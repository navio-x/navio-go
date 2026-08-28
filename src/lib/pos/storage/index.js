import { IndexedDbMerchantStore } from "./indexedDbStore.js";

/**
 * Single storage backend (IndexedDB) used on both web and Capacitor native,
 * matching the wallet's own storage. Kept behind a factory function, not a
 * direct import, so callers don't need to know the concrete backend — same
 * shape as src/lib/payroll/storage/index.js.
 */
export function createMerchantStore(walletId) {
  return new IndexedDbMerchantStore(walletId);
}
