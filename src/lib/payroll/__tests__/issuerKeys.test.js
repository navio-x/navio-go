import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPayrollStore } from "../storage/index.js";
import { derivePayrollKey } from "../crypto.js";

const SEED_HEX = "33".repeat(32);
let store;

// issuerKeys.js reaches storage through session.js, which in turn needs a
// live wallet (getNavioClient/walletName) to pick a store/derive a key. The
// trust-store logic itself doesn't care where the store/key come from, so —
// same idea as crypto.test.js deriving a key directly instead of going
// through getPayrollKey() — session.js is mocked here to hand back a real
// (fake-indexeddb-backed) store and a real derived key without needing a
// wallet at all.
vi.mock("../session.js", () => ({
  getPayrollStore: () => store,
  getPayrollKey: async () => derivePayrollKey(SEED_HEX),
}));

const { checkIssuer, trustIssuerKey, listIssuerKeys } = await import("../issuerKeys.js");

const KEY_A = "aa".repeat(32);
const KEY_B = "bb".repeat(32);

describe("issuerKeys", () => {
  beforeEach(() => {
    store = createPayrollStore(`wallet-issuer-test-${Math.random()}`);
  });

  it("reports 'unknown' for a label never seen before", async () => {
    const result = await checkIssuer({ employerLabel: "Acme Ltd", employerPublicKey: KEY_A });
    expect(result.status).toBe("unknown");
    expect(result.fingerprint).toMatch(/^[0-9A-F ]+$/);
  });

  it("reports 'trusted' once the same label/key pair has been trusted", async () => {
    await trustIssuerKey({ employerLabel: "Acme Ltd", employerPublicKey: KEY_A });
    const result = await checkIssuer({ employerLabel: "Acme Ltd", employerPublicKey: KEY_A });
    expect(result.status).toBe("trusted");
  });

  it("warns with 'key_changed' when a previously trusted label shows a new key", async () => {
    await trustIssuerKey({ employerLabel: "Acme Ltd", employerPublicKey: KEY_A });
    const result = await checkIssuer({ employerLabel: "Acme Ltd", employerPublicKey: KEY_B });
    expect(result.status).toBe("key_changed");
    expect(result.record.publicKeyHex).toBe(KEY_A);
  });

  it("matches labels case/whitespace-insensitively", async () => {
    await trustIssuerKey({ employerLabel: "Acme Ltd", employerPublicKey: KEY_A });
    const result = await checkIssuer({ employerLabel: "  acme ltd  ", employerPublicKey: KEY_A });
    expect(result.status).toBe("trusted");
  });

  it("does not confuse unrelated employer labels", async () => {
    await trustIssuerKey({ employerLabel: "Acme Ltd", employerPublicKey: KEY_A });
    const result = await checkIssuer({ employerLabel: "Other Co", employerPublicKey: KEY_B });
    expect(result.status).toBe("unknown");
  });

  it("lists trusted issuers sorted by label", async () => {
    await trustIssuerKey({ employerLabel: "Zeta Co", employerPublicKey: KEY_A });
    await trustIssuerKey({ employerLabel: "Acme Ltd", employerPublicKey: KEY_B });
    const list = await listIssuerKeys();
    expect(list.map((r) => r.employerLabel)).toEqual(["Acme Ltd", "Zeta Co"]);
  });

  it("updating trust for a changed key replaces the record (re-trusting clears the warning)", async () => {
    await trustIssuerKey({ employerLabel: "Acme Ltd", employerPublicKey: KEY_A });
    await trustIssuerKey({ employerLabel: "Acme Ltd", employerPublicKey: KEY_B });
    const result = await checkIssuer({ employerLabel: "Acme Ltd", employerPublicKey: KEY_B });
    expect(result.status).toBe("trusted");
    const list = await listIssuerKeys();
    expect(list.length).toBe(1);
  });
});
