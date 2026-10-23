import { describe, it, expect } from "vitest";
import { passwordWaitMs, recordPasswordFailure, recordPasswordSuccess, FREE_ATTEMPTS, BASE_WAIT_MS, MAX_WAIT_MS, waitSeconds } from "../passwordThrottle.js";

describe("password throttle", () => {
  it("allows the free attempts, then doubles the wait, capped", () => {
    const w = "t1"; const t0 = 1_000_000;
    for (let i = 1; i < FREE_ATTEMPTS; i++) expect(recordPasswordFailure(w, t0)).toBe(0);
    expect(recordPasswordFailure(w, t0)).toBe(BASE_WAIT_MS);            // 5th
    expect(passwordWaitMs(w, t0 + 1000)).toBe(BASE_WAIT_MS - 1000);
    expect(passwordWaitMs(w, t0 + BASE_WAIT_MS)).toBe(0);
    expect(recordPasswordFailure(w, t0)).toBe(BASE_WAIT_MS * 2);        // 6th
    expect(recordPasswordFailure(w, t0)).toBe(BASE_WAIT_MS * 4);        // 7th
    for (let i = 0; i < 10; i++) recordPasswordFailure(w, t0);
    expect(passwordWaitMs(w, t0)).toBe(MAX_WAIT_MS);
    recordPasswordSuccess(w);
    expect(passwordWaitMs(w, t0)).toBe(0);
    expect(recordPasswordFailure(w, t0)).toBe(0);
  });

  it("is per wallet", () => {
    for (let i = 0; i < FREE_ATTEMPTS; i++) recordPasswordFailure("a", 0);
    expect(passwordWaitMs("a", 0)).toBe(BASE_WAIT_MS);
    expect(passwordWaitMs("b", 0)).toBe(0);
  });

  it("rounds the wait up to whole seconds, never below one", () => {
    expect(waitSeconds(29_001)).toBe(30);
    expect(waitSeconds(1)).toBe(1);
  });
});
