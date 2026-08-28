/**
 * Payroll data encryption-at-rest.
 *
 * Key derivation and record encryption both reuse navio-sdk's existing
 * WebCrypto AES-256-GCM primitives (encryptWithKey/decryptWithKey — fresh
 * IV per call, non-extractable keys) instead of reimplementing AES-GCM.
 * Only the key *derivation* is payroll-specific: an HKDF step derives a
 * dedicated key from the wallet's master seed, domain-separated from the
 * wallet's own Argon2id-derived key so payroll storage never shares key
 * material with wallet key encryption.
 */

const HKDF_INFO = new TextEncoder().encode("navio-payroll-v1");
// Fixed (not random) HKDF salt: the derived key must be reproducible from
// the same seed on every unlock, so this cannot vary per call/session.
const HKDF_SALT = new TextEncoder().encode("navio-payroll-storage-salt-v1");

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Derive a non-extractable AES-256-GCM CryptoKey for payroll storage from
 * the wallet's master seed (hex, from KeyManager.getMasterSeedHex()).
 * Never persisted; re-derived each session while the wallet is unlocked.
 */
export async function derivePayrollKey(masterSeedHex) {
  if (!masterSeedHex) throw new Error("masterSeedHex required");
  const seedBytes = hexToBytes(masterSeedHex);
  const baseKey = await crypto.subtle.importKey("raw", seedBytes, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: HKDF_SALT, info: HKDF_INFO },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a JSON-serializable record. Delegates the actual AES-GCM work to
 * navio-sdk's encryptWithKey (fresh random IV per call).
 */
export async function encryptRecord(key, record) {
  const { encryptWithKey, serializeEncryptedData, randomBytes, SALT_LENGTH } = await import("navio-sdk");
  const plaintext = new TextEncoder().encode(JSON.stringify(record));
  // encryptWithKey's salt param is storage metadata only (the key is not
  // re-derived from it on decrypt) — a fresh value per record all the same.
  const salt = randomBytes(SALT_LENGTH);
  const encrypted = await encryptWithKey(plaintext, key, salt);
  return serializeEncryptedData(encrypted);
}

/**
 * Decrypt a record produced by encryptRecord. Throws if the ciphertext was
 * tampered with or the key is wrong (AES-GCM auth tag failure).
 */
export async function decryptRecord(key, serialized) {
  const { decryptWithKey, deserializeEncryptedData } = await import("navio-sdk");
  const encrypted = deserializeEncryptedData(serialized);
  const plaintext = await decryptWithKey(encrypted, key);
  return JSON.parse(new TextDecoder().decode(plaintext));
}
