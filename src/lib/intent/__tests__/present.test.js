import { describe, it, expect } from "vitest";
import { visibleSteps, progressOf, statusLine, describeStep, historyRowOf, technicalDetails, explorerLinks, outcomeOf } from "../present";

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

  it("links a step's transaction to the explorer of the chain it is on", () => {
    expect(explorerLinks({ type: "deposit", txId: "ab12" })).toEqual([{ url: "https://blocks.nav.io/tx/ab12", hash: "ab12" }]);
    expect(explorerLinks({ type: "burn", hash: "0xcd" })).toEqual([{ url: "https://hyperevmscan.io/tx/0xcd", hash: "0xcd" }]);
    expect(explorerLinks({ type: "order", cloid: "x" })).toEqual([]);
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
