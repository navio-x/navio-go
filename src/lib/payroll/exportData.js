import { listRuns, getRun, getPayments, listAllPayments } from "./paymentRuns.js";
import { satToNavString } from "./satAmount.js";

/**
 * Flattens a (payment, run) pair into the fixed row shape every export
 * (CSV and PDF) is built from — see exportCsv.js's CSV_FIELD_ORDER, which
 * mirrors the field names used here.
 *
 * Recipient label/address come from the *payment* snapshot, not the live
 * recipient record — same reasoning as everywhere else in payroll: a later
 * edit or archive of the recipient must not rewrite the history of a run
 * that already happened (see persist.js).
 */
function toRow(payment, run) {
  return {
    paymentId: payment.id,
    date: run.date,
    periodLabel: run.periodLabel,
    recipientLabel: payment.label,
    recipientAddress: payment.address,
    // Precise BigInt-based conversion, not Number(amountSat)/1e8 — that
    // loses precision once amountSat exceeds Number.MAX_SAFE_INTEGER,
    // which would let an exported amount silently disagree with the same
    // payment's signed receipt (receiptCanonical.js does the same split).
    amountSat: payment.amountSat,
    amountNav: satToNavString(payment.amountSat),
    currency: payment.currency,
    fiatAmount: payment.amountFiat,
    rate: run.rate?.navPriceInCurrency ?? null,
    rateTimestamp: run.rate?.lockedAt ?? null,
    transactionId: payment.txId,
    status: payment.status,
    runId: run.id,
    recipientId: payment.recipientId,
  };
}

function sortRows(rows) {
  return [...rows].sort(
    (a, b) => (a.date || "").localeCompare(b.date || "") || a.recipientLabel.localeCompare(b.recipientLabel)
  );
}

export async function resolveRunScope(runId) {
  const run = await getRun(runId);
  if (!run) throw new Error("run_not_found");
  const payments = await getPayments(runId);
  return { rows: sortRows(payments.map((p) => toRow(p, run))), meta: { scope: "run", runId, periodLabel: run.periodLabel } };
}

/** `from`/`to` are inclusive ISO date strings (run.date), either may be omitted. */
export async function resolveDateRangeScope({ from, to } = {}) {
  const runs = await listRuns();
  const inRange = runs.filter((r) => (!from || r.date >= from) && (!to || r.date <= to));
  const runsById = new Map(inRange.map((r) => [r.id, r]));
  const allPayments = await listAllPayments();
  const rows = allPayments.filter((p) => runsById.has(p.runId)).map((p) => toRow(p, runsById.get(p.runId)));
  return { rows: sortRows(rows), meta: { scope: "range", from: from || null, to: to || null } };
}

/**
 * All payments to one recipient, across every run, optionally narrowed by
 * date range and/or status. Works for archived recipients too — this only
 * ever reads payment history, never the live recipient record, so an
 * archived recipient's history is unaffected (see recipients.js).
 */
export async function resolveRecipientScope(recipientId, { from, to, status } = {}) {
  const runs = await listRuns();
  const runsById = new Map(runs.map((r) => [r.id, r]));
  const allPayments = await listAllPayments();
  const rows = allPayments
    .filter((p) => p.recipientId === recipientId && runsById.has(p.runId))
    .map((p) => ({ payment: p, run: runsById.get(p.runId) }))
    .filter(({ run }) => (!from || run.date >= from) && (!to || run.date <= to))
    .filter(({ payment }) => !status || payment.status === status)
    .map(({ payment, run }) => toRow(payment, run));
  return { rows: sortRows(rows), meta: { scope: "recipient", recipientId, from: from || null, to: to || null, status: status || null } };
}
