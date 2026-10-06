import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  UNLOCK_DURATIONS,
  rememberPassword,
  recallPassword,
  forgetPassword,
  forgetAllPasswords,
} from "../unlockCache.js";

const HOUR = UNLOCK_DURATIONS["1h"];

describe("unlockCache", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    await forgetAllPasswords();
  });
  afterEach(() => vi.useRealTimers());

  it("recalls a remembered password inside the window", async () => {
    await rememberPassword("w1", "hunter2 ş");
    vi.setSystemTime(Date.now() + HOUR - 1000);
    expect(await recallPassword("w1", HOUR)).toBe("hunter2 ş");
  });

  it("returns null and drops the entry once the window has passed", async () => {
    await rememberPassword("w1", "pw");
    vi.setSystemTime(Date.now() + HOUR);
    expect(await recallPassword("w1", HOUR)).toBeNull();
    // gone for good, even if a longer window is chosen afterwards
    expect(await recallPassword("w1", UNLOCK_DURATIONS["30d"])).toBeNull();
  });

  it("does not slide: recalling never extends the lifetime", async () => {
    await rememberPassword("w1", "pw");
    vi.setSystemTime(Date.now() + HOUR / 2);
    expect(await recallPassword("w1", HOUR)).toBe("pw");
    vi.setSystemTime(Date.now() + HOUR / 2);
    expect(await recallPassword("w1", HOUR)).toBeNull();
  });

  it("never recalls when the feature is off (no max age)", async () => {
    await rememberPassword("w1", "pw");
    expect(await recallPassword("w1", 0)).toBeNull();
  });

  it("drops the entry if the clock was wound back", async () => {
    await rememberPassword("w1", "pw");
    vi.setSystemTime(Date.now() + 2 * HOUR);
    expect(await recallPassword("w1", UNLOCK_DURATIONS["24h"])).toBe("pw");
    vi.setSystemTime(Date.now() - HOUR);
    expect(await recallPassword("w1", UNLOCK_DURATIONS["24h"])).toBeNull();
  });

  it("keeps wallets separate and forgets only the one asked for", async () => {
    await rememberPassword("w1", "pw1");
    await rememberPassword("w2", "pw2");
    await forgetPassword("w1");
    expect(await recallPassword("w1", HOUR)).toBeNull();
    expect(await recallPassword("w2", HOUR)).toBe("pw2");
  });

  it("forgetAllPasswords clears everything", async () => {
    await rememberPassword("w1", "pw1");
    await forgetAllPasswords();
    expect(await recallPassword("w1", HOUR)).toBeNull();
  });
});
