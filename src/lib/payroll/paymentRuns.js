import { encryptRecord, decryptRecord } from "./crypto.js";
import { getPayrollStore, getPayrollKey } from "./session.js";

const RUN_TYPE = "payment_runs";
const PAYMENT_TYPE = "payments";

async function putRun(run) {
  const store = getPayrollStore();
  const key = await getPayrollKey();
  await store.put(RUN_TYPE, run.id, await encryptRecord(key, run));
  return run;
}

async function putPayment(payment) {
  const store = getPayrollStore();
  const key = await getPayrollKey();
  await store.put(PAYMENT_TYPE, payment.id, await encryptRecord(key, payment));
  return payment;
}

// allSettled everywhere below, not all: one record this wallet's key can't
// decrypt must not take down the rest of the list (see recipients.js).
async function decryptAll(key, rows) {
  const settled = await Promise.allSettled(rows.map((row) => decryptRecord(key, row.data)));
  return settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
}

export async function listRuns() {
  const store = getPayrollStore();
  const key = await getPayrollKey();
  const rows = await store.list(RUN_TYPE);
  const runs = await decryptAll(key, rows);
  return runs.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getRun(id) {
  const store = getPayrollStore();
  const row = await store.get(RUN_TYPE, id);
  if (!row) return null;
  const key = await getPayrollKey();
  return decryptRecord(key, row.data);
}

export async function updateRun(id, patch) {
  const run = await getRun(id);
  if (!run) throw new Error("run_not_found");
  return putRun({ ...run, ...patch, updatedAt: Date.now() });
}

export async function getPayment(id) {
  const store = getPayrollStore();
  const row = await store.get(PAYMENT_TYPE, id);
  if (!row) return null;
  const key = await getPayrollKey();
  return decryptRecord(key, row.data);
}

/** Every payment across every run, unfiltered — for cross-run views (exports, recipient history). */
export async function listAllPayments() {
  const store = getPayrollStore();
  const key = await getPayrollKey();
  const rows = await store.list(PAYMENT_TYPE);
  return decryptAll(key, rows);
}

export async function getPayments(runId) {
  const store = getPayrollStore();
  const key = await getPayrollKey();
  const rows = await store.list(PAYMENT_TYPE);
  const all = await decryptAll(key, rows);
  return all.filter((p) => p.runId === runId).sort((a, b) => a.label.localeCompare(b.label));
}

export async function updatePayment(id, patch) {
  const store = getPayrollStore();
  const key = await getPayrollKey();
  const row = await store.get(PAYMENT_TYPE, id);
  if (!row) throw new Error("payment_not_found");
  const payment = await decryptRecord(key, row.data);
  return putPayment({ ...payment, ...patch, updatedAt: Date.now() });
}

/**
 * Create a run and snapshot its payment rows (status 'pending'). Recipient
 * label/address are copied in at creation time so a later edit or archive
 * of the recipient doesn't change history of an already-created run.
 *
 * @param {object} input
 * @param {string} input.periodLabel
 * @param {string} input.date - ISO date string
 * @param {Array<{recipientId:string, label:string, address:string, amountSat:string, amountFiat?:number|null, currency?:string|null}>} input.payments
 */
export async function createRun({ periodLabel, date, payments }) {
  if (!periodLabel?.trim()) throw new Error("period_label_required");
  if (!payments?.length) throw new Error("no_recipients");

  const now = Date.now();
  const run = {
    id: crypto.randomUUID(),
    periodLabel: periodLabel.trim(),
    date,
    rate: null,
    fee: null,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
  await putRun(run);

  for (const p of payments) {
    await putPayment({
      id: crypto.randomUUID(),
      runId: run.id,
      recipientId: p.recipientId,
      label: p.label,
      address: p.address,
      amountSat: String(p.amountSat),
      amountFiat: p.amountFiat ?? null,
      currency: p.currency ?? null,
      status: "pending",
      txId: null,
      error: null,
      sentAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  return run.id;
}

/** Freeze the fiat->NAV rate used to build this run's amounts. */
export async function lockRunRate(runId, { currency, navPriceInCurrency, source }) {
  return updateRun(runId, {
    rate: { currency, navPriceInCurrency, source, lockedAt: Date.now() },
  });
}

export function totalRunAmountSat(payments) {
  return payments.reduce((sum, p) => sum + BigInt(p.amountSat), 0n);
}
