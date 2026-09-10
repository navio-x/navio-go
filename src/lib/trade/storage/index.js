import { IndexedDbTradeStore } from "./indexedDbStore.js";

/** Same pattern as payroll's storage/index.js — kept behind a factory so
 * callers don't need to know the concrete backend. */
export function createTradeStore(walletId) {
  return new IndexedDbTradeStore(walletId);
}
