import { describe, it, expect, vi } from "vitest";

const mockCheckMerchant = vi.fn();
vi.mock("../merchantKeys.js", () => ({
  checkMerchant: (...args) => mockCheckMerchant(...args),
}));

const { evaluateScannedRequest } = await import("../scanRequest.js");
const { buildPaymentRequestUri, deriveMerchantSigningKeypair } = await import("../uriScheme.js");

const SEED_HEX = "55".repeat(32);
const REALISTIC_ADDRESS = "tnv1" + "q".repeat(161) + "x";

async function buildUri({ exp, amount = "1", label = "Cafe Luna" } = {}) {
  const { privateKey, publicKeyHex } = await deriveMerchantSigningKeypair(SEED_HEX);
  const built = await buildPaymentRequestUri({
    address: REALISTIC_ADDRESS,
    amount,
    label,
    exp: exp ?? Math.floor(Date.now() / 1000) + 300,
    privateKey,
    publicKeyHex,
  });
  return built.uri;
}

describe("evaluateScannedRequest", () => {
  it("returns 'not_a_request' for a non-navio URI", async () => {
    expect(await evaluateScannedRequest("bitcoin:abc?amount=1")).toEqual({ status: "not_a_request" });
    expect(await evaluateScannedRequest("not a uri")).toEqual({ status: "not_a_request" });
  });

  it("returns 'expired' for a request past its exp, without checking trust", async () => {
    mockCheckMerchant.mockClear();
    const uri = await buildUri({ exp: Math.floor(Date.now() / 1000) - 10 });
    const result = await evaluateScannedRequest(uri);
    expect(result.status).toEqual("expired");
    expect(mockCheckMerchant).not.toHaveBeenCalled();
  });

  it("returns 'invalid_signature' for a tampered request", async () => {
    const uri = await buildUri();
    const tampered = uri.replace("amount=1.00000000", "amount=9.00000000");
    const result = await evaluateScannedRequest(tampered);
    expect(result.status).toEqual("invalid_signature");
  });

  it("returns 'ok' with verified=true and the trust check result for a valid signed request", async () => {
    mockCheckMerchant.mockResolvedValueOnce({ status: "unknown", record: null, fingerprint: "AB12" });
    const uri = await buildUri();
    const result = await evaluateScannedRequest(uri);
    expect(result.status).toEqual("ok");
    expect(result.verified).toBe(true);
    expect(result.trust.status).toEqual("unknown");
    expect(mockCheckMerchant).toHaveBeenCalledWith({ label: "Cafe Luna", publicKeyHex: expect.any(String) });
  });

  it("returns 'ok' with verified=false and no trust check for an unsigned request", async () => {
    mockCheckMerchant.mockClear();
    const exp = Math.floor(Date.now() / 1000) + 300;
    const uri = `navio:${REALISTIC_ADDRESS}?amount=1.00000000&label=Cafe+Luna&id=abcd1234abcd1234&exp=${exp}`;
    const result = await evaluateScannedRequest(uri);
    expect(result.status).toEqual("ok");
    expect(result.verified).toBe(false);
    expect(result.trust).toBeNull();
    expect(mockCheckMerchant).not.toHaveBeenCalled();
  });
});
