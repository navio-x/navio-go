import { ref } from "vue";
import { parseUnits, formatUnits } from "viem";
import { getEvmAccount } from "@/composables/useEvmAccount";
import { evmAddress } from "@/stores/evm";
import {
  readIsRegistered,
  readMinBurnValue,
  readPaused,
  readNavEvmBalance,
  readHypeBalance,
  burnWithNote,
  mapBridgeError,
} from "@/lib/hyperliquid/bridge/contract";
import { spotSendNavToEvm } from "@/lib/hyperliquid/exchange";
import { encryptWithdrawalNote } from "@/lib/hyperliquid/bridge/noteEncryption";
import { parseStrictAmount } from "@/lib/hyperliquid/bridge/amount";
import { NAV_DECIMALS } from "@/lib/hyperliquid/bridge/config";
import { getSpotMeta, resolveTokens } from "@/lib/hyperliquid/meta";
import { fetchSpotClearinghouseState } from "@/lib/hyperliquid/api";

/**
 * HyperCore → Navio withdrawal flow. NAV must be on HyperEVM as the ERC20
 * before burnWithNote() will accept it — if it's still on Core, spotSend
 * moves it to the bridge's system address first. The Navio destination is
 * encrypted client-side (SPEC 2) and never sent anywhere in plaintext.
 */
export function useNavioBridgeWithdraw() {
  const navOnEvm = ref(0n); // raw base units, 8 decimals
  const navOnCore = ref(0n);
  const hypeBalance = ref(0n);
  const minBurnValueRaw = ref(0n);
  const bridgePaused = ref(false);
  const coreActivated = ref(null);
  const loading = ref(false);
  const moving = ref(false); // spotSend Core -> EVM in progress
  const moveErrorCode = ref("");
  const moveErrorDetail = ref(""); // raw SDK/API message, moveCoreToEvm's own errors — kept separate from withdraw's so the UI can show each next to the action that caused it
  const status = ref("idle"); // idle | encrypting | burning | done | error
  const errorCode = ref("");
  const errorDetail = ref("");

  async function refreshBalances() {
    if (!evmAddress.value) return;
    loading.value = true;
    errorCode.value = "";
    try {
      const meta = await getSpotMeta();
      const resolved = resolveTokens(meta);
      const nav = resolved.find((t) => t.symbol === "NAV");

      const [evmBal, hype, minBurn, paused, registered, coreState] = await Promise.all([
        readNavEvmBalance(evmAddress.value),
        readHypeBalance(evmAddress.value),
        readMinBurnValue(),
        readPaused(),
        readIsRegistered(evmAddress.value),
        fetchSpotClearinghouseState(evmAddress.value),
      ]);

      navOnEvm.value = evmBal;
      hypeBalance.value = hype;
      minBurnValueRaw.value = minBurn;
      bridgePaused.value = paused;
      // Registered with the bridge (register()), not merely a HyperCore account.
      coreActivated.value = registered;

      if (nav?.index != null) {
        const bal = coreState.balances?.find((b) => b.token === nav.index);
        navOnCore.value = bal ? parseUnits(bal.total, nav.weiDecimals) : 0n;
      } else {
        navOnCore.value = 0n;
      }
    } catch (e) {
      console.error("[bridge] withdraw balance refresh failed:", e);
      errorCode.value = mapBridgeError(e);
    } finally {
      loading.value = false;
    }
  }

  /** Moves the full Core NAV balance to HyperEVM so it can be burned. */
  async function moveCoreToEvm() {
    moveErrorCode.value = "";
    moveErrorDetail.value = "";
    moving.value = true;
    try {
      const account = getEvmAccount();
      if (!account) throw new Error("wallet_locked");
      if (navOnCore.value <= 0n) throw new Error("nothing_to_move");
      const amountStr = formatUnits(navOnCore.value, NAV_DECIMALS);
      const result = await spotSendNavToEvm(account, amountStr);
      console.log("[bridge] spotSend Core->EVM result:", result);
      await refreshBalances();
    } catch (e) {
      console.error("[bridge] spotSend Core->EVM failed:", e);
      moveErrorCode.value = mapBridgeError(e);
      moveErrorDetail.value = e?.message && moveErrorCode.value === "unknown" ? String(e.message) : "";
    } finally {
      moving.value = false;
    }
  }

  /**
   * `amountInput` is the raw form string (comma or dot decimal) —
   * validated here, not by the caller, per the task's explicit warning
   * about silently mis-parsing amounts. `destination` is the plaintext
   * Navio address; it and the intermediate ciphertext never leave this
   * function except inside the signed burnWithNote() call itself.
   */
  async function withdraw({ amountInput, destination }) {
    errorCode.value = "";
    errorDetail.value = "";
    status.value = "encrypting";
    try {
      const account = getEvmAccount();
      if (!account) throw new Error("wallet_locked");

      const parsed = parseStrictAmount(amountInput);
      if (!parsed) throw new Error("invalid_amount");
      const valueRaw = parseUnits(parsed.normalized, NAV_DECIMALS);
      if (valueRaw < minBurnValueRaw.value) throw new Error("below_minimum");
      if (valueRaw > navOnEvm.value) throw new Error("insufficient_balance");

      const note = encryptWithdrawalNote(destination, account.address);

      status.value = "burning";
      const receipt = await burnWithNote(account, valueRaw, note);
      console.log("[bridge] burnWithNote receipt:", receipt);
      status.value = "done";
      await refreshBalances();
    } catch (e) {
      console.error("[bridge] withdraw failed:", e);
      status.value = "error";
      errorCode.value = mapBridgeError(e);
      errorDetail.value = errorCode.value === "unknown" && e?.message ? String(e.message) : "";
    }
  }

  function reset() {
    status.value = "idle";
    errorCode.value = "";
    errorDetail.value = "";
  }

  return {
    navOnEvm,
    navOnCore,
    hypeBalance,
    minBurnValueRaw,
    bridgePaused,
    coreActivated,
    loading,
    moving,
    moveErrorCode,
    moveErrorDetail,
    status,
    errorCode,
    errorDetail,
    refreshBalances,
    moveCoreToEvm,
    withdraw,
    reset,
  };
}
