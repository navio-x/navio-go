import { encryptRecord, decryptRecord } from "./crypto.js";
import { validateNavioAddress } from "./validation.js";
import { getPayrollStore as getStore, getPayrollKey } from "./session.js";

const RECORD_TYPE = "recipients";

/**
 * List recipients (decrypted). Archived recipients are excluded unless
 * requested — they stay in storage (payment history may still reference
 * them) but are hidden from normal pickers/lists.
 */
export async function listRecipients({ includeArchived = false } = {}) {
  const store = getStore();
  const key = await getPayrollKey();
  const rows = await store.list(RECORD_TYPE);
  // allSettled, not all: one record this wallet's key can't decrypt (e.g.
  // storage corruption, or a foreign-wallet record that slipped in some
  // other way) must not take down the whole list.
  const settled = await Promise.allSettled(rows.map((row) => decryptRecord(key, row.data)));
  const recipients = settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
  const filtered = includeArchived ? recipients : recipients.filter((r) => !r.archived);
  return filtered.sort((a, b) => a.label.localeCompare(b.label));
}

export async function getRecipient(id) {
  const store = getStore();
  const row = await store.get(RECORD_TYPE, id);
  if (!row) return null;
  const key = await getPayrollKey();
  return decryptRecord(key, row.data);
}

/**
 * Create or update a recipient. Throws with a short error code
 * ('label_required' | 'invalid_address') the UI can map to a translated
 * message, rather than a raw Error string.
 */
export async function saveRecipient(input) {
  const label = (input.label ?? "").trim();
  const address = (input.address ?? "").trim();

  if (!label) throw new Error("label_required");
  const addressCheck = validateNavioAddress(address);
  if (!addressCheck.valid) throw new Error("invalid_address");

  const store = getStore();
  const key = await getPayrollKey();
  const now = Date.now();

  const existing = input.id ? await store.get(RECORD_TYPE, input.id) : null;
  const existingRecord = existing ? await decryptRecord(key, existing.data) : null;

  const record = {
    id: input.id || crypto.randomUUID(),
    label,
    address,
    defaultAmount: input.defaultAmount === "" || input.defaultAmount == null ? null : Number(input.defaultAmount),
    currency: input.currency || null,
    groupTag: (input.groupTag ?? "").trim() || null,
    archived: input.archived ?? existingRecord?.archived ?? false,
    createdAt: existingRecord?.createdAt ?? now,
    updatedAt: now,
  };

  const encrypted = await encryptRecord(key, record);
  await store.put(RECORD_TYPE, record.id, encrypted);
  return record;
}

export async function setRecipientArchived(id, archived) {
  const record = await getRecipient(id);
  if (!record) throw new Error("not_found");
  return saveRecipient({ ...record, archived });
}

/** Distinct group tags across active recipients, for group-based selection in payment runs. */
export async function listRecipientGroups() {
  const recipients = await listRecipients({ includeArchived: false });
  return [...new Set(recipients.map((r) => r.groupTag).filter(Boolean))].sort();
}
