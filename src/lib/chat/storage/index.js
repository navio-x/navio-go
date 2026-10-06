import { IndexedDbChatHistoryStore } from "./indexedDbStore.js";

export function createChatHistoryStore(walletId) {
  return new IndexedDbChatHistoryStore(walletId);
}
