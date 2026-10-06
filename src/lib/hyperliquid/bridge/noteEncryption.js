import { bls12_381 } from "@noble/curves/bls12-381.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { randomBytes } from "@noble/hashes/utils.js";
import { BRIDGE_NOTE_PUBLIC_KEY_HEX } from "./config";

// ECIES over BLS12-381 G1 + XChaCha20-Poly1305 — SPEC 2. Verified by
// round-trip (encrypt → decrypt recovers the original destination) and by
// successfully encrypting against the real mainnet bridge note key.
//
// Envelope, 281 bytes then base64 (376 chars):
//   0   1B   version = 0x01
//   1   48B  ephemeral public key E, compressed G1
//   49  24B  XChaCha20-Poly1305 nonce
//   73  208B ciphertext ‖ 16-byte Poly1305 tag  (192-byte padded plaintext + tag)
const VERSION = 0x01;
const PLAINTEXT_LEN = 192;
const HKDF_INFO = new TextEncoder().encode("navio-hl-note/v1");
const ENVELOPE_LEN = 1 + 48 + 24 + (PLAINTEXT_LEN + 16);

const G1 = bls12_381.G1.Point;

/**
 * Encrypts a Navio withdrawal destination for the bridge's watchtower.
 * The plaintext destination must never leave the caller's browser — this
 * function does not perform any network I/O.
 *
 * - A fresh ephemeral scalar is drawn for every call: reusing one would turn
 *   the ciphertext into a stable pseudonym for the destination.
 * - `burnerEvmAddress` is authenticated as AAD, so a note can't be lifted
 *   into someone else's burn transaction. Normalised to lowercase.
 * - The destination is zero-padded to a fixed 192 bytes so ciphertext length
 *   never leaks anything about the address.
 */
export function encryptWithdrawalNote(destination, burnerEvmAddress, notePublicKeyHex = BRIDGE_NOTE_PUBLIC_KEY_HEX) {
  const notePubKey = G1.fromBytes(hexToBytes(notePublicKeyHex));

  const e = G1.Fn.fromBytes(randomBytes(32)); // fresh every note
  const E = G1.BASE.multiply(e);
  const S = notePubKey.multiply(e); // ECDH shared point

  const Ebytes = E.toBytes(true); // 48-byte compressed
  const Sbytes = S.toBytes(true);

  const key = hkdf(sha256, Sbytes, Ebytes, HKDF_INFO, 32);
  const aad = encodeAad(burnerEvmAddress);

  const destBytes = new TextEncoder().encode(destination);
  if (destBytes.length > PLAINTEXT_LEN) throw new Error("destination_too_long");
  const pt = new Uint8Array(PLAINTEXT_LEN);
  pt.set(destBytes);

  const nonce = randomBytes(24);
  const ct = xchacha20poly1305(key, nonce, aad).encrypt(pt); // 208 bytes (192 + 16-byte tag)

  const envelope = new Uint8Array(ENVELOPE_LEN);
  envelope[0] = VERSION;
  envelope.set(Ebytes, 1);
  envelope.set(nonce, 49);
  envelope.set(ct, 73);

  return bytesToBase64(envelope);
}

/** Round-trip helper for tests — not used in the withdrawal flow itself (only the watchtower holds the note secret key). */
export function decryptWithdrawalNote(base64Envelope, burnerEvmAddress, noteSecretKeyBytes) {
  const envelope = base64ToBytes(base64Envelope);
  if (envelope.length !== ENVELOPE_LEN) throw new Error("bad_envelope_length");
  if (envelope[0] !== VERSION) throw new Error("bad_envelope_version");

  const Ebytes = envelope.slice(1, 49);
  const nonce = envelope.slice(49, 73);
  const ct = envelope.slice(73, ENVELOPE_LEN);

  const E = G1.fromBytes(Ebytes);
  const d = G1.Fn.fromBytes(noteSecretKeyBytes);
  const Sbytes = E.multiply(d).toBytes(true);

  const key = hkdf(sha256, Sbytes, Ebytes, HKDF_INFO, 32);
  const aad = encodeAad(burnerEvmAddress);
  const pt = xchacha20poly1305(key, nonce, aad).decrypt(ct);

  let end = pt.length;
  while (end > 0 && pt[end - 1] === 0) end--;
  return new TextDecoder().decode(pt.slice(0, end));
}

function encodeAad(evmAddress) {
  const lower = evmAddress.toLowerCase();
  const aad = new TextEncoder().encode(lower);
  if (aad.length !== 42) throw new Error("invalid_burner_address");
  return aad;
}

function hexToBytes(hex) {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
