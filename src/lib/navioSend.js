/**
 * Following one of this wallet's sends on chain.
 *
 * The id a send gets when it is signed is not a reliable handle: Navio
 * merges the transactions of a block into one, so once the send is mined
 * together with others the chain knows it under the merged transaction's
 * id, and the wallet's own records are rewritten to that id. What does not
 * change is the outputs the send spent — so a send is followed through one
 * of those (`spentOutput`, an output hash recorded right after sending),
 * and only matched by its signing-time id when no such output is known.
 *
 * Pure: `outputs` are the wallet's output records
 * ({ outputHash, txHash, blockHeight, spentTxHash, spentBlockHeight }).
 */

/** An output this send spent, for following it later; "" when the wallet shows none. */
export function spentOutputOf(outputs, txId) {
  if (!txId) return "";
  const spent = (outputs || []).find((o) => o.spentTxHash === txId && o.outputHash);
  return spent ? String(spent.outputHash) : "";
}

/**
 * Where a send is now: { height, txId } — `height` 0 while it waits in the
 * mempool, `txId` the id the chain knows it under (the merged transaction's
 * once mined). null when the wallet has no trace of it.
 */
export function locateSend(outputs, { txId, spentOutput } = {}) {
  if (!txId && !spentOutput) return null;
  let found = null;
  for (const o of outputs || []) {
    let at = null;
    if (spentOutput && o.outputHash === spentOutput) {
      // Spent by this send, whatever id it carries by now.
      if (o.spentTxHash) at = { height: Number(o.spentBlockHeight) || 0, txId: o.spentTxHash };
    } else if (txId && o.spentTxHash === txId) {
      at = { height: Number(o.spentBlockHeight) || 0, txId };
    } else if (txId && o.txHash === txId) {
      at = { height: Number(o.blockHeight) || 0, txId };
    }
    if (!at) continue;
    if (at.height > 0) return at;
    found = found ?? at;
  }
  return found;
}

/** Confirmations of a send at chain height `tip`: 0 in the mempool, null when the wallet has not seen it. */
export function sendConfirmations(outputs, send, tip) {
  const at = locateSend(outputs, send);
  if (!at) return null;
  if (!(at.height > 0)) return 0;
  return tip >= at.height ? tip - at.height + 1 : 0;
}

/** The id under which a mined send can be looked up on an explorer; null until it is in a block. */
export function minedTxId(outputs, send) {
  const at = locateSend(outputs, send);
  return at && at.height > 0 ? at.txId : null;
}
