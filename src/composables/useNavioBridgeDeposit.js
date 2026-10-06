import { ref } from "vue";
import { parseUnits, formatUnits } from "viem";
import { getEvmAccount } from "@/composables/useEvmAccount";
import {
  readCoreUserExists,
  readIsRegistered,
  readPaused,
  readHypeBalance,
  estimateRegisterGasCost,
  registerCoreUser,
  mapBridgeError,
} from "@/lib/hyperliquid/bridge/contract";
import { deriveDepositAddress } from "@/lib/hyperliquid/bridge/depositAddress";
import { fetchSpotClearinghouseState } from "@/lib/hyperliquid/api";
import { spotSendHypeToEvm } from "@/lib/hyperliquid/exchange";

// Most HYPE moved Core -> EVM for register() gas; anything above stays on Core.
const MAX_HYPE_TO_MOVE = 0.01;
const HYPE_CORE_DECIMALS = 8;
const EVM_CREDIT_TIMEOUT_MS = 60_000;
const EVM_CREDIT_POLL_MS = 3_000;

/**
 * Navio → HyperCore deposit flow. The bridge only watches deposit addresses
 * of addresses that called register() on the contract — a HyperCore account
 * alone (coreUserExists, e.g. created by receiving a transfer) is not enough,
 * and deposits to an unregistered address are not credited. So the deposit
 * address (SPEC 1, pure/deterministic) is only shown once `registered` is true.
 */
export function useNavioBridgeDeposit(evmAddress) {
  const coreExists = ref(null); // HyperCore account exists (needed before register())
  const coreActivated = ref(null); // registered with the bridge; null = not checked yet
  const bridgePaused = ref(false);
  const depositAddress = ref(null);
  const checking = ref(false);
  const registering = ref(false);
  const registerStep = ref(""); // "" | "moving_hype" | "registering"
  const errorCode = ref("");

  async function check() {
    if (!evmAddress.value) return;
    checking.value = true;
    errorCode.value = "";
    try {
      const [exists, registered, paused] = await Promise.all([
        readCoreUserExists(evmAddress.value),
        readIsRegistered(evmAddress.value),
        readPaused(),
      ]);
      coreExists.value = exists;
      coreActivated.value = registered;
      bridgePaused.value = paused;
      depositAddress.value = registered ? deriveDepositAddress(evmAddress.value).bech32mAddress : null;
    } catch (e) {
      console.error("[bridge] deposit check failed:", e);
      errorCode.value = mapBridgeError(e);
    } finally {
      checking.value = false;
    }
  }

  /**
   * register() costs HYPE gas on HyperEVM. If the EVM side can't cover it but
   * HyperCore spot holds HYPE (e.g. from the faucet), move some over first.
   */
  async function ensureEvmGas(account) {
    const needed = await estimateRegisterGasCost(account);
    const evmHype = await readHypeBalance(account.address);
    if (evmHype >= needed) return;

    const state = await fetchSpotClearinghouseState(account.address);
    const bal = state.balances?.find((b) => b.coin === "HYPE");
    const coreHype = bal ? Number(bal.total) - Number(bal.hold) : 0;
    if (!(coreHype > 0)) throw new Error("no_hype_for_gas");

    const amount = Math.min(coreHype, MAX_HYPE_TO_MOVE);
    const amountStr = formatUnits(parseUnits(amount.toFixed(HYPE_CORE_DECIMALS), HYPE_CORE_DECIMALS), HYPE_CORE_DECIMALS);
    registerStep.value = "moving_hype";
    await spotSendHypeToEvm(account, amountStr);

    const deadline = Date.now() + EVM_CREDIT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, EVM_CREDIT_POLL_MS));
      if ((await readHypeBalance(account.address)) >= needed) return;
    }
    throw new Error("hype_move_timeout");
  }

  async function register() {
    errorCode.value = "";
    registering.value = true;
    try {
      const account = getEvmAccount();
      if (!account) throw new Error("wallet_locked");
      if (coreExists.value === false) throw new Error("SenderNotActivated");
      await ensureEvmGas(account);
      registerStep.value = "registering";
      await registerCoreUser(account);
      await check();
    } catch (e) {
      console.error("[bridge] register failed:", e);
      errorCode.value = mapBridgeError(e);
    } finally {
      registering.value = false;
      registerStep.value = "";
    }
  }

  return {
    coreExists,
    coreActivated,
    bridgePaused,
    depositAddress,
    checking,
    registering,
    registerStep,
    errorCode,
    check,
    register,
  };
}
