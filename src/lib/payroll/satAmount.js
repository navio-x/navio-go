/**
 * Exact satoshi -> NAV decimal-string conversion via BigInt.
 *
 * `Number(amountSat) / 1e8` (used elsewhere for on-screen totals) loses
 * precision once amountSat exceeds Number.MAX_SAFE_INTEGER, because the
 * string-to-Number parse itself is lossy before division ever happens.
 * CSV/PDF exports are the actual document handed to an accountant, so
 * those numbers need to match the payment's signed receipt exactly (see
 * receiptCanonical.js, which does the same whole/fraction split for the
 * same reason) — this is the shared implementation for that.
 */
export function satToNavString(amountSat) {
  const sat = BigInt(amountSat);
  const negative = sat < 0n;
  const abs = negative ? -sat : sat;
  const whole = abs / 100000000n;
  const frac = (abs % 100000000n).toString().padStart(8, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

/** Sums a list of satoshi amounts (BigInt-exact) and formats the total. */
export function sumSatToNavString(amountsSat) {
  const total = amountsSat.reduce((sum, s) => sum + BigInt(s || 0), 0n);
  return satToNavString(total);
}
