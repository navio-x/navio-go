import { navPrice, fetchNavPrice, getPriceIn } from "@/stores/navPrice";

// Matches the two endpoints navPrice.js actually fetches from.
export const RATE_SOURCE = "blocks.nav.io + frankfurter.dev";

/**
 * Ensure a fiat rate is available for `currency`, fetching if needed, and
 * return the current live NAV price in that currency. Used only to snapshot
 * a rate to lock onto a run — after locking, the run keeps its own frozen
 * value and this live one may keep moving without affecting it.
 */
export async function getLiveRate(currency) {
  let price = getPriceIn(currency);
  if (price == null && !navPrice.loading) {
    await fetchNavPrice();
    price = getPriceIn(currency);
  }
  return price;
}
