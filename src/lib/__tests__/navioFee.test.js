import { describe, it, expect } from "vitest";
import { navSendFee, navSendAllFee, spendableNavAmounts, NAV_FEE_FALLBACK } from "../navioFee";
import { evaluateFunding, walletSpendable } from "../intent/requirements";

// The wallet that failed in the field: five outputs, 59.20052078 NAV in all.
// Sending 59.19052078 (balance less the old flat 0.01 reserve) needed
// 0.014 of fee — "need 5920452078 sat (5919052078 + 1400000 fee) but only
// have 5920052078 sat".
const fiveOutputs = [30, 20, 5, 4, 0.20052078];

describe("navSendFee", () => {
  it("prices a send like navio-sdk: 0.002 per input and output, largest inputs first", () => {
    expect(navSendFee(1, [10])).toBe(0.006); // 1 input + 2 outputs
    expect(navSendFee(25, fiveOutputs)).toBe(0.006); // the 30 covers it alone
    expect(navSendFee(45, fiveOutputs)).toBe(0.008); // 30 + 20
  });

  it("needs every output, and so more than the old flat reserve, to send the field case", () => {
    expect(navSendFee(59.19052078, fiveOutputs)).toBe(0.014);
    expect(navSendAllFee(fiveOutputs)).toBe(0.014);
  });

  it("falls back to the flat reserve when the outputs are unknown", () => {
    expect(navSendFee(1, undefined)).toBe(NAV_FEE_FALLBACK);
    expect(navSendAllFee([])).toBe(NAV_FEE_FALLBACK);
  });

  it("counts only confirmed, unspent, NAV, non-staking outputs", () => {
    const zeros = "0".repeat(64);
    const outputs = [
      { amount: 1e8, blockHeight: 10, isSpent: false },
      { amount: 2e8, blockHeight: 10, isSpent: false, tokenId: zeros },
      { amount: 3e8, blockHeight: 10, isSpent: true },
      { amount: 4e8, blockHeight: 0, isSpent: false },
      { amount: 5e8, blockHeight: 10, isSpent: false, isStakedCommitment: true },
      { amount: 6e8, blockHeight: 10, isSpent: false, tokenId: "ab".repeat(32) },
    ];
    expect(spendableNavAmounts(outputs)).toEqual([1, 2]);
  });
});

describe("planning with the wallet's outputs", () => {
  const ready = { registered: true, coreExists: true, gasReady: true, balances: { USDC: 0 }, navExchange: 0, navEvm: 0, paused: false };

  it("lets Max move everything but the fee, leaving the wallet at 0", () => {
    const state = { ...ready, navWallet: 59.20052078, utxos: fiveOutputs };
    const max = walletSpendable(state);
    expect(max).toBe(59.18652078);
    expect(Math.round((max + navSendFee(max, fiveOutputs)) * 1e8) / 1e8).toBe(59.20052078);
    expect(evaluateFunding({ amount: max, target: max, state }).some((r) => r.resolution === "blocked")).toBe(false);
    expect(evaluateFunding({ amount: 59.19052078, target: 59.19052078, state }).find((r) => r.resolution === "blocked")?.reason).toBe("insufficient_balance");
  });
});
