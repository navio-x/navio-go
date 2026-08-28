/**
 * Pre-send fee estimate for the review screen.
 *
 * navio-sdk has no public "estimate fee before sending" API — the real fee
 * is only known once a transaction is actually built and signed (which
 * requires real UTXO selection, i.e. it's a side-effecting operation, not a
 * dry run). Rather than reimplementing the SDK's internal blsCT fee/size
 * math (private, unexported, and liable to drift), this asks the connected
 * Electrum server for its standard fee-rate estimate — the same protocol
 * call any Electrum-based wallet uses — and applies it to a conservative,
 * clearly-labeled size model for one batched sendToMany transaction. It is
 * only ever used for the UI's approximate figure; the SDK still computes
 * and applies the authoritative fee itself when signing.
 */

// Conservative rough size for the parts of a batched blsCT transaction that
// don't scale with recipient count: input(s), tx envelope, change output.
const BASE_OVERHEAD_BYTES = 700;

// Conservative rough size of one confidential recipient output (range
// proofs dominate blsCT output size). Chosen so a 1-recipient batch's
// estimate (BASE + 1 * PER_RECIPIENT = 1500 bytes) matches the single-send
// estimate this replaced. Deliberately generous — better to over-warn about
// balance than under-warn.
const PER_RECIPIENT_BYTES = 800;

// Used only if the Electrum server can't provide a live fee rate.
const FALLBACK_FEE_RATE_NAV_PER_KB = 0.002;

/**
 * @param {number} recipientCount - number of recipients in the batched send
 * @returns {Promise<number>} estimated total fee in NAV for the whole batch
 */
export async function estimateFeeForRecipients(client, recipientCount) {
  const bytes = BASE_OVERHEAD_BYTES + Math.max(recipientCount, 1) * PER_RECIPIENT_BYTES;

  try {
    const electrum = client?.getElectrumClient?.();
    if (electrum) {
      const rate = await electrum.call("blockchain.estimatefee", [2]);
      if (typeof rate === "number" && rate > 0) {
        return (rate * bytes) / 1000;
      }
    }
  } catch {
    // Server doesn't support the call, or isn't connected — use the fallback.
  }
  return (FALLBACK_FEE_RATE_NAV_PER_KB * bytes) / 1000;
}
