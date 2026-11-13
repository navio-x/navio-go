import { describe, it, expect, vi } from "vitest";
import { bridgeCreditsSince, waitForCredit, creditMaxWaitMs, CREDIT_POLL_MS } from "../creditWait";
import { BRIDGE_CONTRACT_ADDRESS, HYPERCORE_SYSTEM_ADDRESS, NAV_TOKEN_ID } from "@/lib/hyperliquid/bridge/config";

const ME = "0x24acc1e0000000000000000000000000000000aa";
const SENT_AT = 1_000_000;
const HOUR = 60 * 60 * 1000;

// The shape the exchange returns for a bridge credit (checked against the live ledger).
const credit = (amount, time, over = {}) => ({
  time,
  hash: `0xhash${time}`,
  delta: { type: "spotTransfer", token: "NAV", amount: String(amount), user: BRIDGE_CONTRACT_ADDRESS, destination: ME, ...over },
});

describe("bridgeCreditsSince", () => {
  it("adds up the bridge's NAV transfers to the account since the send", () => {
    const ledger = [credit(40, SENT_AT - 1), credit(60, SENT_AT + 10), credit(39.5, SENT_AT + 20)];
    expect(bridgeCreditsSince(ledger, ME.toUpperCase().replace("0X", "0x"), SENT_AT)).toEqual({ amount: 99.5, hash: `0xhash${SENT_AT + 20}` });
  });

  it("ignores everything that is not a bridge deposit", () => {
    const ledger = [
      // NAV coming back from HyperEVM, from another account, to someone else, another token.
      credit(100, SENT_AT + 1, { user: HYPERCORE_SYSTEM_ADDRESS }),
      credit(100, SENT_AT + 2, { user: "0x00000000000000000000000000000000000000bb" }),
      credit(100, SENT_AT + 3, { destination: "0x00000000000000000000000000000000000000cc" }),
      credit(100, SENT_AT + 4, { token: "HYPE" }),
      credit(100, SENT_AT + 5, { token: "NAV:0x00000000000000000000000000000001" }),
      credit(100, SENT_AT + 6, { type: "send" }),
      { time: SENT_AT + 7, hash: "0x7", delta: { type: "deposit", usdc: "100" } },
    ];
    expect(bridgeCreditsSince(ledger, ME, SENT_AT)).toEqual({ amount: 0, hash: "" });
    expect(bridgeCreditsSince(null, ME, SENT_AT).amount).toBe(0);
  });

  it("accepts NAV written with its token id", () => {
    expect(bridgeCreditsSince([credit(5, SENT_AT, { token: `NAV:${NAV_TOKEN_ID}` })], ME, SENT_AT).amount).toBe(5);
  });
});

/** A clock that only moves when the wait sleeps. */
function harness({ balances, ledger, startAt = SENT_AT }) {
  let clock = startAt;
  const api = {
    now: () => clock,
    sleep: vi.fn(async (ms) => {
      clock += ms;
    }),
    save: vi.fn(),
  };
  const reads = {
    address: ME,
    readBalances: vi.fn(async () => balances(clock)),
    readLedger: vi.fn(async (since) => ledger(clock, since)),
    onPoll: vi.fn(),
  };
  return { api, reads, now: () => clock };
}

const nav = (available, total = available) => ({ available: { NAV: available }, total: { NAV: total } });
const moveOp = (amount, baseline, step = {}) => {
  const wait = { type: "waitCredit", need: null, added: amount, minutes: 6, ...step };
  return { op: { steps: [{ type: "deposit", amount, sentAt: SENT_AT }, wait], ctx: { creditBaseline: baseline } }, step: wait };
};
const swapOp = (deposit, need, step = {}) => {
  const wait = { type: "waitCredit", need, minutes: 6, ...step };
  return { op: { steps: [{ type: "deposit", amount: deposit, sentAt: SENT_AT }, wait], ctx: {} }, step: wait };
};

describe("waitForCredit", () => {
  it("ends once the balance has grown by the deposit", async () => {
    const { op, step } = moveOp(500, 200);
    const h = harness({ balances: (t) => (t >= SENT_AT + 3 * CREDIT_POLL_MS ? nav(700) : nav(200)), ledger: () => [] });
    await expect(waitForCredit(step, op, h.api, h.reads)).resolves.toBeNull();
    expect(h.api.sleep).toHaveBeenCalledTimes(3);
    expect(h.reads.onPoll).toHaveBeenCalledTimes(3);
  });

  it("sees the credit in the ledger when the balance was spent meanwhile", async () => {
    // 200 NAV were on the exchange when 500 were sent; the 200 were sold
    // before the credit, so the total never reaches 200 + 500.
    const { op, step } = moveOp(500, 200);
    const h = harness({ balances: () => nav(500), ledger: (t) => (t >= SENT_AT + CREDIT_POLL_MS ? [credit(500, SENT_AT + 400_000)] : []) });
    await expect(waitForCredit(step, op, h.api, h.reads)).resolves.toBeNull();
    expect(step.creditHash).toBe(`0xhash${SENT_AT + 400_000}`);
    expect(h.reads.readLedger).toHaveBeenLastCalledWith(SENT_AT);
  });

  it("sees the credit in the ledger when the NAV a swap needs is held by an order", async () => {
    const { op, step } = swapOp(300, 400);
    const h = harness({ balances: () => nav(100, 400), ledger: () => [credit(300, SENT_AT + 1)] });
    await expect(waitForCredit(step, op, h.api, h.reads)).resolves.toBeNull();
    expect(h.api.sleep).not.toHaveBeenCalled();
  });

  it("does not take an earlier or a smaller credit for this deposit", async () => {
    const { op, step } = moveOp(500, 200);
    const h = harness({ balances: () => nav(200), ledger: () => [credit(500, SENT_AT - 1), credit(100, SENT_AT + 1)] });
    await expect(waitForCredit(step, op, h.api, h.reads)).rejects.toThrow("credit_delayed");
  });

  it("still ends on the balance when the ledger cannot be read", async () => {
    const { op, step } = moveOp(500, 0);
    const h = harness({ balances: () => nav(500), ledger: () => { throw new Error("rate_limited"); } });
    await expect(waitForCredit(step, op, h.api, h.reads)).resolves.toBeNull();
  });

  it("stops for the user once the wait is over, instead of waiting forever", async () => {
    const { op, step } = moveOp(500, 200);
    const h = harness({ balances: () => nav(200), ledger: () => [] });
    await expect(waitForCredit(step, op, h.api, h.reads)).rejects.toThrow("credit_delayed");
    expect(h.now() - SENT_AT).toBeGreaterThan(creditMaxWaitMs(step));
    expect(h.now() - SENT_AT).toBeLessThanOrEqual(creditMaxWaitMs(step) + CREDIT_POLL_MS);
  });

  it("checks once more before giving up when the app was closed past the limit", async () => {
    const { op, step } = moveOp(500, 200);
    // Reopened ten hours later, with the credit long there.
    const h = harness({ startAt: SENT_AT + 10 * HOUR, balances: () => nav(0), ledger: () => [credit(500, SENT_AT + 400_000)] });
    await expect(waitForCredit(step, op, h.api, h.reads)).resolves.toBeNull();
  });

  it("reports the read failure, not a late credit, when nothing could be read", async () => {
    const { op, step } = moveOp(500, 200);
    const h = harness({
      startAt: SENT_AT + 10 * HOUR,
      balances: () => { throw new Error("rate_limited"); },
      ledger: () => { throw new Error("network_error"); },
    });
    await expect(waitForCredit(step, op, h.api, h.reads)).rejects.toThrow("rate_limited");
  });

  it("waits a full period again after 'keep waiting'", async () => {
    const reopenedAt = SENT_AT + 10 * HOUR;
    const { op, step } = moveOp(500, 200, { waitFrom: reopenedAt });
    const h = harness({ startAt: reopenedAt, balances: () => nav(200), ledger: () => [] });
    await expect(waitForCredit(step, op, h.api, h.reads)).rejects.toThrow("credit_delayed");
    expect(h.now() - reopenedAt).toBeGreaterThan(creditMaxWaitMs(step));
  });

  it("gives large deposits the time their confirmations take", () => {
    expect(creditMaxWaitMs({ minutes: 6 })).toBe(2 * HOUR);
    expect(creditMaxWaitMs({ minutes: 96 })).toBe(96 * 3 * 60_000);
    expect(creditMaxWaitMs({})).toBe(2 * HOUR);
  });

  it("falls back to the balance alone for a deposit with no send time", async () => {
    const wait = { type: "waitCredit", need: null, added: 50, minutes: 6, startedAt: SENT_AT };
    const op = { steps: [{ type: "deposit", amount: 50 }, wait], ctx: { creditBaseline: 0 } };
    const h = harness({ balances: (t) => (t > SENT_AT ? nav(50) : nav(0)), ledger: () => [credit(50, SENT_AT)] });
    await expect(waitForCredit(wait, op, h.api, h.reads)).resolves.toBeNull();
    expect(h.reads.readLedger).not.toHaveBeenCalled();
  });
});
