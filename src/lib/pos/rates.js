/**
 * Thin fiat-rate helper for POS, mirroring src/lib/payroll/rates.js exactly
 * (same two-line body) — duplicated rather than imported for the same
 * no-cross-feature-coupling reason as merchantCrypto.js. Both build on the
 * shared, non-payroll-specific src/stores/navPrice.js.
 */
import { navPrice, fetchNavPrice, getPriceIn } from "@/stores/navPrice";

export const RATE_SOURCE = "blocks.nav.io + frankfurter.dev";

/**
 * Ensure a fiat rate is available for `currency`, fetching if needed, and
 * return the current live NAV price in that currency. Used only to snapshot
 * a rate to lock onto a payment request — after locking, the request keeps
 * its own frozen value and this live one may keep moving without affecting it.
 */
export async function getLiveRate(currency) {
  let price = getPriceIn(currency);
  if (price == null && !navPrice.loading) {
    await fetchNavPrice();
    price = getPriceIn(currency);
  }
  return price;
}
