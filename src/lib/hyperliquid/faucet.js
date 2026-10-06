import { settings } from "@/stores/settings";
import { getNavioClient } from "@/stores/navio";

function baseUrl() {
  return (settings.faucetUrl || "").trim().replace(/\/+$/, "");
}

/**
 * navio-hl-faucet teklifi: { amountNav, amountSats, navAddress, memo,
 * payout: { usdc, hype }, expiresAt }. Hata kodu Error.message olarak
 * fırlatılır (bkz. bridge.faucet.errors.*).
 */
export async function fetchFaucetQuote(evmAddress) {
  if (!baseUrl()) throw new Error("no_url");
  let res;
  let body;
  try {
    res = await fetch(`${baseUrl()}/quote?address=${encodeURIComponent(evmAddress)}`);
    body = await res.json().catch(() => ({}));
  } catch (e) {
    console.error("[faucet] quote failed:", e);
    throw new Error("network_error");
  }
  if (!res.ok) {
    throw new Error(
      res.status === 409 ? "already_claimed"
      : res.status === 403 ? "not_allowed"
      : res.status === 400 ? "invalid_address"
      : "unavailable"
    );
  }
  // Sunucunun memo'daki adresi bizim adresimizle eşleşmeli; aksi halde
  // USDC/HYPE başka bir adrese gider.
  if (!body.memo || !body.memo.toLowerCase().endsWith(evmAddress.toLowerCase())) {
    throw new Error("bad_quote");
  }
  return body;
}

export const isFaucetQuoteExpired = (quote) => !quote || Date.now() >= quote.expiresAt;

/** Teklifteki tutarı, teklifin memo'suyla gönderir. */
export function sendFaucetPayment(quote) {
  return getNavioClient().sendTransaction({
    address: quote.navAddress,
    amount: BigInt(quote.amountSats),
    memo: quote.memo,
    // Servis tam teklif tutarını bekler; ağ ücreti tutardan düşülmemeli.
    subtractFeeFromAmount: false,
  });
}
