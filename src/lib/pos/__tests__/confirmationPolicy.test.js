import { describe, it, expect } from "vitest";
import {
  confirmationsFor,
  classifyConfirmationState,
  evaluatePayment,
  DEFAULT_ZERO_CONF_THRESHOLD_NAV,
  DEFAULT_REQUIRED_CONFIRMATIONS,
} from "../confirmationPolicy.js";

const POLICY = { zeroConfThreshold: DEFAULT_ZERO_CONF_THRESHOLD_NAV, requiredConfirmations: DEFAULT_REQUIRED_CONFIRMATIONS };

describe("confirmationsFor", () => {
  it("is 0 for an unmined output", () => {
    expect(confirmationsFor({ blockHeight: 0 }, 100)).toEqual(0);
    expect(confirmationsFor(null, 100)).toEqual(0);
  });

  it("is at least 1 once mined, even with an unknown chain tip", () => {
    expect(confirmationsFor({ blockHeight: 100 }, 0)).toEqual(1);
  });

  it("counts how far behind the chain tip the output is", () => {
    expect(confirmationsFor({ blockHeight: 100 }, 100)).toEqual(1);
    expect(confirmationsFor({ blockHeight: 100 }, 101)).toEqual(2);
    expect(confirmationsFor({ blockHeight: 100 }, 105)).toEqual(6);
  });
});

describe("classifyConfirmationState", () => {
  it("is 'confirmed' once confirmations meet the policy, regardless of amount", () => {
    expect(classifyConfirmationState({ confirmations: 2, amountNav: 1000, policy: POLICY })).toEqual("confirmed");
    expect(classifyConfirmationState({ confirmations: 5, amountNav: 1, policy: POLICY })).toEqual("confirmed");
  });

  it("is 'accepted_zero_conf' below the threshold before enough confirmations", () => {
    expect(classifyConfirmationState({ confirmations: 0, amountNav: 1, policy: POLICY })).toEqual("accepted_zero_conf");
    expect(classifyConfirmationState({ confirmations: 1, amountNav: DEFAULT_ZERO_CONF_THRESHOLD_NAV, policy: POLICY })).toEqual(
      "accepted_zero_conf"
    );
  });

  it("is 'seen' above the threshold before enough confirmations", () => {
    expect(classifyConfirmationState({ confirmations: 0, amountNav: 1000, policy: POLICY })).toEqual("seen");
    expect(classifyConfirmationState({ confirmations: 1, amountNav: DEFAULT_ZERO_CONF_THRESHOLD_NAV + 0.01, policy: POLICY })).toEqual(
      "seen"
    );
  });
});

describe("evaluatePayment", () => {
  it("never reports paid on an amount mismatch", () => {
    const under = evaluatePayment({ requestedAmountNav: 10, receivedAmountNav: 9.5, confirmations: 5, policy: POLICY });
    expect(under.outcome).toEqual("underpaid");

    const over = evaluatePayment({ requestedAmountNav: 10, receivedAmountNav: 10.5, confirmations: 5, policy: POLICY });
    expect(over.outcome).toEqual("overpaid");
  });

  it("tolerates only sub-satoshi floating point noise as a match", () => {
    const exact = evaluatePayment({ requestedAmountNav: 0.1 + 0.2, receivedAmountNav: 0.3, confirmations: 5, policy: POLICY });
    expect(exact.outcome).not.toEqual("underpaid");
    expect(exact.outcome).not.toEqual("overpaid");
  });

  it("classifies an exact match by confirmation policy", () => {
    const zeroConf = evaluatePayment({ requestedAmountNav: 1, receivedAmountNav: 1, confirmations: 0, policy: POLICY });
    expect(zeroConf.outcome).toEqual("accepted_zero_conf");

    const seen = evaluatePayment({ requestedAmountNav: 1000, receivedAmountNav: 1000, confirmations: 1, policy: POLICY });
    expect(seen.outcome).toEqual("seen");

    const confirmed = evaluatePayment({ requestedAmountNav: 1000, receivedAmountNav: 1000, confirmations: 2, policy: POLICY });
    expect(confirmed.outcome).toEqual("confirmed");
  });

  it("reports the actual received/requested amounts for the cashier to see", () => {
    const result = evaluatePayment({ requestedAmountNav: 10, receivedAmountNav: 7, confirmations: 1, policy: POLICY });
    expect(result.receivedAmountNav).toEqual(7);
    expect(result.requestedAmountNav).toEqual(10);
  });
});
