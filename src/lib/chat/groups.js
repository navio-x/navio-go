import { encryptRecord, decryptRecord } from "./crypto.js";
import { getChatHistoryStore as getStore, getChatHistoryKey } from "./session.js";

const RECORD_TYPE = "groups";

/** Local group definitions, sorted by most recently updated. */
export async function listGroups() {
  const store = getStore();
  const key = await getChatHistoryKey();
  const rows = await store.list(RECORD_TYPE);
  const settled = await Promise.allSettled(rows.map((row) => decryptRecord(key, row.data)));
  const groups = settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
  return groups.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export async function getGroup(id) {
  const store = getStore();
  const row = await store.get(RECORD_TYPE, id);
  if (!row) return null;
  const key = await getChatHistoryKey();
  return decryptRecord(key, row.data);
}

/** Replace the local copy of a group record (id must already be set — see client.js). */
export async function putGroup(group) {
  const store = getStore();
  const key = await getChatHistoryKey();
  const encrypted = await encryptRecord(key, group);
  await store.put(RECORD_TYPE, group.id, encrypted);
  return group;
}

/** Device-local only — see clearGroupHistory / deleteGroup in client.js for the "notify members" path. */
export async function deleteGroupLocal(id) {
  const store = getStore();
  await store.delete(RECORD_TYPE, id);
}
