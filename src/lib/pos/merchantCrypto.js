/**
 * Signing key derivation and Ed25519 sign/verify for POS payment requests.
 *
 * Deliberately a *separate* key from the wallet spending key, the payroll
 * storage key, and the payroll receipt-signing key: same HKDF-from-master-
 * seed pattern used throughout the app, but with its own domain-separation
 * string, so compromising one derived key never implicates another. This is
 * a merchant attestation key, not a spending key — it never touches the
 * wallet's on-chain signing path.
 *
 * The Ed25519/WebCrypto/PKCS8 approach here is deliberately duplicated from
 * src/lib/payroll/receiptCrypto.js rather than imported from it: the two
 * features are independent and this task's constraints call for additive,
 * non-refactoring changes to Payroll. See that file for the fuller
 * explanation of the WebCrypto Ed25519 import quirks this works around.
 */

const HKDF_INFO = new TextEncoder().encode("navio-merchant-v1");
// Fixed (not random) HKDF salt: the merchant signing keypair must be
// reproducible from the same seed on every device/session.
const HKDF_SALT = new TextEncoder().encode("navio-merchant-signing-salt-v1");

// Fixed ASN.1 DER prefix for an unencrypted PKCS8 Ed25519 private key
// (PrivateKeyInfo wrapping a 32-byte raw seed). Constant for every Ed25519
// key — only the trailing 32 seed bytes vary.
const ED25519_PKCS8_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64UrlToBytes(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64url.length / 4) * 4, "=");
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function bytesToBase64Url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Hex <-> base64url convenience wrappers — the URI carries base64url (shorter than hex) for pk/sig. */
export function hexToBase64Url(hex) {
  return bytesToBase64Url(hexToBytes(hex));
}
export function base64UrlToHex(b64url) {
  return bytesToHex(base64UrlToBytes(b64url));
}

async function deriveSeedBytes(masterSeedHex) {
  if (!masterSeedHex) throw new Error("masterSeedHex required");
  const seedBytes = hexToBytes(masterSeedHex);
  const baseKey = await crypto.subtle.importKey("raw", seedBytes, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: HKDF_SALT, info: HKDF_INFO },
    baseKey,
    256
  );
  return new Uint8Array(bits);
}

function pkcs8FromSeed(seed32) {
  const pkcs8 = new Uint8Array(ED25519_PKCS8_PREFIX.length + 32);
  pkcs8.set(ED25519_PKCS8_PREFIX, 0);
  pkcs8.set(seed32, ED25519_PKCS8_PREFIX.length);
  return pkcs8;
}

/**
 * Derive this wallet's merchant signing keypair from its master seed.
 * Deterministic: the same seed always yields the same keypair, so a request
 * signed on one device verifies against the public key derived on another
 * device from the same mnemonic.
 *
 * @returns {Promise<{ privateKey: CryptoKey, publicKeyRaw: Uint8Array, publicKeyHex: string }>}
 */
export async function deriveMerchantSigningKeypair(masterSeedHex) {
  const seed = await deriveSeedBytes(masterSeedHex);
  const pkcs8 = pkcs8FromSeed(seed);

  // Extractable only long enough to recover the public key (see file header);
  // the key actually used for signing below is re-imported non-extractable.
  const extractablePriv = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, true, ["sign"]);
  const jwk = await crypto.subtle.exportKey("jwk", extractablePriv);
  const publicKeyRaw = base64UrlToBytes(jwk.x);

  const privateKey = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, false, ["sign"]);

  return { privateKey, publicKeyRaw, publicKeyHex: bytesToHex(publicKeyRaw) };
}

/** Sign canonical request bytes. Returns the signature as lowercase hex. */
export async function signBytes(privateKey, bytes) {
  const sig = await crypto.subtle.sign({ name: "Ed25519" }, privateKey, bytes);
  return bytesToHex(new Uint8Array(sig));
}

/**
 * Verify a signature against canonical bytes and a merchant public key (hex).
 * Never throws on a bad signature/key — returns false — so callers (the QR
 * scan confirmation sheet) can render a verdict rather than a crash for any
 * malformed/tampered input.
 */
export async function verifyBytes(publicKeyHex, bytes, signatureHex) {
  try {
    const publicKey = await crypto.subtle.importKey(
      "raw",
      hexToBytes(publicKeyHex),
      { name: "Ed25519" },
      false,
      ["verify"]
    );
    return await crypto.subtle.verify({ name: "Ed25519" }, publicKey, hexToBytes(signatureHex), bytes);
  } catch {
    return false;
  }
}

/**
 * Human-comparable fingerprint of a public key: SHA-256 of the raw key
 * bytes, grouped as uppercase hex quads (same idea as a PGP fingerprint) so
 * a customer can eyeball-compare it against one they've trusted before.
 */
export async function publicKeyFingerprint(publicKeyHex) {
  const digest = await crypto.subtle.digest("SHA-256", hexToBytes(publicKeyHex));
  const hex = bytesToHex(new Uint8Array(digest)).toUpperCase();
  return hex.match(/.{1,4}/g).join(" ");
}
