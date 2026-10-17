import { describe, it, expect, vi, beforeEach } from "vitest";

const played = [];
vi.mock("@/lib/txSound", () => ({ playTxSound: (kind) => played.push(kind) }));

const { toasts, trackTransactions, baselineTransactions, resetTxTracking, isTxTrackingArmed } = await import("../txNotifications.js");

const out = (txHash, amount, extra = {}) => ({ txHash, amount, tokenId: null, blockHeight: 10, isSpent: false, ...extra });

beforeEach(() => {
  resetTxTracking();
  played.length = 0;
});

describe("txNotifications", () => {
  it("announces nothing before the baseline", () => {
    trackTransactions([out("old", 5)]);
    expect(isTxTrackingArmed()).toBe(false);
    expect(toasts.value).toEqual([]);
  });

  it("announces the first new block's transaction after the baseline", () => {
    // The wallet opens already caught up: the baseline comes from the sync's
    // progress, and the very next block carries an incoming payment.
    baselineTransactions([out("old", 5)]);
    trackTransactions([out("old", 5), out("new", 700)]);
    expect(toasts.value.map((t) => [t.txHash, t.kind, t.amount])).toEqual([["new", "in", 700]]);
    expect(played).toEqual(["in"]);
  });

  it("never announces what the catch-up found", () => {
    trackTransactions([out("a", 1)]);
    baselineTransactions([out("a", 1), out("b", 2)]);
    trackTransactions([out("a", 1), out("b", 2)]);
    expect(toasts.value).toEqual([]);
    expect(played).toEqual([]);
  });

  it("plays one chime for several toasts, for the newest", () => {
    baselineTransactions([]);
    trackTransactions([out("r", 800, { memo: "Reward" }), out("i", 5)]);
    expect(toasts.value).toHaveLength(2);
    expect(played).toEqual(["in"]);
  });
});
