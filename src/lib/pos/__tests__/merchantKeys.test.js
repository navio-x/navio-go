import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMerchantStore } from "../storage/index.js";
import { deriveMerchantStorageKey } from "../crypto.js";

const SEED_HEX = "44".repeat(32);
let store;

// merchantKeys.js reaches storage through session.js, which in turn needs a
// live wallet (getNavioClient/walletName) to pick a store/derive a key. The
// trust-store logic itself doesn't care where the store/key come from, so —
// same approach as payroll's issuerKeys.test.js — session.js is mocked here
// to hand back a real (fake-indexeddb-backed) store and a real derived key
// without needing a wallet at all.
vi.mock("../session.js", () => ({
  getMerchantStore: () => store,
  getMerchantStorageKey: async () => deriveMerchantStorageKey(SEED_HEX),
}));

const { checkMerchant, trustMerchantKey, listMerchantKeys } = await import("../merchantKeys.js");

const KEY_A = "aa".repeat(32);
const KEY_B = "bb".repeat(32);

describe("merchantKeys", () => {
  beforeEach(() => {
    store = createMerchantStore(`wallet-merchant-test-${Math.random()}`);
  });

  it("reports 'unknown' for a label never seen before", async () => {
    const result = await checkMerchant({ label: "Cafe Luna", publicKeyHex: KEY_A });
    expect(result.status).toBe("unknown");
    expect(result.fingerprint).toMatch(/^[0-9A-F ]+$/);
  });

  it("reports 'trusted' once the same label/key pair has been trusted", async () => {
    await trustMerchantKey({ label: "Cafe Luna", publicKeyHex: KEY_A });
    const result = await checkMerchant({ label: "Cafe Luna", publicKeyHex: KEY_A });
    expect(result.status).toBe("trusted");
  });

  it("warns with 'key_changed' when a previously trusted label shows a new key", async () => {
    await trustMerchantKey({ label: "Cafe Luna", publicKeyHex: KEY_A });
    const result = await checkMerchant({ label: "Cafe Luna", publicKeyHex: KEY_B });
    expect(result.status).toBe("key_changed");
    expect(result.record.publicKeyHex).toBe(KEY_A);
  });

  it("matches labels case/whitespace-insensitively", async () => {
    await trustMerchantKey({ label: "Cafe Luna", publicKeyHex: KEY_A });
    const result = await checkMerchant({ label: "  cafe luna  ", publicKeyHex: KEY_A });
    expect(result.status).toBe("trusted");
  });

  it("does not confuse unrelated merchant labels", async () => {
    await trustMerchantKey({ label: "Cafe Luna", publicKeyHex: KEY_A });
    const result = await checkMerchant({ label: "Other Shop", publicKeyHex: KEY_B });
    expect(result.status).toBe("unknown");
  });

  it("lists trusted merchants sorted by label", async () => {
    await trustMerchantKey({ label: "Zeta Store", publicKeyHex: KEY_A });
    await trustMerchantKey({ label: "Cafe Luna", publicKeyHex: KEY_B });
    const list = await listMerchantKeys();
    expect(list.map((r) => r.label)).toEqual(["Cafe Luna", "Zeta Store"]);
  });

  it("updating trust for a changed key replaces the record (re-trusting clears the warning)", async () => {
    await trustMerchantKey({ label: "Cafe Luna", publicKeyHex: KEY_A });
    await trustMerchantKey({ label: "Cafe Luna", publicKeyHex: KEY_B });
    const result = await checkMerchant({ label: "Cafe Luna", publicKeyHex: KEY_B });
    expect(result.status).toBe("trusted");
    const list = await listMerchantKeys();
    expect(list.length).toBe(1);
  });
});
