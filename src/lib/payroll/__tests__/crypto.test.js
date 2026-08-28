import { describe, it, expect } from "vitest";
import { derivePayrollKey, encryptRecord, decryptRecord } from "../crypto.js";

const SEED_HEX_A = "11".repeat(32);
const SEED_HEX_B = "22".repeat(32);

describe("derivePayrollKey", () => {
  it("is deterministic for the same seed", async () => {
    const keyA1 = await derivePayrollKey(SEED_HEX_A);
    const keyA2 = await derivePayrollKey(SEED_HEX_A);
    const record = { label: "same seed check" };
    const encrypted = await encryptRecord(keyA1, record);
    await expect(decryptRecord(keyA2, encrypted)).resolves.toEqual(record);
  });

  it("produces a non-extractable AES-GCM key", async () => {
    const key = await derivePayrollKey(SEED_HEX_A);
    expect(key.extractable).toBe(false);
    expect(key.algorithm.name).toBe("AES-GCM");
  });

  it("derives a different key for a different seed", async () => {
    const keyA = await derivePayrollKey(SEED_HEX_A);
    const keyB = await derivePayrollKey(SEED_HEX_B);
    const encrypted = await encryptRecord(keyA, { label: "secret" });
    await expect(decryptRecord(keyB, encrypted)).rejects.toThrow();
  });
});

describe("encryptRecord / decryptRecord round-trip", () => {
  it("round-trips arbitrary JSON records", async () => {
    const key = await derivePayrollKey(SEED_HEX_A);
    const record = {
      id: "rec-1",
      label: "Alice",
      address: "tnv1qexampleaddress",
      defaultAmount: 100000000,
      groupTag: "engineering",
    };
    const encrypted = await encryptRecord(key, record);

    // Never stored in plaintext: the serialized form must not contain the
    // record's actual field values anywhere in the ciphertext/metadata.
    const serializedText = JSON.stringify(encrypted);
    expect(serializedText).not.toContain("Alice");
    expect(serializedText).not.toContain("tnv1qexampleaddress");
    expect(serializedText).not.toContain("engineering");

    const decrypted = await decryptRecord(key, encrypted);
    expect(decrypted).toEqual(record);
  });

  it("uses a fresh IV for every encryption of the same plaintext", async () => {
    const key = await derivePayrollKey(SEED_HEX_A);
    const record = { label: "repeat me" };
    const first = await encryptRecord(key, record);
    const second = await encryptRecord(key, record);

    expect(first.iv).not.toEqual(second.iv);
    expect(first.ciphertext).not.toEqual(second.ciphertext);
  });

  it("rejects tampered ciphertext (AES-GCM auth tag failure)", async () => {
    const key = await derivePayrollKey(SEED_HEX_A);
    const encrypted = await encryptRecord(key, { label: "tamper test" });

    const bytes = Uint8Array.from(atob(encrypted.ciphertext), (c) => c.charCodeAt(0));
    bytes[0] ^= 0xff;
    const tampered = { ...encrypted, ciphertext: btoa(String.fromCharCode(...bytes)) };

    await expect(decryptRecord(key, tampered)).rejects.toThrow();
  });
});
