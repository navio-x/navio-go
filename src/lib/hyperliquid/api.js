import { HL_API_URL } from "./config";

// Error convention matches lib/evm/swapMath.js's mapErrorCode: the thrown
// Error's `message` itself is the code, read back via e.message by callers.
async function postInfo(body) {
  let response;
  try {
    response = await fetch(HL_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("network_error");
  }

  if (response.status === 429) throw new Error("rate_limited");
  if (!response.ok) throw new Error("http_error");
  return response.json();
}

/** { tokens: [{ name, index, tokenId, szDecimals, weiDecimals }], universe: [{ tokens: [base, quote], name, index }] } */
export function fetchSpotMeta() {
  return postInfo({ type: "spotMeta" });
}

/** { balances: [{ coin, token, total, hold }] } */
export function fetchSpotClearinghouseState(user) {
  return postInfo({ type: "spotClearinghouseState", user });
}

/** [meta, ctxs] — ctxs is NOT aligned with meta.universe by position; match each ctx by its `coin` ("@<pair index>" or the pair name). */
export function fetchSpotMetaAndAssetCtxs() {
  return postInfo({ type: "spotMetaAndAssetCtxs" });
}

/** { levels: [bids[], asks[]] } — each level is { px, sz, n } (strings). */
export function fetchL2Book(coin) {
  return postInfo({ type: "l2Book", coin });
}

/** [{ t, T, s, i, o, c, h, l, v, n }] — OHLCV candles oldest first; t/T are open/close ms, prices are strings. `interval` e.g. "15m" | "1h" | "4h" | "1d". */
export function fetchCandleSnapshot(coin, interval, startTime, endTime) {
  return postInfo({ type: "candleSnapshot", req: { coin, interval, startTime, endTime } });
}

/** [{ coin, side: "B"|"A", px, sz, time, hash, tid }] — the market's latest trades (all participants); side is the taker's: "B" bought, "A" sold. */
export function fetchRecentTrades(coin) {
  return postInfo({ type: "recentTrades", coin });
}

/** [{ coin, side: "B"|"A", limitPx, sz, oid, timestamp, origSz }] — across every market for this user. */
export function fetchOpenOrders(user) {
  return postInfo({ type: "openOrders", user });
}

/** [{ coin, side: "B"|"A", px, sz, time, oid, hash, closedPnl, fee }] — most recent fills first, across every market for this user. */
export function fetchUserFills(user) {
  return postInfo({ type: "userFills", user });
}

/** "unifiedAccount" | "portfolioMargin" | "disabled" | "default" | "dexAbstraction" */
export function fetchUserAbstraction(user) {
  return postInfo({ type: "userAbstraction", user });
}
