// Hyperliquid's order validation rules (tick/lot size):
// - Size is rounded to the asset's szDecimals.
// - Price gets at most 5 significant figures AND at most (8 - szDecimals)
//   decimal places for spot (6 for perps — this app only trades spot).
//   Integer prices are exempt from the significant-figure cap.
// Getting this wrong doesn't risk funds (the API just rejects the order),
// but rounding client-side avoids a submit → reject → confused-user loop.
const MAX_DECIMALS_SPOT = 8;
const MAX_SIG_FIGS = 5;

/** Rounds a raw price to a string Hyperliquid will accept for this market. */
export function roundPrice(rawPrice, szDecimals) {
  const p = Number(rawPrice);
  if (!Number.isFinite(p) || p <= 0) return null;

  const maxDecimals = Math.max(0, MAX_DECIMALS_SPOT - szDecimals);
  const magnitude = Math.floor(Math.log10(Math.abs(p)));
  const sigFigDecimals = Math.max(0, MAX_SIG_FIGS - 1 - magnitude);
  const decimals = Math.min(maxDecimals, sigFigDecimals);

  const rounded = Number(p.toFixed(Math.max(0, decimals)));
  return rounded > 0 ? rounded.toFixed(Math.max(0, decimals)) : null;
}

/** Rounds a raw size to a string Hyperliquid will accept for this market. */
export function roundSize(rawSize, szDecimals) {
  const s = Number(rawSize);
  if (!Number.isFinite(s) || s <= 0) return null;
  const rounded = Number(s.toFixed(szDecimals));
  return rounded > 0 ? rounded.toFixed(szDecimals) : null;
}
