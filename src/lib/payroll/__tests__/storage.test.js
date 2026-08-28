import { describe, it, expect, beforeEach } from "vitest";
import { createPayrollStore } from "../storage/index.js";
import { IndexedDbPayrollStore } from "../storage/indexedDbStore.js";

describe("createPayrollStore", () => {
  it("selects the IndexedDB backend", () => {
    const store = createPayrollStore("wallet-1");
    expect(store).toBeInstanceOf(IndexedDbPayrollStore);
  });

  it("scopes storage per wallet id", () => {
    const storeA = createPayrollStore("wallet-a");
    const storeB = createPayrollStore("wallet-b");
    expect(storeA.walletId).toBe("wallet-a");
    expect(storeB.walletId).toBe("wallet-b");
  });
});

describe("IndexedDbPayrollStore CRUD", () => {
  let store;

  beforeEach(() => {
    store = createPayrollStore(`wallet-test-${Math.random()}`);
  });

  it("rejects unknown record types", async () => {
    await expect(store.put("not_a_type", "id-1", {})).rejects.toThrow();
  });

  it("put/get round-trips an opaque encrypted blob", async () => {
    const blob = { ciphertext: "aa", iv: "bb", salt: "cc", version: 1 };
    await store.put("recipients", "rec-1", blob);
    const stored = await store.get("recipients", "rec-1");
    expect(stored.id).toBe("rec-1");
    expect(stored.data).toEqual(blob);
    expect(typeof stored.updatedAt).toBe("number");
  });

  it("returns null for a missing record", async () => {
    const stored = await store.get("recipients", "does-not-exist");
    expect(stored).toBeNull();
  });

  it("lists all records of a type", async () => {
    await store.put("payment_runs", "run-1", { ciphertext: "1" });
    await store.put("payment_runs", "run-2", { ciphertext: "2" });
    const all = await store.list("payment_runs");
    expect(all.map((r) => r.id).sort()).toEqual(["run-1", "run-2"]);
  });

  it("does not leak records across record types", async () => {
    await store.put("recipients", "shared-id", { ciphertext: "recipient" });
    await store.put("payments", "shared-id", { ciphertext: "payment" });
    expect((await store.get("recipients", "shared-id")).data.ciphertext).toBe("recipient");
    expect((await store.get("payments", "shared-id")).data.ciphertext).toBe("payment");
  });

  it("deletes a record", async () => {
    await store.put("recipients", "rec-del", { ciphertext: "x" });
    await store.delete("recipients", "rec-del");
    expect(await store.get("recipients", "rec-del")).toBeNull();
  });
});
