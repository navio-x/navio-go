import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMerchantStore } from "../storage/index.js";
import { deriveMerchantStorageKey } from "../crypto.js";

const SEED_HEX = "66".repeat(32);
let store;

vi.mock("../session.js", () => ({
  getMerchantStore: () => store,
  getMerchantStorageKey: async () => deriveMerchantStorageKey(SEED_HEX),
}));

const { createRequestRecord, updateRequestRecord, getRequestRecord, listRequests } = await import("../requests.js");

describe("requests storage", () => {
  beforeEach(() => {
    store = createMerchantStore(`wallet-requests-test-${Math.random()}`);
  });

  it("creates a request record with status 'active' and null outcome fields", async () => {
    const record = await createRequestRecord({
      id: "req1",
      address: "tnv1qexample",
      amountNav: "12.50000000",
      label: "Cafe Luna",
      exp: 1700000300,
      fiat: null,
      createdAt: 1700000000000,
    });
    expect(record.status).toEqual("active");
    expect(record.receivedAmountNav).toBeNull();
    expect(record.transactionId).toBeNull();
    expect(record.settledAt).toBeNull();

    const fetched = await getRequestRecord("req1");
    expect(fetched).toEqual(record);
  });

  it("stores a fiat rate-lock snapshot when provided", async () => {
    const record = await createRequestRecord({
      id: "req2",
      address: "tnv1qexample",
      amountNav: "1.00000000",
      label: "Shop",
      exp: 1700000300,
      fiat: { currency: "USD", rate: 0.15, lockedAt: 1700000000000, fiatAmount: "6.67" },
    });
    expect(record.currency).toEqual("USD");
    expect(record.fiatRate).toEqual(0.15);
    expect(record.fiatRateTimestamp).toEqual(1700000000000);
    expect(record.fiatAmount).toEqual("6.67");
  });

  it("updates status/outcome fields without disturbing the rest of the record", async () => {
    await createRequestRecord({ id: "req3", address: "tnv1qexample", amountNav: "1.00000000", label: "Shop", exp: 1700000300 });
    const updated = await updateRequestRecord("req3", {
      status: "paid",
      receivedAmountNav: 1,
      transactionId: "deadbeef",
      settledAt: 1700000100000,
    });
    expect(updated.status).toEqual("paid");
    expect(updated.transactionId).toEqual("deadbeef");
    expect(updated.address).toEqual("tnv1qexample"); // untouched fields survive
    expect(updated.updatedAt).toBeGreaterThan(0);
  });

  it("throws updating a request that doesn't exist", async () => {
    await expect(updateRequestRecord("nonexistent", { status: "paid" })).rejects.toThrow("request_not_found");
  });

  it("lists requests newest first", async () => {
    await createRequestRecord({ id: "old", address: "a", amountNav: "1", label: "A", exp: 1, createdAt: 1000 });
    await createRequestRecord({ id: "new", address: "a", amountNav: "1", label: "A", exp: 1, createdAt: 2000 });
    const list = await listRequests();
    expect(list.map((r) => r.id)).toEqual(["new", "old"]);
  });
});
