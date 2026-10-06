// Optional "keep this wallet unlocked for N hours/days" cache. The SDK can
// only unlock with the password itself (keyManager.unlock), so that's what
// has to be recoverable — it is stored AES-GCM encrypted under a
// non-extractable WebCrypto key that lives in IndexedDB, never in plaintext.
//
// This is a convenience, not a second layer of encryption: any code running
// on this origin (or anyone with the unlocked device/browser profile) can ask
// the same key to decrypt for as long as the entry is alive. The lifetime is
// what bounds the exposure, which is why it's enforced on every read.
//
// Dependency-free and failure-tolerant: if IndexedDB/WebCrypto is missing or
// blocked, every export degrades to "nothing remembered".

const DB_NAME = "navio-unlock-cache";
const STORE = "kv";
const WRAP_KEY_ID = "wrapKey";
const ENTRY_PREFIX = "entry:";
// Small allowance for clock corrections before treating "now is earlier than
// the last time we looked" as someone winding the clock back to revive an
// expired entry.
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const HOUR = 60 * 60 * 1000;
export const UNLOCK_DURATIONS = {
  "1h": HOUR,
  "24h": 24 * HOUR,
  "7d": 7 * 24 * HOUR,
  "30d": 30 * 24 * HOUR,
};

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

const idbGet = (key) => withStore("readonly", (s) => s.get(key));
const idbPut = (key, value) => withStore("readwrite", (s) => s.put(value, key));
const idbDelete = (key) => withStore("readwrite", (s) => s.delete(key));

async function getWrapKey({ create }) {
  let key = await idbGet(WRAP_KEY_ID);
  if (!key && create) {
    key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await idbPut(WRAP_KEY_ID, key);
  }
  return key ?? null;
}

// Binds a ciphertext to the wallet it was stored for, so an entry can't be
// replayed under another wallet's name.
const aad = (walletName) => new TextEncoder().encode(walletName);

export async function rememberPassword(walletName, password) {
  if (!walletName || !password) return;
  try {
    const key = await getWrapKey({ create: true });
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: aad(walletName) },
      key,
      new TextEncoder().encode(password),
    );
    const now = Date.now();
    await idbPut(ENTRY_PREFIX + walletName, { iv, ciphertext, createdAt: now, lastSeen: now });
  } catch (e) {
    console.warn("Could not remember wallet unlock:", e);
  }
}

/**
 * @param {string} walletName
 * @param {number} maxAgeMs - lifetime counted from the last time the user
 *   actually typed the password (not sliding); 0/undefined = never recall.
 * @returns {Promise<string|null>}
 */
export async function recallPassword(walletName, maxAgeMs) {
  if (!walletName) return null;
  try {
    const entry = await idbGet(ENTRY_PREFIX + walletName);
    if (!entry) return null;

    const now = Date.now();
    const expired = !maxAgeMs || now >= entry.createdAt + maxAgeMs;
    const clockRolledBack = now + CLOCK_SKEW_MS < entry.lastSeen;
    if (expired || clockRolledBack) {
      await idbDelete(ENTRY_PREFIX + walletName);
      return null;
    }

    const key = await getWrapKey({ create: false });
    if (!key) return null;
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: entry.iv, additionalData: aad(walletName) },
      key,
      entry.ciphertext,
    );
    await idbPut(ENTRY_PREFIX + walletName, { ...entry, lastSeen: now });
    return new TextDecoder().decode(plain);
  } catch (e) {
    console.warn("Could not recall wallet unlock:", e);
    forgetPassword(walletName);
    return null;
  }
}

export async function forgetPassword(walletName) {
  if (!walletName) return;
  try {
    await idbDelete(ENTRY_PREFIX + walletName);
  } catch {
    // nothing stored / storage unavailable
  }
}

/** Drops every remembered unlock and the wrapping key itself. */
export async function forgetAllPasswords() {
  try {
    await withStore("readwrite", (s) => s.clear());
  } catch {
    // nothing stored / storage unavailable
  }
}
