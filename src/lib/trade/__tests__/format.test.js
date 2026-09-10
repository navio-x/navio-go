import { describe, it, expect } from "vitest";
import { toSatoshi, formatAmount, shortenId, secondsUntil, formatCountdown } from "../format.js";

describe("toSatoshi", () => {
  it("converts a decimal NAV amount to base units", () => {
    expect(toSatoshi(1.5)).toBe(150_000_000n);
  });
  it("rounds to the nearest base unit", () => {
    expect(toSatoshi(0.000000005)).toBe(1n);
  });
});

describe("formatAmount", () => {
  it("formats NAV as a trimmed decimal", () => {
    expect(formatAmount(150_000_000n, true)).toBe("1.5");
    expect(formatAmount(100_000_000n, true)).toBe("1");
    expect(formatAmount(1n, true)).toBe("0.00000001");
  });
  it("formats a token amount as a plain integer", () => {
    expect(formatAmount(500n, false)).toBe("500");
  });
  it("handles negative NAV amounts", () => {
    expect(formatAmount(-150_000_000n, true)).toBe("-1.5");
  });
  it("formats zero NAV without a fractional part", () => {
    expect(formatAmount(0n, true)).toBe("0");
  });
});

describe("shortenId", () => {
  it("leaves short values untouched", () => {
    expect(shortenId("abc123")).toBe("abc123");
  });
  it("truncates long hex ids", () => {
    const id = "a".repeat(64);
    expect(shortenId(id)).toBe(`${"a".repeat(10)}…${"a".repeat(6)}`);
  });
});

describe("secondsUntil / formatCountdown", () => {
  const now = 1_700_000_000_000;

  it("returns 0 for a past timestamp", () => {
    expect(secondsUntil(now / 1000 - 10, now)).toBe(0);
  });
  it("returns remaining seconds for a future timestamp", () => {
    expect(secondsUntil(now / 1000 + 90, now)).toBe(90);
  });
  it("formats a countdown under a minute as seconds only", () => {
    expect(formatCountdown(now / 1000 + 45, now)).toBe("45s");
  });
  it("formats a countdown over a minute as minutes and seconds", () => {
    expect(formatCountdown(now / 1000 + 125, now)).toBe("2m 5s");
  });
  it("returns null once expired, so callers render their own expired copy", () => {
    expect(formatCountdown(now / 1000 - 1, now)).toBeNull();
  });
});
