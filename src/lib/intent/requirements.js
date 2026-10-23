/**
 * The prerequisite engine: what has to be true for an intent, whether it is,
 * and what it takes to make it true. Pure — the account snapshot comes from
 * executors.readAccountState() (or the dev scenario), the result is consumed
 * by router.js (steps) and by the UI (the "one-time setup" explanation and
 * the honest blocker messages).
 *
 * A requirement resolves in one of four ways:
 *   "auto"    — steps that move no funds (register, gas top-up)
 *   "send"    — steps that move the user's funds; consented to in Review
 *   "wait"    — a chain/exchange wait that follows a send
 *   "blocked" — cannot be resolved by the app; the user is told exactly why
 */
import { confirmationsForAmount } from "@/lib/hyperliquid/bridge/config";
import { MIN_ORDER_USDC } from "./quote";
import { navSendFee, navSendAllFee, NAV_FEE_FALLBACK } from "@/lib/navioFee";

// The bridge credits/pays out whole deposits and burns of at least 1 NAV.
export const MIN_BRIDGE_NAV = 1;
// The Navio network fee is paid on top of the amount sent and depends on how
// many outputs the wallet spends (see lib/navioFee.js); `state.utxos` carries
// their amounts. Without them this flat reserve stands in.
export const NAV_FEE_RESERVE = NAV_FEE_FALLBACK;
/** Fee for one wallet send of `amountNav`. */
export const walletSendFee = (state, amountNav) => navSendFee(amountNav, state.utxos);
export const NAVIO_BLOCK_MINUTES = 2;
// Confirmations the faucet waits for before crediting the account.
const FAUCET_CONFIRMATIONS = 3;

export const r8 = (n) => Math.round(Number(n) * 1e8) / 1e8;

/** NAV reserved by other operations still in flight: { wallet, exchange }. */
export function reservedNav(activeOps = []) {
  let wallet = 0;
  let exchange = 0;
  for (const op of activeOps) {
    for (const s of op.steps ?? []) {
      if (s.status === "done" || s.status === "failed") continue;
      if (s.type === "faucet") wallet += Number(s.amountNav) || 0;
      if (s.type === "deposit") wallet += Number(s.amount) || 0;
      if (s.type === "order" && s.side === "sell" && s.base === "NAV") exchange += Number(s.size) || 0;
      if (s.type === "toEvm") exchange += Number(s.amount) || 0;
    }
  }
  return { wallet: r8(wallet), exchange: r8(exchange) };
}

/** The wallet NAV the planner may spend (after the fee for spending it all and other operations). */
export function walletSpendable(state) {
  return r8(Math.max(0, (state.navWallet || 0) - navSendAllFee(state.utxos) - (state.reserved?.wallet || 0)));
}

/** Exchange NAV the planner may spend (after other operations). */
export function exchangeSpendable(state) {
  return r8(Math.max(0, (state.navExchange || 0) - (state.reserved?.exchange || 0)));
}

/** The one-time setup cost in NAV, 0 when the account is ready. */
export function setupCostNav(state) {
  if (state.registered) return 0;
  const needsFaucet = !state.coreExists || !state.gasReady;
  return needsFaucet && state.faucet ? Number(state.faucet.amountNav) || 0 : 0;
}

function req(id, satisfied, extra = {}) {
  return { id, satisfied, resolution: satisfied ? "met" : "auto", steps: [], costNav: 0, minutes: 0, ...extra };
}

function blocked(id, reason, extra = {}) {
  return req(id, false, { resolution: "blocked", reason, ...extra });
}

/**
 * The account can use the bridge at all: a Hyperliquid account holding HYPE
 * for gas (bought once with NAV through the faucet service) and the one-time
 * registration with the bridge contract.
 */
export function evaluateSetup(state) {
  const reqs = [];
  if (state.registered) {
    reqs.push(req("tradingAccount", true), req("bridgeRegistered", true));
    return reqs;
  }
  const needsFaucet = !state.coreExists || !state.gasReady;
  if (!needsFaucet) {
    reqs.push(req("tradingAccount", true));
  } else if (!state.faucet) {
    reqs.push(blocked("tradingAccount", state.coreExists ? "no_gas" : "setup_unavailable"));
  } else {
    reqs.push(
      req("tradingAccount", false, {
        resolution: "send",
        steps: [
          { type: "faucet", amountNav: state.faucet.amountNav },
          { type: "waitAccount", confirmations: FAUCET_CONFIRMATIONS, minutes: FAUCET_CONFIRMATIONS * NAVIO_BLOCK_MINUTES },
        ],
        costNav: Number(state.faucet.amountNav),
        minutes: FAUCET_CONFIRMATIONS * NAVIO_BLOCK_MINUTES,
        setup: state.faucet,
      })
    );
  }
  reqs.push(req("bridgeRegistered", false, { resolution: "auto", steps: [{ type: "register" }] }));
  return reqs;
}

/** The bridge can be used right now (mainnet, not paused). */
export function evaluateBridgeOpen(state) {
  if (state.bridgeUnavailable) return blocked("bridgeOpen", "bridge_unavailable");
  if (state.paused) return blocked("bridgeOpen", "bridge_paused");
  return req("bridgeOpen", true);
}

/**
 * `amount` more NAV has to reach the exchange (until `target` is available
 * there). Returns the requirement list for funding: bridge open, setup,
 * wallet funds, then the deposit itself.
 */
export function evaluateFunding({ amount, target, state }) {
  const reqs = [evaluateBridgeOpen(state)];
  if (reqs[0].resolution === "blocked") return reqs;
  reqs.push(...evaluateSetup(state));
  if (reqs.some((r) => r.resolution === "blocked")) return reqs;

  const deposit = r8(Math.max(amount, MIN_BRIDGE_NAV));
  const setupCost = reqs.reduce((sum, r) => sum + (r.costNav || 0), 0);
  // The setup payment and the deposit are two transactions, each with its fee.
  const fees = walletSendFee(state, deposit) + (setupCost > 0 ? walletSendFee(state, setupCost) : 0);
  const walletNeeded = r8(deposit + setupCost + fees + (state.reserved?.wallet || 0));
  if (walletNeeded > (state.navWallet || 0) + 1e-9) {
    reqs.push(
      blocked("walletFunds", "insufficient_balance", {
        needed: walletNeeded,
        have: r8(state.navWallet || 0),
        shortfall: r8(walletNeeded - (state.navWallet || 0)),
        setupCost,
        deposit,
      })
    );
    return reqs;
  }
  reqs.push(req("walletFunds", true));
  reqs.push(
    req("tradingBalance", false, {
      resolution: "send",
      steps: [
        { type: "deposit", amount: deposit },
        { type: "waitCredit", need: target == null ? null : r8(target), added: target == null ? deposit : undefined, confirmations: confirmationsForAmount(deposit), minutes: confirmationsForAmount(deposit) * NAVIO_BLOCK_MINUTES },
      ],
      costNav: deposit,
      deposit,
      roundedUp: deposit > amount + 1e-9,
      minutes: confirmationsForAmount(deposit) * NAVIO_BLOCK_MINUTES,
    })
  );
  return reqs;
}

/**
 * Bought NAV can be delivered to the wallet. Never a dead end: when it
 * can't, the NAV simply stays on the exchange and the reason is a note.
 */
export function evaluateDelivery({ amount, minAmount, state, destination }) {
  if (!destination) return blocked("deliverable", "no_destination");
  const open = evaluateBridgeOpen(state);
  if (open.resolution === "blocked") return blocked("deliverable", open.reason);
  if (minAmount < MIN_BRIDGE_NAV) return blocked("deliverable", "below_minimum");
  if (!state.gasReady) return blocked("deliverable", "no_gas");
  const steps = [];
  if (!state.registered) steps.push({ type: "register" });
  steps.push({ type: "toEvm", amount }, { type: "waitEvm" }, { type: "burn", destination }, { type: "waitPayout" });
  return req("deliverable", false, { resolution: "send", steps, costNav: 0 });
}

/** Order value check for a leg of a swap. */
export function evaluateOrderMinimum(usdcValue, navPriceUsd) {
  if (usdcValue >= MIN_ORDER_USDC) return req("orderMinimum", true);
  const navEquivalent = navPriceUsd > 0 ? Math.ceil(MIN_ORDER_USDC / navPriceUsd) : null;
  return blocked("orderMinimum", "below_minimum", { minUsdc: MIN_ORDER_USDC, navEquivalent });
}

/** Flattens the steps of a requirement list, in order. */
export const stepsOf = (reqs) => reqs.flatMap((r) => r.steps);
/** The first blocked requirement, if any. */
export const firstBlocked = (reqs) => reqs.find((r) => r.resolution === "blocked") ?? null;
/** Total NAV that leaves the wallet for the unmet requirements. */
export const costOf = (reqs) => r8(reqs.reduce((sum, r) => sum + (r.costNav || 0), 0));
/** Minutes of waiting the unmet requirements imply. */
export const minutesOf = (reqs) => reqs.reduce((sum, r) => sum + (r.minutes || 0), 0);
/** Ids of the requirements that were not met (what the process is "for"). */
export const unmetIds = (reqs) => reqs.filter((r) => !r.satisfied && r.resolution !== "blocked").map((r) => r.id);
