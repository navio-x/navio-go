import { ref } from "vue";
import { settings } from "@/stores/settings";
import { getNavioClient } from "@/stores/navio";

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

  function baseUrl() {
    return (settings.faucetUrl || "").trim().replace(/\/+$/, "");
  }

  async function fetchQuote(evmAddress) {
    errorCode.value = "";
    quote.value = null;
    if (!baseUrl()) {
      errorCode.value = "no_url";
      return null;
    }
    loading.value = true;
    try {
      const res = await fetch(`${baseUrl()}/quote?address=${encodeURIComponent(evmAddress)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        errorCode.value =
          res.status === 409 ? "already_claimed"
          : res.status === 403 ? "not_allowed"
          : res.status === 400 ? "invalid_address"
          : "unavailable";
        return null;
      }
      // Sunucunun memo'daki adresi bizim adresimizle eşleşmeli; aksi halde
      // USDC/HYPE başka bir adrese gider.
      if (!body.memo || !body.memo.toLowerCase().endsWith(evmAddress.toLowerCase())) {
        errorCode.value = "bad_quote";
        return null;
      }
      quote.value = body;
      return body;
    } catch (e) {
      console.error("[faucet] quote failed:", e);
      errorCode.value = "network_error";
      return null;
    } finally {
      loading.value = false;
    }
  }

  const isExpired = () => !quote.value || Date.now() >= quote.value.expiresAt;

  async function send() {
    if (!quote.value) return null;
    errorCode.value = "";
    sending.value = true;
    try {
      const result = await getNavioClient().sendTransaction({
        address: quote.value.navAddress,
        amount: BigInt(quote.value.amountSats),
        memo: quote.value.memo,
        // Servis tam teklif tutarını bekler; ağ ücreti tutardan düşülmemeli.
        subtractFeeFromAmount: false,
      });
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
