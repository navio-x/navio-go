// Strict amount parsing for the bridge's withdrawal form. Per the task spec:
// "reject non-numeric characters, never strip them. '1,5' silently becoming
// '15' is a ten-fold withdrawal." So this rejects (returns null) rather than
// sanitizing anything ambiguous — a comma is accepted only as the sole
// decimal separator, never silently dropped, and it caps at NAV's fixed 8
// decimal places.
const STRICT_AMOUNT_RE = /^\d+([.,]\d+)?$/;
const MAX_DECIMALS = 8;

/** Returns { normalized } (a plain "1234.5" string, dot decimal) or null if the input is not unambiguously a valid positive amount. */
export function parseStrictAmount(input) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!STRICT_AMOUNT_RE.test(trimmed)) return null;

  const normalized = trimmed.replace(",", ".");
  const [whole, frac = ""] = normalized.split(".");
  if (frac.length > MAX_DECIMALS) return null;
  if (/^0+$/.test(whole) && /^0*$/.test(frac)) return null; // reject zero

  return { normalized };
}
