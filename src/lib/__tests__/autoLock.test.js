import { describe, it, expect } from "vitest";
import { shouldLock, AUTO_LOCK_OPTIONS } from "../autoLock.js";

const MIN = 60 * 1000;
const base = { now: 100 * MIN, lastActivity: 100 * MIN, hiddenAt: null };

describe("shouldLock", () => {
  it("never locks when auto-lock is off", () => {
    expect(shouldLock({ ...base, lastActivity: 0, hiddenAt: 0, thresholdMs: null })).toBe(false);
    expect(shouldLock({ ...base, lastActivity: 0, hiddenAt: 0, thresholdMs: undefined })).toBe(false);
  });

  it("locks after the idle threshold in the foreground", () => {
    const thresholdMs = AUTO_LOCK_OPTIONS["5m"];
    expect(shouldLock({ ...base, lastActivity: base.now - 4 * MIN, thresholdMs })).toBe(false);
    expect(shouldLock({ ...base, lastActivity: base.now - 5 * MIN, thresholdMs })).toBe(true);
  });

  it("locks after the threshold in the background even with recent input before it", () => {
    const thresholdMs = AUTO_LOCK_OPTIONS["1m"];
    const s = { ...base, lastActivity: base.now - 30 * 1000, hiddenAt: base.now - 2 * MIN, thresholdMs };
    expect(shouldLock(s)).toBe(true);
    expect(shouldLock({ ...s, hiddenAt: base.now - 30 * 1000 })).toBe(false);
  });

  it("'immediately' locks on the background transition only", () => {
    const thresholdMs = AUTO_LOCK_OPTIONS.immediately;
    expect(thresholdMs).toBe(0);
    // Idle in the foreground for an hour: still not locked.
    expect(shouldLock({ ...base, lastActivity: base.now - 60 * MIN, thresholdMs })).toBe(false);
    expect(shouldLock({ ...base, hiddenAt: base.now, thresholdMs })).toBe(true);
    expect(shouldLock({ ...base, resuming: true, thresholdMs })).toBe(true);
  });
});
