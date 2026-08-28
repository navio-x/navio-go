import { describe, it, expect, vi, beforeEach } from "vitest";

const mockHealth = { lastSuccessAt: null, lastErrorAt: null };
vi.mock("@/stores/navio", () => ({
  getSyncHealth: () => mockHealth,
}));

const { isConnectionOffline } = await import("../connectivity.js");

describe("isConnectionOffline", () => {
  beforeEach(() => {
    mockHealth.lastSuccessAt = null;
    mockHealth.lastErrorAt = null;
  });

  it("is not offline before the first sync tick has ever happened", () => {
    expect(isConnectionOffline()).toBe(false);
  });

  it("is not offline shortly after a successful sync tick", () => {
    mockHealth.lastSuccessAt = Date.now() - 1000;
    expect(isConnectionOffline()).toBe(false);
  });

  it("is offline once the last successful tick is stale", () => {
    mockHealth.lastSuccessAt = Date.now() - 30_000;
    expect(isConnectionOffline()).toBe(true);
  });
});
