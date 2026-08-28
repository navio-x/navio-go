import { IndexedDbPayrollStore } from "./indexedDbStore.js";

/**
 * Single storage backend (IndexedDB) used on both web and Capacitor native,
 * matching the wallet's own storage (see src/stores/navio.js). Kept behind
 * a factory function, not a direct import, so callers don't need to know
 * the concrete backend.
 */
export function createPayrollStore(walletId) {
  return new IndexedDbPayrollStore(walletId);
}
