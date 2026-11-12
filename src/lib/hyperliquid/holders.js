import { HYPURRSCAN_API_URL } from "./config";

/**
 * Pulls the holder count out of whatever has arrived of a Hypurrscan
 * holders answer: { token, lastUpdate, holdersCount, holders: {…} }. For
 * most tokens the count is written before the (possibly megabytes-long)
 * holders map, so the first chunk is enough; for some (UBTC) it comes
 * after. Returns null until the count is in `text`.
 */
export function parseHolderCount(text) {
  const count = /"holdersCount"\s*:\s*(\d+)/.exec(text);
  if (!count) return null;
  const updated = /"lastUpdate"\s*:\s*(\d+)/.exec(text);
  return { count: Number(count[1]), updatedAt: updated ? Number(updated[1]) * 1000 : null };
}

// Enough for a token whose count trails its holder map (UBTC's answer is
// ~1.3 MB); HYPE's 15 MB is never read, its count leads.
const MAX_BYTES = 3 * 1024 * 1024;

/**
 * Holder count for a Hyperliquid spot token (by its spotMeta name, e.g.
 * "UBTC") from Hypurrscan — the exchange's own API has no such number. The
 * body is streamed and cancelled as soon as the count has gone by: the
 * full answer lists every holder (15 MB for HYPE), which nobody here needs.
 * Third-party and best-effort: resolves to null when it can't be had.
 */
export async function fetchHolderCount(tokenName, { timeoutMs = 20_000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${HYPURRSCAN_API_URL}/holders/${encodeURIComponent(tokenName)}`, { signal: ctrl.signal });
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let read = 0;
    let head = ""; // the first few KB, where lastUpdate is
    let tail = ""; // overlap so a count split across chunks is still seen
    let updatedAt = null;
    try {
      while (read < MAX_BYTES) {
        const { value, done } = await reader.read();
        const chunk = value ? decoder.decode(value, { stream: true }) : "";
        read += chunk.length;
        if (head.length < 4096) {
          head += chunk;
          const m = /"lastUpdate"\s*:\s*(\d+)/.exec(head);
          if (m) updatedAt = Number(m[1]) * 1000;
        }
        const window = tail + chunk;
        const found = parseHolderCount(window);
        if (found) return { count: found.count, updatedAt: found.updatedAt ?? updatedAt };
        tail = window.slice(-64);
        if (done) return null;
      }
      return null;
    } finally {
      reader.cancel().catch(() => {});
    }
  } catch (e) {
    console.error("[hyperliquid] holder count unavailable:", e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
