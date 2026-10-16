import { isAddress, getAddress } from "viem";
import { encryptRecord, decryptRecord } from "./crypto.js";
import { getContactsStore as getStore, getContactsKey } from "./session.js";

/**
 * Saved EVM send destinations for Hyperliquid account transfers — each one
 * labelled and tied to the network it was saved for ('hypercore' |
 * 'arbitrum'), since the same 0x address means a different place on each.
 * Stored encrypted next to contacts, in the same per-wallet database.
 */

const RECORD_TYPE = "evmAddresses";
export const EVM_ADDRESS_NETWORKS = ["hypercore", "arbitrum"];

/**
 * The EIP-55 checksummed form of `address` when it's valid but typed in a
 * different case (e.g. all-lowercase from an exchange), else null — lets
 * the UI explain why the saved address looks different.
 */
export function checksumIfChanged(address) {
  const raw = (address ?? "").trim();
  if (!isAddress(raw, { strict: false })) return null;
  const checksummed = getAddress(raw);
  return checksummed === raw ? null : checksummed;
}

/** List saved addresses (decrypted), sorted by label. */
export async function listEvmAddresses() {
  const store = getStore();
  const key = await getContactsKey();
  const rows = await store.list(RECORD_TYPE);
  const settled = await Promise.allSettled(rows.map((row) => decryptRecord(key, row.data)));
  const entries = settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
  return entries.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Create or update a saved address. Throws with a short error code
 * ('label_required' | 'invalid_address' | 'invalid_network' | 'duplicate')
 * the UI can map to a translated message.
 */
export async function saveEvmAddress(input) {
  const label = (input.label ?? "").trim();
  const raw = (input.address ?? "").trim();
  const network = input.network;

  if (!label) throw new Error("label_required");
  if (!isAddress(raw, { strict: false })) throw new Error("invalid_address");
  if (!EVM_ADDRESS_NETWORKS.includes(network)) throw new Error("invalid_network");
  const address = getAddress(raw);

  const existingAll = await listEvmAddresses();
  const clash = existingAll.find(
    (e) => e.id !== input.id && e.network === network && e.address.toLowerCase() === address.toLowerCase()
  );
  if (clash) throw new Error("duplicate");

  const previous = input.id ? existingAll.find((e) => e.id === input.id) : null;
  const now = Date.now();
  const record = {
    id: input.id || crypto.randomUUID(),
    label,
    address,
    network,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    lastUsedAt: previous?.lastUsedAt ?? null,
  };

  const store = getStore();
  const key = await getContactsKey();
  await store.put(RECORD_TYPE, record.id, await encryptRecord(key, record));
  return record;
}

/** Stamp an entry as just used, so the picker can list recent ones first. */
export async function touchEvmAddress(id) {
  const store = getStore();
  const row = await store.get(RECORD_TYPE, id);
  if (!row) return;
  const key = await getContactsKey();
  const record = await decryptRecord(key, row.data);
  record.lastUsedAt = Date.now();
  await store.put(RECORD_TYPE, id, await encryptRecord(key, record));
}

export async function deleteEvmAddress(id) {
  await getStore().delete(RECORD_TYPE, id);
}
