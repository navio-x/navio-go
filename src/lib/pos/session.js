import { deriveMerchantSigningKeypair } from "./merchantCrypto.js";
import { deriveMerchantStorageKey } from "./crypto.js";
import { createMerchantStore } from "./storage/index.js";
import { getNavioClient, walletName } from "@/stores/navio";
import { slugify } from "@/stores/wallet_management";

/** Derived fresh from the live wallet seed each call — never cached to disk. */
export async function getMerchantSigningKeypair() {
  const client = getNavioClient();
  if (!client) throw new Error("Wallet not ready");
  const keyManager = client.getKeyManager();
  const seedHex = keyManager.getMasterSeedHex();
  return deriveMerchantSigningKeypair(seedHex);
}

function currentWalletId() {
  const name = walletName.value;
  if (!name) throw new Error("No wallet loaded");
  return slugify(name);
}

export function getMerchantStore() {
  return createMerchantStore(currentWalletId());
}

/** Derived fresh from the live wallet seed each call — never cached to disk. */
export async function getMerchantStorageKey() {
  const client = getNavioClient();
  if (!client) throw new Error("Wallet not ready");
  const keyManager = client.getKeyManager();
  const seedHex = keyManager.getMasterSeedHex();
  return deriveMerchantStorageKey(seedHex);
}
