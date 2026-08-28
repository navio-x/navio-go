import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPayrollStore } from "../storage/index.js";
import { derivePayrollKey } from "../crypto.js";

const SEED_HEX = "55".repeat(32);
let store;
let mockKeyManager;

vi.mock("../session.js", () => ({
  getPayrollStore: () => store,
  getPayrollKey: async () => derivePayrollKey(SEED_HEX),
}));

vi.mock("@/stores/navio", () => ({
  getNavioClient: () => ({ getKeyManager: () => mockKeyManager }),
}));

vi.mock("@/stores/settings", () => ({
  settings: { employerLabel: "Acme Ltd" },
}));

const { createRun, lockRunRate, updatePayment, getPayments } = await import("../paymentRuns.js");
const { generateReceipt, latestReceiptsByPaymentId } = await import("../receipts.js");

async function markAllSent(runId, txId) {
  const payments = await getPayments(runId);
  for (const p of payments) {
    await updatePayment(p.id, { status: "sent", txId, sentAt: Date.now() });
  }
}

describe("receipts.js", () => {
  beforeEach(() => {
    store = createPayrollStore(`wallet-receipts-test-${Math.random()}`);
    mockKeyManager = { isEncrypted: () => false, isUnlocked: () => true, getMasterSeedHex: () => SEED_HEX };
  });

  it("generateReceipt throws wallet_locked instead of a raw SDK error when the wallet is encrypted and locked", async () => {
    const runId = await createRun({
      periodLabel: "August 2026",
      date: "2026-08-27",
      payments: [{ recipientId: "r1", label: "Alice", address: "addr-alice", amountSat: "100000000" }],
    });
    await markAllSent(runId, "tx-1");
    const [payment] = await getPayments(runId);

    mockKeyManager.isEncrypted = () => true;
    mockKeyManager.isUnlocked = () => false;

    await expect(generateReceipt(payment.id)).rejects.toThrow("wallet_locked");
  });

  it("generateReceipt succeeds once the wallet is unlocked", async () => {
    const runId = await createRun({
      periodLabel: "August 2026",
      date: "2026-08-27",
      payments: [{ recipientId: "r1", label: "Alice", address: "addr-alice", amountSat: "100000000" }],
    });
    await markAllSent(runId, "tx-1");
    const [payment] = await getPayments(runId);

    mockKeyManager.isEncrypted = () => true;
    mockKeyManager.isUnlocked = () => true;

    const receipt = await generateReceipt(payment.id);
    expect(receipt.employerLabel).toBe("Acme Ltd");
    expect(receipt.signature).toBeTruthy();
  });

  it("latestReceiptsByPaymentId does one store pass and returns only the newest receipt per payment", async () => {
    const runId = await createRun({
      periodLabel: "August 2026",
      date: "2026-08-27",
      payments: [
        { recipientId: "r1", label: "Alice", address: "addr-alice", amountSat: "100000000" },
        { recipientId: "r2", label: "Bob", address: "addr-bob", amountSat: "200000000" },
      ],
    });
    await markAllSent(runId, "tx-1");
    const [alice, bob] = await getPayments(runId);

    const first = await generateReceipt(alice.id);
    await new Promise((r) => setTimeout(r, 2));
    const second = await generateReceipt(alice.id); // regenerate — should supersede `first`
    await generateReceipt(bob.id);

    const latest = await latestReceiptsByPaymentId([alice.id, bob.id]);
    expect(latest.size).toBe(2);
    expect(latest.get(alice.id).id).toBe(second.id);
    expect(latest.get(alice.id).id).not.toBe(first.id);
    expect(latest.get(bob.id).recipientLabel).toBe("Bob");
  });

  it("latestReceiptsByPaymentId ignores payments not asked for", async () => {
    const runId = await createRun({
      periodLabel: "August 2026",
      date: "2026-08-27",
      payments: [{ recipientId: "r1", label: "Alice", address: "addr-alice", amountSat: "100000000" }],
    });
    await markAllSent(runId, "tx-1");
    const [payment] = await getPayments(runId);
    await generateReceipt(payment.id);

    const latest = await latestReceiptsByPaymentId(["some-other-payment-id"]);
    expect(latest.size).toBe(0);
  });
});
