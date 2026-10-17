// Which of the wallet's transactions are new since the last look, and what
// each one is for the user: NAV received, NAV sent, or a staking reward.
// Pure, so the rules can be tested; stores/txNotifications.js decides when
// to look.

import { REWARD_MEMO } from "./staking.js";

/**
 * The wallet's NAV movement per transaction, from its outputs: what each
 * transaction paid in, what it spent, and whether it is a reward or a
 * staking operation. Token outputs are left out.
 */
export function summarizeTxs(outputs) {
  const txs = new Map();
  const get = (hash) => {
    let tx = txs.get(hash);
    if (!tx) {
      tx = { txHash: hash, received: 0, spent: 0, reward: false, staking: false, pending: false };
      txs.set(hash, tx);
    }
    return tx;
  };
  for (const o of outputs) {
    if (o.tokenId) continue;
    const amount = Number(o.amount) || 0;
    if (o.txHash) {
      const tx = get(o.txHash);
      tx.received += amount;
      if (String(o.memo ?? "").trim() === REWARD_MEMO) tx.reward = true;
      if (o.isStakedCommitment) tx.staking = true;
      if (!(o.blockHeight > 0)) tx.pending = true;
    }
    if (o.isSpent && o.spentTxHash) {
      const tx = get(o.spentTxHash);
      tx.spent += amount;
      if (o.isStakedCommitment) tx.staking = true;
    }
  }
  return txs;
}

/**
 * The notifications owed for transactions not in `seen`, as
 * [{ txHash, kind: 'in' | 'out' | 'reward', amount (sats), pending }], and
 * the updated set. Staking and unstaking are left out: the user started them
 * and saw the outcome, and as transfers to themselves they would read as a
 * small "sent" of the fee.
 */
export function newTxEvents(outputs, seen) {
  const next = new Set(seen);
  const events = [];
  for (const tx of summarizeTxs(outputs).values()) {
    if (next.has(tx.txHash)) continue;
    next.add(tx.txHash);
    if (tx.staking) continue;
    const net = tx.received - tx.spent;
    if (tx.reward && tx.spent === 0) events.push({ txHash: tx.txHash, kind: "reward", amount: tx.received, pending: tx.pending });
    else if (net > 0) events.push({ txHash: tx.txHash, kind: "in", amount: net, pending: tx.pending });
    else if (net < 0) events.push({ txHash: tx.txHash, kind: "out", amount: -net, pending: tx.pending });
  }
  return { events, seen: next };
}
