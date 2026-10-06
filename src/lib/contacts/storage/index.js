import { IndexedDbContactsStore } from "./indexedDbStore.js";

/**
 * Single storage backend (IndexedDB), matching payroll/trade. Kept behind a
 * factory function, not a direct import, so callers don't need to know the
 * concrete backend.
 */
export function createContactsStore(walletId) {
  return new IndexedDbContactsStore(walletId);
}
