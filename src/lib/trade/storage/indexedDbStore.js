/**
 * IndexedDB-backed trade record store — same shape as payroll's
 * indexedDbStore.js. Each record is { id, updatedAt, data } where `data` is
 * the navio-sdk SerializedEncryptedData blob from crypto.js — never
 * plaintext. Separate database from payroll's (own name), even though both
 * are per-wallet, so the two modules can't collide or cross-read.
 */

const RECORD_TYPES = ["reservations", "history"];
// v2 adds "history" — onupgradeneeded only creates stores that don't
// already exist (see below), so upgrading from v1 leaves the existing
// reservations store and its data untouched. Mirrors payroll's own
// versioning precedent (src/lib/payroll/storage/indexedDbStore.js).
const DB_VERSION = 2;

function dbNameFor(walletId) {
  return `navio-trade-${walletId}`;
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
    throw new Error(`Unknown trade record type: ${type}`);
  }
}

export class IndexedDbTradeStore {
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
