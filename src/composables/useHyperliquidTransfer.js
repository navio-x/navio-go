import { ref } from "vue";
import { getEvmAccount } from "@/composables/useEvmAccount";
import { sendSpotToAddress, withdrawUsdcToArbitrum } from "@/lib/hyperliquid/exchange";
import { fetchUserAbstraction } from "@/lib/hyperliquid/api";

// Hyperliquid's own bridge charges a flat 1 USDC on every Arbitrum withdrawal.
export const ARBITRUM_WITHDRAW_FEE_USDC = 1;

/**
 * Sends a Hyperliquid spot balance to an EVM address. Two routes:
 *  - "hypercore": sendAsset to the address's Hyperliquid account (any token,
 *    instant, no fee).
 *  - "arbitrum": USDC only, withdraw3 to Arbitrum (1 USDC fee, a few minutes).
 * Same status/errorCode/errorDetail shape as useHyperliquidTrading.
 */
export function useHyperliquidTransfer() {
  const status = ref("idle"); // idle | sending | sent | error
  const errorCode = ref("");
  const errorDetail = ref("");

  function reset() {
    status.value = "idle";
    errorCode.value = "";
    errorDetail.value = "";
  }

  async function send({ route, token, destination, amount }) {
    errorCode.value = "";
    errorDetail.value = "";
    status.value = "sending";
    try {
      const account = getEvmAccount();
      if (!account) throw new Error("wallet_locked");

      if (route === "arbitrum") {
        const abstraction = await fetchUserAbstraction(account.address);
        await withdrawUsdcToArbitrum(account, { destination, amount, abstraction });
      } else {
        await sendSpotToAddress(account, { destination, token, amount });
      }
      status.value = "sent";
    } catch (e) {
      console.error("[hyperliquid] transfer failed:", e);
      status.value = "error";
      errorCode.value = e?.message === "wallet_locked" ? "wallet_locked" : "rejected";
      errorDetail.value = e?.message === "wallet_locked" ? "" : String(e?.message || "");
    }
  }

  return { status, errorCode, errorDetail, send, reset };
}
