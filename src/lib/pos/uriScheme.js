/**
 * `navio:` URI scheme (v1) for POS payment requests.
 *
 * Full spec for other wallets / the future WooCommerce plugin to implement
 * against: docs/pos-payment-request-uri.md. Summary:
 *
 *   navio:<address>?v=1&amount=<nav>&label=<merchant>&id=<request_id>
 *         &exp=<unix_ts>&pk=<merchant_pubkey>&sig=<signature>
 *
 * `pk` (the merchant's Ed25519 public key, base64url) travels in the URI
 * because Ed25519 signatures aren't key-recoverable — a scanning wallet with
 * no prior relationship to the merchant has no other way to get the key the
 * signature claims to be from. It doesn't need to be part of the signed
 * payload itself: verify(pk, message, sig) already binds all three together,
 * so a substituted pk simply fails verification.
 *
 * `amount`, `pk` and `sig` are base64url-encoded (not hex) specifically to
 * keep the URI within the ~400-character budget a QR code needs to scan
 * reliably in poor lighting — see the size accounting in the spec doc.
 */
import {
  deriveMerchantSigningKeypair,
  signBytes,
  verifyBytes,
  hexToBase64Url,
  base64UrlToHex,
} from "./merchantCrypto.js";
import { canonicalRequestBytes, formatAmount } from "./canonical.js";
import { generateRequestId } from "./requestId.js";

export const POS_URI_SCHEME = "navio";
export const POS_URI_VERSION = 1;

// Merchant labels travel inside a QR meant for a quick scan — kept short so
// a request stays comfortably under the size budget regardless of how long
// the merchant's configured display name is (see settings.merchantLabel,
// added in a later part). The full configured name is still what's stored
// in local merchant records (Part 6); this only truncates what's *signed
// and transmitted* in the URI. 20 chars leaves headroom even at the largest
// realistic amount (see the "size budget" tests in uriScheme.test.js).
export const MAX_LABEL_LENGTH = 20;

// Recommended scan-reliability ceiling. buildPaymentRequestUri() always
// returns the URI it built even if this is exceeded (a very long label is a
// merchant configuration choice, not an error) — callers should surface
// `overBudget` to the user rather than silently failing.
export const URI_LENGTH_BUDGET = 400;

export { deriveMerchantSigningKeypair };

/** Strip control characters and collapse to the max label length. */
export function sanitizeLabel(label) {
  const cleaned = String(label ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .trim();
  return cleaned.slice(0, MAX_LABEL_LENGTH);
}

/**
 * Build and sign a POS payment request URI.
 *
 * @param {object} params
 * @param {string} params.address - Fresh per-request address (see address.js).
 * @param {number|string} params.amount - Requested amount, in NAV.
 * @param {string} params.label - Merchant display name (sanitised/truncated here).
 * @param {number} params.exp - Expiry, unix seconds.
 * @param {CryptoKey} params.privateKey - Merchant signing private key (see merchantCrypto.js).
 * @param {string} params.publicKeyHex - Merchant signing public key, hex.
 * @returns {Promise<{ uri: string, length: number, overBudget: boolean, id: string, address: string, amount: string, label: string, exp: number }>}
 */
export async function buildPaymentRequestUri({ address, amount, label, exp, privateKey, publicKeyHex }) {
  if (!address) throw new Error("address required");
  if (!exp) throw new Error("exp required");
  if (!privateKey || !publicKeyHex) throw new Error("merchant signing keypair required");

  const id = generateRequestId();
  const fields = {
    address,
    amount: formatAmount(amount),
    label: sanitizeLabel(label),
    id,
    exp: Math.trunc(exp),
  };

  const bytes = canonicalRequestBytes(fields);
  const sigHex = await signBytes(privateKey, bytes);

  const query = new URLSearchParams();
  query.set("v", String(POS_URI_VERSION));
  query.set("amount", fields.amount);
  query.set("label", fields.label);
  query.set("id", fields.id);
  query.set("exp", String(fields.exp));
  query.set("pk", hexToBase64Url(publicKeyHex));
  query.set("sig", hexToBase64Url(sigHex));

  const uri = `${POS_URI_SCHEME}:${address}?${query.toString()}`;

  return {
    uri,
    length: uri.length,
    overBudget: uri.length > URI_LENGTH_BUDGET,
    id,
    address,
    amount: fields.amount,
    label: fields.label,
    exp: fields.exp,
  };
}

/**
 * Parse a `navio:` payment request URI without verifying it. Returns null
 * for anything that isn't a well-formed navio: request URI at all (wrong
 * scheme, missing address/amount/id/exp). `version`/`publicKeyHex`/
 * `signatureHex` come back null for an unsigned or unrecognised-version URI
 * — the scanning wallet (Part 5) allows payment in that case but must mark
 * the merchant details as unverified.
 */
export function parsePaymentRequestUri(uri) {
  if (typeof uri !== "string") return null;
  const prefix = `${POS_URI_SCHEME}:`;
  if (!uri.toLowerCase().startsWith(prefix)) return null;

  const rest = uri.slice(prefix.length);
  const qIdx = rest.indexOf("?");
  const address = qIdx === -1 ? rest : rest.slice(0, qIdx);
  const query = new URLSearchParams(qIdx === -1 ? "" : rest.slice(qIdx + 1));

  const amount = query.get("amount");
  const id = query.get("id");
  const expRaw = query.get("exp");
  if (!address || !amount || !id || !expRaw) return null;

  const exp = Number.parseInt(expRaw, 10);
  if (!Number.isFinite(exp)) return null;

  const versionRaw = query.get("v");
  const pk = query.get("pk");
  const sig = query.get("sig");

  let publicKeyHex = null;
  let signatureHex = null;
  try {
    publicKeyHex = pk ? base64UrlToHex(pk) : null;
    signatureHex = sig ? base64UrlToHex(sig) : null;
  } catch {
    // Malformed base64url in pk/sig — treat as unsigned rather than throwing.
    publicKeyHex = null;
    signatureHex = null;
  }

  return {
    version: versionRaw ? Number.parseInt(versionRaw, 10) : null,
    address,
    amount,
    label: query.get("label") ?? "",
    id,
    exp,
    publicKeyHex,
    signatureHex,
    signed: Boolean(publicKeyHex && signatureHex),
  };
}

/**
 * Verify a parsed request's signature against its own fields and embedded
 * public key. A parsed request's fields come from a scanned QR code — fully
 * attacker-controlled — so this never throws: a field mutated into a form
 * canonicalisation itself rejects (e.g. a non-numeric amount) is just
 * another way to fail verification, not a crash. Returns false for an
 * unsigned request too — callers must check `parsed.signed` first if they
 * need to distinguish "unsigned" from "signed but invalid".
 */
export async function verifyPaymentRequest(parsed) {
  if (!parsed || !parsed.signed) return false;
  let bytes;
  try {
    bytes = canonicalRequestBytes({
      address: parsed.address,
      amount: parsed.amount,
      label: parsed.label,
      id: parsed.id,
      exp: parsed.exp,
    });
  } catch {
    return false;
  }
  return verifyBytes(parsed.publicKeyHex, bytes, parsed.signatureHex);
}

/** Unix-seconds expiry check. `now` is injectable for tests. */
export function isRequestExpired(parsed, now = Date.now()) {
  return Math.floor(now / 1000) > parsed.exp;
}
