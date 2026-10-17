// Small, pure helpers for the cold-staking UI. The SDK is the authority on
// every rule; these only let the form answer before a transaction is built.

const G1_IDENTITY_HEX = "c0" + "00".repeat(47);

/** A staker's delegation key: a 48-byte, non-identity G1 point in hex. */
export function isValidStakerKey(value) {
  const key = String(value ?? "").trim().toLowerCase();
  return /^[0-9a-f]{96}$/.test(key) && key !== G1_IDENTITY_HEX;
}

/** Pulls a key out of pasted or scanned text (a bare key, or `…:key`). */
export function extractStakerKey(raw) {
  const match = String(raw ?? "").match(/[0-9a-fA-F]{96}/);
  return match ? match[0].toLowerCase() : String(raw ?? "").trim();
}

export function shortKey(key, head = 8, tail = 6) {
  if (!key) return "";
  return key.length <= head + tail + 1 ? key : `${key.slice(0, head)}…${key.slice(-tail)}`;
}

/**
 * Every unspent staked commitment as one position the UI can show, newest
 * first: `confirming` (in the mempool; can't be unstaked yet), `active`
 * (delegated, its staker known) or `unknown` (confirmed, but the wallet
 * can't read who it is delegated to).
 */
export function toPositions(stakedOutputs, delegations) {
  const byHash = new Map(delegations.map((d) => [d.outputHash, d]));
  return stakedOutputs
    .map((o) => {
      const d = byHash.get(o.outputHash);
      return {
        outputHash: o.outputHash,
        txHash: o.txHash,
        amount: o.amountNav,
        blockHeight: o.blockHeight,
        status: o.blockHeight > 0 ? (d ? "active" : "unknown") : "confirming",
        delegateKey: d?.delegateKey ?? "",
        rewardAddress: d?.rewardAddress ?? "",
      };
    })
    .sort((a, b) => (a.blockHeight || Infinity) < (b.blockHeight || Infinity) ? 1 : -1);
}

// --- Rewards ---------------------------------------------------------------
// A staker pays each block reward as a normal output with the memo "Reward"
// (navio-core's miner); its own cut, if any, goes out as "Operator Fee" to
// the operator and never reaches this wallet.

export const REWARD_MEMO = "Reward";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/**
 * The reward ranges, each split into equal buckets that end with the
 * current hour (24H) or day (the rest), so the newest bar is the one
 * still filling up.
 */
export const REWARD_RANGES = [
  { key: "24H", unit: "hour", buckets: 24, step: 1 },
  { key: "7D", unit: "day", buckets: 7, step: 1 },
  { key: "30D", unit: "day", buckets: 30, step: 1 },
  { key: "90D", unit: "day", buckets: 15, step: 6 },
  { key: "180D", unit: "day", buckets: 18, step: 10 },
  { key: "1Y", unit: "day", buckets: 12, step: 30.5 },
];

export function isRewardOutput(output) {
  return (
    !output.isStakedCommitment &&
    !output.tokenId &&
    String(output.memo ?? "").trim() === REWARD_MEMO
  );
}

/** Reward outputs as { at (ms), amount (NAV) }; those with no block time yet are left out. */
export function toRewards(outputs) {
  const rewards = [];
  for (const o of outputs) {
    if (!isRewardOutput(o) || !(Number(o.timestamp) > 0)) continue;
    rewards.push({ at: Number(o.timestamp) * 1000, amount: Number(o.amount) / 1e8 });
  }
  return rewards;
}

/**
 * Rewards earned in one range: the total, how many there were, and the
 * buckets the chart draws, oldest first. The total is the buckets' sum, so
 * the headline and the chart always agree.
 */
export function rewardSeries(rewards, rangeKey, now = Date.now()) {
  const range = REWARD_RANGES.find((r) => r.key === rangeKey) ?? REWARD_RANGES[2];
  const end = new Date(now);
  if (range.unit === "hour") {
    end.setMinutes(0, 0, 0);
    end.setHours(end.getHours() + 1);
  } else {
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 1);
  }
  const size = range.step * (range.unit === "hour" ? HOUR : DAY);
  const endMs = end.getTime();
  const startMs = endMs - size * range.buckets;

  const buckets = Array.from({ length: range.buckets }, (_, i) => ({
    start: startMs + i * size,
    end: startMs + (i + 1) * size,
    amount: 0,
    count: 0,
  }));
  let total = 0;
  let count = 0;
  for (const r of rewards) {
    if (r.at < startMs || r.at >= endMs) continue;
    const bucket = buckets[Math.min(range.buckets - 1, Math.floor((r.at - startMs) / size))];
    bucket.amount += r.amount;
    bucket.count++;
    total += r.amount;
    count++;
  }
  return { range, total, count, buckets };
}

/** A round axis top at or above `max`: 1, 2 or 5 times a power of ten. */
export function niceCeil(max) {
  if (!(max > 0)) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 5, 10]) if (m * pow >= max) return m * pow;
  return 10 * pow;
}

// --- Chain parameters, for the staking guide -------------------------------
// navio-core's chainparams.cpp, the same on mainnet and testnet: a PoS block
// every 2 minutes, a flat 8 NAV reward (no halving), and a coinbase that
// matures after 100 blocks (COINBASE_MATURITY).
export const STAKING_PARAMS = {
  blockReward: 8,
  blockSeconds: 120,
  rewardMaturity: 100,
};

export const BLOCKS_PER_DAY = (24 * 3600) / STAKING_PARAMS.blockSeconds;

/**
 * What a stake can expect to earn on average, given the network's total
 * stake and the operator's fee (percent). Each block goes to a stake with
 * probability proportional to its size, so this is an expectation, not a
 * schedule. null when the inputs can't produce a number.
 */
export function estimateRewards({ stake, totalStaked, feePercent = 0 }) {
  const s = Number(stake);
  const total = Number(totalStaked);
  const fee = Number(feePercent);
  if (!(s > 0) || !(total > 0) || !(fee >= 0 && fee <= 100)) return null;
  // Your own stake is part of the total; it can't be bigger than it.
  const share = Math.min(1, s / Math.max(total, s));
  const perDay = BLOCKS_PER_DAY * STAKING_PARAMS.blockReward * share * (1 - fee / 100);
  return {
    share,
    perDay,
    perMonth: perDay * 30,
    perYear: perDay * 365,
    apr: ((perDay * 365) / s) * 100,
    // Average wait between two rewards, in days.
    daysBetweenRewards: share > 0 ? 1 / (BLOCKS_PER_DAY * share) : Infinity,
  };
}

/** Default operator first, then cheapest, then longest listed. */
export function sortOperators(list) {
  return [...list].sort(
    (a, b) =>
      Number(b.isDefault) - Number(a.isDefault) ||
      a.feeBps - b.feeBps ||
      (a.createdAt ?? Infinity) - (b.createdAt ?? Infinity)
  );
}

// --- Operator directory ----------------------------------------------------
// A public JSON list of staking operators (staking/operators.json in this repo).
// It is remote, untrusted input: every field is checked, anything malformed
// is dropped rather than shown, and only https links survive.

const clip = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function httpsUrl(v) {
  try {
    const url = new URL(String(v));
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * The operators in a directory document, each as { id, name, delegationKey,
 * feeBps, networks, createdAt (ms or null), website, description, isDefault,
 * enabled }. A key listed twice keeps its first entry. `isDefault` marks the
 * operator the stake form starts with; `enabled: false` takes an operator off
 * the list offered for new stakes (a missing flag means enabled).
 */
export function parseOperators(doc) {
  if (!doc || !Array.isArray(doc.operators)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of doc.operators) {
    if (!raw || typeof raw !== "object") continue;
    const name = clip(raw.name, 60);
    const delegationKey = String(raw.delegationKey ?? "").trim().toLowerCase();
    const feeBps = Number(raw.feeBps ?? 0);
    if (!name || !isValidStakerKey(delegationKey) || seen.has(delegationKey)) continue;
    if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10000) continue;
    const created = Date.parse(raw.createdAt);
    seen.add(delegationKey);
    out.push({
      id: clip(raw.id, 60) || delegationKey.slice(0, 16),
      name,
      delegationKey,
      feeBps,
      networks: Array.isArray(raw.networks) ? raw.networks.filter((n) => typeof n === "string") : [],
      createdAt: Number.isFinite(created) ? created : null,
      website: httpsUrl(raw.website),
      description: clip(raw.description, 200),
      isDefault: raw.default === true,
      enabled: raw.enabled !== false,
    });
  }
  return out;
}
