/**
 * The Navio network fee as navio-sdk charges it, so the app can tell up front
 * what a send will cost instead of keeping a flat reserve and hoping.
 *
 * navio-sdk prices a confidential transaction per component: 200,000 sat for
 * every input and every output (NavioClient.sendTransaction, stake and the
 * multi-send all start from `(inputs + 2) * DEFAULT_FEE_PER_COMPONENT` and
 * only raise it if the signed size demands more, which in practice it does
 * not). Inputs are chosen largest first until the amount plus that fee is
 * covered (NavioClient.selectInputs). The fee is paid on top of the amount.
 *
 * A wallet made of many small outputs therefore pays more to move the same
 * NAV: five inputs cost 0.014, not the 0.01 the old flat reserve assumed.
 */
export const NAV_FEE_PER_COMPONENT = 0.002;
/** Used when the wallet's outputs are unknown (planner tests, the dev harness). */
export const NAV_FEE_FALLBACK = 0.01;
// The SDK always budgets two outputs (payment and change), even when a Max
// send leaves no change. No margin on top: the per-component price is itself
// several times what the signed size requires, so the estimate is exact, and
// sending `balance - fee` empties the wallet to 0.
const OUTPUTS = 2;

const r8 = (n) => Math.round(n * 1e8) / 1e8;
const feeFor = (inputs) => r8((inputs + OUTPUTS) * NAV_FEE_PER_COMPONENT);

/** The NAV amounts of the outputs a send may spend: unspent, confirmed, NAV (not a token), not a staking commitment. */
export function spendableNavAmounts(outputs) {
  return (outputs || [])
    .filter((o) => !o.isSpent && o.blockHeight > 0 && !o.isStakedCommitment && isNavToken(o.tokenId))
    .map((o) => Number(o.amount) / 1e8);
}

const NAV_TOKEN_ID = "0".repeat(64);
function isNavToken(tokenId) {
  return !tokenId || tokenId === NAV_TOKEN_ID || tokenId === NAV_TOKEN_ID + "ffffffffffffffff";
}

/** Fee for sending `amountNav` from a wallet holding `utxoAmounts` (NAV per output). */
export function navSendFee(amountNav, utxoAmounts) {
  if (!Array.isArray(utxoAmounts) || !utxoAmounts.length) return NAV_FEE_FALLBACK;
  const sorted = [...utxoAmounts].sort((a, b) => b - a);
  let total = 0;
  for (let i = 0; i < sorted.length; i++) {
    total += sorted[i];
    const fee = feeFor(i + 1);
    if (total + 1e-9 >= amountNav + fee) return fee;
  }
  return feeFor(sorted.length);
}

/** Fee for a send that spends every output, i.e. what Max has to leave behind. */
export function navSendAllFee(utxoAmounts) {
  if (!Array.isArray(utxoAmounts) || !utxoAmounts.length) return NAV_FEE_FALLBACK;
  return feeFor(utxoAmounts.length);
}
