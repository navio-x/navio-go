import { describe, it, expect } from "vitest";
import { evaluateFunding, evaluateSetup, reservedNav, setupCostNav, walletSpendable, NAV_FEE_RESERVE } from "../requirements";
import { planSwap, planReceiveViaBridge, planIntent, swappableNav } from "../router";

const ready = { navWallet: 1000, navExchange: 0, navEvm: 0, balances: { USDC: 500 }, registered: true, coreExists: true, paused: false, gasReady: true, faucet: null };
const fresh = { ...ready, registered: false, coreExists: false, gasReady: false, balances: {}, faucet: { amountNav: "28.88", usdc: "0.01", hype: "0.001" } };
const sellQuote = (size) => ({ send: size, estReceive: size * 0.04, minReceive: size * 0.039, legs: [{ side: "sell", pair: "NAV-USDC", base: "NAV", size, limitPx: "0.0395", minOut: size * 0.039 }] });

describe("requirements", () => {
  it("lists every unmet requirement for a fresh account, in order", () => {
    const reqs = evaluateFunding({ amount: 300, target: 300, state: fresh });
    expect(reqs.map((r) => `${r.id}:${r.resolution}`)).toEqual([
      "bridgeOpen:met",
      "tradingAccount:send",
      "bridgeRegistered:auto",
      "walletFunds:met",
      "tradingBalance:send",
    ]);
    expect(reqs.find((r) => r.id === "tradingAccount").costNav).toBe(28.88);
    expect(reqs.find((r) => r.id === "tradingBalance").minutes).toBe(6);
  });

  it("reports the exact shortfall when the wallet can't cover setup + deposit + fee", () => {
    const reqs = evaluateFunding({ amount: 1, target: 1, state: { ...fresh, navWallet: 1 } });
    const blocked = reqs.find((r) => r.resolution === "blocked");
    expect(blocked.id).toBe("walletFunds");
    expect(blocked.needed).toBe(Math.round((1 + 28.88 + 2 * NAV_FEE_RESERVE) * 1e8) / 1e8);
    expect(blocked.have).toBe(1);
    expect(blocked.setupCost).toBe(28.88);
  });

  it("skips what is already true", () => {
    expect(evaluateSetup(ready).every((r) => r.satisfied)).toBe(true);
    expect(evaluateSetup({ ...ready, registered: false }).map((r) => r.id + ":" + r.resolution)).toEqual(["tradingAccount:met", "bridgeRegistered:auto"]);
  });

  it("blocks honestly when the setup can't be bought", () => {
    expect(evaluateSetup({ ...fresh, faucet: null })[0].reason).toBe("setup_unavailable");
    expect(evaluateSetup({ ...fresh, coreExists: true, faucet: null })[0].reason).toBe("no_gas");
  });

  it("keeps funds other operations are about to spend out of a new plan", () => {
    const ops = [{ steps: [{ type: "deposit", status: "pending", amount: 300 }, { type: "faucet", status: "done", amountNav: "28.88" }] }];
    expect(reservedNav(ops)).toEqual({ wallet: 300, exchange: 0 });
    const state = { ...ready, navWallet: 400, reserved: reservedNav(ops) };
    expect(walletSpendable(state)).toBe(400 - 300 - NAV_FEE_RESERVE);
    expect(planSwap({ from: "NAV", to: "USDC", quote: sellQuote(300), state }).blocker).toBe("insufficient_balance");
  });

  it("values NAV as one balance less the unpaid setup", () => {
    expect(setupCostNav(fresh)).toBe(28.88);
    expect(swappableNav({ ...fresh, navWallet: 400, navExchange: 10 })).toBe(Math.round((400 - NAV_FEE_RESERVE - 28.88 + 10) * 1e8) / 1e8);
  });
});

describe("planIntent", () => {
  it("builds a setup-only process for receiving through the bridge", () => {
    const plan = planReceiveViaBridge({ state: fresh });
    expect(plan.steps.map((s) => s.type)).toEqual(["faucet", "waitAccount", "register"]);
    expect(plan.unmet).toEqual(["tradingAccount", "bridgeRegistered"]);
    expect(plan.setupCost).toBe(28.88);
    expect(planReceiveViaBridge({ state: ready }).steps).toEqual([]);
    expect(planReceiveViaBridge({ state: { ...fresh, navWallet: 1 } }).blocker).toBe("insufficient_balance");
  });

  it("routes every intent kind through the same evaluator", () => {
    expect(planIntent({ kind: "toExchange", amount: 50 }, ready).steps.map((s) => s.type)).toEqual(["deposit", "waitCredit"]);
    expect(planIntent({ kind: "toWallet", amount: 5, destination: "nav1x" }, { ...ready, navExchange: 10 }).steps.map((s) => s.type)).toEqual(["toEvm", "waitEvm", "burn", "waitPayout"]);
    expect(planIntent({ kind: "swap", from: "NAV", to: "USDC", quote: sellQuote(300) }, fresh).steps.map((s) => s.type)).toEqual(["faucet", "waitAccount", "register", "deposit", "waitCredit", "order"]);
    expect(() => planIntent({ kind: "nope" }, ready)).toThrow();
  });

  it("records the unmet requirements on the plan for the review screen", () => {
    const plan = planSwap({ from: "NAV", to: "USDC", quote: sellQuote(300), state: fresh });
    expect(plan.unmet).toEqual(["tradingAccount", "bridgeRegistered", "tradingBalance"]);
    expect(plan.setupCost).toBe(28.88);
    expect(plan.leavesWallet).toBe(300);
    expect(plan.minutes).toBe(12);
  });
});
