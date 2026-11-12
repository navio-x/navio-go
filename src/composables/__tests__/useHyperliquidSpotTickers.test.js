import { describe, it, expect } from "vitest";
import { ctxToTicker } from "../useHyperliquidSpotTickers";

describe("ctxToTicker", () => {
  it("maps a spot asset ctx to price / 24h change / 24h volume", () => {
    const t = ctxToTicker({ midPx: "10.694", markPx: "10.682", prevDayPx: "10.942", dayNtlVlm: "27779.90326" });
    expect(t.price).toBe(10.694);
    expect(t.change24h).toBeCloseTo(((10.694 - 10.942) / 10.942) * 100, 10);
    expect(t.volume24h).toBeCloseTo(27779.90326, 10);
  });

  it("falls back to markPx without a mid, and leaves unknowns null", () => {
    expect(ctxToTicker({ markPx: "5", prevDayPx: "4" })).toEqual({ price: 5, change24h: 25, volume24h: null });
    expect(ctxToTicker({ midPx: "5", prevDayPx: "0" }).change24h).toBeNull();
    expect(ctxToTicker({})).toEqual({ price: null, change24h: null, volume24h: null });
  });
});
