import { describe, it, expect, vi, afterEach } from "vitest";
import { postInfo, fetchUserLedger, REQUEST_TIMEOUT_MS } from "../api";

const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("postInfo", () => {
  it("posts the body and returns the parsed answer", async () => {
    const fetchMock = vi.fn(async () => json([{ time: 1 }]));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchUserLedger("0xabc", 42)).resolves.toEqual([{ time: 1 }]);
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ type: "userNonFundingLedgerUpdates", user: "0xabc", startTime: 42 });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("maps failures to the app's error codes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 429)));
    await expect(postInfo({})).rejects.toThrow("rate_limited");
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 500)));
    await expect(postInfo({})).rejects.toThrow("http_error");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("failed to fetch"); }));
    await expect(postInfo({})).rejects.toThrow("network_error");
  });

  it("gives up on a request that never answers, and aborts it", async () => {
    vi.useFakeTimers();
    let signal;
    // Hangs forever, even after the abort.
    vi.stubGlobal("fetch", vi.fn((_url, init) => { signal = init.signal; return new Promise(() => {}); }));
    const outcome = postInfo({ type: "spotMeta" }).then(() => "answered", (e) => e.message);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(outcome).resolves.toBe("network_error");
    expect(signal.aborted).toBe(true);
  });

  it("gives up on an answer whose body never arrives", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: () => new Promise(() => {}) })));
    const outcome = postInfo({}).then(() => "answered", (e) => e.message);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await expect(outcome).resolves.toBe("network_error");
  });

  it("leaves no timer behind after an answer", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => json({ ok: 1 })));
    await expect(postInfo({})).resolves.toEqual({ ok: 1 });
    expect(vi.getTimerCount()).toBe(0);
  });
});
