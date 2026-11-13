/**
 * Waiting for a wallet -> exchange deposit to be credited by the bridge.
 *
 * The credit itself is the proof: the bridge contract sends the NAV to the
 * account as a HyperCore spot transfer, and that entry stays in the
 * account's ledger whatever happens to the balance afterwards. The balance
 * comparison is kept as a second way to notice the arrival (it needs no
 * send time), but on its own it can miss a credit for good — NAV sold or
 * put in an order meanwhile keeps the balance under the expected figure.
 *
 * The wait also ends on its own: after `creditMaxWaitMs` without a credit
 * the operation stops for the user instead of saying "waiting" forever.
 *
 * Pure: the reads are injected (see executors.js's waitCredit).
 */
import { BRIDGE_CONTRACT_ADDRESS, NAV_TOKEN_ID } from "@/lib/hyperliquid/bridge/config";

// A credited deposit is accepted as "arrived" within this margin of the
// expected amount, so an operation never waits forever on a rounding
// difference between what was sent and what the bridge credits.
export const CREDIT_TOLERANCE = 0.01;
export const CREDIT_POLL_MS = 15_000;
// The bridge credits after 3-48 Navio confirmations (6-96 minutes). Past
// three times the plan's own estimate, and never before two hours, the wait
// is no longer normal.
const CREDIT_MIN_MAX_WAIT_MS = 2 * 60 * 60 * 1000;
const CREDIT_MAX_WAIT_FACTOR = 3;

const POLL_ERROR_CODES = ["network_error", "rate_limited", "http_error"];
const same = (a, b) => !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase();

/** How long a waitCredit step waits before it asks the user. */
export function creditMaxWaitMs(step) {
  return Math.max(CREDIT_MIN_MAX_WAIT_MS, (Number(step?.minutes) || 0) * 60_000 * CREDIT_MAX_WAIT_FACTOR);
}

/** The ledger writes NAV as "NAV" or "NAV:<tokenId>"; with an id it must be the real one. */
function isNav(token) {
  const [name, tokenId] = String(token || "").split(":");
  return name === "NAV" && (!tokenId || same(tokenId, NAV_TOKEN_ID));
}

/**
 * NAV the bridge has credited to `address` since `since` (ms), from the
 * account's ledger (api.js fetchUserLedger): { amount, hash } — `hash` is
 * the latest such credit. Only transfers sent by the bridge contract count;
 * NAV coming back from HyperEVM or from another account is not a deposit.
 */
export function bridgeCreditsSince(ledger, address, since) {
  let amount = 0;
  let hash = "";
  for (const entry of ledger || []) {
    const d = entry?.delta || {};
    if (d.type !== "spotTransfer" || !isNav(d.token)) continue;
    if (!same(d.user, BRIDGE_CONTRACT_ADDRESS) || !same(d.destination, address)) continue;
    if (!(entry.time >= since)) continue;
    const value = Number(d.amount);
    if (!(value > 0)) continue;
    amount += value;
    hash = entry.hash || hash;
  }
  return { amount, hash };
}

function fail(code) {
  return new Error(code);
}

/**
 * Resolves once the deposit of this operation has been credited; throws
 * "credit_delayed" (or the read error's own code when nothing could be
 * read) once the wait is over. `reads`:
 *   address        — the account being credited
 *   readBalances() — { available: { NAV }, total: { NAV } }
 *   readLedger(since) — the account's ledger entries from `since` on
 *   onPoll()       — called after every unsuccessful poll (optional)
 */
export async function waitForCredit(step, op, api, { address, readBalances, readLedger, onPoll }) {
  const deposit = op.steps?.find((s) => s.type === "deposit");
  const sent = Number(deposit?.amount ?? step.added) || 0;
  const since = deposit?.sentAt ?? null;
  // "Keep waiting" restarts the clock (step.waitFrom); otherwise it runs
  // from the send, so time spent with the app closed counts too.
  const waitFrom = step.waitFrom ?? since ?? step.startedAt ?? api.now();
  const maxWait = creditMaxWaitMs(step);

  for (;;) {
    let checked = false;
    let readError = null;

    try {
      const exchange = await readBalances();
      checked = true;
      const arrived = step.need != null
        ? exchange.available.NAV >= step.need * (1 - CREDIT_TOLERANCE)
        : exchange.total.NAV >= (op.ctx.creditBaseline ?? 0) + step.added * (1 - CREDIT_TOLERANCE);
      if (arrived) return null;
    } catch (e) {
      readError = e;
      console.error("[intent] waitCredit balance read failed:", e?.message);
    }

    if (since != null && sent > 0) {
      try {
        const credit = bridgeCreditsSince(await readLedger(since), address, since);
        checked = true;
        if (credit.amount >= sent * (1 - CREDIT_TOLERANCE)) {
          step.creditHash = credit.hash;
          return null;
        }
      } catch (e) {
        readError = readError ?? e;
        console.error("[intent] waitCredit ledger read failed:", e?.message);
      }
    }

    if (api.now() - waitFrom > maxWait) {
      // Nothing could be read: say that, not that the credit is late.
      if (!checked) throw fail(POLL_ERROR_CODES.includes(readError?.message) ? readError.message : "network_error");
      throw fail("credit_delayed");
    }

    onPoll?.();
    await api.sleep(CREDIT_POLL_MS);
  }
}
