/**
 * IndexedDB-backed contacts record store.
 *
 * Same shape as src/lib/payroll/storage/indexedDbStore.js: the Capacitor
 * webview supports IndexedDB natively on every platform this app ships to,
 * so it's the one storage backend used here too. Each record is stored as
 * { id, updatedAt, data } where `data` is the navio-sdk SerializedEncryptedData
 * blob from crypto.js — never plaintext.
 */

const RECORD_TYPES = ["contacts"];
const DB_VERSION = 1;

function dbNameFor(walletId) {
  return `navio-contacts-${walletId}`;
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
    throw new Error(`Unknown contacts record type: ${type}`);
  }
}

export class IndexedDbContactsStore {
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
