import { ref } from "vue";
import { getEvmAccount } from "@/composables/useEvmAccount";
import { placeSpotOrder, cancelSpotOrder } from "@/lib/hyperliquid/exchange";
import { roundPrice, roundSize } from "@/lib/hyperliquid/precision";

/**
 * Order placement/cancellation for a resolved Hyperliquid spot market.
 * Mirrors usePancakeSwap's status/errorCode shape for UI consistency, even
 * though the underlying signing is completely different (Hyperliquid L1
 * action, not an ERC20 approve/router swap).
 */
export function useHyperliquidTrading() {
  const status = ref("idle"); // idle | placing | placed | cancelling | error
  const errorCode = ref("");
  // Raw message text from the exchange's own rejection or the SDK/network
  // exception — shown under the translated errorCode headline so a
  // rejection's actual reason is never just "something went wrong".
  const errorDetail = ref("");
  const lastOrder = ref(null); // { oid } | null — most recent resting order, if any

  function reset() {
    status.value = "idle";
    errorCode.value = "";
    errorDetail.value = "";
    lastOrder.value = null;
  }

  /**
   * `market` is a resolved market object (coin/pairIndex/baseSzDecimals) from
   * lib/hyperliquid/market.js. `side` is "buy" | "sell". For a market order,
   * pass `price` already slippage-adjusted (best ask/bid ± tolerance) — this
   * function only handles rounding to the asset's tick/lot size, not slippage.
   */
  async function placeOrder({ market, side, price, size, orderType }) {
    errorCode.value = "";
    errorDetail.value = "";
    status.value = "placing";
    try {
      const account = getEvmAccount();
      if (!account) throw new Error("wallet_locked");

      const roundedPrice = roundPrice(price, market.baseSzDecimals);
      const roundedSize = roundSize(size, market.baseSzDecimals);
      if (!roundedPrice) throw new Error("invalid_price");
      if (!roundedSize) throw new Error("invalid_size");

      const tif = orderType === "market" ? "Ioc" : "Gtc";
      const result = await placeSpotOrder(account, {
        pairIndex: market.pairIndex,
        isBuy: side === "buy",
        price: roundedPrice,
        size: roundedSize,
        tif,
      });

      const orderStatus = result?.response?.data?.statuses?.[0];
      if (orderStatus?.error) throw exchangeRejection(orderStatus.error);

      lastOrder.value = orderStatus?.resting ? { oid: orderStatus.resting.oid } : null;
      status.value = "placed";
    } catch (e) {
      console.error("[hyperliquid] place order failed:", e);
      status.value = "error";
      errorCode.value = mapErrorCode(e);
      errorDetail.value = extractDetail(e);
    }
  }

  async function cancelOrder({ market, oid }) {
    errorCode.value = "";
    errorDetail.value = "";
    status.value = "cancelling";
    try {
      const account = getEvmAccount();
      if (!account) throw new Error("wallet_locked");

      const result = await cancelSpotOrder(account, { pairIndex: market.pairIndex, oid });
      const cancelStatus = result?.response?.data?.statuses?.[0];
      if (cancelStatus?.error) throw exchangeRejection(cancelStatus.error);

      status.value = "idle";
    } catch (e) {
      console.error("[hyperliquid] cancel order failed:", e);
      status.value = "error";
      errorCode.value = mapErrorCode(e);
      errorDetail.value = extractDetail(e);
    }
  }

  return { status, errorCode, errorDetail, lastOrder, placeOrder, cancelOrder, reset };
}

/** An Error whose message is a translated bucket, carrying the exchange's own rejection text as `.detail`. */
function exchangeRejection(rawMessage) {
  const err = new Error(mapExchangeError(rawMessage));
  err.detail = rawMessage;
  return err;
}

function mapExchangeError(message) {
  const msg = String(message || "").toLowerCase();
  if (msg.includes("insufficient")) return "insufficient_balance";
  if (msg.includes("minimum")) return "order_too_small";
  if (msg.includes("tick") || msg.includes("price")) return "invalid_price";
  if (msg.includes("reduce")) return "reduce_only";
  return "exchange_rejected";
}

// Codes whose translated headline (market.orderErrors.*) already fully
// explains the problem — no raw SDK/exchange text needed underneath.
const SELF_EXPLANATORY = new Set(["wallet_locked", "invalid_price", "invalid_size"]);

/** Prefers the exchange's own rejection text; otherwise the SDK/network exception's own message. */
function extractDetail(e) {
  if (e?.detail) return String(e.detail);
  if (e?.message && !SELF_EXPLANATORY.has(e.message)) return String(e.message);
  return "";
}

function mapErrorCode(e) {
  if (e?.message === "wallet_locked") return "wallet_locked";
  if (e?.message === "invalid_price") return "invalid_price";
  if (e?.message === "invalid_size") return "invalid_size";
  if (
    e?.message === "insufficient_balance" ||
    e?.message === "order_too_small" ||
    e?.message === "reduce_only" ||
    e?.message === "exchange_rejected"
  ) {
    return e.message;
  }
  return "unknown";
}
