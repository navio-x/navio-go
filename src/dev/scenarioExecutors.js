/**
 * DEV-ONLY simulated step executors (see scenario.js). Same contract as
 * lib/intent/executors.js — { run, verify } per step type — but every chain
 * action just mutates the scenario state after a delay, and every wait
 * polls that state. The engine, the planner and the whole UI are the real
 * ones, which is the point: every journey can be exercised end to end.
 */
import { readScenario, writeScenario, schedule, fakeTxId, maybeFail } from "./scenario";
import { STEP_TYPES } from "@/lib/intent/steps";

const r8 = (n) => Math.round(Number(n) * 1e8) / 1e8;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(code, detail) {
  const err = new Error(code);
  if (detail) err.detail = detail;
  return err;
}

async function poll(api, ok, every = 1500) {
  for (;;) {
    if (ok(readScenario())) return null;
    await api.sleep(every);
  }
}

export const executors = {
  faucet: {
    async run(step, _op, api) {
      const s = readScenario();
      if (s.coreExists && s.hype > 0) return null;
      if (!s.faucet) throw fail("setup_unavailable");
      const approved = Number(step.approved?.amountNav ?? step.amountNav);
      const quoted = Number(s.faucet.amountNav);
      if (quoted > approved * 1.02) {
        const err = new Error("needs_approval");
        err.approval = { code: "setup_price_changed", amountNav: quoted, approvedNav: approved, usdc: s.faucet.usdc, hype: s.faucet.hype };
        throw err;
      }
      if (quoted + 0.01 > s.navWallet) throw fail("insufficient_wallet");
      step.amountNav = s.faucet.amountNav;
      step.walletBefore = s.navWallet;
      step.sentAt = api.now();
      api.save();
      const crash = maybeFail("faucet");
      if (crash) return crash;
      await sleep(800);
      writeScenario((cur) => ({ ...cur, navWallet: r8(cur.navWallet - quoted - 0.0002) }));
      schedule("faucet", s.sim.faucetMs, { usdc: s.faucet.usdc, hype: s.faucet.hype });
      step.txId = fakeTxId("navtx");
      return { setupTxId: step.txId };
    },
    async verify(step) {
      const s = readScenario();
      if (s.coreExists && s.hype > 0) return "done";
      if (s.pending.some((p) => p.kind === "faucet")) return "done";
      if (step.walletBefore != null && s.navWallet >= step.walletBefore - 0.001) return "not_sent";
      return "unknown";
    },
  },
  waitAccount: {
    run: (_s, _o, api) => poll(api, (s) => s.coreExists && s.hype > 0),
  },
  register: {
    async run(step, _op, api) {
      const s = readScenario();
      if (s.registered) return null;
      if (!s.coreExists) throw fail("SenderNotActivated");
      if (!(s.hypeEvm > 0 || s.hype > 0)) throw fail("no_hype_for_gas");
      maybeFail("register");
      if (!(s.hypeEvm > 0)) {
        step.detail = "moving_gas";
        api.save();
        await sleep(1200);
        writeScenario((cur) => ({ ...cur, hype: r8(cur.hype - 0.0005), hypeEvm: cur.hypeEvm + 0.0005 }));
      }
      step.detail = "registering";
      api.save();
      await sleep(1500);
      writeScenario((cur) => ({ ...cur, registered: true, hypeEvm: Math.max(0, cur.hypeEvm - 0.00001) }));
      step.hash = fakeTxId("0xreg");
      return null;
    },
  },
  deposit: {
    async run(step, _op, api) {
      const s = readScenario();
      if (s.paused) throw fail("bridge_paused");
      if (!s.registered) throw fail("SenderNotActivated");
      if (step.amount > s.navWallet) throw fail("insufficient_wallet");
      step.address = "nav1simulateddepositaddress";
      step.walletBefore = s.navWallet;
      step.creditBaseline = s.navExchange;
      step.sentAt = api.now();
      api.save();
      const crash = maybeFail("deposit");
      if (crash) return crash;
      await sleep(800);
      writeScenario((cur) => ({ ...cur, navWallet: r8(cur.navWallet - step.amount - 0.0002) }));
      schedule("credit", s.sim.creditMs, { amount: step.amount });
      step.txId = fakeTxId("navtx");
      return { depositTxId: step.txId, creditBaseline: step.creditBaseline };
    },
    async verify(step) {
      const s = readScenario();
      if (s.navExchange >= (step.creditBaseline ?? 0) + step.amount * 0.99) return "done";
      if (s.pending.some((p) => p.kind === "credit" && p.amount === step.amount)) return "done";
      if (step.walletBefore != null && s.navWallet >= step.walletBefore - 0.001) return "not_sent";
      return "unknown";
    },
  },
  waitCredit: {
    run: (step, op, api) =>
      poll(api, (s) => (step.need != null ? s.navExchange >= step.need * 0.99 : s.navExchange >= (op.ctx.creditBaseline ?? 0) + step.added * 0.99)),
  },
  order: {
    async run(step, op, api) {
      const s = readScenario();
      const price = Number(step.limitPx) || 0.0414;
      let size;
      if (step.side === "sell") {
        size = Math.min(step.size, s.navExchange);
        if (size < step.size * 0.99) throw fail("insufficient_balance");
      } else {
        size = step.size ?? r8(Math.min(op.ctx.proceeds ?? 0, s.usdc) / price);
        if (size * price > s.usdc + 1e-9) throw fail("insufficient_balance");
      }
      if (!(size > 0)) throw fail("order_too_small");
      step.cloid = fakeTxId("0xcloid");
      step.sentSize = size;
      step.sentAt = api.now();
      api.save();
      maybeFail("order");
      await sleep(1200);
      const fee = 0.0007;
      let received;
      if (step.side === "sell") {
        received = r8(size * price * (1 - fee));
        writeScenario((cur) => ({ ...cur, navExchange: r8(cur.navExchange - size), usdc: r8(cur.usdc + received) }));
      } else {
        received = r8(size * (1 - fee));
        writeScenario((cur) => ({ ...cur, usdc: r8(cur.usdc - size * price), navExchange: r8(cur.navExchange + received) }));
      }
      step.oid = Math.floor(Math.random() * 1e9);
      step.filledSz = size;
      step.avgPx = price;
      api.save();
      return {
        received,
        receivedSymbol: step.side === "sell" ? "USDC" : step.base,
        partial: false,
        ...(step.side === "sell" ? { proceeds: received, sold: size } : {}),
      };
    },
    async verify(step) {
      return step.filledSz ? "done" : "not_sent";
    },
  },
  toEvm: {
    async run(step, op, api) {
      const s = readScenario();
      const amount = r8(Math.min(step.amount ?? op.ctx.received ?? 0, s.navExchange));
      if (amount < 1) throw fail("below_minimum");
      step.exchangeBefore = s.navExchange;
      step.moveAmount = amount;
      api.save();
      maybeFail("toEvm");
      await sleep(800);
      writeScenario((cur) => ({ ...cur, navExchange: r8(cur.navExchange - amount) }));
      schedule("evm", s.sim.evmMs, { amount });
      return { burnAmount: amount };
    },
    async verify(step) {
      const s = readScenario();
      if (step.exchangeBefore != null && s.navExchange <= step.exchangeBefore - step.moveAmount * 0.99) return "done";
      return "not_sent";
    },
  },
  waitEvm: {
    run: (_s, op, api) => poll(api, (s) => s.navEvm >= (op.steps.find((x) => x.type === "burn")?.amount ?? op.ctx.burnAmount ?? 0) * 0.999),
  },
  burn: {
    async run(step, op, api) {
      const s = readScenario();
      const amount = step.amount ?? op.ctx.burnAmount;
      if (s.paused) throw fail("bridge_paused");
      if (!s.registered) throw fail("BurnerNotActivated");
      if (amount > s.navEvm + 1e-9) throw fail("insufficient_balance");
      if (!(s.hypeEvm > 0 || s.hype > 0)) throw fail("no_hype_for_gas");
      step.evmBefore = s.navEvm;
      step.burnAmount = amount;
      step.walletBefore = s.navWallet;
      api.save();
      maybeFail("burn");
      await sleep(1200);
      writeScenario((cur) => ({ ...cur, navEvm: r8(cur.navEvm - amount) }));
      schedule("payout", s.sim.payoutMs, { amount });
      step.hash = fakeTxId("0xburn");
      return { payout: { amount, baseline: step.walletBefore, at: api.now() } };
    },
    async verify(step, op, api) {
      const s = readScenario();
      if (step.evmBefore != null && s.navEvm <= step.evmBefore - step.burnAmount * 0.99) {
        op.ctx.payout = op.ctx.payout ?? { amount: step.burnAmount, baseline: step.walletBefore, at: api.now() };
        return "done";
      }
      return "not_sent";
    },
  },
};

for (const [type, def] of Object.entries(executors)) Object.assign(def, STEP_TYPES[type]);
