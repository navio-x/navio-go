import { roundPrice } from "@/lib/hyperliquid/precision";

// Hyperliquid rejects spot orders worth less than 10 USDC.
export const MIN_ORDER_USDC = 10;
// Used for the "minimum received" figure when the account's own fee rate
// can't be fetched — deliberately above Hyperliquid's base spot taker fee so
// the promised minimum is never overstated.
export const FALLBACK_FEE_RATE = 0.001;

/** Rounds down to `decimals` places (never up: rounding up would overspend a balance). */
export function floorTo(value, decimals) {
  const factor = 10 ** decimals;
  const floored = Math.floor(Number(value) * factor + 1e-9) / factor;
  return floored > 0 ? floored : 0;
}

/** Plain decimal string with at most `decimals` places and no trailing zeros. */
export function toDecimalString(value, decimals) {
  const fixed = Number(value).toFixed(decimals);
  return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
}

function levelsOf(levels) {
  return (levels || [])
    .map((l) => ({ px: Number(l.px), sz: Number(l.sz) }))
    .filter((l) => l.px > 0 && l.sz > 0);
}

/**
 * Quote for selling `size` of the base token into `bids` (best first).
 * The order is an IOC limit at `limitPx`, so every fill is at or above it —
 * `minOut` is what a full fill is guaranteed to pay, after the fee.
 */
export function quoteSell({ size, bids, szDecimals, slippageBps, feeRate }) {
  const sz = floorTo(size, szDecimals);
  const book = levelsOf(bids);
  if (!(sz > 0)) return { error: "invalid_amount" };
  if (!book.length) return { error: "no_liquidity" };

  let left = sz;
  let gross = 0;
  for (const lvl of book) {
    const take = Math.min(left, lvl.sz);
    gross += take * lvl.px;
    left -= take;
    if (left <= 1e-12) break;
  }
  if (left > 1e-12) return { error: "insufficient_liquidity" };

  const avgPx = gross / sz;
  const limitPx = roundPrice(avgPx * (1 - slippageBps / 10000), szDecimals);
  if (!limitPx) return { error: "no_liquidity" };
  if (gross < MIN_ORDER_USDC) return { error: "below_minimum" };

  const fee = feeRate ?? FALLBACK_FEE_RATE;
  return {
    side: "sell",
    size: sz,
    avgPx,
    limitPx,
    estIn: sz,
    estOut: gross * (1 - (feeRate ?? 0)),
    minOut: sz * Number(limitPx) * (1 - fee),
    feeOut: feeRate != null ? gross * feeRate : null,
    priceImpact: book[0].px > 0 ? Math.max(0, 1 - avgPx / book[0].px) : 0,
  };
}

/**
 * Quote for buying the base token with at most `budget` of the quote token
 * from `asks` (best first). The size is fixed up front from the worst
 * acceptable price, so the order can never cost more than the budget; a
 * better fill just spends less.
 */
export function quoteBuy({ budget, asks, szDecimals, slippageBps, feeRate }) {
  const spend = Number(budget);
  const book = levelsOf(asks);
  if (!(spend > 0)) return { error: "invalid_amount" };
  if (!book.length) return { error: "no_liquidity" };
  if (spend < MIN_ORDER_USDC) return { error: "below_minimum" };

  // Average price of spending the whole budget, walking the book.
  let left = spend;
  let got = 0;
  for (const lvl of book) {
    const cost = Math.min(left, lvl.sz * lvl.px);
    got += cost / lvl.px;
    left -= cost;
    if (left <= 1e-12) break;
  }
  if (left > 1e-9) return { error: "insufficient_liquidity" };

  const avgPx = spend / got;
  const limitPx = roundPrice(avgPx * (1 + slippageBps / 10000), szDecimals);
  if (!limitPx) return { error: "no_liquidity" };
  const size = floorTo(spend / Number(limitPx), szDecimals);
  if (!(size > 0)) return { error: "below_minimum" };

  const fee = feeRate ?? FALLBACK_FEE_RATE;
  return {
    side: "buy",
    size,
    avgPx,
    limitPx,
    estIn: size * avgPx,
    maxIn: size * Number(limitPx),
    estOut: size * (1 - (feeRate ?? 0)),
    minOut: size * (1 - fee),
    feeOut: feeRate != null ? size * feeRate : null,
    priceImpact: book[0].px > 0 ? Math.max(0, avgPx / book[0].px - 1) : 0,
  };
}

/**
 * Quote for swapping `amount` of `from` into `to`. Every market is
 * <base>/USDC, so a swap is one order when either side is USDC and two
 * (sell, then buy with the proceeds) otherwise. `books[symbol]` is
 * { bids, asks, szDecimals } for that symbol's USDC market.
 */
export function quoteSwap({ from, to, amount, books, slippageBps, feeRate }) {
  if (from === to) return { error: "same_asset" };
  const legs = [];

  let usdc = null; // USDC available to the buy leg
  let minUsdc = null;
  if (from === "USDC") {
    usdc = Number(amount);
    minUsdc = usdc;
  } else {
    const book = books[from];
    if (!book) return { error: "no_market" };
    const sell = quoteSell({ size: amount, bids: book.bids, szDecimals: book.szDecimals, slippageBps, feeRate });
    if (sell.error) return sell;
    legs.push({ ...sell, pair: `${from}-USDC`, base: from });
    usdc = sell.estOut;
    minUsdc = sell.minOut;
  }

  if (to === "USDC") {
    const sell = legs[0];
    return {
      legs,
      send: sell.size,
      estReceive: sell.estOut,
      minReceive: sell.minOut,
      rate: sell.estOut / sell.size,
      priceImpact: sell.priceImpact,
    };
  }

  const book = books[to];
  if (!book) return { error: "no_market" };
  const buy = quoteBuy({ budget: usdc, asks: book.asks, szDecimals: book.szDecimals, slippageBps, feeRate });
  if (buy.error) return buy;
  // What the buy leg is guaranteed to deliver if the sell leg only pays its minimum.
  const worst = quoteBuy({ budget: minUsdc, asks: book.asks, szDecimals: book.szDecimals, slippageBps, feeRate });
  legs.push({ ...buy, pair: `${to}-USDC`, base: to });

  if (from === "USDC") {
    // A single buy is for a fixed size: what arrives is known up front, and
    // it is the cost that varies — at most the budget, usually a bit less.
    return {
      legs,
      send: Number(amount),
      estSend: buy.estIn,
      maxSend: buy.maxIn,
      fixedReceive: true,
      estReceive: buy.estOut,
      minReceive: buy.minOut,
      rate: buy.estOut / buy.estIn,
      priceImpact: buy.priceImpact,
    };
  }

  return {
    legs,
    send: legs[0].size,
    estReceive: buy.estOut,
    minReceive: worst.error ? buy.minOut : worst.minOut,
    rate: buy.estOut / legs[0].size,
    priceImpact: Math.max(...legs.map((l) => l.priceImpact)),
  };
}
