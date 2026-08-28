import { describe, it, expect } from "vitest";
import {
  buildPaymentRequestUri,
  parsePaymentRequestUri,
  verifyPaymentRequest,
  isRequestExpired,
  sanitizeLabel,
  deriveMerchantSigningKeypair,
  MAX_LABEL_LENGTH,
  URI_LENGTH_BUDGET,
  POS_URI_VERSION,
} from "../uriScheme.js";
import { signBytes } from "../merchantCrypto.js";
import { canonicalRequestBytes } from "../canonical.js";

const SEED_HEX_A = "11".repeat(32);
const SEED_HEX_B = "22".repeat(32);

// A real mainnet/testnet bech32m sub-address is 166 characters (3-char HRP +
// separator + 154 data chars + 8-char checksum — see key-manager.ts /
// navio-core's bech32_mod.h). This fixture matches that length and charset
// so size-budget tests reflect reality; it is not a functionally valid
// address (nothing here decodes it on-chain).
const REALISTIC_ADDRESS = "tnv1" + "q".repeat(161) + "x".repeat(1);

async function keypair(seedHex = SEED_HEX_A) {
  return deriveMerchantSigningKeypair(seedHex);
}

describe("buildPaymentRequestUri / parsePaymentRequestUri round trip", () => {
  it("round-trips all fields", async () => {
    const { privateKey, publicKeyHex } = await keypair();
    const exp = Math.floor(Date.now() / 1000) + 300;
    const built = await buildPaymentRequestUri({
      address: REALISTIC_ADDRESS,
      amount: "12.5",
      label: "Cafe Luna",
      exp,
      privateKey,
      publicKeyHex,
    });

    const parsed = parsePaymentRequestUri(built.uri);
    expect(parsed.address).toEqual(REALISTIC_ADDRESS);
    expect(parsed.amount).toEqual("12.50000000");
    expect(parsed.label).toEqual("Cafe Luna");
    expect(parsed.id).toEqual(built.id);
    expect(parsed.exp).toEqual(exp);
    expect(parsed.version).toEqual(POS_URI_VERSION);
    expect(parsed.publicKeyHex).toEqual(publicKeyHex);
    expect(parsed.signed).toBe(true);
  });

  it("verifies a genuinely signed request", async () => {
    const { privateKey, publicKeyHex } = await keypair();
    const exp = Math.floor(Date.now() / 1000) + 300;
    const built = await buildPaymentRequestUri({
      address: REALISTIC_ADDRESS,
      amount: "1",
      label: "Shop",
      exp,
      privateKey,
      publicKeyHex,
    });
    const parsed = parsePaymentRequestUri(built.uri);
    await expect(verifyPaymentRequest(parsed)).resolves.toBe(true);
  });

  it("rejects a request with any single tampered field", async () => {
    const { privateKey, publicKeyHex } = await keypair();
    const exp = Math.floor(Date.now() / 1000) + 300;
    const built = await buildPaymentRequestUri({
      address: REALISTIC_ADDRESS,
      amount: "1",
      label: "Shop",
      exp,
      privateKey,
      publicKeyHex,
    });
    const parsed = parsePaymentRequestUri(built.uri);

    for (const field of ["address", "amount", "label", "id", "exp"]) {
      const tampered = { ...parsed, [field]: field === "exp" ? parsed.exp + 1 : parsed[field] + "_x" };
      await expect(
        verifyPaymentRequest(tampered),
        `tampering "${field}" should invalidate the signature`
      ).resolves.toBe(false);
    }
  });

  it("rejects an attacker's forged request claiming the merchant's public key", async () => {
    const { privateKey, publicKeyHex } = await keypair(SEED_HEX_A);
    const exp = Math.floor(Date.now() / 1000) + 300;
    const built = await buildPaymentRequestUri({
      address: REALISTIC_ADDRESS,
      amount: "1",
      label: "Shop",
      exp,
      privateKey,
      publicKeyHex,
    });
    const parsed = parsePaymentRequestUri(built.uri);

    // Attacker modifies the amount and signs with their own key (they don't
    // have the merchant's private key), then claims the merchant's pk.
    const attacker = await keypair(SEED_HEX_B);
    const forgedFields = { ...parsed, amount: "999.00000000" };
    const forgedSigHex = await signBytes(
      attacker.privateKey,
      canonicalRequestBytes({
        address: forgedFields.address,
        amount: forgedFields.amount,
        label: forgedFields.label,
        id: forgedFields.id,
        exp: forgedFields.exp,
      })
    );
    const impersonating = { ...forgedFields, publicKeyHex: parsed.publicKeyHex, signatureHex: forgedSigHex };
    await expect(verifyPaymentRequest(impersonating)).resolves.toBe(false);
  });

  it("emits query fields in the same fixed order on every build", async () => {
    const { privateKey, publicKeyHex } = await keypair();
    const exp = 1700000000;
    const a = await buildPaymentRequestUri({
      address: REALISTIC_ADDRESS,
      amount: "5",
      label: "Shop",
      exp,
      privateKey,
      publicKeyHex,
    });
    const b = await buildPaymentRequestUri({
      address: REALISTIC_ADDRESS,
      amount: "5",
      label: "Shop",
      exp,
      privateKey,
      publicKeyHex,
    });
    const paramNames = (uri) => Array.from(new URLSearchParams(uri.split("?")[1]).keys());
    expect(paramNames(a.uri)).toEqual(["v", "amount", "label", "id", "exp", "pk", "sig"]);
    expect(paramNames(a.uri)).toEqual(paramNames(b.uri));
    // ids are independently randomised per request, so the full URI differs...
    expect(a.uri).not.toEqual(b.uri);
    // ...but signing the exact same fields (fixed id) is byte-stable.
    const fixedId = "0102030405060708";
    const fieldsA = canonicalRequestBytes({ address: REALISTIC_ADDRESS, amount: "5.00000000", label: "Shop", id: fixedId, exp });
    const fieldsB = canonicalRequestBytes({ address: REALISTIC_ADDRESS, amount: "5.00000000", label: "Shop", id: fixedId, exp });
    expect(fieldsA).toEqual(fieldsB);
  });
});

describe("parsePaymentRequestUri malformed / legacy input", () => {
  it("returns null for a non-navio URI", () => {
    expect(parsePaymentRequestUri("bitcoin:abc?amount=1")).toBeNull();
    expect(parsePaymentRequestUri("not a uri")).toBeNull();
    expect(parsePaymentRequestUri(null)).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    expect(parsePaymentRequestUri(`navio:${REALISTIC_ADDRESS}`)).toBeNull();
    expect(parsePaymentRequestUri(`navio:${REALISTIC_ADDRESS}?amount=1`)).toBeNull();
  });

  it("parses an unsigned / legacy request as unsigned rather than throwing", () => {
    const parsed = parsePaymentRequestUri(`navio:${REALISTIC_ADDRESS}?amount=1&id=abcd1234&exp=1700000000`);
    expect(parsed).not.toBeNull();
    expect(parsed.signed).toBe(false);
    expect(parsed.publicKeyHex).toBeNull();
    expect(parsed.version).toBeNull();
  });
});

describe("expiry", () => {
  it("flags a request past its exp as expired", () => {
    const parsed = { exp: 1000 };
    expect(isRequestExpired(parsed, 1001_000)).toBe(true);
    expect(isRequestExpired(parsed, 999_000)).toBe(false);
  });
});

describe("sanitizeLabel", () => {
  it("truncates to MAX_LABEL_LENGTH", () => {
    const long = "A".repeat(MAX_LABEL_LENGTH + 10);
    expect(sanitizeLabel(long).length).toEqual(MAX_LABEL_LENGTH);
  });

  it("strips newlines/tabs and trims whitespace", () => {
    expect(sanitizeLabel("  Cafe\nLuna\t  ")).toEqual("Cafe Luna");
  });
});

describe("size budget", () => {
  it("stays comfortably under the 400-char target with a realistic address and short label", async () => {
    const { privateKey, publicKeyHex } = await keypair();
    const built = await buildPaymentRequestUri({
      address: REALISTIC_ADDRESS,
      amount: "12.5",
      label: "Cafe Luna",
      exp: Math.floor(Date.now() / 1000) + 300,
      privateKey,
      publicKeyHex,
    });
    expect(built.length).toBeLessThan(URI_LENGTH_BUDGET);
    expect(built.overBudget).toBe(false);
  });

  it("stays under budget even with a full-length (MAX_LABEL_LENGTH) label", async () => {
    const { privateKey, publicKeyHex } = await keypair();
    const built = await buildPaymentRequestUri({
      address: REALISTIC_ADDRESS,
      amount: "9999.99999999",
      label: "A".repeat(MAX_LABEL_LENGTH),
      exp: Math.floor(Date.now() / 1000) + 300,
      privateKey,
      publicKeyHex,
    });
    expect(built.length).toBeLessThan(URI_LENGTH_BUDGET);
  });
});
