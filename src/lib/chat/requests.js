/**
 * Incoming contact requests — someone else added our p2p address and we
 * haven't accepted/rejected them yet. Kept separate from contacts.js
 * because these are not (and may never become) a saved contact; see
 * client.js's handling of the "contact-req" topic.
 */
import { encryptRecord, decryptRecord } from "./crypto.js";
import { getChatHistoryStore as getStore, getChatHistoryKey } from "./session.js";

const RECORD_TYPE = "contactRequests";

/** Pending requests, newest first. */
export async function listRequests() {
  const store = getStore();
  const key = await getChatHistoryKey();
  const rows = await store.list(RECORD_TYPE);
  const settled = await Promise.allSettled(rows.map((row) => decryptRecord(key, row.data)));
  const requests = settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
  return requests.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export async function getRequest(identity) {
  const store = getStore();
  const row = await store.get(RECORD_TYPE, identity);
  if (!row) return null;
  const key = await getChatHistoryKey();
  return decryptRecord(key, row.data);
}

/** Keyed by the requester's canonical navid1 identity — a resend just refreshes it. */
export async function putRequest(request) {
  const store = getStore();
  const key = await getChatHistoryKey();
  const encrypted = await encryptRecord(key, request);
  await store.put(RECORD_TYPE, request.identity, encrypted);
  return request;
}

export async function deleteRequest(identity) {
  const store = getStore();
  await store.delete(RECORD_TYPE, identity);
}
