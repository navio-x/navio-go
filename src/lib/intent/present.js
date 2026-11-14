/**
 * Turns a persisted operation into what every surface shows — the tray, the
 * cards, the Activity page, History — so they all agree. Pure: `t` is the
 * i18n function, everything else is data.
 */
import { stepKind, STAGE_OF } from "./steps";

/** A token amount for display; small values keep more decimals (same rule as lib/displayFormat, without its settings dependency). */
export function formatAmount(value, maxDecimals) {
  const n = Number(value);
  if (!Number.isFinite(n) || !n) return "0";
  const decimals = maxDecimals ?? (Math.abs(n) < 1 ? 8 : Math.abs(n) < 1000 ? 4 : 2);
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

export const isActive = (op) => op.status === "running" || op.status === "attention" || op.status === "awaiting";
export const needsUser = (op) => op.status === "attention" || op.status === "awaiting";

/** { done, total } over the steps the user sees (waits are folded into the send they follow). */
export function progressOf(op) {
  const visible = visibleSteps(op);
  return { done: visible.filter((v) => v.state === "done").length, total: visible.length };
}

/**
 * How far an operation is, 0..1, for a progress bar. Finer than
 * `progressOf`: a send that is waiting for the network counts its
 * confirmations, so the bar of a one-step deposit moves during the wait
 * instead of standing at zero until the credit arrives.
 */
export function fractionOf(op) {
  const visible = visibleSteps(op);
  if (!visible.length) return 0;
  const sum = visible.reduce((acc, v) => acc + stepFraction(v), 0);
  return Math.min(1, sum / visible.length);
}

// Share of a step that sending it is worth; the wait that follows fills the
// rest, short of 1 until the other side has really credited.
const SENT_SHARE = 0.15;
const CONFIRMED_SHARE = 0.9;

function stepFraction({ step, wait, state }) {
  if (state === "done") return 1;
  if (step.status !== "done") return 0;
  // Sent, waiting for the network.
  const required = wait?.confirmations;
  if (!(required > 0) || wait?.confirmed == null) return SENT_SHARE;
  const confirmed = Math.min(1, Math.max(0, wait.confirmed / required));
  return SENT_SHARE + (CONFIRMED_SHARE - SENT_SHARE) * confirmed;
}

/** The step currently being worked on (first not done), or null. */
export const currentStep = (op) => op.steps.find((s) => s.status !== "done") ?? null;

/**
 * Steps as the user sees them: each `wait` step is shown as the waiting
 * phase of the send it follows, not as a step of its own.
 */
export function visibleSteps(op) {
  const out = [];
  for (const step of op.steps) {
    const kind = step.kind ?? stepKind(step.type);
    if (kind === "wait" && out.length) {
      out[out.length - 1].wait = step;
      continue;
    }
    out.push({ step, wait: null });
  }
  const cur = currentStep(op);
  return out.map((v) => ({ ...v, state: stateOf(v, cur, op) }));
}

function stateOf({ step, wait }, cur, op) {
  const own = step.status;
  if (own === "done" && (!wait || wait.status === "done")) return "done";
  if (own === "failed" || wait?.status === "failed") return "failed";
  if (op.status === "awaiting" && op.approval?.step === step.type) return "approval";
  if (op.status === "attention" && (cur === step || cur === wait)) return "failed";
  if (own === "done" && wait && wait.status !== "done") return op.status === "running" ? "waiting" : "paused";
  if (own === "active" || own === "submitting") return op.status === "running" ? "active" : "paused";
  return "upcoming";
}

const SHORT = (n) => formatAmount(n);

/** The label and detail of one visible step. */
export function describeStep({ step, wait, state }, op, t) {
  // A failed step is explained by the operation's attention block; the line
  // under the step must not read as if it had happened.
  if (state === "failed") return { label: labelOf(step, op, t), detail: "" };
  const p = { amount: SHORT(step.amountNav ?? step.amount ?? step.moveAmount ?? op.send), from: op.from, to: op.to, base: step.base };
  let label;
  let detail = "";
  switch (step.type) {
    case "faucet":
      label = t("process.step.faucet");
      detail = state === "done" ? t("process.stepDetail.faucetDone", p) : state === "waiting" ? waitingDetail("faucet", wait, op, p, t) : t("process.stepDetail.faucet", p);
      break;
    case "register":
      label = t("process.step.register");
      detail = step.detail === "moving_gas" && state === "active" ? t("process.stepDetail.movingGas") : state === "done" ? "" : t("process.stepDetail.register");
      break;
    case "deposit":
      label = t("process.step.deposit", p);
      detail = state === "waiting"
        ? waitingDetail("deposit", wait, op, p, t)
        : state === "done" ? t("process.stepDetail.depositDone", p) : t("process.stepDetail.deposit", p);
      break;
    case "order": {
      const leg = step.side === "sell" ? t("process.step.sell", { base: step.base }) : t("process.step.buy", { base: step.base });
      label = leg;
      detail = state === "done" && step.filledSz
        ? t("process.stepDetail.orderDone", { size: SHORT(step.filledSz), base: step.base, price: step.avgPx })
        : t("process.stepDetail.order", { price: step.limitPx });
      break;
    }
    case "toEvm":
      label = t("process.step.toEvm");
      detail = state === "waiting" ? t("process.stepDetail.toEvmWaiting") : "";
      break;
    case "burn": {
      label = t("process.step.burn");
      const arrived = state === "done" && wait?.status === "done" && !wait.timedOut;
      detail = arrived
        ? t("process.stepDetail.payoutDone", { amount: SHORT(step.burnAmount ?? step.amount ?? op.ctx.payout?.amount ?? op.send) })
        : state === "done" || state === "waiting" ? t("process.stepDetail.burnDone") : t("process.stepDetail.burn");
      break;
    }
    default:
      label = step.type;
  }
  return { label, detail };
}

function labelOf(step, op, t) {
  return describeStep({ step, wait: null, state: "upcoming" }, op, t).label;
}

/**
 * The line under a send that is waiting for the network. Confirmations
 * counted by the wallet are the solid fact, so they come first: "2/3", then
 * "confirmed, waiting for the other side". Before the wallet has seen the
 * transaction (or for operations planned before counts were kept) the
 * plan's minute estimate stands in.
 */
function waitingDetail(kind, wait, op, p, t) {
  const required = wait?.confirmations;
  if (required > 0 && wait?.confirmed != null) {
    if (wait.confirmed >= required) return t(`process.stepDetail.${kind}Crediting`, p);
    return t(`process.stepDetail.${kind}Confirming`, { ...p, confirmations: wait.confirmed, required });
  }
  return kind === "deposit"
    ? t("process.stepDetail.depositWaiting", { ...p, minutes: minutesLeft(wait, op) })
    : t("process.stepDetail.faucetWaiting", p);
}

/** Minutes a waiting step probably still needs, from the plan's estimate and the time already spent. */
export function minutesLeft(wait, op) {
  const estimate = wait?.minutes || op.meta?.minutes || 6;
  const started = wait?.startedAt ?? wait?.sentAt ?? op.updatedAt;
  const spent = started ? (Date.now() - started) / 60_000 : 0;
  return Math.max(1, Math.round(estimate - spent));
}

// Where a step's transaction can be followed on the web: Navio sends by
// their tx id on the Navio explorer, HyperEVM calls (the burn, gas moves)
// by their hash on the HyperEVM explorer.
const NAVIO_EXPLORER_TX = "https://blocks.nav.io/tx/";
const HYPEREVM_EXPLORER_TX = "https://hyperevmscan.io/tx/";

/**
 * Explorer links for a step (and the wait that follows it): [{ url, hash }].
 * `navioTxOf(step)` gives the id a Navio send has on chain, or null while
 * the explorer can't show it yet (unconfirmed) — see lib/navioSend.js for
 * why that is not simply `step.txId`. Without it the step's own id is used.
 */
export function explorerLinks(step, navioTxOf = null) {
  const links = [];
  const navioTx = step?.txId ? (navioTxOf ? navioTxOf(step) : step.txId) : null;
  if (navioTx) links.push({ url: NAVIO_EXPLORER_TX + navioTx, hash: navioTx });
  if (step?.hash) links.push({ url: HYPEREVM_EXPLORER_TX + step.hash, hash: step.hash });
  return links;
}

/**
 * NAV that has left one side and not yet shown up on the other, one entry
 * per transfer: [{ opId, direction: "toExchange" | "toWallet", amount, link }].
 * `link` ({ url, hash }) is the transaction that carries it on its chain's
 * explorer — the Navio send for a deposit, the HyperEVM burn for a payout —
 * or null when there is nothing to show there yet (a send still unconfirmed,
 * or one whose id the app never learnt). `navioTxOf`: see explorerLinks.
 */
export function transitItems(ops, navioTxOf = null) {
  const items = [];
  const stepOf = (op, type) => op.steps?.find((s) => s.type === type);
  for (const op of ops || []) {
    const deposit = stepOf(op, "deposit");
    const credit = stepOf(op, "waitCredit");
    if (deposit?.status === "done" && credit && credit.status !== "done" && op.status !== "cancelled") {
      items.push({ opId: op.id, direction: "toExchange", amount: deposit.amount, link: explorerLinks(deposit, navioTxOf)[0] ?? null });
    }
    if (op.ctx?.payout && !op.ctx.payoutSettled) {
      items.push({ opId: op.id, direction: "toWallet", amount: op.ctx.payout.amount, link: explorerLinks(stepOf(op, "burn"))[0] ?? null });
    }
  }
  return items;
}

/** Title + subtitle of an operation. */
export function titleOf(op, t) {
  const done = op.status === "done";
  if (op.kind === "swap") {
    const title = done ? t("process.title.swapDone", { from: op.from, to: op.to }) : t("process.title.swap", { from: op.from, to: op.to });
    const got = done && op.ctx.received != null;
    const receive = got ? SHORT(op.ctx.received) : `≈ ${SHORT(op.estReceive)}`;
    const sent = got && op.ctx.sold != null && op.steps.filter((s) => s.type === "order").length === 1 ? op.ctx.sold : op.send;
    return { title, subtitle: `${SHORT(sent)} ${op.from} → ${receive} ${op.to}` };
  }
  if (op.kind === "receiveViaBridge") return { title: t("process.title.receiveViaBridge"), subtitle: t("process.subtitle.setupOnly") };
  return { title: t(`process.title.${op.kind}`), subtitle: `${SHORT(op.send)} NAV` };
}

/** True once the bridge's payout after a burn has shown up in the wallet. */
export const payoutArrived = (op) => op.steps.some((s) => s.type === "waitPayout" && s.status === "done" && !s.timedOut);

/** The one line under a finished operation (card, page). */
export function outcomeOf(op, t) {
  if (op.status === "cancelled") return t("ops.outcome.cancelled");
  const toWallet = t(payoutArrived(op) ? "ops.outcome.toWalletArrived" : "ops.outcome.toWallet");
  if (op.kind === "toExchange") return t("ops.outcome.toExchange");
  if (op.kind === "toWallet") return toWallet;
  if (op.kind === "receiveViaBridge") return t("process.setupOnlyDone");
  const parts = [t("ops.outcome.swap", { amount: formatAmount(op.ctx.received), symbol: op.ctx.receivedSymbol ?? op.to })];
  if (op.ctx.partial) parts.push(t("ops.outcome.partial"));
  if (op.deliversToWallet) parts.push(toWallet);
  else if (op.to === "NAV") parts.push(t("ops.outcome.keptOnExchange"));
  return parts.join(" ");
}

/** One line about what is happening right now (tray, cards). */
export function statusLine(op, t) {
  if (op.status === "done") return t("process.status.done");
  if (op.status === "cancelled") return t("process.status.cancelled");
  if (op.status === "awaiting") return t("process.status.awaiting");
  if (op.status === "attention") return t("process.status.attention");
  const vis = visibleSteps(op).find((v) => v.state !== "done" && v.state !== "upcoming");
  if (!vis) return t("process.status.starting");
  const { label, detail } = describeStep(vis, op, t);
  if (vis.state === "waiting") return detail || label;
  return label;
}

/** The user-facing stages (setup / prepare / swap / deliver) present in this op, each with a status. */
export function stagesOf(op) {
  const stages = [];
  for (const step of op.steps) {
    const id = STAGE_OF[step.type] ?? step.type;
    let stage = stages.find((s) => s.id === id);
    if (!stage) stages.push((stage = { id, steps: [] }));
    stage.steps.push(step);
  }
  return stages;
}

/** The technical facts an advanced user may want: tx ids, hashes, amounts, errors. */
export function technicalDetails(op, t) {
  const rows = [{ label: t("process.tech.id"), value: op.id, mono: true }];
  for (const step of op.steps) {
    const facts = [];
    if (step.txId) facts.push(`tx ${step.txId}`);
    if (step.hash) facts.push(`hash ${step.hash}`);
    if (step.address) facts.push(`→ ${step.address}`);
    if (step.cloid) facts.push(`cloid ${step.cloid}`);
    if (step.oid) facts.push(`oid ${step.oid}`);
    if (step.filledSz) facts.push(`filled ${step.filledSz} @ ${step.avgPx}`);
    if (step.amountNav) facts.push(`${step.amountNav} NAV`);
    if (step.amount && step.type !== "order") facts.push(`${step.amount} NAV`);
    if (step.error) facts.push(`error ${step.error.code}${step.error.detail ? `: ${step.error.detail}` : ""}`);
    if (step.assumedDone) facts.push(t("process.tech.assumedDone"));
    if (step.verified) facts.push(t("process.tech.verified"));
    rows.push({ label: `${step.type} · ${step.status}${step.attempts > 1 ? ` ×${step.attempts}` : ""}`, value: facts.join(" · ") || "—", mono: true });
  }
  if (op.ctx.received != null) rows.push({ label: t("process.tech.received"), value: `${op.ctx.received} ${op.ctx.receivedSymbol ?? op.to}` });
  if (op.attention) rows.push({ label: t("process.tech.lastError"), value: `${op.attention.code}${op.attention.detail ? `: ${op.attention.detail}` : ""}`, mono: true });
  return rows;
}

/** A finished operation as one History row (technical steps inside). */
export function historyRowOf(op, t) {
  const { title, subtitle } = titleOf(op, t);
  return {
    id: `op-${op.id}`,
    source: "op",
    time: op.finishedAt ?? op.updatedAt,
    op,
    title,
    subtitle,
    cancelled: op.status === "cancelled",
  };
}
