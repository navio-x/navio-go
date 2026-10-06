import { describe, it, expect } from "vitest";
import { planSwap, planMove, spendable, stagesOf, NAV_FEE_RESERVE } from "../router";

// An account that has used the bridge before and holds gas.
const ready = {
  navWallet: 1000,
  navExchange: 0,
  navEvm: 0,
  balances: { USDC: 500 },
  registered: true,
  coreExists: true,
  paused: false,
  gasReady: true,
  faucet: null,
};
const fresh = { ...ready, registered: false, coreExists: false, gasReady: false, balances: {}, faucet: { amountNav: "25", usdc: "5", hype: "0.05" } };

const sellQuote = (size) => ({
  send: size,
  estReceive: size * 0.42,
  minReceive: size * 0.41,
  legs: [{ side: "sell", pair: "NAV-USDC", base: "NAV", size, limitPx: "0.415", minOut: size * 0.41 }],
});
const buyQuote = (size) => ({
  send: 100,
  estReceive: size,
  minReceive: size * 0.99,
  legs: [{ side: "buy", pair: "NAV-USDC", base: "NAV", size, limitPx: "0.435", minOut: size * 0.99 }],
});
const types = (plan) => plan.steps.map((s) => s.type);

describe("spendable", () => {
  it("treats NAV in the wallet and on the exchange as one balance", () => {
    expect(spendable("NAV", { ...ready, navExchange: 20 })).toBe(1020 - NAV_FEE_RESERVE);
    expect(spendable("USDC", ready)).toBe(500);
    expect(spendable("BTC", ready)).toBe(0);
  });
});

describe("planSwap: NAV -> USDC", () => {
  it("is a single order when the exchange already holds enough", () => {
    const plan = planSwap({ from: "NAV", to: "USDC", quote: sellQuote(100), state: { ...ready, navExchange: 150 } });
    expect(types(plan)).toEqual(["order"]);
    expect(plan.leavesWallet).toBe(0);
    expect(plan.minutes).toBe(0);
  });

  it("moves only the missing part from the wallet", () => {
    const plan = planSwap({ from: "NAV", to: "USDC", quote: sellQuote(100), state: { ...ready, navExchange: 30 } });
    expect(types(plan)).toEqual(["deposit", "waitCredit", "order"]);
    expect(plan.steps[0].amount).toBe(70);
    expect(plan.steps[1].need).toBe(100);
    expect(plan.leavesWallet).toBe(70);
    expect(plan.minutes).toBe(6); // < 1,000 NAV: 3 confirmations
  });

  it("rounds a tiny top-up up to the bridge minimum and says so", () => {
    const plan = planSwap({ from: "NAV", to: "USDC", quote: sellQuote(100), state: { ...ready, navExchange: 99.5 } });
    expect(plan.steps[0]).toMatchObject({ type: "deposit", amount: 1 });
    expect(plan.notes).toContain("deposit_rounded_up");
  });

  it("adds the one-time setup for a brand-new account", () => {
    const plan = planSwap({ from: "NAV", to: "USDC", quote: sellQuote(100), state: fresh });
    expect(types(plan)).toEqual(["faucet", "waitAccount", "register", "deposit", "waitCredit", "order"]);
    expect(plan.setup).toEqual(fresh.faucet);
  });

  it("only registers when the account already has gas", () => {
    const plan = planSwap({ from: "NAV", to: "USDC", quote: sellQuote(100), state: { ...ready, registered: false } });
    expect(types(plan)).toEqual(["register", "deposit", "waitCredit", "order"]);
  });

  it("blocks instead of planning something that can't finish", () => {
    const plan = (state, size = 100) => planSwap({ from: "NAV", to: "USDC", quote: sellQuote(size), state }).blocker;
    expect(plan({ ...ready, paused: true })).toBe("bridge_paused");
    expect(plan(ready, 1000)).toBe("insufficient_balance"); // nothing left for the network fee
    expect(plan({ ...fresh, faucet: null })).toBe("setup_unavailable");
    expect(plan({ ...ready, registered: false, gasReady: false })).toBe("no_gas");
    // The setup package is paid from the wallet too.
    expect(plan({ ...fresh, navWallet: 110 })).toBe("insufficient_balance");
  });
});

describe("planSwap: USDC -> NAV", () => {
  it("delivers the bought NAV to the wallet", () => {
    const plan = planSwap({ from: "USDC", to: "NAV", quote: buyQuote(230), state: ready, destination: "nav1dest" });
    expect(types(plan)).toEqual(["order", "toEvm", "waitEvm", "burn"]);
    expect(plan.steps[3].destination).toBe("nav1dest");
    expect(plan.deliversToWallet).toBe(true);
  });

  it("registers first when the account never used the bridge", () => {
    const plan = planSwap({ from: "USDC", to: "NAV", quote: buyQuote(230), state: { ...ready, registered: false }, destination: "nav1dest" });
    expect(types(plan)).toEqual(["order", "register", "toEvm", "waitEvm", "burn"]);
  });

  it("keeps the NAV on the exchange, with a reason, when it can't be delivered", () => {
    const notes = (state, size = 230, extra = {}) =>
      planSwap({ from: "USDC", to: "NAV", quote: buyQuote(size), state, destination: "nav1dest", ...extra });
    expect(notes({ ...ready, gasReady: false }).notes).toEqual(["stays_on_exchange:no_gas"]);
    expect(notes({ ...ready, paused: true }).notes).toEqual(["stays_on_exchange:bridge_paused"]);
    expect(notes(ready, 0.5).notes).toEqual(["stays_on_exchange:below_minimum"]);
    expect(types(notes({ ...ready, gasReady: false }))).toEqual(["order"]);
    // The user can also ask for it to stay there.
    const kept = notes(ready, 230, { deliverToWallet: false });
    expect(types(kept)).toEqual(["order"]);
    expect(kept.notes).toEqual([]);
  });

  it("checks the balance of the asset being spent", () => {
    const plan = planSwap({ from: "USDC", to: "NAV", quote: { ...buyQuote(230), send: 900 }, state: ready, destination: "nav1dest" });
    expect(plan.blocker).toBe("insufficient_balance");
  });
});

describe("planSwap: two-hop", () => {
  it("lets the buy spend what the sell actually paid", () => {
    const quote = {
      send: 100,
      estReceive: 0.0007,
      minReceive: 0.00068,
      legs: [
        { side: "sell", pair: "NAV-USDC", base: "NAV", size: 100, limitPx: "0.415", minOut: 41 },
        { side: "buy", pair: "BTC-USDC", base: "BTC", size: 0.0007, limitPx: "60700", minOut: 0.00068 },
      ],
    };
    const plan = planSwap({ from: "NAV", to: "BTC", quote, state: { ...ready, navExchange: 100 } });
    expect(types(plan)).toEqual(["order", "order"]);
    expect(plan.steps[0].size).toBe(100);
    expect(plan.steps[1].size).toBeNull();
  });
});

describe("planMove", () => {
  it("moves NAV to the exchange and waits for that deposit", () => {
    const plan = planMove({ direction: "toExchange", amount: 50, state: ready });
    expect(types(plan)).toEqual(["deposit", "waitCredit"]);
    expect(plan.steps[1]).toMatchObject({ need: null, added: 50 });
    expect(plan.leavesWallet).toBe(50);
  });

  it("brings NAV back, moving only what isn't already on the EVM side", () => {
    const state = { ...ready, navExchange: 80, navEvm: 20 };
    const plan = planMove({ direction: "toWallet", amount: 60, state, destination: "nav1dest" });
    expect(types(plan)).toEqual(["toEvm", "waitEvm", "burn"]);
    expect(plan.steps[0].amount).toBe(40);
    expect(plan.steps[2]).toMatchObject({ amount: 60, destination: "nav1dest" });

    const fromEvmOnly = planMove({ direction: "toWallet", amount: 15, state, destination: "nav1dest" });
    expect(types(fromEvmOnly)).toEqual(["waitEvm", "burn"]);
  });

  it("blocks on amounts and states that can't work", () => {
    const blocker = (args) => planMove({ state: ready, destination: "nav1dest", ...args }).blocker;
    expect(blocker({ direction: "toExchange", amount: 0 })).toBe("invalid_amount");
    expect(blocker({ direction: "toExchange", amount: 0.5 })).toBe("below_minimum");
    expect(blocker({ direction: "toExchange", amount: 5000 })).toBe("insufficient_balance");
    expect(blocker({ direction: "toWallet", amount: 5 })).toBe("insufficient_balance");
    expect(blocker({ direction: "toWallet", amount: 5, state: { ...ready, navExchange: 10, gasReady: false } })).toBe("no_gas");
    expect(blocker({ direction: "toWallet", amount: 5, state: { ...ready, navExchange: 10, paused: true } })).toBe("bridge_paused");
  });
});

describe("stagesOf", () => {
  it("collapses engine steps into the stages the user sees", () => {
    const steps = [
      { type: "deposit", status: "done" },
      { type: "waitCredit", status: "active" },
      { type: "order", status: "pending" },
      { type: "toEvm", status: "pending" },
      { type: "burn", status: "pending" },
    ];
    expect(stagesOf(steps)).toEqual([
      { id: "prepare", status: "active" },
      { id: "swap", status: "pending" },
      { id: "deliver", status: "pending" },
    ]);
  });

  it("marks a stage failed or done from its steps", () => {
    expect(stagesOf([{ type: "order", status: "failed" }])[0].status).toBe("failed");
    expect(stagesOf([{ type: "deposit", status: "done" }, { type: "waitCredit", status: "done" }])[0].status).toBe("done");
  });
});
