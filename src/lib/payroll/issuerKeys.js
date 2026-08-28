import { encryptRecord, decryptRecord } from "./crypto.js";
import { getPayrollStore, getPayrollKey } from "./session.js";
import { publicKeyFingerprint } from "./receiptCrypto.js";

const RECORD_TYPE = "issuer_keys";

/**
 * Trust-on-first-use store for receipt issuers, keyed by the employer label
 * a receipt self-reports (normalised). This is deliberately independent of
 * Employer mode and of any particular run/recipient — it's the recipient's
 * own record of "keys I've seen claiming to be this employer", used by the
 * verification screen (see checkIssuer) regardless of whether this device
 * ever runs payroll itself.
 *
 * Persisted through the same encrypted payroll store as everything else
 * (per-wallet, HKDF-derived key) — not because it's secret (public keys
 * aren't), but because it's the storage adapter this app already has.
 */

function normalizeLabel(label) {
  return (label ?? "").trim().toLowerCase();
}

async function listAll() {
  const store = getPayrollStore();
  const key = await getPayrollKey();
  const rows = await store.list(RECORD_TYPE);
  const settled = await Promise.allSettled(rows.map((row) => decryptRecord(key, row.data)));
  return settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
}

export async function listIssuerKeys() {
  const all = await listAll();
  return all.sort((a, b) => a.employerLabel.localeCompare(b.employerLabel));
}

async function findByLabel(employerLabel) {
  const all = await listAll();
  const norm = normalizeLabel(employerLabel);
  return all.find((r) => normalizeLabel(r.employerLabel) === norm) || null;
}

/**
 * Compare a receipt's (employerLabel, employerPublicKey) against what's
 * been trusted before for that label.
 *
 * @returns {Promise<{status: 'unknown'|'trusted'|'key_changed', record: object|null, fingerprint: string}>}
 *  - 'unknown': first time this label has been seen on this device — nothing
 *    to warn about yet, but nothing to vouch for either.
 *  - 'trusted': matches the public key already recorded for this label.
 *  - 'key_changed': this label was seen before, signed by a *different* key
 *    — the case the spec calls out to warn on.
 */
export async function checkIssuer({ employerLabel, employerPublicKey }) {
  const fingerprint = await publicKeyFingerprint(employerPublicKey);
  const existing = await findByLabel(employerLabel);
  if (!existing) {
    return { status: "unknown", record: null, fingerprint };
  }
  if (existing.publicKeyHex.toLowerCase() === (employerPublicKey || "").toLowerCase()) {
    return { status: "trusted", record: existing, fingerprint };
  }
  return { status: "key_changed", record: existing, fingerprint };
}

/**
 * Trust a (label, key) pair — called when the user accepts a new issuer or
 * knowingly accepts a changed key. `userLabel` is the user's own note
 * (defaults to the employer's self-reported label); overwrites any prior
 * record for the same normalised employer label.
 */
export async function trustIssuerKey({ employerLabel, employerPublicKey, userLabel }) {
  if (!employerLabel?.trim()) throw new Error("employer_label_required");
  if (!employerPublicKey?.trim()) throw new Error("employer_public_key_required");

  const store = getPayrollStore();
  const key = await getPayrollKey();
  const existing = await findByLabel(employerLabel);
  const now = Date.now();

  const record = {
    id: existing?.id || crypto.randomUUID(),
    employerLabel: employerLabel.trim(),
    publicKeyHex: employerPublicKey.trim().toLowerCase(),
    userLabel: (userLabel ?? existing?.userLabel ?? employerLabel).trim(),
    firstSeenAt: existing?.firstSeenAt ?? now,
    updatedAt: now,
  };

  await store.put(RECORD_TYPE, record.id, await encryptRecord(key, record));
  return record;
}
