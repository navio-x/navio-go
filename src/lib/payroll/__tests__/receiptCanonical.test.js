import { describe, it, expect } from "vitest";
import { canonicalReceiptString, canonicalReceiptBytes, RECEIPT_FORMAT_VERSION } from "../receiptCanonical.js";

const SAMPLE = {
  employerLabel: "Acme Ltd",
  employerPublicKey: "AABBCC",
  recipientLabel: "Alice",
  recipientAddress: "tnv1qexampleaddress",
  amountSat: "150000000",
  currency: "USD",
  fiatAmount: 42.5,
  fiatRate: 0.123456789,
  fiatRateTimestamp: 1700000000123,
  periodLabel: "August 2026",
  paymentDate: "2026-08-27",
  transactionId: "deadbeef",
  issuedAt: 1700000001000,
  nonce: "0102030405060708",
};

describe("canonical receipt serialisation", () => {
  it("is byte-stable across repeated runs over the same data", () => {
    const a = canonicalReceiptBytes(SAMPLE);
    const b = canonicalReceiptBytes({ ...SAMPLE });
    expect(a).toEqual(b);
  });

  it("is stable regardless of the input object's own key order", () => {
    const keys = Object.keys(SAMPLE);
    const shuffled = {};
    for (const k of [...keys].reverse()) shuffled[k] = SAMPLE[k];
    expect(canonicalReceiptString(SAMPLE)).toEqual(canonicalReceiptString(shuffled));
  });

  it("fixes the field order in the output regardless of input order", () => {
    const s = canonicalReceiptString(SAMPLE);
    const parsedKeys = Object.keys(JSON.parse(s));
    expect(parsedKeys).toEqual([
      "formatVersion",
      "employerLabel",
      "employerPublicKey",
      "recipientLabel",
      "recipientAddress",
      "amountSat",
      "currency",
      "fiatAmount",
      "fiatRate",
      "fiatRateTimestamp",
      "periodLabel",
      "paymentDate",
      "transactionId",
      "issuedAt",
      "nonce",
    ]);
  });

  it("embeds the current format version", () => {
    const parsed = JSON.parse(canonicalReceiptString(SAMPLE));
    expect(parsed.formatVersion).toBe(String(RECEIPT_FORMAT_VERSION));
  });

  it("formats fiat amount to a fixed 2 decimals", () => {
    const parsed = JSON.parse(canonicalReceiptString({ ...SAMPLE, fiatAmount: 1 }));
    expect(parsed.fiatAmount).toBe("1.00");
  });

  it("formats the rate to a fixed 8 decimals", () => {
    const parsed = JSON.parse(canonicalReceiptString({ ...SAMPLE, fiatRate: 1 }));
    expect(parsed.fiatRate).toBe("1.00000000");
  });

  it("canonicalises amountSat via BigInt, never float rounding", () => {
    const parsed = JSON.parse(canonicalReceiptString({ ...SAMPLE, amountSat: "9007199254740993" }));
    expect(parsed.amountSat).toBe("9007199254740993");
  });

  it("renders null/undefined optional fields as an empty string, not 'null'", () => {
    const parsed = JSON.parse(
      canonicalReceiptString({ ...SAMPLE, currency: null, fiatAmount: null, fiatRate: null, fiatRateTimestamp: null })
    );
    expect(parsed.currency).toBe("");
    expect(parsed.fiatAmount).toBe("");
    expect(parsed.fiatRate).toBe("");
    expect(parsed.fiatRateTimestamp).toBe("");
  });

  it("changes output when any single field changes", () => {
    const base = canonicalReceiptString(SAMPLE);
    // amountSat is canonicalised via BigInt (see formatAmountSat) so it's
    // mutated with a valid integer string here instead of a "_x" suffix.
    for (const field of Object.keys(SAMPLE)) {
      const mutatedValue = field === "amountSat" ? SAMPLE[field] + "1" : SAMPLE[field] + "_x";
      const mutated = canonicalReceiptString({ ...SAMPLE, [field]: mutatedValue });
      expect(mutated, `field "${field}" did not affect canonical output`).not.toEqual(base);
    }
  });

  it("returns a UTF-8 byte encoding matching the canonical string", () => {
    const bytes = canonicalReceiptBytes(SAMPLE);
    expect(new TextDecoder().decode(bytes)).toEqual(canonicalReceiptString(SAMPLE));
  });
});
