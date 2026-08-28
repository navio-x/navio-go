/**
 * IndexedDB-backed payroll record store.
 *
 * Used on both web and Capacitor native — the Capacitor webview supports
 * IndexedDB natively, matching how the wallet's own data (KeyManager /
 * WalletDB via navio-sdk) is already stored on every platform this app
 * ships to. See src/stores/navio.js (databaseAdapter: 'indexeddb').
 *
 * Each record is stored as { id, updatedAt, data } where `data` is the
 * navio-sdk SerializedEncryptedData blob from crypto.js — never plaintext.
 */

const RECORD_TYPES = ["recipients", "payment_runs", "payments", "receipts", "issuer_keys"];
// v2 adds "receipts" and "issuer_keys" — onupgradeneeded only creates stores
// that don't already exist (see below), so upgrading from v1 leaves existing
// recipients/payment_runs/payments object stores and their data untouched.
const DB_VERSION = 2;

function dbNameFor(walletId) {
  return `navio-payroll-${walletId}`;
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
    throw new Error(`Unknown payroll record type: ${type}`);
  }
}

export class IndexedDbPayrollStore {
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
