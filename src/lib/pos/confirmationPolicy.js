/**
 * Confirmation policy for accepting a POS payment: how many blocks a
 * payment needs before it counts as final, with a merchant-configurable
 * "instant accept" exception below a chosen NAV threshold.
 *
 * A note on what "seen (unconfirmed)" means here: the wallet's chain-
 * watching (src/stores/navio.js's startBackgroundSync) only ever records an
 * output once it's been scanned out of a mined block — there is no mempool/
 * 0-conf subscription wired up in the current sync layer (electrum.ts has
 * the primitive; nothing calls it). So in practice a payment is never seen
 * with *zero* confirmations here — "seen" below means "confirmed at least
 * once, but fewer times than the policy requires for its amount", which is
 * the achievable equivalent with today's chain-watching. True sub-block
 * mempool visibility would need that subscription wired up as a separate,
 * deliberate change to the sync layer — out of scope for this pass.
 */

export const DEFAULT_ZERO_CONF_THRESHOLD_NAV = 5;
export const DEFAULT_REQUIRED_CONFIRMATIONS = 2;

// One satoshi, in NAV — guards the amount comparison below against binary
// floating-point noise (e.g. 0.1 + 0.2 !== 0.3) without hiding any real
// under/overpayment down to the chain's actual smallest unit.
const NAV_EPSILON = 5e-9;

/** Confirmations for an output: 0 if unmined, otherwise how far behind the chain tip it is (at least 1 once mined). */
export function confirmationsFor(output, chainTip) {
  if (!output || !output.blockHeight || output.blockHeight <= 0) return 0;
  if (!chainTip || chainTip <= 0) return 1;
  return Math.max(1, chainTip - output.blockHeight + 1);
}

/**
 * Classify an exact-amount-match payment's confirmation state under the
 * given policy. Only called once the amount itself has already been judged
 * a match (see evaluatePayment) — this function alone never decides
 * paid/not-paid on amount.
 */
export function classifyConfirmationState({ confirmations, amountNav, policy }) {
  if (confirmations >= policy.requiredConfirmations) return "confirmed";
  if (amountNav <= policy.zeroConfThreshold) return "accepted_zero_conf";
  return "seen";
}

/**
 * Evaluate a detected payment (possibly the sum of several outputs to the
 * same request address) against what was requested.
 *
 * @returns {{ outcome: 'underpaid'|'overpaid'|'seen'|'accepted_zero_conf'|'confirmed', confirmations: number, receivedAmountNav: number, requestedAmountNav: number }}
 *
 * Never returns a "paid" outcome ('confirmed'/'accepted_zero_conf') on an
 * amount mismatch — underpaid/overpaid are terminal-for-now outcomes the
 * cashier must act on explicitly (see PosHome.vue).
 */
export function evaluatePayment({ requestedAmountNav, receivedAmountNav, confirmations, policy }) {
  if (receivedAmountNav < requestedAmountNav - NAV_EPSILON) {
    return { outcome: "underpaid", confirmations, receivedAmountNav, requestedAmountNav };
  }
  if (receivedAmountNav > requestedAmountNav + NAV_EPSILON) {
    return { outcome: "overpaid", confirmations, receivedAmountNav, requestedAmountNav };
  }
  const outcome = classifyConfirmationState({ confirmations, amountNav: receivedAmountNav, policy });
  return { outcome, confirmations, receivedAmountNav, requestedAmountNav };
}
