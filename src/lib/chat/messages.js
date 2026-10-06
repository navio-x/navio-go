import { encryptRecord, decryptRecord } from "./crypto.js";
import { getChatHistoryStore as getStore, getChatHistoryKey } from "./session.js";
import { createKeyedMutex } from "./keyedMutex.js";

const RECORD_TYPE = "conversations";
// Every write below is a load-modify-save cycle on the whole conversation
// record — see keyedMutex.js for why concurrent ones (a send racing an
// incoming message, an ack racing a read receipt, ...) need serializing per
// conversation to avoid silently losing one side's write.
const withLock = createKeyedMutex();

async function loadConversation(p2pAddress) {
  const store = getStore();
  const row = await store.get(RECORD_TYPE, p2pAddress);
  if (!row) return { id: p2pAddress, messages: [] };
  const key = await getChatHistoryKey();
  return decryptRecord(key, row.data);
}

async function saveConversation(conversation) {
  const store = getStore();
  const key = await getChatHistoryKey();
  const encrypted = await encryptRecord(key, conversation);
  await store.put(RECORD_TYPE, conversation.id, encrypted);
}

/**
 * Insert by timestamp instead of always pushing to the end — an incoming
 * message's timestamp is the sender's send time, which can arrive after a
 * message that was actually sent later (relay retries, chunked reassembly),
 * so arrival order isn't reliably send order. Scans from the tail since the
 * common case (in-order arrival) settles in one comparison.
 */
function insertByTimestamp(messages, message) {
  let i = messages.length;
  while (i > 0 && messages[i - 1].timestamp > message.timestamp) i--;
  messages.splice(i, 0, message);
}

/** Full message history for one contact (chronological). */
export async function listMessages(p2pAddress) {
  const conversation = await loadConversation(p2pAddress);
  return conversation.messages;
}

/** Most recent message for one contact, or null. Used for the chat list preview. */
export async function lastMessage(p2pAddress) {
  const conversation = await loadConversation(p2pAddress);
  return conversation.messages.at(-1) ?? null;
}

/** Append an outgoing message in 'sending' state. Returns the stored record. */
export async function appendOutgoing(p2pAddress, { localId, msgIdHex, text, timestamp }) {
  return withLock(p2pAddress, async () => {
    const conversation = await loadConversation(p2pAddress);
    const message = {
      id: localId,
      msgIdHex,
      direction: "out",
      text,
      status: "sending",
      timestamp,
    };
    conversation.messages.push(message);
    await saveConversation(conversation);
    return message;
  });
}

/**
 * Append an incoming message, ordered by its (sender-supplied) timestamp
 * rather than arrival order. `msgIdHex` (the wire message id) lets us later
 * tell the sender we've read it — see unnotifiedIncoming/markReadNotified
 * and client.js's markConversationRead.
 */
export async function appendIncoming(p2pAddress, { msgIdHex, text, timestamp }) {
  return withLock(p2pAddress, async () => {
    const conversation = await loadConversation(p2pAddress);
    const message = {
      id: crypto.randomUUID(),
      msgIdHex,
      direction: "in",
      text,
      status: "received",
      readNotified: false,
      timestamp,
    };
    insertByTimestamp(conversation.messages, message);
    await saveConversation(conversation);
    return message;
  });
}

/**
 * Flip an outgoing message from 'sending' to 'delivered' once the
 * recipient's client acks it (end-to-end, not just handed to a relay).
 * navio-p2pmsg batches protocol acks with a couple of seconds' delay
 * (ackDelayMs), while our own read-receipt (an app-level message the
 * recipient sends the moment they view the conversation) has no such
 * delay — so if they already had the chat open, the read receipt can
 * arrive and flip this to 'read' *before* the ack does. Never downgrade
 * that back to 'delivered'.
 */
export async function markDelivered(p2pAddress, msgIdHex) {
  return withLock(p2pAddress, async () => {
    const conversation = await loadConversation(p2pAddress);
    const message = conversation.messages.find((m) => m.msgIdHex === msgIdHex);
    if (!message || message.status === "read") return;
    message.status = "delivered";
    await saveConversation(conversation);
  });
}

/** Flip an outgoing message to 'read' once the recipient's read receipt arrives — see TOPIC_READ_RECEIPT in client.js. Always applies: 'read' is the terminal state. */
export async function markRead(p2pAddress, msgIdHex) {
  return withLock(p2pAddress, async () => {
    const conversation = await loadConversation(p2pAddress);
    const message = conversation.messages.find((m) => m.msgIdHex === msgIdHex);
    if (!message) return;
    message.status = "read";
    await saveConversation(conversation);
  });
}

/** Flip an outgoing message to 'failed' once its TTL expires with no ack — unless we already know better (a late-arriving expiry racing behind an ack/read receipt shouldn't undo it). */
export async function markFailed(p2pAddress, msgIdHex) {
  return withLock(p2pAddress, async () => {
    const conversation = await loadConversation(p2pAddress);
    const message = conversation.messages.find((m) => m.msgIdHex === msgIdHex);
    if (!message || message.status === "delivered" || message.status === "read") return;
    message.status = "failed";
    await saveConversation(conversation);
  });
}

/** Incoming messages we haven't yet told the sender we've read. Skips ones from before this feature (no msgIdHex). */
export async function unnotifiedIncoming(p2pAddress) {
  const conversation = await loadConversation(p2pAddress);
  return conversation.messages.filter((m) => m.direction === "in" && m.msgIdHex && !m.readNotified).map((m) => m.msgIdHex);
}

/** Record that a read receipt was sent for these incoming messages, so we don't resend it every time the conversation is opened. */
export async function markReadNotified(p2pAddress, msgIdHexes) {
  return withLock(p2pAddress, async () => {
    const conversation = await loadConversation(p2pAddress);
    const set = new Set(msgIdHexes);
    for (const m of conversation.messages) {
      if (m.direction === "in" && set.has(m.msgIdHex)) m.readNotified = true;
    }
    await saveConversation(conversation);
  });
}

/**
 * Device-local delete only: navio-p2pmsg has no server-side history (the
 * bus never stores messages), so this cannot and does not affect the other
 * side's copy. The UI must say so (see ChatConversation.vue). Locked too,
 * so a write already in flight can't resurrect the conversation by saving
 * after this delete.
 */
export async function clearHistory(p2pAddress) {
  return withLock(p2pAddress, async () => {
    const store = getStore();
    await store.delete(RECORD_TYPE, p2pAddress);
  });
}
