import { describe, it, expect } from "vitest";
import { parseHolderCount } from "../holders";

describe("parseHolderCount", () => {
  it("reads the count and update time from the head of the document", () => {
    const head = '{"token": "HYPE", "lastUpdate": 1794504685, "holdersCount": 267855, "holders": {"0x61aa": 111.9, "0x33';
    expect(parseHolderCount(head)).toEqual({ count: 267855, updatedAt: 1794504685000 });
  });

  it("waits for the count to arrive", () => {
    expect(parseHolderCount('{"token": "HYPE", "lastUpdate": 1794504685, "holdersCo')).toBeNull();
    expect(parseHolderCount("")).toBeNull();
  });

  it("copes without a lastUpdate", () => {
    expect(parseHolderCount('{"holdersCount": 29, "holders": {}}')).toEqual({ count: 29, updatedAt: null });
  });
});
