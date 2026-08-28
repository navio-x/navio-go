/**
 * Deterministic canonical serialisation for signed receipts.
 *
 * Signing/verifying must produce byte-identical output for byte-identical
 * input on every run and every platform, so this module is the single place
 * that turns a receipt's fields into signable bytes. Two things make that
 * true here:
 *  - Every field is coerced to a fixed-format *string* before it's placed
 *    into the payload object, so there's no reliance on how a given JS
 *    engine happens to stringify numbers (exponential notation, trailing
 *    zeros, etc. all vary between engines/values).
 *  - The payload object is always built with the same field order via an
 *    explicit object literal (not spread from caller input), and JSON
 *    key order for string keys is insertion order per spec, so
 *    JSON.stringify is deterministic across engines for this fixed shape.
 */

export const RECEIPT_FORMAT_VERSION = 1;

function str(v) {
  return v == null ? "" : String(v);
}

/** Satoshi amounts are already integers — canonicalise via BigInt, never a float. */
function formatAmountSat(amountSat) {
  return BigInt(amountSat).toString();
}

/** Fiat amounts: fixed 2 decimal places. */
function formatFiatAmount(n) {
  return n == null ? "" : Number(n).toFixed(2);
}

/** Exchange rates: fixed 8 decimal places (matches NAV's own decimal precision). */
function formatRate(n) {
  return n == null ? "" : Number(n).toFixed(8);
}

/** Millisecond epoch timestamps: integer string, truncated (no fractional ms). */
function formatTimestamp(n) {
  return n == null ? "" : String(Math.trunc(n));
}

/**
 * Build the canonical field object for a receipt. `receipt` fields are the
 * plain, already-typed values (see receipts.js) — this function only
 * normalises formatting and fixes field order.
 */
export function canonicalReceiptFields(receipt) {
  return {
    formatVersion: str(RECEIPT_FORMAT_VERSION),
    employerLabel: str(receipt.employerLabel),
    employerPublicKey: str(receipt.employerPublicKey).toLowerCase(),
    recipientLabel: str(receipt.recipientLabel),
    recipientAddress: str(receipt.recipientAddress),
    amountSat: formatAmountSat(receipt.amountSat),
    currency: str(receipt.currency),
    fiatAmount: formatFiatAmount(receipt.fiatAmount),
    fiatRate: formatRate(receipt.fiatRate),
    fiatRateTimestamp: formatTimestamp(receipt.fiatRateTimestamp),
    periodLabel: str(receipt.periodLabel),
    paymentDate: str(receipt.paymentDate),
    transactionId: str(receipt.transactionId),
    issuedAt: formatTimestamp(receipt.issuedAt),
    nonce: str(receipt.nonce),
  };
}

/** Canonical JSON string for a receipt's fields — the exact text that gets signed. */
export function canonicalReceiptString(receipt) {
  return JSON.stringify(canonicalReceiptFields(receipt));
}

/** Canonical UTF-8 bytes for a receipt's fields — what's actually passed to sign/verify. */
export function canonicalReceiptBytes(receipt) {
  return new TextEncoder().encode(canonicalReceiptString(receipt));
}
