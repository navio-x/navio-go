/**
 * Chat identity + local message-history encryption.
 *
 * Two separate HKDF derivations from the wallet's master seed, domain-
 * separated from each other and from every other module's derived key
 * (payroll, trade, contacts):
 *
 *  - Identity seed: navio-p2pmsg needs the raw 32 bytes itself (it derives
 *    its own BLS identity/prekey from them internally), so this uses
 *    deriveBits rather than deriveKey — there's no way to hand the library
 *    a non-extractable WebCrypto key, and the wallet's own master seed is
 *    never handed to it directly, only this domain-separated derivative.
 *  - History key: a plain non-extractable AES-256-GCM CryptoKey, same
 *    pattern as payroll/trade/contacts, for encrypting local message
 *    history at rest (the library itself has no concept of message
 *    history — it only carries protocol state in its own Store).
 */

const IDENTITY_INFO = new TextEncoder().encode("navio-chat-identity-v1");
const IDENTITY_SALT = new TextEncoder().encode("navio-chat-identity-salt-v1");
const HISTORY_INFO = new TextEncoder().encode("navio-chat-history-v1");
const HISTORY_SALT = new TextEncoder().encode("navio-chat-history-salt-v1");

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Derive the 32-byte seed passed to MessagingClient.create({ seed }) from
 * the wallet's master seed (hex, from KeyManager.getMasterSeedHex()).
 * Reproducible from the same wallet seed on every unlock — the p2p identity
 * is stable across sessions without being persisted anywhere itself.
 */
export async function deriveChatIdentitySeed(masterSeedHex) {
  if (!masterSeedHex) throw new Error("masterSeedHex required");
  const seedBytes = hexToBytes(masterSeedHex);
  const baseKey = await crypto.subtle.importKey("raw", seedBytes, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: IDENTITY_SALT, info: IDENTITY_INFO },
    baseKey,
    256
  );
  return new Uint8Array(bits);
}

/** Non-extractable AES-256-GCM key for encrypting local message history at rest. */
export async function deriveChatHistoryKey(masterSeedHex) {
  if (!masterSeedHex) throw new Error("masterSeedHex required");
  const seedBytes = hexToBytes(masterSeedHex);
  const baseKey = await crypto.subtle.importKey("raw", seedBytes, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: HISTORY_SALT, info: HISTORY_INFO },
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
