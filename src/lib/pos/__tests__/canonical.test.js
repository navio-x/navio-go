import { describe, it, expect } from "vitest";
import { canonicalRequestString, canonicalRequestBytes, formatAmount, POS_REQUEST_FORMAT_VERSION } from "../canonical.js";

const SAMPLE = {
  address: "tnv1qexamplemerchantaddress",
  amount: "12.5",
  label: "Cafe Luna",
  id: "0102030405060708",
  exp: 1700000000,
};

describe("canonical POS request serialisation", () => {
  it("is byte-stable across repeated runs over the same data", () => {
    const a = canonicalRequestBytes(SAMPLE);
    const b = canonicalRequestBytes({ ...SAMPLE });
    expect(a).toEqual(b);
  });

  it("is stable regardless of the input object's own key order", () => {
    const keys = Object.keys(SAMPLE);
    const shuffled = {};
    for (const k of [...keys].reverse()) shuffled[k] = SAMPLE[k];
    expect(canonicalRequestString(SAMPLE)).toEqual(canonicalRequestString(shuffled));
  });

  it("fixes the field order in the output regardless of input order", () => {
    const s = canonicalRequestString(SAMPLE);
    const parsedKeys = Object.keys(JSON.parse(s));
    expect(parsedKeys).toEqual(["formatVersion", "address", "amount", "label", "id", "exp"]);
  });

  it("embeds the current format version", () => {
    const parsed = JSON.parse(canonicalRequestString(SAMPLE));
    expect(parsed.formatVersion).toBe(String(POS_REQUEST_FORMAT_VERSION));
  });

  it("formats amount to a fixed 8 decimals", () => {
    expect(formatAmount(12.5)).toBe("12.50000000");
    expect(formatAmount("1")).toBe("1.00000000");
    const parsed = JSON.parse(canonicalRequestString({ ...SAMPLE, amount: 1 }));
    expect(parsed.amount).toBe("1.00000000");
  });

  it("truncates fractional-second expiry to an integer string", () => {
    const parsed = JSON.parse(canonicalRequestString({ ...SAMPLE, exp: 1700000000.9 }));
    expect(parsed.exp).toBe("1700000000");
  });

  it("changes output when any single field changes", () => {
    const base = canonicalRequestString(SAMPLE);
    // amount is canonicalised via Number(...).toFixed(8) (see formatAmount),
    // so — like amountSat in the payroll equivalent of this test — it's
    // mutated with a valid numeric value instead of an "_x" suffix.
    for (const field of Object.keys(SAMPLE)) {
      let mutatedValue;
      if (field === "exp") mutatedValue = SAMPLE[field] + 1;
      else if (field === "amount") mutatedValue = Number(SAMPLE[field]) + 1;
      else mutatedValue = SAMPLE[field] + "_x";
      const mutated = canonicalRequestString({ ...SAMPLE, [field]: mutatedValue });
      expect(mutated, `field "${field}" did not affect canonical output`).not.toEqual(base);
    }
  });

  it("returns a UTF-8 byte encoding matching the canonical string", () => {
    const bytes = canonicalRequestBytes(SAMPLE);
    expect(new TextDecoder().decode(bytes)).toEqual(canonicalRequestString(SAMPLE));
  });

  it("rejects a non-finite amount", () => {
    expect(() => formatAmount("not-a-number")).toThrow();
  });
});
