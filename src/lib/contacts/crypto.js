/**
 * Contacts data encryption-at-rest.
 *
 * Same approach as payroll/trade: navio-sdk's existing WebCrypto AES-256-GCM
 * primitives (encryptWithKey/decryptWithKey) do the actual encryption; only
 * the key *derivation* is contacts-specific, an HKDF step from the wallet's
 * master seed domain-separated from wallet key encryption and from every
 * other module's derived key (payroll, trade, chat).
 */

const HKDF_INFO = new TextEncoder().encode("navio-contacts-v1");
// Fixed (not random) HKDF salt: the derived key must be reproducible from
// the same seed on every unlock, so this cannot vary per call/session.
const HKDF_SALT = new TextEncoder().encode("navio-contacts-storage-salt-v1");

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Derive a non-extractable AES-256-GCM CryptoKey for contacts storage from
 * the wallet's master seed (hex, from KeyManager.getMasterSeedHex()).
 * Never persisted; re-derived each session while the wallet is unlocked.
 */
export async function deriveContactsKey(masterSeedHex) {
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

/** Encrypt a JSON-serializable record. Delegates to navio-sdk's encryptWithKey. */
export async function encryptRecord(key, record) {
  const { encryptWithKey, serializeEncryptedData, randomBytes, SALT_LENGTH } = await import("navio-sdk");
  const plaintext = new TextEncoder().encode(JSON.stringify(record));
  const salt = randomBytes(SALT_LENGTH);
  const encrypted = await encryptWithKey(plaintext, key, salt);
  return serializeEncryptedData(encrypted);
}

/** Decrypt a record produced by encryptRecord. Throws on tampering or a wrong key. */
export async function decryptRecord(key, serialized) {
  const { decryptWithKey, deserializeEncryptedData } = await import("navio-sdk");
  const encrypted = deserializeEncryptedData(serialized);
  const plaintext = await decryptWithKey(encrypted, key);
  return JSON.parse(new TextDecoder().decode(plaintext));
}
