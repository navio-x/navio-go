/**
 * Coin-selection for maker reservations.
 *
 * navio-sdk's replyQuote/broadcastOrder auto-select inputs internally when
 * no `selectedUtxos` is given — and don't report back which ones they
 * picked (only acceptQuote, the taker side, returns spentInputs). To lock
 * coins locally we have to take over selection ourselves: pick UTXOs
 * up front, pass them explicitly as selectedUtxos (so the SDK spends
 * exactly those, no auto top-up), and only then do we know precisely what
 * to reserve. See navio-sdk NavioClient.buildSwapHalf for the algorithm
 * this mirrors.
 */

// Mirrors navio-sdk's own fee-guess constants (DEFAULT_FEE_PER_COMPONENT and
// MAKER_TAKER_FEE_ALLOWANCE in its buildSwapHalf) — the initial NAV headroom
// a maker half needs before its fee is known exactly. If the SDK's real
// iterated fee ends up higher than this guess, buildSwapHalf throws
// "Insufficient funds" before signing or broadcasting anything, so
// under-estimating here never puts coins at risk — it just means the
// action needs a retry (uncommon: the guess already carries a fixed
// allowance on top of a representative per-component fee).
export const FEE_GUESS = 4n * 200_000n + 2500n * 125n; // 1_112_500n

/** Largest-first selection — mirrors navio-sdk's own selectInputsByAmount so
 * a local reservation matches what the SDK will actually spend when handed
 * these hashes via selectedUtxos. */
export function selectUtxosByAmount(utxos, targetAmount) {
  const sorted = [...utxos].sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));
  const selected = [];
  let totalIn = 0n;
  for (const utxo of sorted) {
    selected.push(utxo);
    totalIn += utxo.amount;
    if (totalIn >= targetAmount) break;
  }
  return { selected, totalIn };
}

/**
 * Plan the UTXOs a maker action (replyQuote/broadcastOrder) should reserve
 * and pass as `selectedUtxos`.
 *
 * @param {string|null} payTokenId - token being paid out (null = NAV)
 * @param {bigint} payAmount - amount of payTokenId required
 * @param {Array} payUtxos - spendable outputs for payTokenId, already
 *   excluding anything already reserved by another outstanding quote/order
 * @param {Array} navUtxos - spendable NAV outputs (same array as payUtxos
 *   when payTokenId is null), already excluding reserved ones
 * @returns {{ok: true, selectedUtxos: string[]} | {ok: false, reason: string, shortfall: bigint}}
 */
export function planMakerReservation({ payTokenId, payAmount, payUtxos, navUtxos }) {
  if (payAmount <= 0n) {
    return { ok: false, reason: "invalid_amount", shortfall: 0n };
  }
  const payIsNav = payTokenId === null;
  const payTarget = payAmount + (payIsNav ? FEE_GUESS : 0n);
  const { selected: selectedPay, totalIn: totalPayIn } = selectUtxosByAmount(payUtxos, payTarget);
  if (totalPayIn < payAmount) {
    return { ok: false, reason: "insufficient_pay", shortfall: payAmount - totalPayIn };
  }

  let selectedNav = [];
  if (!payIsNav) {
    const { selected, totalIn } = selectUtxosByAmount(navUtxos, FEE_GUESS);
    selectedNav = selected;
    if (totalIn === 0n) {
      return { ok: false, reason: "insufficient_fee_nav", shortfall: FEE_GUESS };
    }
  }

  return {
    ok: true,
    selectedUtxos: [...selectedPay, ...selectedNav].map((u) => u.outputHash),
  };
}
