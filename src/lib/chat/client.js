/**
 * p2pChat service — wraps navio-p2pmsg's MessagingClient.
 *
 * Lifecycle mirrors stores/trade.js's bridge probe: active only when
 * settings.chatMode is on AND a wallet is connected (the chat identity is
 * derived from the live wallet seed — see session.js). Turning the toggle
 * off, or disconnecting the wallet, tears the client down immediately so no
 * connection or PoW work happens in the background while chat is disabled.
 *
 * Message history (local-only; the bus itself stores nothing) lives in
 * messages.js, keyed by the canonical navid1… identity string — both
 * inbound (`msg.from`) and outbound (via resolveIdentity, which also
 * accepts a navmsg1… bundle) resolve to that same form so a conversation
 * has one stable key regardless of which address form a contact was saved
 * with.
 */
import { reactive, watch } from "vue";
import { App as CapApp } from "@capacitor/app";
import { settings } from "@/stores/settings";
import { walletName } from "@/stores/navio";
import { getChatIdentitySeed, currentChatNetwork, chatProtocolStoreName } from "./session.js";
import * as chatMessages from "./messages.js";
import * as chatGroups from "./groups.js";
import * as groupMessages from "./groupMessages.js";
import * as contactRequests from "./requests.js";

// navio-p2pmsg's 1:1 send() accepts a custom `topic` per call, and the same
// client.on('message', ...) listener receives it regardless of topic — so
// group text/control traffic rides the exact same encrypted, acked, 1:1
// channel as normal chat, just tagged apart from it (see handleIncoming).
const TOPIC_GROUP_MESSAGE = "group-msg";
const TOPIC_GROUP_CONTROL = "group-ctl";
// A contact added on one device is otherwise invisible to the other side —
// they have no local record of you, so your messages arrive but have no
// contact card to show up under (see ChatContacts.vue). This topic carries
// the introduction (and the other side's accept/reply) that fixes that; see
// sendContactRequest / handleContactRequestControl.
const TOPIC_CONTACT_REQUEST = "contact-req";
// navio-p2pmsg's own 'ack' only confirms the recipient's client received
// the message (see handleAck below) — there's no protocol-level "the user
// actually opened this" signal, so the blue double-tick is entirely an
// app-level feature built on top: see markConversationRead, sent once a
// conversation is viewed, and the TOPIC_READ_RECEIPT branch in
// handleIncoming that applies the other side's receipt to our sent messages.
const TOPIC_READ_RECEIPT = "read-receipt";

export const chatState = reactive({
  ready: false,
  connecting: false,
  // Whether we currently have at least one live relay socket — `ready` only
  // means the client was created and asked the pool to start dialing (see
  // MessagingClient.connect(), which returns before any peer is up), so a UI
  // that only checks `ready` would show chat as usable while actually offline.
  connected: false,
  identity: null, // navid1…
  bundle: null, // navmsg1…
  error: null,
});

/** Bumped on every inbound message/ack/expired event so views can react by re-reading messages.js. */
export const chatActivity = reactive({ tick: 0, lastEvent: null });

let client = null;
let protocolStore = null;
let initPromise = null;
const identityCache = new Map(); // p2pAddress string -> resolved navid1 identity
// msgIdHex -> groupId, so an ack/expired event (which only carries the
// per-recipient identity, not which group the send belonged to) can be
// routed back to the right group conversation. Memory-only: a stale/missing
// entry after a restart just leaves an old "sending" status un-updated,
// which is harmless cosmetic staleness, not a correctness issue.
const groupMsgIndex = new Map();

function bump(event) {
  chatActivity.tick++;
  chatActivity.lastEvent = event;
}

async function handleIncoming(msg) {
  // Unsigned messages carry no verified sender — nothing to file them under.
  if (!msg.from) return;
  const { fromUtf8, toHex } = await import("navio-p2pmsg");

  if (msg.topic === TOPIC_READ_RECEIPT) {
    const payload = JSON.parse(fromUtf8(msg.payload));
    for (const msgIdHex of payload.msgIds || []) {
      await chatMessages.markRead(msg.from, msgIdHex);
    }
    bump({ type: "read-receipt", from: msg.from });
    return;
  }

  if (msg.topic === TOPIC_CONTACT_REQUEST) {
    const payload = JSON.parse(fromUtf8(msg.payload));
    await applyContactRequestControl(msg.from, payload);
    bump({ type: "contact-req", from: msg.from, requestType: payload.type });
    return;
  }

  if (msg.topic === TOPIC_GROUP_CONTROL) {
    const payload = JSON.parse(fromUtf8(msg.payload));
    await applyGroupControl(payload);
    bump({ type: "group-ctl", groupId: payload.groupId });
    return;
  }

  if (msg.topic === TOPIC_GROUP_MESSAGE) {
    const payload = JSON.parse(fromUtf8(msg.payload));
    // A message for a group we've since left/been removed from (or never
    // knew about, e.g. an invite that hasn't arrived yet) has nowhere local
    // to go — drop it rather than resurrecting a group record from a text.
    const group = await chatGroups.getGroup(payload.groupId);
    if (!group) return;
    console.log("[chat] incoming group message", { groupId: payload.groupId, from: msg.from, text: payload.text });
    await groupMessages.appendIncoming(payload.groupId, {
      fromIdentity: msg.from,
      text: payload.text,
      // navio-p2pmsg's frame.timestamp is the sender's own send time in
      // whole seconds (see its nowSeconds()), not the ms epoch this app
      // uses everywhere else (Date.now() for outgoing, formatTime()) — left
      // unconverted this both renders as 1970 and sorts before everything.
      timestamp: msg.timestamp * 1000,
    });
    bump({ type: "group-message", groupId: payload.groupId });
    return;
  }

  const msgIdHex = toHex(msg.msgId);
  const text = fromUtf8(msg.payload);
  console.log("[chat] incoming message", { from: msg.from, msgIdHex, text, timestamp: msg.timestamp * 1000 });
  await chatMessages.appendIncoming(msg.from, {
    msgIdHex,
    text,
    timestamp: msg.timestamp * 1000,
  });
  bump({ type: "message", from: msg.from });
}

async function handleAck({ msgId, to }) {
  const { toHex } = await import("navio-p2pmsg");
  const msgIdHex = toHex(msgId);
  const groupId = groupMsgIndex.get(msgIdHex);
  if (groupId) {
    await groupMessages.markRecipientSent(groupId, msgIdHex);
    groupMsgIndex.delete(msgIdHex);
    bump({ type: "group-ack", groupId });
    return;
  }
  await chatMessages.markDelivered(to, msgIdHex);
  bump({ type: "ack", to });
}

async function handleExpired({ msgId, to }) {
  const { toHex } = await import("navio-p2pmsg");
  const msgIdHex = toHex(msgId);
  const groupId = groupMsgIndex.get(msgIdHex);
  if (groupId) {
    await groupMessages.markRecipientFailed(groupId, msgIdHex);
    groupMsgIndex.delete(msgIdHex);
    bump({ type: "group-expired", groupId });
    return;
  }
  await chatMessages.markFailed(to, msgIdHex);
  bump({ type: "expired", to });
}

/**
 * Apply an incoming contact-req frame. 'request' files it under
 * requests.js (a saved contact isn't created until the user accepts it —
 * see acceptContactRequest); 'accept'/'reject' is the other side's reply to
 * a request *we* sent, so it patches the matching local contact's
 * requestStatus (see setContactRequestStatus) for ChatContacts.vue's
 * closeable notice card.
 */
async function applyContactRequestControl(fromIdentity, payload) {
  if (payload.type === "request") {
    await contactRequests.putRequest({
      identity: fromIdentity,
      bundle: payload.bundle,
      displayName: payload.displayName || "",
      createdAt: Date.now(),
    });
    return;
  }
  if (payload.type === "accept" || payload.type === "reject") {
    const { listContacts, setContactRequestStatus } = await import("@/lib/contacts/contacts.js");
    const contacts = await listContacts();
    for (const contact of contacts) {
      if (!contact.p2pAddress) continue;
      try {
        if ((await resolveIdentity(contact.p2pAddress)) === fromIdentity) {
          await setContactRequestStatus(contact.id, payload.type === "accept" ? "accepted" : "rejected");
          break;
        }
      } catch {
        // contact's p2pAddress no longer resolves — nothing to match against
      }
    }
  }
}

/**
 * Apply an incoming group-ctl frame (invite/update/delete) from another
 * member. Membership sync is last-writer-wins by `version` — see the design
 * note in groups.js. `delete` and "I was removed from the member list" both
 * just drop the local copy; there is nothing to roll back since group state
 * only ever lived on each device.
 */
async function applyGroupControl(payload) {
  const { groupId, type, name, members, version } = payload;
  const existing = await chatGroups.getGroup(groupId);

  if (type === "delete") {
    if (existing) await chatGroups.deleteGroupLocal(groupId);
    return;
  }
  if (existing && existing.version >= version) return; // stale or duplicate — ignore

  const myIdentity = chatState.identity;
  const stillMember = (members || []).some((m) => m.identity === myIdentity);
  if (!stillMember) {
    if (existing) await chatGroups.deleteGroupLocal(groupId);
    return;
  }

  await chatGroups.putGroup({
    id: groupId,
    name,
    members,
    version,
    // The inviter is the closest thing to a known owner when we've never
    // seen this group before; a later 'update' from the true owner (a
    // higher version) will not change this field, since ownership itself
    // isn't part of the synced payload — see the note in groups.js.
    owner: existing?.owner ?? payload.owner,
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  });
}

/** Idempotent — safe to call repeatedly; concurrent callers share one connect. */
export async function init() {
  if (client || initPromise) return initPromise;
  initPromise = (async () => {
    chatState.connecting = true;
    chatState.error = null;
    chatState.connected = false;
    try {
      const { MessagingClient, IndexedDBStore } = await import("navio-p2pmsg");
      const seed = await getChatIdentitySeed();
      protocolStore = await IndexedDBStore.open(chatProtocolStoreName());
      const peers = (settings.chatPeers || "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      // A page loaded over HTTPS can't open a plain ws:// socket — browsers
      // block it as mixed content (the raw error is an opaque
      // "Failed to construct 'WebSocket'" DOMException). Catch it here with
      // a message that tells the user what to actually do about it: put the
      // relay behind a TLS-terminating reverse proxy and use wss://.
      if (
        typeof window !== "undefined" &&
        window.location?.protocol === "https:" &&
        peers.some((p) => p.startsWith("ws://"))
      ) {
        throw new Error(
          "This page is loaded over HTTPS, which blocks insecure ws:// relay connections. " +
          "Put the relay in Settings behind a TLS reverse proxy and use a wss:// address instead."
        );
      }
      client = await MessagingClient.create({
        network: currentChatNetwork(),
        seed,
        store: protocolStore,
        peers: peers.length ? peers : undefined,
      });
      client.on("message", handleIncoming);
      client.on("ack", handleAck);
      client.on("expired", handleExpired);
      client.on("error", (err) => {
        chatState.error = err?.message || String(err);
      });
      // PeerPool dials/redials relays on its own backoff schedule — this just
      // mirrors its live handshaked-peer count into chatState.connected.
      // chatState.error is otherwise sticky (see the 'error' handler above):
      // a transient WsTransport failure while wifi/data was off would
      // otherwise sit on screen forever even after the pool quietly
      // reconnects on its own, so clear it the moment a peer comes back up.
      client.on("peer", () => {
        chatState.connected = client.pool.connectedCount > 0;
        if (chatState.connected) chatState.error = null;
      });
      client.on("peerclose", () => { chatState.connected = client.pool.connectedCount > 0; });
      await client.connect();
      chatState.identity = client.identity;
      chatState.bundle = client.bundle();
      chatState.ready = true;
    } catch (err) {
      chatState.error = err?.message || String(err);
      client = null;
      throw err;
    } finally {
      chatState.connecting = false;
    }
  })();
  return initPromise;
}

/** Tears the connection down; idle until init() is called again. */
export async function close() {
  if (client) {
    client.close();
    client = null;
  }
  if (protocolStore) {
    await protocolStore.close?.();
    protocolStore = null;
  }
  identityCache.clear();
  groupMsgIndex.clear();
  initPromise = null;
  chatState.ready = false;
  chatState.connected = false;
  chatState.identity = null;
  chatState.bundle = null;
  chatState.error = null;
}

/**
 * Resolve a stored contact's p2pAddress (navid1… or navmsg1…) to its
 * canonical navid1 identity, registering the bundle locally if one was
 * given (no network round trip unless the address is a bare navid1 the
 * client has never seen — discovery then happens lazily on send).
 */
export async function resolveIdentity(p2pAddress) {
  if (!client) throw new Error("Chat not initialized");
  if (identityCache.has(p2pAddress)) return identityCache.get(p2pAddress);
  const identity = await client.addContact(p2pAddress);
  identityCache.set(p2pAddress, identity);
  return identity;
}

/** Send a text message to a stored contact's p2p address. Appends a local 'sending' record immediately. */
export async function sendMessage(p2pAddress, text) {
  if (!client) throw new Error("Chat not initialized");
  const { utf8, toHex } = await import("navio-p2pmsg");
  const identity = await resolveIdentity(p2pAddress);
  const localId = crypto.randomUUID();
  const timestamp = Date.now();
  const msgId = await client.send(identity, utf8(text));
  const msgIdHex = toHex(msgId);
  console.log("[chat] outgoing message", { to: identity, msgIdHex, text, timestamp });
  return chatMessages.appendOutgoing(identity, { localId, msgIdHex, text, timestamp });
}

/**
 * Tell a contact we've read their not-yet-notified messages — see
 * ChatConversation.vue, which calls this whenever the conversation is
 * (re)viewed. Best-effort and safe to call repeatedly: only sent (and only
 * marked notified) when it actually goes out, so a call made while offline
 * just retries on the next view instead of silently losing the receipt.
 */
export async function markConversationRead(p2pAddress) {
  if (!client) return;
  const identity = await resolveIdentity(p2pAddress);
  const msgIds = await chatMessages.unnotifiedIncoming(identity);
  if (msgIds.length === 0) return;
  const { utf8 } = await import("navio-p2pmsg");
  const payload = utf8(JSON.stringify({ type: "read", msgIds }));
  await client.send(identity, payload, { topic: TOPIC_READ_RECEIPT });
  await chatMessages.markReadNotified(identity, msgIds);
}

/**
 * Introduce ourselves to a newly-added (or re-addressed) contact so we show
 * up on their side too — see ChatContactForm.vue, which calls this right
 * after saveContact() whenever the p2p address is new. Best-effort: if chat
 * isn't connected there's nothing queueing this for later, same as
 * sendMessage above.
 */
export async function sendContactRequest(p2pAddress) {
  if (!client) return;
  const { utf8 } = await import("navio-p2pmsg");
  const identity = await resolveIdentity(p2pAddress);
  const displayName = settings.chatNickname.trim() || walletName.value;
  const payload = utf8(JSON.stringify({ type: "request", bundle: chatState.bundle, displayName }));
  await client.send(identity, payload, { topic: TOPIC_CONTACT_REQUEST });
}

/** Pending incoming contact requests — see ChatContacts.vue. */
export async function listContactRequests() {
  return contactRequests.listRequests();
}

/** Accept an incoming request: save it as a contact and let the sender know. */
export async function acceptContactRequest(identity) {
  const request = await contactRequests.getRequest(identity);
  if (!request) return;
  const { saveContact } = await import("@/lib/contacts/contacts.js");
  await saveContact({ firstName: request.displayName || identity.slice(0, 14), p2pAddress: request.bundle || identity });
  await contactRequests.deleteRequest(identity);
  if (client) {
    const { utf8 } = await import("navio-p2pmsg");
    await client.send(identity, utf8(JSON.stringify({ type: "accept" })), { topic: TOPIC_CONTACT_REQUEST });
  }
}

/** Reject an incoming request: just drop it and let the sender know, without saving a contact. */
export async function rejectContactRequest(identity) {
  await contactRequests.deleteRequest(identity);
  if (client) {
    const { utf8 } = await import("navio-p2pmsg");
    await client.send(identity, utf8(JSON.stringify({ type: "reject" })), { topic: TOPIC_CONTACT_REQUEST });
  }
}

/** Full local history for a stored contact, resolving its address to the canonical identity key. */
export async function conversationHistory(p2pAddress) {
  const identity = await resolveIdentity(p2pAddress);
  return chatMessages.listMessages(identity);
}

/** Most recent local message for a stored contact, for list previews. */
export async function conversationPreview(p2pAddress) {
  const identity = await resolveIdentity(p2pAddress);
  return chatMessages.lastMessage(identity);
}

/** Device-local delete only — see messages.js clearHistory. */
export async function clearConversation(p2pAddress) {
  const identity = await resolveIdentity(p2pAddress);
  return chatMessages.clearHistory(identity);
}

/** Fan out a group-ctl frame to every member (or an explicit override list, for a member who just got removed). */
async function broadcastGroupControl(group, type, explicitTargets) {
  const { utf8 } = await import("navio-p2pmsg");
  const targets = (explicitTargets ?? group.members.map((m) => m.identity)).filter((id) => id !== chatState.identity);
  const payload = utf8(JSON.stringify({
    groupId: group.id,
    type,
    name: group.name,
    members: group.members,
    version: group.version,
    owner: group.owner,
  }));
  await Promise.allSettled(targets.map((identity) => client.send(identity, payload, { topic: TOPIC_GROUP_CONTROL })));
}

/** Create a group and invite its initial members (their p2pAddress, as stored on a contact). */
export async function createGroup(name, memberP2pAddresses) {
  if (!client) throw new Error("Chat not initialized");
  const memberIdentities = await Promise.all(memberP2pAddresses.map((addr) => resolveIdentity(addr)));
  const group = {
    id: crypto.randomUUID(),
    name,
    members: [{ identity: chatState.identity }, ...memberIdentities.map((identity) => ({ identity }))],
    version: 1,
    owner: chatState.identity,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await chatGroups.putGroup(group);
  await broadcastGroupControl(group, "invite");
  bump({ type: "group-ctl", groupId: group.id });
  return group;
}

/** Rename and/or change membership. Owner-only — see GroupManage.vue, which hides this from non-owners. */
export async function updateGroup(groupId, { name, memberIdentities }) {
  if (!client) throw new Error("Chat not initialized");
  const existing = await chatGroups.getGroup(groupId);
  if (!existing) throw new Error("not_found");
  if (existing.owner !== chatState.identity) throw new Error("not_owner");

  // Removed members are not in the new list, so the normal "fan out to
  // group.members" path in broadcastGroupControl would skip them — notify
  // them too (on the union of old + new) so they learn they were removed.
  const notifyTargets = [...new Set([...existing.members.map((m) => m.identity), ...memberIdentities])];

  const group = {
    ...existing,
    name: name ?? existing.name,
    members: memberIdentities.map((identity) => ({ identity })),
    version: existing.version + 1,
    updatedAt: Date.now(),
  };
  await chatGroups.putGroup(group);
  await broadcastGroupControl(group, "update", notifyTargets);
  bump({ type: "group-ctl", groupId: group.id });
  return group;
}

/**
 * Remove the group. The owner's delete notifies every member (their copies
 * are removed too); a non-owner's delete only ever removes their own local
 * copy — see the confirmation text in GroupManage.vue, which must say so.
 */
export async function deleteGroup(groupId) {
  const existing = await chatGroups.getGroup(groupId);
  if (!existing) return;
  if (client && existing.owner === chatState.identity) {
    await broadcastGroupControl(existing, "delete");
  }
  await chatGroups.deleteGroupLocal(groupId);
  await groupMessages.clearHistory(groupId);
}

/** Send a text message to every other member of a group as a separate 1:1 send. */
export async function sendGroupMessage(groupId, text) {
  if (!client) throw new Error("Chat not initialized");
  const { utf8, toHex } = await import("navio-p2pmsg");
  const group = await chatGroups.getGroup(groupId);
  if (!group) throw new Error("not_found");

  const targets = group.members.map((m) => m.identity).filter((id) => id !== chatState.identity);
  const payload = utf8(JSON.stringify({ groupId, text }));
  console.log("[chat] outgoing group message", { groupId, targets, text });
  const recipients = [];
  for (const identity of targets) {
    try {
      const msgId = await client.send(identity, payload, { topic: TOPIC_GROUP_MESSAGE });
      const msgIdHex = toHex(msgId);
      groupMsgIndex.set(msgIdHex, groupId);
      recipients.push({ identity, msgIdHex, status: "sending" });
    } catch (err) {
      recipients.push({ identity, status: "failed" });
    }
  }

  return groupMessages.appendOutgoing(groupId, {
    localId: crypto.randomUUID(),
    text,
    timestamp: Date.now(),
    recipients,
  });
}

export async function listMyGroups() {
  return chatGroups.listGroups();
}

export async function getMyGroup(groupId) {
  return chatGroups.getGroup(groupId);
}

export async function groupHistory(groupId) {
  return groupMessages.listMessages(groupId);
}

export async function groupPreview(groupId) {
  return groupMessages.lastMessage(groupId);
}

/** Device-local delete only — same caveat as clearConversation. */
export async function clearGroupHistory(groupId) {
  return groupMessages.clearHistory(groupId);
}

/**
 * Best-effort identity -> display name map for a list of member identities,
 * matched against saved contacts (via their resolved p2p identity). An
 * identity with no matching contact — or not yet resolved this session —
 * falls back to the caller showing the raw identity, truncated.
 */
export async function memberDisplayNames(identities) {
  const { listContacts } = await import("@/lib/contacts/contacts.js");
  const contacts = await listContacts();
  const map = {};
  for (const contact of contacts) {
    if (!contact.p2pAddress) continue;
    try {
      const identity = await resolveIdentity(contact.p2pAddress);
      if (identities.includes(identity)) {
        map[identity] = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() || contact.p2pAddress;
      }
    } catch {
      // contact's p2pAddress no longer resolves (e.g. malformed) — leave unmapped
    }
  }
  return map;
}

function evaluate() {
  if (settings.chatMode && walletName.value) {
    init().catch((err) => console.warn("Chat init failed:", err));
  } else {
    close();
  }
}
watch(() => settings.chatMode, evaluate);
watch(() => walletName.value, evaluate);
// Sync immediately on import (e.g. chatMode was already on and a wallet was
// already connected before /chat — or this module — was first reached).
evaluate();

// Backgrounding an Android WebView tends to kill the relay socket outright
// (Doze/App Standby) without the pool ever seeing a 'close' event to trigger
// its own backoff/redial — so on resume we can't just trust the existing
// client to notice it's dead. Force a fresh connect instead of waiting on it.
// `backgrounded` guards against firing on the initial isActive:true at app
// launch, which is a startup event, not a real resume.
let backgrounded = false;
CapApp.addListener("appStateChange", ({ isActive }) => {
  if (!isActive) {
    backgrounded = true;
    return;
  }
  if (!backgrounded) return;
  backgrounded = false;
  close().then(evaluate);
});
