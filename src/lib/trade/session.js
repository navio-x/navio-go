import { createTradeStore } from "./storage/index.js";
import { deriveTradeKey } from "./crypto.js";
import { getNavioClient, walletName } from "@/stores/navio";
import { slugify } from "@/stores/wallet_management";

function currentWalletId() {
  const name = walletName.value;
  if (!name) throw new Error("No wallet loaded");
  return slugify(name);
}

export function getTradeStore() {
  return createTradeStore(currentWalletId());
}

/** Derived fresh from the live wallet seed each call — never cached to disk. */
export async function getTradeKey() {
  const client = getNavioClient();
  if (!client) throw new Error("Wallet not ready");
  const keyManager = client.getKeyManager();
  const seedHex = keyManager.getMasterSeedHex();
  return deriveTradeKey(seedHex);
}
