/**
 * IndexedDB-backed local chat history store.
 *
 * Separate database from navio-p2pmsg's own IndexedDBStore (see
 * src/lib/chat/session.js), which holds only the library's protocol state
 * (keys/contacts/outbox) — this one holds the application's message
 * history, one record per conversation (keyed by the contact's p2p
 * address) so "clear history" (Step 7) is a single delete. Same shape as
 * payroll/contacts: { id, updatedAt, data } where `data` is the navio-sdk
 * SerializedEncryptedData blob from crypto.js — never plaintext.
 */

const RECORD_TYPES = ["conversations", "groups", "group_conversations", "contactRequests"];
// v2 adds "groups" (group definitions) and "group_conversations" (group
// message history, one record per groupId). v3 adds "contactRequests"
// (pending incoming contact requests — see requests.js). onupgradeneeded
// only creates stores that don't already exist, so upgrading from an
// earlier version leaves existing data untouched.
const DB_VERSION = 3;

function dbNameFor(walletId) {
  return `navio-chat-history-${walletId}`;
}

function openDb(walletId) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbNameFor(walletId), DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const type of RECORD_TYPES) {
        if (!db.objectStoreNames.contains(type)) {
          db.createObjectStore(type, { keyPath: "id" });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function assertType(type) {
  if (!RECORD_TYPES.includes(type)) {
    throw new Error(`Unknown chat record type: ${type}`);
  }
}

export class IndexedDbChatHistoryStore {
  constructor(walletId) {
    if (!walletId) throw new Error("walletId required");
    this.walletId = walletId;
    this._dbPromise = null;
  }

  _db() {
    if (!this._dbPromise) this._dbPromise = openDb(this.walletId);
    return this._dbPromise;
  }

  async put(type, id, data) {
    assertType(type);
    const db = await this._db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(type, "readwrite");
      tx.objectStore(type).put({ id, updatedAt: Date.now(), data });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async get(type, id) {
    assertType(type);
    const db = await this._db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(type, "readonly");
      const req = tx.objectStore(type).get(id);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async list(type) {
    assertType(type);
    const db = await this._db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(type, "readonly");
      const req = tx.objectStore(type).getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(type, id) {
    assertType(type);
    const db = await this._db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(type, "readwrite");
      tx.objectStore(type).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async close() {
    if (!this._dbPromise) return;
    const db = await this._dbPromise;
    db.close();
    this._dbPromise = null;
  }
}
