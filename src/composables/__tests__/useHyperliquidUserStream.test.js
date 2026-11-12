import { describe, it, expect } from "vitest";
import { applyOrderUpdates } from "../useHyperliquidOpenOrders";
import { mergeFills } from "../useHyperliquidTradeHistory";

const order = (oid, coin = "@107", extra = {}) => ({ coin, side: "B", limitPx: "70", sz: "1", oid, timestamp: oid, origSz: "1", ...extra });

describe("applyOrderUpdates", () => {
  it("adds an open order on top, replaces one by oid, drops any other status", () => {
    const start = [order(1), order(2)];
    const next = applyOrderUpdates(start, [
      { order: order(3), status: "open", statusTimestamp: 3 },
      { order: order(1, "@107", { sz: "0.5" }), status: "open", statusTimestamp: 4 },
      { order: order(2), status: "filled", statusTimestamp: 5 },
    ], "@107");
    expect(next.map((o) => o.oid)).toEqual([1, 3]);
    expect(next[0].sz).toBe("0.5");
    expect(start).toHaveLength(2); // input untouched
  });

  it("ignores other markets when a coin is set, and takes everything without one", () => {
    const updates = [{ order: order(9, "@142"), status: "open" }];
    expect(applyOrderUpdates([], updates, "@107")).toEqual([]);
    expect(applyOrderUpdates([], updates, null)).toHaveLength(1);
    expect(applyOrderUpdates([order(1)], [{ status: "open" }, null], "@107")).toHaveLength(1);
  });
});

describe("mergeFills", () => {
  const fill = (tid, time, coin = "@107") => ({ tid, time, coin, px: "1", sz: "1", side: "B" });

  it("puts a live fill on top and deduplicates by tid", () => {
    const have = [fill(2, 200), fill(1, 100)];
    const next = mergeFills(have, [fill(3, 300), fill(2, 200)], false, "@107");
    expect(next.map((f) => f.tid)).toEqual([3, 2, 1]);
  });

  it("replaces the list on a snapshot, newest first, filtered to the coin", () => {
    const next = mergeFills([fill(9, 900)], [fill(1, 100), fill(2, 200, "@142"), fill(3, 300)], true, "@107");
    expect(next.map((f) => f.tid)).toEqual([3, 1]);
  });

  it("caps to 30 rows", () => {
    const many = Array.from({ length: 40 }, (_, i) => fill(i, i));
    expect(mergeFills([], many, true, null)).toHaveLength(30);
  });
});

describe("mergeTrades", () => {
  const tr = (tid, time) => ({ tid, time, coin: "@107", px: "1", sz: "1", side: "B" });

  it("sorts the subscribe batch newest first and puts later pushes on top without duplicates", async () => {
    const { mergeTrades } = await import("../useHyperliquidRecentTrades");
    const batch = mergeTrades([], [tr(1, 100), tr(2, 200), tr(3, 300)]); // oldest first, as the exchange sends it
    expect(batch.map((t) => t.tid)).toEqual([3, 2, 1]);
    const next = mergeTrades(batch, [tr(4, 400), tr(3, 300)]);
    expect(next.map((t) => t.tid)).toEqual([4, 3, 2, 1]);
    expect(mergeTrades([], Array.from({ length: 40 }, (_, i) => tr(i, i)))).toHaveLength(30);
  });
});
