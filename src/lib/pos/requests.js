import { encryptRecord, decryptRecord } from "./crypto.js";
import { getMerchantStore, getMerchantStorageKey } from "./session.js";

const RECORD_TYPE = "requests";

async function putRequest(record) {
  const store = getMerchantStore();
  const key = await getMerchantStorageKey();
  await store.put(RECORD_TYPE, record.id, await encryptRecord(key, record));
  return record;
}

// allSettled, not all: one record this wallet's key can't decrypt must not
// take down the rest of the list (mirrors payroll's paymentRuns.js).
async function decryptAll(key, rows) {
  const settled = await Promise.allSettled(rows.map((row) => decryptRecord(key, row.data)));
  return settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
}

export async function listRequests() {
  const store = getMerchantStore();
  const key = await getMerchantStorageKey();
  const rows = await store.list(RECORD_TYPE);
  const records = await decryptAll(key, rows);
  return records.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getRequestRecord(id) {
  const store = getMerchantStore();
  const row = await store.get(RECORD_TYPE, id);
  if (!row) return null;
  const key = await getMerchantStorageKey();
  return decryptRecord(key, row.data);
}

/**
 * Create the initial record for a freshly created payment request (status
 * 'active'). `fiat`, if the cashier used fiat entry, is the rate-lock
 * snapshot from PosHome.vue: { currency, rate, lockedAt, fiatAmount }.
 */
export async function createRequestRecord({ id, address, subAddressId, amountNav, label, exp, fiat, createdAt = Date.now() }) {
  const record = {
    id,
    address,
    subAddressId: subAddressId ?? null,
    amountNav,
    label,
    exp,
    currency: fiat?.currency ?? null,
    fiatAmount: fiat?.fiatAmount ?? null,
    fiatRate: fiat?.rate ?? null,
    fiatRateTimestamp: fiat?.lockedAt ?? null,
    status: "active",
    receivedAmountNav: null,
    transactionId: null,
    createdAt,
    settledAt: null,
    updatedAt: createdAt,
  };
  return putRequest(record);
}

/** Update an existing request's status/outcome (paid, late, cancelled). */
export async function updateRequestRecord(id, patch) {
  const existing = await getRequestRecord(id);
  if (!existing) throw new Error("request_not_found");
  return putRequest({ ...existing, ...patch, updatedAt: Date.now() });
}
