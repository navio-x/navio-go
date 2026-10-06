import { encryptRecord, decryptRecord } from "./crypto.js";
import { validateNavioAddress, validateP2pAddress } from "./validation.js";
import { getContactsStore as getStore, getContactsKey } from "./session.js";

const RECORD_TYPE = "contacts";

function displayName(c) {
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || c.email || c.phone || c.p2pAddress || c.receiveAddress;
}

/** List contacts (decrypted), sorted by display name. */
export async function listContacts() {
  const store = getStore();
  const key = await getContactsKey();
  const rows = await store.list(RECORD_TYPE);
  // allSettled: a record this wallet's key can't decrypt must not take down
  // the whole list (same reasoning as payroll's listRecipients).
  const settled = await Promise.allSettled(rows.map((row) => decryptRecord(key, row.data)));
  const contacts = settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
  return contacts.sort((a, b) => displayName(a).localeCompare(displayName(b)));
}

export async function getContact(id) {
  const store = getStore();
  const row = await store.get(RECORD_TYPE, id);
  if (!row) return null;
  const key = await getContactsKey();
  return decryptRecord(key, row.data);
}

/**
 * Create or update a contact. Throws with a short error code
 * ('name_required' | 'invalid_receive_address' | 'invalid_p2p_address')
 * the UI can map to a translated message.
 */
export async function saveContact(input) {
  const firstName = (input.firstName ?? "").trim();
  const lastName = (input.lastName ?? "").trim();
  const email = (input.email ?? "").trim();
  const phone = (input.phone ?? "").trim();
  const receiveAddress = (input.receiveAddress ?? "").trim();
  const p2pAddress = (input.p2pAddress ?? "").trim();
  const note = (input.note ?? "").trim();

  if (!firstName && !lastName) throw new Error("name_required");
  if (receiveAddress) {
    const check = validateNavioAddress(receiveAddress);
    if (!check.valid) throw new Error("invalid_receive_address");
  }
  if (p2pAddress) {
    const check = await validateP2pAddress(p2pAddress);
    if (!check.valid) throw new Error("invalid_p2p_address");
  }

  const store = getStore();
  const key = await getContactsKey();
  const now = Date.now();

  const existing = input.id ? await store.get(RECORD_TYPE, input.id) : null;
  const existingRecord = existing ? await decryptRecord(key, existing.data) : null;

  // A p2p address that's new or changed means a fresh request needs
  // sending (see client.js's sendContactRequest, called by the form after
  // this resolves) — reset the accept/reject state so a stale notice from
  // a previous address doesn't linger. Editing anything else about an
  // already-requested contact leaves its request status alone.
  const p2pAddressChanged = p2pAddress !== (existingRecord?.p2pAddress || "");
  const requestStatus = p2pAddressChanged ? (p2pAddress ? "pending" : null) : (existingRecord?.requestStatus ?? null);
  const requestNoticeDismissed = p2pAddressChanged ? true : (existingRecord?.requestNoticeDismissed ?? true);

  const record = {
    id: input.id || crypto.randomUUID(),
    firstName,
    lastName,
    email: email || null,
    phone: phone || null,
    receiveAddress: receiveAddress || null,
    p2pAddress: p2pAddress || null,
    note: note || null,
    requestStatus,
    requestNoticeDismissed,
    createdAt: existingRecord?.createdAt ?? now,
    updatedAt: now,
  };

  const encrypted = await encryptRecord(key, record);
  await store.put(RECORD_TYPE, record.id, encrypted);
  return record;
}

export async function deleteContact(id) {
  const store = getStore();
  await store.delete(RECORD_TYPE, id);
}

/** Applied when the other side's accept/reject for a request we sent arrives — see client.js. */
export async function setContactRequestStatus(id, status) {
  const store = getStore();
  const row = await store.get(RECORD_TYPE, id);
  if (!row) return null;
  const key = await getContactsKey();
  const record = await decryptRecord(key, row.data);
  record.requestStatus = status;
  record.requestNoticeDismissed = false;
  record.updatedAt = Date.now();
  const encrypted = await encryptRecord(key, record);
  await store.put(RECORD_TYPE, id, encrypted);
  return record;
}

/** Dismiss the "accepted"/"rejected" notice card for a contact. */
export async function dismissContactRequestNotice(id) {
  const store = getStore();
  const row = await store.get(RECORD_TYPE, id);
  if (!row) return;
  const key = await getContactsKey();
  const record = await decryptRecord(key, row.data);
  record.requestNoticeDismissed = true;
  const encrypted = await encryptRecord(key, record);
  await store.put(RECORD_TYPE, id, encrypted);
}
