/**
 * Turns an intent (swap, move NAV, receive via the bridge) plus the account
 * snapshot into a plan: the requirements that are unmet, the steps the engine
 * runs to meet them and then do the thing, and everything the review screen
 * needs to say. Pure; see requirements.js for the individual checks.
 */
import { STAGE_OF } from "./steps";
import {
  MIN_BRIDGE_NAV,
  NAV_FEE_RESERVE,
  r8,
  evaluateFunding,
  evaluateDelivery,
  evaluateSetup,
  evaluateBridgeOpen,
  walletSpendable,
  exchangeSpendable,
  setupCostNav,
  stepsOf,
  firstBlocked,
  costOf,
  minutesOf,
  unmetIds,
} from "./requirements";

export { MIN_BRIDGE_NAV, NAV_FEE_RESERVE };

/**
 * What the user can spend of `symbol` in one action. NAV is one asset to the
 * user: what's already on the exchange plus what the wallet can move there.
 */
export function spendable(symbol, state) {
  if (symbol !== "NAV") return Number(state.balances?.[symbol] ?? 0);
  return r8(exchangeSpendable(state) + walletSpendable(state));
}

/** NAV the wallet can put towards a swap once the setup has been paid for. */
export function swappableNav(state) {
  const setup = setupCostNav(state);
  return r8(exchangeSpendable(state) + Math.max(0, walletSpendable(state) - setup));
}

function basePlan(kind, fields) {
  return {
    kind,
    steps: [],
    notes: [],
    requirements: [],
    unmet: [],
    minutes: 0,
    leavesWallet: 0, // NAV that moves from the private wallet to the public exchange
    setup: null, // the faucet quote when the one-time setup is part of this plan
    setupCost: 0,
    blocker: null, // code
    blocked: null, // the requirement that blocked, with its numbers
    ...fields,
  };
}

function finish(plan, reqs) {
  plan.requirements = reqs;
  plan.unmet = unmetIds(reqs);
  const blocked = firstBlocked(reqs);
  if (blocked) {
    plan.blocker = blocked.reason;
    plan.blocked = blocked;
    return plan;
  }
  const setupReq = reqs.find((r) => r.id === "tradingAccount" && !r.satisfied);
  plan.setup = setupReq?.setup ?? null;
  plan.setupCost = setupReq?.costNav ?? 0;
  plan.minutes = minutesOf(reqs);
  return plan;
}

/**
 * Plans a swap from an already-computed quote (see quote.js). The result's
 * `steps` are what the engine runs; everything else is for the review
 * screen. `state` is the account snapshot from executors.js's readAccountState().
 */
export function planSwap({ from, to, quote, state, destination, deliverToWallet = true }) {
  const plan = basePlan("swap", {
    from,
    to,
    send: quote.send,
    estReceive: quote.estReceive,
    minReceive: quote.minReceive,
    intent: { from, to, amount: quote.send, deliverToWallet },
  });
  const reqs = [];

  if (from === "NAV") {
    const size = quote.legs[0].size;
    const fromExchange = Math.min(size, exchangeSpendable(state));
    const need = r8(size - fromExchange);
    if (need > 0) {
      const funding = evaluateFunding({ amount: need, target: size, state });
      reqs.push(...funding);
      if (firstBlocked(funding)) return finish(plan, reqs);
      const deposit = funding.find((r) => r.id === "tradingBalance");
      plan.leavesWallet = deposit.deposit;
      if (deposit.roundedUp) plan.notes.push("deposit_rounded_up");
    }
  } else if (quote.send > spendable(from, state) + 1e-9) {
    reqs.push({ id: "tradingBalance", satisfied: false, resolution: "blocked", reason: "insufficient_balance", steps: [], have: spendable(from, state), symbol: from });
    return finish(plan, reqs);
  }

  const orders = quote.legs.map((leg, i) => ({
    type: "order",
    pair: leg.pair,
    base: leg.base,
    side: leg.side,
    limitPx: leg.limitPx,
    // A buy that follows a sell spends what the sell actually paid.
    size: leg.side === "buy" && i > 0 ? null : leg.size,
    minOut: leg.minOut,
  }));

  if (to === "NAV" && deliverToWallet) {
    const delivery = evaluateDelivery({ amount: null, minAmount: quote.minReceive, state, destination });
    if (delivery.resolution === "blocked") plan.notes.push(`stays_on_exchange:${delivery.reason}`);
    else {
      reqs.push({ ...delivery, afterOrders: true });
      plan.deliversToWallet = true;
    }
  }

  finish(plan, reqs);
  plan.steps = [...stepsOf(reqs.filter((r) => !r.afterOrders)), ...orders, ...stepsOf(reqs.filter((r) => r.afterOrders))];
  return plan;
}

/**
 * Plans an explicit move of NAV between the wallet and the exchange — the
 * advanced "wrap/unwrap" action. `direction` is "toExchange" | "toWallet".
 */
export function planMove({ direction, amount, state, destination }) {
  const value = r8(amount);
  const plan = basePlan(direction, { from: "NAV", to: "NAV", send: value, intent: { amount: value, destination } });
  if (!(value > 0)) return { ...plan, blocker: "invalid_amount" };
  if (value < MIN_BRIDGE_NAV) return { ...plan, blocker: "below_minimum" };

  if (direction === "toExchange") {
    const funding = evaluateFunding({ amount: value, target: null, state });
    finish(plan, funding);
    if (plan.blocker) return plan;
    plan.steps = stepsOf(funding);
    plan.leavesWallet = value;
    return plan;
  }

  const onExchange = r8(exchangeSpendable(state) + (state.navEvm || 0));
  if (value > onExchange + 1e-9) return { ...plan, blocker: "insufficient_balance", blocked: { id: "tradingBalance", reason: "insufficient_balance", have: onExchange } };
  const fromEvm = Math.min(value, state.navEvm || 0);
  const toMove = r8(value - fromEvm);
  const delivery = evaluateDelivery({ amount: toMove, minAmount: value, state, destination });
  if (delivery.resolution === "blocked") return { ...plan, blocker: delivery.reason, blocked: delivery };
  finish(plan, [delivery]);
  plan.steps = delivery.steps
    .filter((s) => s.type !== "toEvm" || toMove > 0)
    .map((s) => (s.type === "burn" ? { ...s, amount: value } : s));
  plan.deliversToWallet = true;
  return plan;
}

/**
 * Plans "receive NAV into trading from another wallet": nothing moves, the
 * account just has to be ready for the bridge to credit deposits.
 */
export function planReceiveViaBridge({ state }) {
  const plan = basePlan("receiveViaBridge", { from: "NAV", to: "NAV", send: 0, intent: {} });
  const reqs = [evaluateBridgeOpen(state)];
  if (!firstBlocked(reqs)) reqs.push(...evaluateSetup(state));
  if (!firstBlocked(reqs)) {
    const cost = costOf(reqs);
    if (cost + NAV_FEE_RESERVE > (state.navWallet || 0) + 1e-9) {
      reqs.push({ id: "walletFunds", satisfied: false, resolution: "blocked", reason: "insufficient_balance", steps: [], needed: r8(cost + NAV_FEE_RESERVE), have: r8(state.navWallet || 0), shortfall: r8(cost + NAV_FEE_RESERVE - (state.navWallet || 0)), setupCost: cost, deposit: 0 });
    }
  }
  finish(plan, reqs);
  if (!plan.blocker) plan.steps = stepsOf(reqs);
  plan.leavesWallet = plan.setupCost;
  return plan;
}

/** One entry point for every intent: { kind: 'swap' | 'toExchange' | 'toWallet' | 'receiveViaBridge', ... }. */
export function planIntent(intent, state) {
  switch (intent.kind) {
    case "swap":
      return planSwap({ ...intent, state });
    case "toExchange":
    case "toWallet":
      return planMove({ direction: intent.kind, amount: intent.amount, state, destination: intent.destination });
    case "receiveViaBridge":
      return planReceiveViaBridge({ state });
    default:
      throw new Error(`unknown intent ${intent.kind}`);
  }
}

/** Collapses engine steps into ordered user-facing stages: [{ id, status }]. */
export function stagesOf(steps) {
  const stages = [];
  for (const step of steps) {
    const id = STAGE_OF[step.type] ?? step.type;
    let stage = stages.find((s) => s.id === id);
    if (!stage) {
      stage = { id, steps: [] };
      stages.push(stage);
    }
    stage.steps.push(step);
  }
  return stages.map(({ id, steps: own }) => ({
    id,
    status: own.every((s) => s.status === "done")
      ? "done"
      : own.some((s) => s.status === "failed")
        ? "failed"
        : own.some((s) => s.status && s.status !== "pending")
          ? "active"
          : "pending",
  }));
}
