import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseOperators } from "../staking.js";

// staking/operators.json is edited by pull request and read by every wallet,
// so a change that the app would silently drop fails here instead.
const doc = JSON.parse(readFileSync(resolve(__dirname, "../../../staking/operators.json"), "utf8"));
const parsed = parseOperators(doc);

describe("staking/operators.json", () => {
  it("is a schema 1 directory", () => {
    expect(doc.schema).toBe(1);
    expect(Array.isArray(doc.operators)).toBe(true);
  });

  it("has no entry the app would drop", () => {
    expect(parsed.map((o) => o.id)).toEqual(doc.operators.map((o) => o.id));
  });

  it("has unique ids", () => {
    const ids = doc.operators.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lists only known networks", () => {
    for (const o of doc.operators) {
      expect(o.networks.length).toBeGreaterThan(0);
      for (const n of o.networks) expect(["mainnet", "testnet"]).toContain(n);
    }
  });

  it("has valid createdAt dates and https websites", () => {
    for (const o of doc.operators) {
      expect(Number.isFinite(Date.parse(o.createdAt))).toBe(true);
      if (o.website) expect(o.website.startsWith("https://")).toBe(true);
    }
  });

  it("has at most one enabled default operator per network", () => {
    for (const net of ["mainnet", "testnet"]) {
      const defaults = parsed.filter((o) => o.enabled && o.isDefault && o.networks.includes(net));
      expect(defaults.length).toBeLessThanOrEqual(1);
    }
  });
});
