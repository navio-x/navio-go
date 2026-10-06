import { settings } from "@/stores/settings";
import { navPrice } from "@/stores/navPrice";

/** A token amount for display; small values keep more decimals. */
export function formatAmount(value, maxDecimals) {
  const n = Number(value);
  if (!Number.isFinite(n) || !n) return "0";
  const decimals = maxDecimals ?? (Math.abs(n) < 1 ? 8 : Math.abs(n) < 1000 ? 4 : 2);
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

/** A USD value in the user's display currency, or null while rates are unknown. */
export function formatFiatFromUsd(usd) {
  const currency = settings.currency ?? "USD";
  const rate = navPrice.rates[currency];
  if (usd == null || !Number.isFinite(Number(usd)) || rate == null) return null;
  return (Number(usd) * rate).toLocaleString(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
