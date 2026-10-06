import { ref } from "vue";
import { fetchFaucetQuote, isFaucetQuoteExpired, sendFaucetPayment } from "@/lib/hyperliquid/faucet";

/**
 * navio-hl-faucet: NAV gönder, HyperCore'da USDC + HYPE al. Servis teklifi
 * (tutar, Navio adresi, memo) bir süre sabit tutar; gönderim o memo ile
 * yapılmalı — servis ödemeyi memo'daki EVM adresine yapar.
 */
export function useHlFaucet() {
  const quote = ref(null);
  const loading = ref(false);
  const sending = ref(false);
  const errorCode = ref("");
  const txId = ref("");

  async function fetchQuote(evmAddress) {
    errorCode.value = "";
    quote.value = null;
    loading.value = true;
    try {
      quote.value = await fetchFaucetQuote(evmAddress);
      return quote.value;
    } catch (e) {
      errorCode.value = e.message;
      return null;
    } finally {
      loading.value = false;
    }
  }

  const isExpired = () => isFaucetQuoteExpired(quote.value);

  async function send() {
    if (!quote.value) return null;
    errorCode.value = "";
    sending.value = true;
    try {
      const result = await sendFaucetPayment(quote.value);
      txId.value = result?.txId || "";
      return result;
    } catch (e) {
      console.error("[faucet] send failed:", e);
      errorCode.value = "send_failed";
      throw e;
    } finally {
      sending.value = false;
    }
  }

  function reset() {
    quote.value = null;
    errorCode.value = "";
    txId.value = "";
  }

  return { quote, loading, sending, errorCode, txId, fetchQuote, isExpired, send, reset };
}
