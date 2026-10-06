import { createContactsStore } from "./storage/index.js";
import { deriveContactsKey } from "./crypto.js";
import { getNavioClient, walletName } from "@/stores/navio";
import { slugify } from "@/stores/wallet_management";

function currentWalletId() {
  const name = walletName.value;
  if (!name) throw new Error("No wallet loaded");
  return slugify(name);
}

export function getContactsStore() {
  return createContactsStore(currentWalletId());
}

/** Derived fresh from the live wallet seed each call — never cached to disk. */
export async function getContactsKey() {
  const client = getNavioClient();
  if (!client) throw new Error("Wallet not ready");
  const keyManager = client.getKeyManager();
  const seedHex = keyManager.getMasterSeedHex();
  return deriveContactsKey(seedHex);
}
