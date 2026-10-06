import { describe, it, expect } from "vitest";
import { quoteSell, quoteBuy, quoteSwap, floorTo, toDecimalString } from "../quote";

const bids = [
  { px: "0.42", sz: "1000" },
  { px: "0.41", sz: "5000" },
];
const asks = [
  { px: "0.43", sz: "1000" },
  { px: "0.44", sz: "5000" },
];
const navBook = { bids, asks, szDecimals: 2 };

describe("floorTo / toDecimalString", () => {
  it("rounds down, never up", () => {
    expect(floorTo(1.239, 2)).toBe(1.23);
    expect(floorTo(0.004, 2)).toBe(0);
  });

  it("drops trailing zeros", () => {
    expect(toDecimalString(1.5, 8)).toBe("1.5");
    expect(toDecimalString(100, 2)).toBe("100");
  });
});

describe("quoteSell", () => {
  it("walks the book and prices the limit below the average", () => {
    const q = quoteSell({ size: 2000, bids, szDecimals: 2, slippageBps: 100, feeRate: 0.001 });
    expect(q.size).toBe(2000);
    expect(q.avgPx).toBeCloseTo(0.415, 6);
    expect(Number(q.limitPx)).toBeLessThan(q.avgPx);
    expect(q.estOut).toBeCloseTo(830 * 0.999, 6);
    // A full fill at the limit price is the guaranteed floor.
    expect(q.minOut).toBeCloseTo(2000 * Number(q.limitPx) * 0.999, 6);
    expect(q.minOut).toBeLessThan(q.estOut);
  });

  it("uses a conservative fee for the minimum when the rate is unknown", () => {
    const q = quoteSell({ size: 100, bids, szDecimals: 2, slippageBps: 100, feeRate: null });
    expect(q.feeOut).toBeNull();
    expect(q.estOut).toBeCloseTo(42, 6);
    expect(q.minOut).toBeCloseTo(100 * Number(q.limitPx) * 0.999, 6);
  });

  it("rounds the size down to the lot size", () => {
    expect(quoteSell({ size: 100.129, bids, szDecimals: 2, slippageBps: 100, feeRate: 0 }).size).toBe(100.12);
  });

  it("reports why it can't quote", () => {
    const base = { bids, szDecimals: 2, slippageBps: 100, feeRate: 0 };
    expect(quoteSell({ ...base, size: 0 }).error).toBe("invalid_amount");
    expect(quoteSell({ ...base, size: 10, bids: [] }).error).toBe("no_liquidity");
    expect(quoteSell({ ...base, size: 7000 }).error).toBe("insufficient_liquidity");
    expect(quoteSell({ ...base, size: 5 }).error).toBe("below_minimum");
  });
});

describe("quoteBuy", () => {
  it("can never cost more than the budget", () => {
    const q = quoteBuy({ budget: 100, asks, szDecimals: 2, slippageBps: 100, feeRate: 0.001 });
    expect(q.maxIn).toBeLessThanOrEqual(100);
    expect(q.size * Number(q.limitPx)).toBeLessThanOrEqual(100);
    expect(q.estOut).toBeCloseTo(q.size * 0.999, 8);
    expect(q.estIn).toBeLessThanOrEqual(q.maxIn);
  });

  it("reports why it can't quote", () => {
    const base = { asks, szDecimals: 2, slippageBps: 100, feeRate: 0 };
    expect(quoteBuy({ ...base, budget: 5 }).error).toBe("below_minimum");
    expect(quoteBuy({ ...base, budget: 100, asks: [] }).error).toBe("no_liquidity");
    expect(quoteBuy({ ...base, budget: 1_000_000 }).error).toBe("insufficient_liquidity");
  });
});

describe("quoteSwap", () => {
  const books = { NAV: navBook, BTC: { bids: [{ px: "60000", sz: "5" }], asks: [{ px: "60100", sz: "5" }], szDecimals: 5 } };
  const opts = { books, slippageBps: 100, feeRate: 0.001 };

  it("is one sell for <token> -> USDC", () => {
    const q = quoteSwap({ ...opts, from: "NAV", to: "USDC", amount: 500 });
    expect(q.legs).toHaveLength(1);
    expect(q.legs[0]).toMatchObject({ side: "sell", pair: "NAV-USDC", size: 500 });
    expect(q.send).toBe(500);
    expect(q.minReceive).toBeLessThan(q.estReceive);
  });

  it("is one buy for USDC -> <token>", () => {
    const q = quoteSwap({ ...opts, from: "USDC", to: "NAV", amount: 100 });
    expect(q.legs).toHaveLength(1);
    expect(q.legs[0]).toMatchObject({ side: "buy", pair: "NAV-USDC" });
    expect(q.send).toBe(100);
    // The size is fixed, so the amount received is known and the cost is what varies.
    expect(q.fixedReceive).toBe(true);
    expect(q.minReceive).toBe(q.estReceive);
    expect(q.estSend).toBeLessThanOrEqual(q.maxSend);
    expect(q.maxSend).toBeLessThanOrEqual(100);
    expect(q.rate).toBeCloseTo(q.estReceive / q.estSend, 10);
  });

  it("is a sell then a buy when neither side is USDC", () => {
    const q = quoteSwap({ ...opts, from: "NAV", to: "BTC", amount: 5000 });
    expect(q.legs.map((l) => l.side)).toEqual(["sell", "buy"]);
    expect(q.legs.map((l) => l.pair)).toEqual(["NAV-USDC", "BTC-USDC"]);
    // The minimum assumes both legs fill at their worst acceptable price.
    expect(q.minReceive).toBeLessThan(q.estReceive);
  });

  it("rejects unknown markets and identical assets", () => {
    expect(quoteSwap({ ...opts, from: "NAV", to: "NAV", amount: 1 }).error).toBe("same_asset");
    expect(quoteSwap({ ...opts, from: "DOGE", to: "USDC", amount: 100 }).error).toBe("no_market");
    expect(quoteSwap({ ...opts, from: "USDC", to: "DOGE", amount: 100 }).error).toBe("no_market");
  });
});
