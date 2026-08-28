import { describe, it, expect } from "vitest";
import {
  deriveReceiptSigningKeypair,
  signBytes,
  verifyBytes,
  verifyReceipt,
  publicKeyFingerprint,
  bytesToHex,
} from "../receiptCrypto.js";
import { canonicalReceiptBytes } from "../receiptCanonical.js";

const SEED_HEX_A = "11".repeat(32);
const SEED_HEX_B = "22".repeat(32);

const BASE_FIELDS = {
  employerLabel: "Acme Ltd",
  recipientLabel: "Alice",
  recipientAddress: "tnv1qexampleaddress",
  amountSat: "150000000",
  currency: "USD",
  fiatAmount: 42.5,
  fiatRate: 0.12345,
  fiatRateTimestamp: 1700000000000,
  periodLabel: "August 2026",
  paymentDate: "2026-08-27",
  transactionId: "deadbeef",
  issuedAt: 1700000001000,
  nonce: "0102030405060708",
};

async function buildSignedReceipt(seedHex) {
  const { privateKey, publicKeyHex } = await deriveReceiptSigningKeypair(seedHex);
  const fields = { ...BASE_FIELDS, employerPublicKey: publicKeyHex };
  const signature = await signBytes(privateKey, canonicalReceiptBytes(fields));
  return { ...fields, signature };
}

describe("deriveReceiptSigningKeypair", () => {
  it("is deterministic for the same seed", async () => {
    const a = await deriveReceiptSigningKeypair(SEED_HEX_A);
    const b = await deriveReceiptSigningKeypair(SEED_HEX_A);
    expect(a.publicKeyHex).toEqual(b.publicKeyHex);
  });

  it("derives a different keypair for a different seed", async () => {
    const a = await deriveReceiptSigningKeypair(SEED_HEX_A);
    const b = await deriveReceiptSigningKeypair(SEED_HEX_B);
    expect(a.publicKeyHex).not.toEqual(b.publicKeyHex);
  });

  it("produces a non-extractable private key", async () => {
    const { privateKey } = await deriveReceiptSigningKeypair(SEED_HEX_A);
    expect(privateKey.extractable).toBe(false);
    expect(privateKey.algorithm.name).toBe("Ed25519");
  });

  it("derives a 32-byte raw public key", async () => {
    const { publicKeyRaw } = await deriveReceiptSigningKeypair(SEED_HEX_A);
    expect(publicKeyRaw.length).toBe(32);
  });
});

describe("sign/verify round trip", () => {
  it("verifies a signature produced by signBytes with the matching public key", async () => {
    const { privateKey, publicKeyHex } = await deriveReceiptSigningKeypair(SEED_HEX_A);
    const bytes = new TextEncoder().encode("receipt payload");
    const signature = await signBytes(privateKey, bytes);
    await expect(verifyBytes(publicKeyHex, bytes, signature)).resolves.toBe(true);
  });

  it("rejects a signature checked against the wrong public key", async () => {
    const { privateKey } = await deriveReceiptSigningKeypair(SEED_HEX_A);
    const { publicKeyHex: wrongKey } = await deriveReceiptSigningKeypair(SEED_HEX_B);
    const bytes = new TextEncoder().encode("receipt payload");
    const signature = await signBytes(privateKey, bytes);
    await expect(verifyBytes(wrongKey, bytes, signature)).resolves.toBe(false);
  });

  it("rejects a garbage signature/key without throwing", async () => {
    await expect(verifyBytes("not-hex", new Uint8Array([1, 2, 3]), "also-not-hex")).resolves.toBe(false);
  });
});

describe("verifyReceipt", () => {
  it("accepts a genuinely signed receipt and states what it verified", async () => {
    const receipt = await buildSignedReceipt(SEED_HEX_A);
    const result = await verifyReceipt(receipt);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeNull();
  });

  it("rejects a receipt with any single tampered field", async () => {
    const receipt = await buildSignedReceipt(SEED_HEX_A);
    for (const field of Object.keys(BASE_FIELDS)) {
      const tampered = { ...receipt, [field]: receipt[field] + "_tampered" };
      const result = await verifyReceipt(tampered);
      expect(result.valid, `tampering "${field}" should invalidate the signature`).toBe(false);
    }
  });

  it("rejects a receipt with a substituted (attacker's own) signature over modified content", async () => {
    const receipt = await buildSignedReceipt(SEED_HEX_A);
    // Attacker edits the amount and re-signs with their *own* key, but keeps
    // the original employerPublicKey field to impersonate the real issuer.
    const attacker = await deriveReceiptSigningKeypair(SEED_HEX_B);
    const forged = { ...receipt, amountSat: "999999999" };
    forged.signature = await signBytes(attacker.privateKey, canonicalReceiptBytes(forged));
    const result = await verifyReceipt(forged);
    expect(result.valid).toBe(false);
  });

  it("rejects malformed input without throwing", async () => {
    await expect(verifyReceipt(null)).resolves.toEqual({ valid: false, reason: "invalid_format" });
    await expect(verifyReceipt({})).resolves.toEqual({ valid: false, reason: "missing_signature" });
  });
});

describe("publicKeyFingerprint", () => {
  it("is deterministic and human-groupable", async () => {
    const { publicKeyHex } = await deriveReceiptSigningKeypair(SEED_HEX_A);
    const fp1 = await publicKeyFingerprint(publicKeyHex);
    const fp2 = await publicKeyFingerprint(publicKeyHex);
    expect(fp1).toEqual(fp2);
    expect(fp1).toMatch(/^([0-9A-F]{4} )+[0-9A-F]{4}$/);
  });

  it("differs for different public keys", async () => {
    const a = await deriveReceiptSigningKeypair(SEED_HEX_A);
    const b = await deriveReceiptSigningKeypair(SEED_HEX_B);
    const fpA = await publicKeyFingerprint(a.publicKeyHex);
    const fpB = await publicKeyFingerprint(b.publicKeyHex);
    expect(fpA).not.toEqual(fpB);
  });
});

describe("bytesToHex", () => {
  it("round-trips known bytes", () => {
    expect(bytesToHex(new Uint8Array([0, 255, 16]))).toEqual("00ff10");
  });
});
