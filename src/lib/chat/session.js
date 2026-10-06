import { createChatHistoryStore } from "./storage/index.js";
import { deriveChatIdentitySeed, deriveChatHistoryKey } from "./crypto.js";
import { getNavioClient, walletName } from "@/stores/navio";
import { slugify } from "@/stores/wallet_management";
import { settings } from "@/stores/settings";

function currentWalletId() {
  const name = walletName.value;
  if (!name) throw new Error("No wallet loaded");
  return slugify(name);
}

export function getChatHistoryStore() {
  return createChatHistoryStore(currentWalletId());
}

/** Derived fresh from the live wallet seed each call — never cached to disk. */
export async function getChatHistoryKey() {
  const client = getNavioClient();
  if (!client) throw new Error("Wallet not ready");
  const keyManager = client.getKeyManager();
  const seedHex = keyManager.getMasterSeedHex();
  return deriveChatHistoryKey(seedHex);
}

/** The 32-byte seed handed to MessagingClient.create — never cached to disk. */
export async function getChatIdentitySeed() {
  const client = getNavioClient();
  if (!client) throw new Error("Wallet not ready");
  const keyManager = client.getKeyManager();
  const seedHex = keyManager.getMasterSeedHex();
  return deriveChatIdentitySeed(seedHex);
}

/** navio-p2pmsg's own protocol-state DB name (keys/contacts/outbox) — distinct
 * from the app's message-history DB (see storage/indexedDbStore.js). */
export function chatProtocolStoreName() {
  return `navio-p2pmsg-${currentWalletId()}`;
}

/**
 * The p2pmsg bus's network selects the P2P magic bytes, so it must match
 * whatever chain the configured relay peer (settings.chatPeers) actually
 * runs — not necessarily the wallet's own blockchain network. A wrong match
 * connects fine (WS handshake succeeds) but the node immediately drops the
 * link on the first message ("Wrong MessageStart") once it sees the other
 * chain's magic, which surfaces to the browser as a bare WS close (code
 * 1006). settings.chatNetwork lets testing against a local regtest/testnet
 * relay override the default of following the wallet's own network.
 */
export function currentChatNetwork() {
  return settings.chatNetwork || sessionStorage.getItem("network") || "testnet";
}
