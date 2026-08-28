import { createPayrollStore } from "./storage/index.js";
import { derivePayrollKey } from "./crypto.js";
import { getNavioClient, walletName } from "@/stores/navio";
import { slugify } from "@/stores/wallet_management";

function currentWalletId() {
  const name = walletName.value;
  if (!name) throw new Error("No wallet loaded");
  return slugify(name);
}

export function getPayrollStore() {
  return createPayrollStore(currentWalletId());
}

/** Derived fresh from the live wallet seed each call — never cached to disk. */
export async function getPayrollKey() {
  const client = getNavioClient();
  if (!client) throw new Error("Wallet not ready");
  const keyManager = client.getKeyManager();
  const seedHex = keyManager.getMasterSeedHex();
  return derivePayrollKey(seedHex);
}
