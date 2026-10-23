import { describe, it, expect, vi, beforeEach } from "vitest";

const settings = { spendConfirm: "always", spendConfirmThresholdNav: 100 };
let km = { isEncrypted: () => true, unlock: vi.fn(async (p) => p === "right") };

vi.mock("@/stores/settings", () => ({ settings }));
vi.mock("@/stores/navio", () => ({ getNavioClient: () => (km ? { getKeyManager: () => km } : null) }));

const lib = await import("../spendConfirm.js");

beforeEach(() => {
  settings.spendConfirm = "always";
  settings.spendConfirmThresholdNav = 100;
  km = { isEncrypted: () => true, unlock: vi.fn(async (p) => p === "right") };
  lib.pendingSpendConfirm.value = null;
});

describe("spendConfirmRequired", () => {
  it("always / off", () => {
    expect(lib.spendConfirmRequired(1)).toBe(true);
    expect(lib.spendConfirmRequired(null)).toBe(true);
    settings.spendConfirm = "off";
    expect(lib.spendConfirmRequired(1e6)).toBe(false);
  });

  it("threshold compares NAV amounts and always asks for non-NAV ones", () => {
    settings.spendConfirm = "threshold";
    expect(lib.spendConfirmRequired(99.99)).toBe(false);
    expect(lib.spendConfirmRequired(100)).toBe(true);
    expect(lib.spendConfirmRequired(null)).toBe(true);
    expect(lib.spendConfirmRequired(NaN)).toBe(true);
  });

  it("never asks when there is nothing to verify against", () => {
    km = { isEncrypted: () => false };
    expect(lib.spendConfirmRequired(1)).toBe(false);
    km = null;
    expect(lib.spendConfirmRequired(1)).toBe(false);
  });
});

describe("confirmSpend", () => {
  it("resolves immediately when not required", async () => {
    settings.spendConfirm = "off";
    await expect(lib.confirmSpend({ amountNav: 5 })).resolves.toBe(true);
    expect(lib.pendingSpendConfirm.value).toBeNull();
  });

  it("waits for the dialog and resolves with its answer", async () => {
    const p = lib.confirmSpend({ amountNav: 5, summaryKey: "k", summaryParams: { a: 1 } });
    expect(lib.pendingSpendConfirm.value).toMatchObject({ amountNav: 5, summaryKey: "k" });
    lib.settleSpendConfirm(true);
    await expect(p).resolves.toBe(true);
    expect(lib.pendingSpendConfirm.value).toBeNull();

    const q = lib.confirmSpend({ amountNav: 5 });
    lib.settleSpendConfirm(false);
    await expect(q).resolves.toBe(false);
  });

  it("refuses a second request while one is open", async () => {
    const first = lib.confirmSpend({ amountNav: 1 });
    await expect(lib.confirmSpend({ amountNav: 2 })).resolves.toBe(false);
    lib.settleSpendConfirm(true);
    await expect(first).resolves.toBe(true);
  });

  it("confirmProcess uses what leaves the wallet plus setup cost", async () => {
    settings.spendConfirm = "threshold";
    await expect(lib.confirmProcess({ leavesWallet: 40, setupCost: 30 })).resolves.toBe(true); // 70 < 100
    const p = lib.confirmProcess({ leavesWallet: 90, setupCost: 30 });
    expect(lib.pendingSpendConfirm.value).toMatchObject({ amountNav: 120, summaryKey: "spendConfirm.summary.process" });
    lib.settleSpendConfirm(true);
    await p;
    // No NAV leaves (e.g. bringing NAV back): unknown amount, so it asks.
    const q = lib.confirmProcess({ leavesWallet: 0 });
    expect(lib.pendingSpendConfirm.value).toMatchObject({ amountNav: null, summaryKey: "spendConfirm.summary.processNoAmount" });
    lib.settleSpendConfirm(false);
    await expect(q).resolves.toBe(false);
  });

  it("verifyWalletPassword checks against the key manager", async () => {
    await expect(lib.verifyWalletPassword("right")).resolves.toBe(true);
    await expect(lib.verifyWalletPassword("wrong")).resolves.toBe(false);
  });
});
