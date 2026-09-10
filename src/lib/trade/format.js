/**
 * Formatting helpers for the RFQ trading module. All chain amounts are
 * bigint base units — NAV uses 8 decimals like everywhere else in Navio Go
 * (see stores/navio.js's toSatoshi/formatNAV); custom tokens have no
 * decimals concept and are shown as plain integers, matching how
 * WalletAssets.vue already treats mint/send amounts.
 */
const COIN = 100_000_000n;

export function toSatoshi(navDecimal) {
  return BigInt(Math.round(navDecimal * 1e8));
}

/** Format a base-unit amount for display: NAV as decimal, tokens as integer. */
export function formatAmount(raw, isNav) {
  if (!isNav) return raw.toString();
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const whole = abs / COIN;
  const frac = (abs % COIN).toString().padStart(8, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}${frac ? "." + frac : ""}`;
}

export function shortenId(value, head = 10, tail = 6) {
  if (!value || value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/** Seconds remaining until a unix-seconds timestamp, floored at 0. */
export function secondsUntil(unixSeconds, nowMs = Date.now()) {
  return Math.max(0, Math.floor(unixSeconds - nowMs / 1000));
}

/** Compact countdown string, e.g. "4m 32s" or "expired". */
export function formatCountdown(unixSeconds, nowMs = Date.now()) {
  const secs = secondsUntil(unixSeconds, nowMs);
  if (secs <= 0) return null; // caller renders its own "expired" copy
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
