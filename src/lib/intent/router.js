import { confirmationsForAmount } from "@/lib/hyperliquid/bridge/config";

// The bridge credits/pays out whole deposits and burns of at least 1 NAV.
export const MIN_BRIDGE_NAV = 1;
// Kept back in the wallet for the Navio network fee, which is added on top
// of the amount sent (the SDK doesn't expose a fee estimate up front).
export const NAV_FEE_RESERVE = 0.01;
const NAVIO_BLOCK_MINUTES = 2;

const r8 = (n) => Math.round(Number(n) * 1e8) / 1e8;

/**
 * What the user can spend of `symbol` in one action. NAV is one asset to the
 * user: what's already on the exchange plus what the wallet can move there.
 */
export function spendable(symbol, state) {
  if (symbol !== "NAV") return Number(state.balances?.[symbol] ?? 0);
  return r8(state.navExchange + Math.max(0, state.navWallet - NAV_FEE_RESERVE));
}

/**
 * Steps that make the account able to use the bridge at all: a Hyperliquid
 * account holding HYPE for gas (bought once with NAV through the faucet
 * service) and a one-time registration with the bridge contract.
 */
function setupSteps(state) {
  if (state.registered) return { steps: [], walletCost: 0 };
  const needsFaucet = !state.coreExists || !state.gasReady;
  if (!needsFaucet) return { steps: [{ type: "register" }], walletCost: 0 };
  if (!state.faucet) return { blocker: state.coreExists ? "no_gas" : "setup_unavailable" };
  return {
    steps: [
      { type: "faucet", amountNav: state.faucet.amountNav },
      { type: "waitAccount" },
      { type: "register" },
    ],
    walletCost: Number(state.faucet.amountNav),
    setup: state.faucet,
  };
}

/** Steps that bring `amount` more NAV from the wallet onto the exchange, until `target` is available there. */
function fundingSteps(amount, target, state) {
  if (state.bridgeUnavailable) return { blocker: "bridge_unavailable" };
  if (state.paused) return { blocker: "bridge_paused" };
  const deposit = r8(Math.max(amount, MIN_BRIDGE_NAV));
  const setup = setupSteps(state);
  if (setup.blocker) return setup;

  const walletNeeded = r8(deposit + setup.walletCost + NAV_FEE_RESERVE);
  if (walletNeeded > state.navWallet + 1e-9) return { blocker: "insufficient_balance", walletNeeded };

  return {
    steps: [...setup.steps, { type: "deposit", amount: deposit }, { type: "waitCredit", need: r8(target) }],
    deposit,
    setup: setup.setup ?? null,
    minutes: confirmationsForAmount(deposit) * NAVIO_BLOCK_MINUTES,
  };
}

/**
 * Steps that take NAV off the exchange into the wallet. `amount` null means
 * "whatever the preceding order bought". Returns { keep: reason } when the
 * NAV has to stay on the exchange instead — never a dead end, just a note.
 */
function deliverySteps({ amount, minAmount, state, destination }) {
  if (!destination) return { keep: "no_destination" };
  if (state.bridgeUnavailable) return { keep: "bridge_unavailable" };
  if (state.paused) return { keep: "bridge_paused" };
  if (minAmount < MIN_BRIDGE_NAV) return { keep: "below_minimum" };
  if (!state.gasReady) return { keep: "no_gas" };

  const steps = [];
  if (!state.registered) steps.push({ type: "register" });
  steps.push({ type: "toEvm", amount }, { type: "waitEvm" }, { type: "burn", destination });
  return { steps };
}

/**
 * Plans a swap from an already-computed quote (see quote.js). The result's
 * `steps` are what the engine runs; everything else is for the review
 * screen. `state` is the account snapshot from executors.js's readState().
 */
export function planSwap({ from, to, quote, state, destination, deliverToWallet = true }) {
  const plan = {
    kind: "swap",
    from,
    to,
    send: quote.send,
    estReceive: quote.estReceive,
    minReceive: quote.minReceive,
    steps: [],
    notes: [],
    minutes: 0,
    leavesWallet: 0, // NAV that moves from the private wallet to the public exchange
    setup: null,
    blocker: null,
  };

  if (from === "NAV") {
    const size = quote.legs[0].size;
    const fromExchange = Math.min(size, state.navExchange);
    const need = r8(size - fromExchange);
    if (need > 0) {
      const funding = fundingSteps(need, size, state);
      if (funding.blocker) return { ...plan, blocker: funding.blocker };
      plan.steps.push(...funding.steps);
      plan.leavesWallet = funding.deposit;
      plan.setup = funding.setup;
      plan.minutes = funding.minutes;
      if (funding.deposit > need) plan.notes.push("deposit_rounded_up");
    }
  } else if (quote.send > spendable(from, state) + 1e-9) {
    return { ...plan, blocker: "insufficient_balance" };
  }

  quote.legs.forEach((leg, i) => {
    plan.steps.push({
      type: "order",
      pair: leg.pair,
      base: leg.base,
      side: leg.side,
      limitPx: leg.limitPx,
      // A buy that follows a sell spends what the sell actually paid.
      size: leg.side === "buy" && i > 0 ? null : leg.size,
      minOut: leg.minOut,
    });
  });

  if (to === "NAV" && deliverToWallet) {
    const delivery = deliverySteps({ amount: null, minAmount: quote.minReceive, state, destination });
    if (delivery.keep) plan.notes.push(`stays_on_exchange:${delivery.keep}`);
    else {
      plan.steps.push(...delivery.steps);
      plan.deliversToWallet = true;
    }
  }

  return plan;
}

/**
 * Plans an explicit move of NAV between the wallet and the exchange — the
 * advanced "wrap/unwrap" action. `direction` is "toExchange" | "toWallet".
 */
export function planMove({ direction, amount, state, destination }) {
  const value = r8(amount);
  const plan = { kind: direction, from: "NAV", to: "NAV", send: value, steps: [], notes: [], minutes: 0, setup: null, blocker: null, leavesWallet: 0 };
  if (!(value > 0)) return { ...plan, blocker: "invalid_amount" };
  if (value < MIN_BRIDGE_NAV) return { ...plan, blocker: "below_minimum" };

  if (direction === "toExchange") {
    const funding = fundingSteps(value, null, state);
    if (funding.blocker) return { ...plan, blocker: funding.blocker };
    // Explicit moves wait for the deposit itself, not for a sell size.
    const steps = funding.steps.map((s) => (s.type === "waitCredit" ? { type: "waitCredit", need: null, added: value } : s));
    return { ...plan, steps, minutes: funding.minutes, setup: funding.setup, leavesWallet: value };
  }

  const onExchange = r8(state.navExchange + state.navEvm);
  if (value > onExchange + 1e-9) return { ...plan, blocker: "insufficient_balance" };
  const fromEvm = Math.min(value, state.navEvm);
  const toMove = r8(value - fromEvm);
  const delivery = deliverySteps({ amount: toMove, minAmount: value, state, destination });
  if (delivery.keep) return { ...plan, blocker: delivery.keep };
  const steps = delivery.steps
    .filter((s) => s.type !== "toEvm" || toMove > 0)
    .map((s) => (s.type === "burn" ? { ...s, amount: value } : s));
  return { ...plan, steps, deliversToWallet: true };
}

/** The few stages shown to the user, each covering one or more engine steps. */
const STAGE_OF = {
  faucet: "setup",
  waitAccount: "setup",
  register: "setup",
  deposit: "prepare",
  waitCredit: "prepare",
  order: "swap",
  toEvm: "deliver",
  waitEvm: "deliver",
  burn: "deliver",
};

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
