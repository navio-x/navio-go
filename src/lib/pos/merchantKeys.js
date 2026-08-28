import { encryptRecord, decryptRecord } from "./crypto.js";
import { getMerchantStore, getMerchantStorageKey } from "./session.js";
import { publicKeyFingerprint } from "./merchantCrypto.js";

const RECORD_TYPE = "merchant_keys";

/**
 * Trust-on-first-use store for POS payment requests, keyed by the merchant
 * label a request self-reports (normalised). Mirrors
 * src/lib/payroll/issuerKeys.js exactly — same shape, same checkX/trustX
 * API — duplicated rather than imported for the same no-cross-feature-
 * coupling reason as the rest of src/lib/pos.
 *
 * This is deliberately just a local memory of "keys I've seen claiming to
 * be this merchant" — there is no registry, no verification that a given
 * key actually belongs to the named business. See checkMerchant's docs.
 */

function normalizeLabel(label) {
  return (label ?? "").trim().toLowerCase();
}

async function listAll() {
  const store = getMerchantStore();
  const key = await getMerchantStorageKey();
  const rows = await store.list(RECORD_TYPE);
  const settled = await Promise.allSettled(rows.map((row) => decryptRecord(key, row.data)));
  return settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
}

export async function listMerchantKeys() {
  const all = await listAll();
  return all.sort((a, b) => a.label.localeCompare(b.label));
}

async function findByLabel(label) {
  const all = await listAll();
  const norm = normalizeLabel(label);
  return all.find((r) => normalizeLabel(r.label) === norm) || null;
}

/**
 * Compare a scanned request's (label, publicKeyHex) against what's been
 * trusted before for that label, on this device.
 *
 * @returns {Promise<{status: 'unknown'|'trusted'|'key_changed', record: object|null, fingerprint: string}>}
 *  - 'unknown': first time this label has been seen on this device — nothing
 *    to warn about yet, but nothing to vouch for either (trust-on-first-use).
 *  - 'trusted': matches the public key already recorded for this label.
 *  - 'key_changed': this label was seen before, signed by a *different* key
 *    — the case the spec calls out to warn on before paying.
 */
export async function checkMerchant({ label, publicKeyHex }) {
  const fingerprint = await publicKeyFingerprint(publicKeyHex);
  const existing = await findByLabel(label);
  if (!existing) {
    return { status: "unknown", record: null, fingerprint };
  }
  if (existing.publicKeyHex.toLowerCase() === (publicKeyHex || "").toLowerCase()) {
    return { status: "trusted", record: existing, fingerprint };
  }
  return { status: "key_changed", record: existing, fingerprint };
}

/**
 * Trust a (label, key) pair — called when the customer approves payment to
 * a new merchant, or knowingly accepts a changed key. `userLabel` is the
 * user's own note (defaults to the merchant's self-reported label);
 * overwrites any prior record for the same normalised label.
 */
export async function trustMerchantKey({ label, publicKeyHex, userLabel }) {
  if (!label?.trim()) throw new Error("label_required");
  if (!publicKeyHex?.trim()) throw new Error("public_key_required");

  const store = getMerchantStore();
  const key = await getMerchantStorageKey();
  const existing = await findByLabel(label);
  const now = Date.now();

  const record = {
    id: existing?.id || crypto.randomUUID(),
    label: label.trim(),
    publicKeyHex: publicKeyHex.trim().toLowerCase(),
    userLabel: (userLabel ?? existing?.userLabel ?? label).trim(),
    firstSeenAt: existing?.firstSeenAt ?? now,
    updatedAt: now,
  };

  await store.put(RECORD_TYPE, record.id, await encryptRecord(key, record));
  return record;
}
