/**
 * IndexedDB-backed merchant record store.
 *
 * Mirrors src/lib/payroll/storage/indexedDbStore.js exactly, in its own
 * database (separate name/version) so it never shares schema or upgrade
 * history with payroll's store. Each record is stored as
 * { id, updatedAt, data } where `data` is the navio-sdk SerializedEncryptedData
 * blob from crypto.js — never plaintext.
 */

const RECORD_TYPES = ["merchant_keys", "requests"];
// v2 adds "requests" — onupgradeneeded only creates stores that don't
// already exist (see below), so upgrading from v1 leaves the existing
// merchant_keys object store and its data untouched.
const DB_VERSION = 2;

function dbNameFor(walletId) {
  return `navio-merchant-${walletId}`;
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
    throw new Error(`Unknown merchant record type: ${type}`);
  }
}

export class IndexedDbMerchantStore {
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
