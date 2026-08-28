/**
 * Signing key derivation and Ed25519 sign/verify for payroll receipts.
 *
 * Deliberately a *separate* key from both the wallet spending key and the
 * payroll storage key (crypto.js): same HKDF-from-master-seed pattern as
 * crypto.js, but with its own domain-separation string, so compromising one
 * derived key never implicates another. This is an attestation key, not a
 * spending key — it never touches the wallet's on-chain signing path.
 *
 * Built entirely on native WebCrypto (Ed25519 support: Chrome 113+, Safari
 * 17+, Node 20+, and their Capacitor-webview equivalents) — no new crypto
 * dependency. WebCrypto only exposes raw-format import for Ed25519 *public*
 * keys, not private ones, so a private key is imported via a fixed PKCS8
 * wrapper around the raw 32-byte seed (the standard, unambiguous DER
 * encoding for an Ed25519 private key — no ASN.1 library needed for a fixed
 * 16-byte prefix). The matching public key isn't derivable from a WebCrypto
 * private CryptoKey directly, so it's recovered once via a temporary
 * extractable import + JWK export (the underlying implementation computes
 * it from the private scalar), then the actual private key used for signing
 * is re-imported as non-extractable.
 */

import { canonicalReceiptBytes } from "./receiptCanonical.js";

const HKDF_INFO = new TextEncoder().encode("navio-receipt-v1");
// Fixed (not random) HKDF salt, like crypto.js: the receipt signing keypair
// must be reproducible from the same seed on every device/session.
const HKDF_SALT = new TextEncoder().encode("navio-receipt-signing-salt-v1");

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
 * Derive this wallet's receipt signing keypair from its master seed.
 * Deterministic: the same seed always yields the same keypair, so a receipt
 * signed on one device verifies against the public key derived on another
 * device from the same mnemonic.
 *
 * @returns {Promise<{ privateKey: CryptoKey, publicKeyRaw: Uint8Array, publicKeyHex: string }>}
 */
export async function deriveReceiptSigningKeypair(masterSeedHex) {
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

/** Sign canonical receipt bytes. Returns the signature as lowercase hex. */
export async function signBytes(privateKey, bytes) {
  const sig = await crypto.subtle.sign({ name: "Ed25519" }, privateKey, bytes);
  return bytesToHex(new Uint8Array(sig));
}

/**
 * Verify a signature against canonical bytes and an employer public key
 * (hex). Never throws on a bad signature/key — returns false — so callers
 * (in particular the verification screen) can render a verdict rather than
 * a crash for any malformed/tampered input.
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
 * a recipient can eyeball-compare it against one they've trusted before.
 */
export async function publicKeyFingerprint(publicKeyHex) {
  const digest = await crypto.subtle.digest("SHA-256", hexToBytes(publicKeyHex));
  const hex = bytesToHex(new Uint8Array(digest)).toUpperCase();
  return hex.match(/.{1,4}/g).join(" ");
}

/**
 * Verify a receipt object as a whole: recomputes the canonical bytes from
 * its own fields and checks `signature` against its own `employerPublicKey`.
 * Deliberately self-contained (no wallet, no payroll store) — this is what
 * lets the verification screen work with a receipt pasted in from anywhere,
 * with Employer mode off, on a device that has never touched payroll data.
 *
 * Only checks the signature and the issuer key it embeds — it says nothing
 * about whether that issuer key is one the user has chosen to trust (see
 * issuerKeys.js) and nothing about the on-chain amount.
 */
export async function verifyReceipt(receipt) {
  if (!receipt || typeof receipt !== "object") {
    return { valid: false, reason: "invalid_format" };
  }
  if (!receipt.employerPublicKey || !receipt.signature) {
    return { valid: false, reason: "missing_signature" };
  }
  let bytes;
  try {
    // Canonicalisation itself can throw on malformed input (e.g. a
    // non-integer amountSat) — a receipt pasted in from anywhere is
    // untrusted input, so a formatting error is a verdict, not a crash.
    bytes = canonicalReceiptBytes(receipt);
  } catch {
    return { valid: false, reason: "invalid_format" };
  }
  const valid = await verifyBytes(receipt.employerPublicKey, bytes, receipt.signature);
  return { valid, reason: valid ? null : "signature_mismatch" };
}
