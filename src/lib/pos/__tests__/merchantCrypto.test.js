import { describe, it, expect } from "vitest";
import {
  deriveMerchantSigningKeypair,
  signBytes,
  verifyBytes,
  bytesToHex,
  hexToBase64Url,
  base64UrlToHex,
} from "../merchantCrypto.js";

const SEED_HEX_A = "11".repeat(32);
const SEED_HEX_B = "22".repeat(32);

describe("deriveMerchantSigningKeypair", () => {
  it("is deterministic for the same seed", async () => {
    const a = await deriveMerchantSigningKeypair(SEED_HEX_A);
    const b = await deriveMerchantSigningKeypair(SEED_HEX_A);
    expect(a.publicKeyHex).toEqual(b.publicKeyHex);
  });

  it("derives a different keypair for a different seed", async () => {
    const a = await deriveMerchantSigningKeypair(SEED_HEX_A);
    const b = await deriveMerchantSigningKeypair(SEED_HEX_B);
    expect(a.publicKeyHex).not.toEqual(b.publicKeyHex);
  });

  it("produces a non-extractable private key", async () => {
    const { privateKey } = await deriveMerchantSigningKeypair(SEED_HEX_A);
    expect(privateKey.extractable).toBe(false);
    expect(privateKey.algorithm.name).toBe("Ed25519");
  });

  it("derives a 32-byte raw public key", async () => {
    const { publicKeyRaw } = await deriveMerchantSigningKeypair(SEED_HEX_A);
    expect(publicKeyRaw.length).toBe(32);
  });
});

describe("sign/verify round trip", () => {
  it("verifies a signature produced by signBytes with the matching public key", async () => {
    const { privateKey, publicKeyHex } = await deriveMerchantSigningKeypair(SEED_HEX_A);
    const bytes = new TextEncoder().encode("pos request payload");
    const signature = await signBytes(privateKey, bytes);
    await expect(verifyBytes(publicKeyHex, bytes, signature)).resolves.toBe(true);
  });

  it("rejects a signature checked against the wrong public key", async () => {
    const { privateKey } = await deriveMerchantSigningKeypair(SEED_HEX_A);
    const { publicKeyHex: wrongKey } = await deriveMerchantSigningKeypair(SEED_HEX_B);
    const bytes = new TextEncoder().encode("pos request payload");
    const signature = await signBytes(privateKey, bytes);
    await expect(verifyBytes(wrongKey, bytes, signature)).resolves.toBe(false);
  });

  it("rejects a garbage signature/key without throwing", async () => {
    await expect(verifyBytes("not-hex", new Uint8Array([1, 2, 3]), "also-not-hex")).resolves.toBe(false);
  });
});

describe("hex <-> base64url", () => {
  it("round-trips arbitrary hex", () => {
    const hex = bytesToHex(new Uint8Array([0, 1, 2, 253, 254, 255]));
    expect(base64UrlToHex(hexToBase64Url(hex))).toEqual(hex);
  });

  it("round-trips a real signature", async () => {
    const { privateKey } = await deriveMerchantSigningKeypair(SEED_HEX_A);
    const sigHex = await signBytes(privateKey, new TextEncoder().encode("x"));
    expect(base64UrlToHex(hexToBase64Url(sigHex))).toEqual(sigHex);
  });

  it("produces a shorter encoding than hex", async () => {
    const { publicKeyHex } = await deriveMerchantSigningKeypair(SEED_HEX_A);
    expect(hexToBase64Url(publicKeyHex).length).toBeLessThan(publicKeyHex.length);
  });
});
