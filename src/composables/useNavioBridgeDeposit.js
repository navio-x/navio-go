import { ref } from "vue";
import { getEvmAccount } from "@/composables/useEvmAccount";
import {
  readCoreUserExists,
  readIsRegistered,
  readPaused,
  estimateRegisterGasCost,
  registerCoreUser,
  mapBridgeError,
} from "@/lib/hyperliquid/bridge/contract";
import { deriveDepositAddress } from "@/lib/hyperliquid/bridge/depositAddress";
import { ensureEvmGas } from "@/lib/hyperliquid/bridge/gas";

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

  async function register() {
    errorCode.value = "";
    registering.value = true;
    try {
      const account = getEvmAccount();
      if (!account) throw new Error("wallet_locked");
      if (coreExists.value === false) throw new Error("SenderNotActivated");
      await ensureEvmGas(account, await estimateRegisterGasCost(account), {
        onMoving: () => { registerStep.value = "moving_hype"; },
      });
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
