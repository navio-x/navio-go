import { encryptRecord, decryptRecord } from "./crypto.js";
import { getChatHistoryStore as getStore, getChatHistoryKey } from "./session.js";
import { createKeyedMutex } from "./keyedMutex.js";

const RECORD_TYPE = "group_conversations";
// See keyedMutex.js / messages.js — same load-modify-save-the-whole-record
// shape, same need to serialize concurrent writes per group.
const withLock = createKeyedMutex();

async function loadConversation(groupId) {
  const store = getStore();
  const row = await store.get(RECORD_TYPE, groupId);
  if (!row) return { id: groupId, messages: [] };
  const key = await getChatHistoryKey();
  return decryptRecord(key, row.data);
}

async function saveConversation(conversation) {
  const store = getStore();
  const key = await getChatHistoryKey();
  const encrypted = await encryptRecord(key, conversation);
  await store.put(RECORD_TYPE, conversation.id, encrypted);
}

/** Insert by timestamp instead of always pushing — see messages.js's copy of this for why. */
function insertByTimestamp(messages, message) {
  let i = messages.length;
  while (i > 0 && messages[i - 1].timestamp > message.timestamp) i--;
  messages.splice(i, 0, message);
}

export async function listMessages(groupId) {
  const conversation = await loadConversation(groupId);
  return conversation.messages;
}

export async function lastMessage(groupId) {
  const conversation = await loadConversation(groupId);
  return conversation.messages.at(-1) ?? null;
}

/**
 * A group message fans out to every other member as a separate 1:1 send, so
 * (unlike a 1:1 conversation's single status) it carries one status per
 * recipient — `recipients: [{ identity, msgIdHex, status }]`.
 */
export async function appendOutgoing(groupId, { localId, text, timestamp, recipients }) {
  return withLock(groupId, async () => {
    const conversation = await loadConversation(groupId);
    const message = { id: localId, direction: "out", text, timestamp, recipients };
    conversation.messages.push(message);
    await saveConversation(conversation);
    return message;
  });
}

export async function appendIncoming(groupId, { fromIdentity, text, timestamp }) {
  return withLock(groupId, async () => {
    const conversation = await loadConversation(groupId);
    const message = { id: crypto.randomUUID(), direction: "in", from: fromIdentity, text, timestamp };
    insertByTimestamp(conversation.messages, message);
    await saveConversation(conversation);
    return message;
  });
}

async function updateRecipientStatus(groupId, msgIdHex, status) {
  return withLock(groupId, async () => {
    const conversation = await loadConversation(groupId);
    for (const message of conversation.messages) {
      if (message.direction !== "out" || !message.recipients) continue;
      const recipient = message.recipients.find((r) => r.msgIdHex === msgIdHex);
      if (recipient) {
        recipient.status = status;
        await saveConversation(conversation);
        return;
      }
    }
  });
}

export async function markRecipientSent(groupId, msgIdHex) {
  await updateRecipientStatus(groupId, msgIdHex, "sent");
}

export async function markRecipientFailed(groupId, msgIdHex) {
  await updateRecipientStatus(groupId, msgIdHex, "failed");
}

/** Device-local delete only — same caveat as messages.js clearHistory. */
export async function clearHistory(groupId) {
  return withLock(groupId, async () => {
    const store = getStore();
    await store.delete(RECORD_TYPE, groupId);
  });
}
