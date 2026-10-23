import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("copy-to-clipboard", () => ({ default: vi.fn(() => false) }));

let clip;
beforeEach(() => {
  vi.useFakeTimers();
  clip = { text: null, fail: false, writeText: vi.fn(async (t) => { if (clip.fail) throw new Error("no focus"); clip.text = t; }) };
  globalThis.navigator = { clipboard: clip };
});
afterEach(() => { vi.useRealTimers(); delete globalThis.navigator; });

describe("copySecret", () => {
  it("copies, then empties the clipboard after the TTL", async () => {
    const lib = await import("../clipboard.js");
    expect(await lib.copySecret("seed words", { ttlMs: 1000 })).toBe(true);
    expect(clip.text).toBe("seed words");
    expect(lib.secretCopyPending()).toBe(true);
    await vi.advanceTimersByTimeAsync(999);
    expect(clip.text).toBe("seed words");
    await vi.advanceTimersByTimeAsync(1);
    expect(clip.text).toBe("");
    expect(lib.secretCopyPending()).toBe(false);
  });

  it("a newer copy supersedes the older one's timer", async () => {
    const lib = await import("../clipboard.js");
    await lib.copySecret("first", { ttlMs: 1000 });
    await vi.advanceTimersByTimeAsync(500);
    await lib.copySecret("second", { ttlMs: 1000 });
    await vi.advanceTimersByTimeAsync(600); // first's TTL would have passed
    expect(clip.text).toBe("second");
    await vi.advanceTimersByTimeAsync(400);
    expect(clip.text).toBe("");
  });

  it("retries a refused clear later", async () => {
    const lib = await import("../clipboard.js");
    await lib.copySecret("seed", { ttlMs: 100 });
    clip.fail = true;
    await vi.advanceTimersByTimeAsync(100);
    expect(clip.text).toBe("seed");
    expect(lib.secretCopyPending()).toBe(true);
    clip.fail = false;
    await lib.clearSecretCopy();
    expect(clip.text).toBe("");
    expect(lib.secretCopyPending()).toBe(false);
  });

  it("clearSecretCopy is a no-op when nothing secret was copied", async () => {
    const lib = await import("../clipboard.js");
    await lib.clearSecretCopy();
    expect(clip.writeText).not.toHaveBeenCalled();
  });
});
