import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPayrollStore } from "../storage/index.js";
import { derivePayrollKey } from "../crypto.js";

const SEED_HEX = "44".repeat(32);
let store;

// Same approach as issuerKeys.test.js: exportData.js/paymentRuns.js reach
// storage through session.js, which needs a live wallet. The scope-
// resolution logic doesn't, so session.js is mocked to a real
// (fake-indexeddb-backed) store + a directly-derived key.
vi.mock("../session.js", () => ({
  getPayrollStore: () => store,
  getPayrollKey: async () => derivePayrollKey(SEED_HEX),
}));

const { createRun, lockRunRate, updatePayment, getPayments } = await import("../paymentRuns.js");
const { resolveRunScope, resolveDateRangeScope, resolveRecipientScope } = await import("../exportData.js");

async function markAllSent(runId, txId) {
  const payments = await getPayments(runId);
  for (const p of payments) {
    await updatePayment(p.id, { status: "sent", txId, sentAt: Date.now() });
  }
}

describe("exportData scope resolvers", () => {
  beforeEach(() => {
    store = createPayrollStore(`wallet-export-test-${Math.random()}`);
  });

  it("resolveRunScope returns one row per payment in that run, and no others", async () => {
    const runAId = await createRun({
      periodLabel: "August 2026",
      date: "2026-08-27",
      payments: [
        { recipientId: "r1", label: "Alice", address: "addr-alice", amountSat: "100000000", amountFiat: 50, currency: "USD" },
        { recipientId: "r2", label: "Bob", address: "addr-bob", amountSat: "200000000", amountFiat: 100, currency: "USD" },
      ],
    });
    const runBId = await createRun({
      periodLabel: "September 2026",
      date: "2026-09-27",
      payments: [{ recipientId: "r1", label: "Alice", address: "addr-alice", amountSat: "50000000", amountFiat: 25, currency: "USD" }],
    });
    await lockRunRate(runAId, { currency: "USD", navPriceInCurrency: 0.5, source: "test" });
    await markAllSent(runAId, "tx-a");
    await markAllSent(runBId, "tx-b");

    const { rows, meta } = await resolveRunScope(runAId);
    expect(meta.scope).toBe("run");
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.runId === runAId)).toBe(true);
    const alice = rows.find((r) => r.recipientLabel === "Alice");
    expect(alice.amountNav).toBe("1.00000000");
    expect(alice.amountSat).toBe("100000000");
    expect(alice.rate).toBe(0.5);
    expect(alice.transactionId).toBe("tx-a");
    expect(alice.status).toBe("sent");
    expect(alice.date).toBe("2026-08-27");
    // Regenerating a receipt (RecipientHistory.vue) or the export UI needs
    // the underlying payment id, not just its runId/recipientId.
    const payments = await getPayments(runAId);
    expect(alice.paymentId).toBe(payments.find((p) => p.label === "Alice").id);
  });

  it("resolveRunScope throws for an unknown run", async () => {
    await expect(resolveRunScope("does-not-exist")).rejects.toThrow("run_not_found");
  });

  it("keeps amountNav exact for a payment beyond Number.MAX_SAFE_INTEGER satoshis", async () => {
    const runId = await createRun({
      periodLabel: "Big payment",
      date: "2026-08-27",
      payments: [{ recipientId: "r1", label: "Alice", address: "addr-alice", amountSat: "9007199254740993" }],
    });
    await markAllSent(runId, "tx-big");
    const { rows } = await resolveRunScope(runId);
    // Number("9007199254740993")/1e8 would round-trip through a float and
    // silently disagree with this — see satAmount.test.js.
    expect(rows[0].amountNav).toBe("90071992.54740993");
  });

  it("resolveDateRangeScope includes only runs whose date falls in range", async () => {
    const inRange = await createRun({
      periodLabel: "In range",
      date: "2026-08-15",
      payments: [{ recipientId: "r1", label: "Alice", address: "addr-alice", amountSat: "100000000" }],
    });
    const outOfRange = await createRun({
      periodLabel: "Out of range",
      date: "2026-01-01",
      payments: [{ recipientId: "r1", label: "Alice", address: "addr-alice", amountSat: "300000000" }],
    });
    await markAllSent(inRange, "tx-1");
    await markAllSent(outOfRange, "tx-2");

    const { rows } = await resolveDateRangeScope({ from: "2026-08-01", to: "2026-08-31" });
    expect(rows.length).toBe(1);
    expect(rows[0].periodLabel).toBe("In range");
  });

  it("resolveRecipientScope gathers a recipient's payments across multiple runs", async () => {
    const run1 = await createRun({
      periodLabel: "August 2026",
      date: "2026-08-01",
      payments: [
        { recipientId: "r1", label: "Alice", address: "addr-alice", amountSat: "100000000" },
        { recipientId: "r2", label: "Bob", address: "addr-bob", amountSat: "999000000" },
      ],
    });
    const run2 = await createRun({
      periodLabel: "September 2026",
      date: "2026-09-01",
      payments: [{ recipientId: "r1", label: "Alice", address: "addr-alice-new", amountSat: "150000000" }],
    });
    await markAllSent(run1, "tx-1");
    await markAllSent(run2, "tx-2");

    const { rows } = await resolveRecipientScope("r1");
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.recipientId === "r1")).toBe(true);
    // Address history is visible directly in the rows (see receiptCanonical
    // comment / Part C plan): the older payment kept its address at the
    // time, the newer one reflects the recipient's address change.
    expect(rows.map((r) => r.recipientAddress).sort()).toEqual(["addr-alice", "addr-alice-new"]);
  });

  it("resolveRecipientScope applies date-range and status filters", async () => {
    const run1 = await createRun({
      periodLabel: "August 2026",
      date: "2026-08-01",
      payments: [{ recipientId: "r1", label: "Alice", address: "addr-alice", amountSat: "100000000" }],
    });
    const run2 = await createRun({
      periodLabel: "September 2026",
      date: "2026-09-01",
      payments: [{ recipientId: "r1", label: "Alice", address: "addr-alice", amountSat: "150000000" }],
    });
    await markAllSent(run1, "tx-1");
    // run2's payment is left "pending" (never marked sent).

    const onlySent = await resolveRecipientScope("r1", { status: "sent" });
    expect(onlySent.rows.length).toBe(1);
    expect(onlySent.rows[0].periodLabel).toBe("August 2026");

    const rangeFiltered = await resolveRecipientScope("r1", { from: "2026-09-01", to: "2026-09-30" });
    expect(rangeFiltered.rows.length).toBe(1);
    expect(rangeFiltered.rows[0].periodLabel).toBe("September 2026");
  });
});
