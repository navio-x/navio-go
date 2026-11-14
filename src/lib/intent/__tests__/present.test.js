import { describe, it, expect } from "vitest";
import { visibleSteps, progressOf, fractionOf, statusLine, describeStep, historyRowOf, technicalDetails, explorerLinks, outcomeOf, transitItems } from "../present";

const t = (key, p = {}) => `${key}${Object.keys(p).length ? ":" + Object.values(p).join("/") : ""}`;
const op = (status, steps, extra = {}) => ({
  id: "op1", kind: "swap", from: "NAV", to: "USDC", send: 300, estReceive: 12, status, attention: null, approval: null, ctx: {}, meta: { minutes: 12 }, createdAt: 1, updatedAt: 2, finishedAt: null,
  steps, ...extra,
});

describe("present", () => {
  it("folds each wait into the send it follows and counts progress over what the user sees", () => {
    const o = op("running", [
      { type: "faucet", kind: "send", status: "done", amountNav: "28.88" },
      { type: "waitAccount", kind: "wait", status: "done" },
      { type: "register", kind: "auto", status: "done" },
      { type: "deposit", kind: "send", status: "done", amount: 300 },
      { type: "waitCredit", kind: "wait", status: "active", minutes: 6 },
      { type: "order", kind: "order", status: "pending", side: "sell", base: "NAV", limitPx: "0.04" },
    ]);
    const vis = visibleSteps(o);
    expect(vis.map((v) => v.step.type)).toEqual(["faucet", "register", "deposit", "order"]);
    expect(vis.map((v) => v.state)).toEqual(["done", "done", "waiting", "upcoming"]);
    expect(progressOf(o)).toEqual({ done: 2, total: 4 });
    expect(statusLine(o, t)).toContain("process.stepDetail.depositWaiting");
  });

  it("counts confirmations once the wallet has seen the send, then says it is waiting on the bridge", () => {
    const steps = (confirmed) => [
      { type: "deposit", kind: "send", status: "done", amount: 300 },
      { type: "waitCredit", kind: "wait", status: "active", confirmations: 3, confirmed, minutes: 6 },
    ];
    expect(statusLine(op("running", steps(0)), t)).toMatch(/depositConfirming:.*\/0\/3$/);
    expect(statusLine(op("running", steps(2)), t)).toContain("process.stepDetail.depositConfirming");
    expect(statusLine(op("running", steps(3)), t)).toContain("process.stepDetail.depositCrediting");
    expect(statusLine(op("running", steps(undefined)), t)).toContain("process.stepDetail.depositWaiting");
  });

  it("moves the progress bar with the confirmations of a waiting send", () => {
    const steps = (confirmed, waitStatus = "active") => [
      { type: "deposit", kind: "send", status: waitStatus === "pending" ? "pending" : "done", amount: 11500 },
      { type: "waitCredit", kind: "wait", status: waitStatus, confirmations: 24, confirmed, minutes: 48 },
    ];
    expect(fractionOf(op("running", steps(undefined, "pending")))).toBe(0);
    const sent = fractionOf(op("running", steps(undefined)));
    const half = fractionOf(op("running", steps(12)));
    const full = fractionOf(op("running", steps(24)));
    expect(sent).toBeGreaterThan(0);
    expect(fractionOf(op("running", steps(0)))).toBe(sent);
    expect(half).toBeGreaterThan(sent);
    expect(full).toBeGreaterThan(half);
    // Confirmed on Navio is not arrived: the bar only fills on the credit.
    expect(full).toBeLessThan(1);
    expect(fractionOf(op("running", steps(30)))).toBe(full);
    expect(fractionOf(op("done", steps(24, "done")))).toBe(1);
  });

  it("links a step's transaction to the explorer of the chain it is on", () => {
    expect(explorerLinks({ type: "deposit", txId: "ab12" })).toEqual([{ url: "https://blocks.nav.io/tx/ab12", hash: "ab12" }]);
    expect(explorerLinks({ type: "burn", hash: "0xcd" })).toEqual([{ url: "https://hyperevmscan.io/tx/0xcd", hash: "0xcd" }]);
    expect(explorerLinks({ type: "order", cloid: "x" })).toEqual([]);
  });

  it("links a Navio send by the id it has on chain, and not before it is mined", () => {
    const step = { type: "deposit", txId: "signed", spentOutput: "in1" };
    expect(explorerLinks(step, () => "merged")).toEqual([{ url: "https://blocks.nav.io/tx/merged", hash: "merged" }]);
    expect(explorerLinks(step, () => null)).toEqual([]);
    // The resolver is only asked about Navio sends.
    expect(explorerLinks({ type: "burn", hash: "0xcd" }, () => "merged")).toEqual([{ url: "https://hyperevmscan.io/tx/0xcd", hash: "0xcd" }]);
  });

  it("keeps a withdrawal running until the bridge has paid the wallet, then says it arrived", () => {
    const steps = (payout) => [{ type: "burn", kind: "send", status: "done", amount: 5, hash: "0x1" }, { type: "waitPayout", kind: "wait", ...payout }];
    const waiting = op("running", steps({ status: "active" }), { kind: "toWallet", send: 5 });
    expect(visibleSteps(waiting).map((v) => v.state)).toEqual(["waiting"]);
    expect(statusLine(waiting, t)).toBe("process.stepDetail.burnDone");
    const arrived = op("done", steps({ status: "done" }), { kind: "toWallet", send: 5 });
    expect(describeStep(visibleSteps(arrived)[0], arrived, t).detail).toBe("process.stepDetail.payoutDone:5");
    expect(outcomeOf(arrived, t)).toBe("ops.outcome.toWalletArrived");
    expect(outcomeOf(op("done", steps({ status: "done", timedOut: true }), { kind: "toWallet", send: 5 }), t)).toBe("ops.outcome.toWallet");
  });

  it("shows approval, failure and paused states", () => {
    const steps = [{ type: "faucet", kind: "send", status: "pending", amountNav: "28.88" }, { type: "order", kind: "order", status: "pending", side: "sell", base: "NAV" }];
    expect(visibleSteps(op("awaiting", steps, { approval: { step: "faucet", code: "setup_price_changed" } }))[0].state).toBe("approval");
    expect(visibleSteps(op("attention", [{ ...steps[0], status: "failed" }, steps[1]], { attention: { code: "send_failed" } }))[0].state).toBe("failed");
    expect(visibleSteps(op("cancelled", [{ ...steps[0], status: "active" }, steps[1]]))[0].state).toBe("paused");
  });

  it("describes steps in the user's words", () => {
    const o = op("done", [{ type: "order", kind: "order", status: "done", side: "sell", base: "NAV", filledSz: 300, avgPx: 0.041 }], { ctx: { received: 12.3, receivedSymbol: "USDC", sold: 300 }, finishedAt: 5 });
    const [vis] = visibleSteps(o);
    expect(describeStep(vis, o, t)).toEqual({ label: "process.step.sell:NAV", detail: "process.stepDetail.orderDone:300/NAV/0.041" });
    const row = historyRowOf(o, t);
    expect(row).toMatchObject({ id: "op-op1", source: "op", time: 5, title: "process.title.swapDone:NAV/USDC" });
    expect(technicalDetails(o, t).map((r) => r.label)).toEqual(["process.tech.id", "order · done", "process.tech.received"]);
  });
});

describe("transitItems", () => {
  const depositOp = (over = {}) => ({
    id: "dep",
    status: "running",
    ctx: {},
    steps: [
      { type: "deposit", status: "done", amount: 500, txId: "navtx" },
      { type: "waitCredit", status: "active" },
    ],
    ...over,
  });
  const payoutOp = (over = {}) => ({
    id: "out",
    status: "done",
    ctx: { payout: { amount: 70, baseline: 0, at: 1 } },
    steps: [{ type: "burn", status: "done", hash: "0xburn" }, { type: "waitPayout", status: "done", timedOut: true }],
    ...over,
  });

  it("links a deposit under way to its Navio transaction", () => {
    expect(transitItems([depositOp()])).toEqual([
      { opId: "dep", direction: "toExchange", amount: 500, link: { url: "https://blocks.nav.io/tx/navtx", hash: "navtx" } },
    ]);
  });

  it("links a payout under way to its burn on HyperEVM", () => {
    expect(transitItems([payoutOp()])).toEqual([
      { opId: "out", direction: "toWallet", amount: 70, link: { url: "https://hyperevmscan.io/tx/0xburn", hash: "0xburn" } },
    ]);
  });

  it("has no explorer link for a deposit that is not mined yet, and the chain's id once it is", () => {
    expect(transitItems([depositOp()], () => null)[0].link).toBeNull();
    expect(transitItems([depositOp()], () => "merged")[0].link).toEqual({ url: "https://blocks.nav.io/tx/merged", hash: "merged" });
  });

  it("keeps a transfer whose transaction id is unknown, without a link", () => {
    const op = depositOp({ steps: [{ type: "deposit", status: "done", amount: 5 }, { type: "waitCredit", status: "pending" }] });
    expect(transitItems([op])).toEqual([{ opId: "dep", direction: "toExchange", amount: 5, link: null }]);
  });

  it("still lists a deposit whose credit is late", () => {
    const op = depositOp({ status: "attention", steps: [{ type: "deposit", status: "done", amount: 500, txId: "navtx" }, { type: "waitCredit", status: "failed" }] });
    expect(transitItems([op])).toHaveLength(1);
  });

  it("leaves out what has arrived, was stopped or never left", () => {
    const credited = depositOp({ steps: [{ type: "deposit", status: "done", amount: 500, txId: "a" }, { type: "waitCredit", status: "done" }] });
    const unsent = depositOp({ steps: [{ type: "deposit", status: "submitting", amount: 500 }, { type: "waitCredit", status: "pending" }] });
    const settled = payoutOp({ ctx: { payout: { amount: 70 }, payoutSettled: true } });
    expect(transitItems([credited, unsent, depositOp({ status: "cancelled" }), settled, { id: "x", status: "running", ctx: {}, steps: [] }])).toEqual([]);
    expect(transitItems(null)).toEqual([]);
  });
});
