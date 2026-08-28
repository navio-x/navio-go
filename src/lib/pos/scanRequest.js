/**
 * End-to-end evaluation of a scanned `navio:` payment request URI: parse,
 * expiry check, signature check, and trust-on-first-use lookup. Never
 * throws — returns a result the confirmation sheet renders directly.
 */
import { parsePaymentRequestUri, verifyPaymentRequest, isRequestExpired } from "./uriScheme.js";
import { checkMerchant } from "./merchantKeys.js";

/**
 * @returns {Promise<
 *   | { status: 'not_a_request' }
 *   | { status: 'expired', parsed: object }
 *   | { status: 'invalid_signature' }
 *   | { status: 'ok', parsed: object, verified: boolean, trust: object|null }
 * >}
 */
export async function evaluateScannedRequest(uri) {
  const parsed = parsePaymentRequestUri(uri);
  if (!parsed) return { status: "not_a_request" };

  if (isRequestExpired(parsed)) {
    return { status: "expired", parsed };
  }

  if (parsed.signed) {
    const valid = await verifyPaymentRequest(parsed);
    if (!valid) return { status: "invalid_signature" };

    const trust = await checkMerchant({ label: parsed.label, publicKeyHex: parsed.publicKeyHex });
    return { status: "ok", parsed, verified: true, trust };
  }

  // Unsigned, or from an older/unrecognised version: still payable, but the
  // merchant details can't be checked at all — mark unverified rather than
  // silently treating it as equivalent to a signed, trust-checked request.
  return { status: "ok", parsed, verified: false, trust: null };
}
