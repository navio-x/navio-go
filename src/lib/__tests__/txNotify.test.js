import { describe, it, expect } from "vitest";
import { summarizeTxs, newTxEvents } from "../txNotify.js";

const out = (txHash, amount, extra = {}) => ({ txHash, amount, tokenId: null, blockHeight: 10, isSpent: false, ...extra });

describe("summarizeTxs", () => {
  it("adds up what each transaction paid in and spent", () => {
    const txs = summarizeTxs([
      out("a", 100, { isSpent: true, spentTxHash: "b" }),
      out("b", 30),
    ]);
    expect(txs.get("a")).toMatchObject({ received: 100, spent: 0 });
    expect(txs.get("b")).toMatchObject({ received: 30, spent: 100 });
  });

  it("ignores token outputs", () => {
    expect(summarizeTxs([out("t", 5, { tokenId: "ab" })]).size).toBe(0);
  });
});

describe("newTxEvents", () => {
  it("names received, sent and reward transactions not seen before", () => {
    const outputs = [
      out("in", 500),
      out("old", 1000, { isSpent: true, spentTxHash: "send" }),
      out("send", 200), // change
      out("rw", 800, { memo: "Reward" }),
    ];
    const { events, seen } = newTxEvents(outputs, new Set(["old"]));
    expect(events).toEqual([
      { txHash: "in", kind: "in", amount: 500, pending: false },
      { txHash: "send", kind: "out", amount: 800, pending: false },
      { txHash: "rw", kind: "reward", amount: 800, pending: false },
    ]);
    expect([...seen].sort()).toEqual(["in", "old", "rw", "send"]);
  });

  it("says nothing twice, including when a pending transaction confirms", () => {
    const first = newTxEvents([out("p", 5, { blockHeight: 0 })], new Set());
    expect(first.events[0]).toMatchObject({ kind: "in", pending: true });
    expect(newTxEvents([out("p", 5)], first.seen).events).toEqual([]);
  });

  it("leaves staking and unstaking out", () => {
    const outputs = [
      out("fund", 20_000, { isSpent: true, spentTxHash: "stake" }),
      out("stake", 10_000, { isStakedCommitment: true }),
      out("stake", 9_990),
    ];
    const { events } = newTxEvents(outputs, new Set(["fund"]));
    expect(events).toEqual([]);
  });
});
