import { describe, it, expect } from "vitest";
import { satToNavString, sumSatToNavString } from "../satAmount.js";

describe("satToNavString", () => {
  it("converts whole NAV amounts", () => {
    expect(satToNavString("100000000")).toBe("1.00000000");
  });

  it("converts fractional amounts", () => {
    expect(satToNavString("150000001")).toBe("1.50000001");
  });

  it("converts zero", () => {
    expect(satToNavString("0")).toBe("0.00000000");
  });

  it("pads small fractional amounts to 8 decimals", () => {
    expect(satToNavString("1")).toBe("0.00000001");
  });

  it("stays exact for amounts beyond Number.MAX_SAFE_INTEGER", () => {
    // Number.MAX_SAFE_INTEGER is 9007199254740991 — one more satoshi than
    // that already can't round-trip through a float. This is the exact
    // scenario Number(amountSat)/1e8 gets wrong (see exportData.js).
    const huge = "9007199254740993";
    expect(satToNavString(huge)).toBe("90071992.54740993");
    expect(Number(huge) === Number(huge) + 1).toBe(true); // demonstrates the float can't tell 993 from 994
  });

  it("accepts a BigInt directly", () => {
    expect(satToNavString(123456789n)).toBe("1.23456789");
  });
});

describe("sumSatToNavString", () => {
  it("sums exactly, not via float addition", () => {
    const amounts = Array.from({ length: 10 }).map(() => "10000000"); // 0.1 NAV each
    expect(sumSatToNavString(amounts)).toBe("1.00000000");
  });

  it("sums an empty list to zero", () => {
    expect(sumSatToNavString([])).toBe("0.00000000");
  });

  it("treats null/undefined entries as zero", () => {
    expect(sumSatToNavString(["100000000", null, undefined])).toBe("1.00000000");
  });
});
