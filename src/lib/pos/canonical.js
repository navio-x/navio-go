/**
 * Deterministic canonical serialisation for signed POS payment requests.
 *
 * Same approach as payroll's receiptCanonical.js: every field is coerced to
 * a fixed-format string before being placed into the payload object, and the
 * payload is always built via the same explicit object literal (never spread
 * from caller input), so JSON.stringify's insertion-order key sequence is
 * byte-stable across engines for this fixed shape. Duplicated rather than
 * imported from payroll — see merchantCrypto.js for why.
 */

export const POS_REQUEST_FORMAT_VERSION = 1;

function str(v) {
  return v == null ? "" : String(v);
}

/** NAV amounts: fixed 8 decimal places (matches the chain's own precision). */
export function formatAmount(nav) {
  if (nav == null || nav === "") return "";
  const n = Number(nav);
  if (!Number.isFinite(n)) throw new Error("Invalid amount");
  return n.toFixed(8);
}

/** Unix seconds: integer string, truncated (no fractional seconds). */
function formatExpiry(n) {
  return n == null ? "" : String(Math.trunc(n));
}

/**
 * Build the canonical field object for a payment request. `request` fields
 * are the plain, already-typed values — this function only normalises
 * formatting and fixes field order. `label` is used exactly as it appears in
 * the URI (already sanitised/truncated by uriScheme.js) so any implementation
 * that reconstructs this payload from the URI's own visible fields gets the
 * same bytes.
 */
export function canonicalRequestFields(request) {
  return {
    formatVersion: str(POS_REQUEST_FORMAT_VERSION),
    address: str(request.address),
    amount: formatAmount(request.amount),
    label: str(request.label),
    id: str(request.id),
    exp: formatExpiry(request.exp),
  };
}

/** Canonical JSON string for a request's fields — the exact text that gets signed. */
export function canonicalRequestString(request) {
  return JSON.stringify(canonicalRequestFields(request));
}

/** Canonical UTF-8 bytes for a request's fields — what's passed to sign/verify. */
export function canonicalRequestBytes(request) {
  return new TextEncoder().encode(canonicalRequestString(request));
}
