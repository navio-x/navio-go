import { encryptRecord, decryptRecord } from "./crypto.js";
import { getPayrollStore, getPayrollKey } from "./session.js";
import { getRun, getPayment } from "./paymentRuns.js";
import { deriveReceiptSigningKeypair, signBytes, bytesToHex } from "./receiptCrypto.js";
import { canonicalReceiptBytes, RECEIPT_FORMAT_VERSION } from "./receiptCanonical.js";
import { getNavioClient } from "@/stores/navio";
import { settings } from "@/stores/settings";

const RECORD_TYPE = "receipts";

async function signingKeypair() {
  const client = getNavioClient();
  if (!client) throw new Error("wallet_not_ready");
  const keyManager = client.getKeyManager();
  // Mirrors runSigning.js's precondition check — an encrypted wallet
  // loaded without its password can't hand back a real seed, so this
  // needs to fail with a recognizable code the UI can map to "unlock your
  // wallet", not whatever raw error getMasterSeedHex() happens to throw.
  if (keyManager.isEncrypted() && !keyManager.isUnlocked()) {
    throw new Error("wallet_locked");
  }
  const seedHex = keyManager.getMasterSeedHex();
  return deriveReceiptSigningKeypair(seedHex);
}

async function putReceipt(receipt) {
  const store = getPayrollStore();
  const key = await getPayrollKey();
  await store.put(RECORD_TYPE, receipt.id, await encryptRecord(key, receipt));
  return receipt;
}

async function listAll() {
  const store = getPayrollStore();
  const key = await getPayrollKey();
  const rows = await store.list(RECORD_TYPE);
  // allSettled, not all — matches recipients.js/paymentRuns.js: a record
  // this wallet's key can't decrypt must not take down the whole list.
  const settled = await Promise.allSettled(rows.map((row) => decryptRecord(key, row.data)));
  return settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
}

/**
 * Generate a signed receipt for a single payment. The payment must actually
 * have been sent — a receipt attests to a completed payment, not a
 * pending/failed one.
 *
 * Calling this again for the same payment (e.g. "regenerate" from the UI,
 * including for a historical/older run) produces a *new* receipt — new id,
 * nonce and issuedAt, freshly signed — rather than mutating the old one.
 * Prior receipts for the payment are kept, not overwritten: regenerating
 * must never invalidate a receipt a recipient already has. Use
 * listReceiptsForPayment to find the latest.
 */
export async function generateReceipt(paymentId) {
  const payment = await getPayment(paymentId);
  if (!payment) throw new Error("payment_not_found");
  if (payment.status !== "sent" || !payment.txId) throw new Error("payment_not_sent");

  const run = await getRun(payment.runId);
  if (!run) throw new Error("run_not_found");

  const { privateKey, publicKeyHex } = await signingKeypair();

  const fields = {
    employerLabel: settings.employerLabel || "",
    employerPublicKey: publicKeyHex,
    recipientLabel: payment.label,
    recipientAddress: payment.address,
    amountSat: payment.amountSat,
    currency: payment.currency,
    fiatAmount: payment.amountFiat,
    fiatRate: run.rate?.navPriceInCurrency ?? null,
    fiatRateTimestamp: run.rate?.lockedAt ?? null,
    periodLabel: run.periodLabel,
    paymentDate: run.date,
    transactionId: payment.txId,
    issuedAt: Date.now(),
    nonce: bytesToHex(crypto.getRandomValues(new Uint8Array(16))),
  };

  const signature = await signBytes(privateKey, canonicalReceiptBytes(fields));

  const receipt = {
    id: crypto.randomUUID(),
    formatVersion: RECEIPT_FORMAT_VERSION,
    paymentId,
    runId: run.id,
    recipientId: payment.recipientId,
    ...fields,
    signature,
  };

  await putReceipt(receipt);
  return receipt;
}

export async function listReceiptsForPayment(paymentId) {
  const all = await listAll();
  return all.filter((r) => r.paymentId === paymentId).sort((a, b) => b.issuedAt - a.issuedAt);
}

/**
 * The latest receipt per payment id, for every id in `paymentIds`, in a
 * single store scan/decrypt pass. Use this instead of calling
 * listReceiptsForPayment in a loop — doing that once per payment decrypts
 * the *entire* receipt store once per payment (quadratic: a run with N
 * sent payments against a store of M receipts does N full scans instead
 * of one), which is how RunDetail.vue originally called it.
 *
 * @returns {Promise<Map<string, object>>} paymentId -> latest receipt
 */
export async function latestReceiptsByPaymentId(paymentIds) {
  const wanted = new Set(paymentIds);
  const all = await listAll();
  const latest = new Map();
  for (const r of all) {
    if (!wanted.has(r.paymentId)) continue;
    const existing = latest.get(r.paymentId);
    if (!existing || r.issuedAt > existing.issuedAt) latest.set(r.paymentId, r);
  }
  return latest;
}

export async function listReceiptsForRecipient(recipientId) {
  const all = await listAll();
  return all.filter((r) => r.recipientId === recipientId).sort((a, b) => b.issuedAt - a.issuedAt);
}

export async function getReceipt(id) {
  const store = getPayrollStore();
  const row = await store.get(RECORD_TYPE, id);
  if (!row) return null;
  const key = await getPayrollKey();
  return decryptRecord(key, row.data);
}
