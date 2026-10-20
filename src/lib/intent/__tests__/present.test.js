import { describe, it, expect } from "vitest";
import { visibleSteps, progressOf, statusLine, describeStep, historyRowOf, technicalDetails } from "../present";

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
