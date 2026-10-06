import { parseUnits } from "viem";

// Shared by every Hyperliquid composable that turns the API's decimal
// strings into bigint base units (balances, order book sizes). The API is
// documented to scale values to a token's declared decimals, but parseUnits
// throws if a value ever carries more fractional digits than that —
// truncate rather than blow up a refresh.
export function safeParseUnits(value, decimals) {
  try {
    return parseUnits(value, decimals);
  } catch {
    const [whole, frac = ""] = String(value).split(".");
    return parseUnits(`${whole}.${frac.slice(0, decimals)}`, decimals);
  }
}
