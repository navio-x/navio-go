import { ref, watch, toValue, onMounted, onUnmounted } from "vue";
import { App as CapApp } from "@capacitor/app";
import { formatUnits } from "viem";
import { HL_WS_URL } from "@/lib/hyperliquid/config";
import { fetchL2Book } from "@/lib/hyperliquid/api";
import { getSpotMeta } from "@/lib/hyperliquid/meta";
import { safeParseUnits } from "@/lib/hyperliquid/decimal";

const MAX_RECONNECT_DELAY_MS = 30_000;
const PING_INTERVAL_MS = 30_000;
// The l2Book subscription only pushes a full snapshot every ~10 s (measured
// on spot and perp alike), so REST is polled every second for depth while
// the `bbo` subscription moves the top of the book the instant it changes.
const POLL_MS = 1_000;
const DEFAULT_SIZE_DECIMALS = 8;

// Spot prices never carry more fractional digits than this.
const PX_DECIMALS = 8;

// Merges levels into price buckets of 10^stepExp, best price first as they
// arrive: a bid counts at the bucket's lower edge and an ask at its upper
// one, so a grouped row never shows a better price than the orders in it.
function groupLevels(rawLevels, stepExp, isBid, decimals) {
  const unit = 10n ** BigInt(Math.max(0, PX_DECIMALS + stepExp));
  const grouped = [];
  for (const lvl of rawLevels) {
    const px = safeParseUnits(lvl.px, PX_DECIMALS);
    const rem = px % unit;
    const bucket = rem === 0n ? px : isBid ? px - rem : px - rem + unit;
    const last = grouped[grouped.length - 1];
    if (last && last.bucket === bucket) {
      last.szRaw += safeParseUnits(lvl.sz, decimals);
      last.n += lvl.n;
    } else {
      grouped.push({ bucket, szRaw: safeParseUnits(lvl.sz, decimals), n: lvl.n });
    }
  }
  return grouped.map((g) => ({ px: formatUnits(g.bucket, PX_DECIMALS), sz: formatUnits(g.szRaw, decimals), n: g.n }));
}

function buildLevels(rawLevels, count, decimals, stepExp, isBid) {
  const levels = stepExp == null ? rawLevels || [] : groupLevels(rawLevels || [], stepExp, isBid, decimals);
  let cumRaw = 0n;
  return levels.slice(0, count).map((lvl) => {
    cumRaw += safeParseUnits(lvl.sz, decimals);
    return { px: lvl.px, sz: lvl.sz, n: lvl.n, total: formatUnits(cumRaw, decimals) };
  });
}

// Resolves the base token's szDecimals for a "@<pairIndex>" coin id, reusing
// the same cached spotMeta as useHyperliquidBalances/market.js rather than
// requiring the caller to already know it.
async function resolveSizeDecimals(coinStr) {
  if (!coinStr?.startsWith("@")) return DEFAULT_SIZE_DECIMALS;
  const pairIndex = Number(coinStr.slice(1));
  if (!Number.isFinite(pairIndex)) return DEFAULT_SIZE_DECIMALS;
  try {
    const meta = await getSpotMeta();
    const pair = meta.universe.find((p) => p.index === pairIndex);
    const baseTok = pair ? meta.tokens.find((t) => t.index === pair.tokens[0]) : null;
    return baseTok?.szDecimals ?? DEFAULT_SIZE_DECIMALS;
  } catch {
    return DEFAULT_SIZE_DECIMALS;
  }
}

/**
 * Live Hyperliquid L2 order book for a resolved spot market (`coin`, e.g.
 * "@7" — a Ref<string|null>, resolved by lib/hyperliquid/market.js). Depth
 * comes from a 1 s REST l2Book poll plus the l2Book websocket's occasional
 * full snapshot (each message is a full snapshot, not a diff; the exchange
 * sends one only every ~10 s); the `bbo` subscription on the same socket
 * updates the best bid/ask on every change in between, so the top of the
 * book and the mid are real-time. Snapshots carry the exchange's `time`, and
 * an older one never overwrites a newer one. Only ever runs while the owning
 * component is mounted and the app is foregrounded.
 *
 * Price grouping (both optional, plain values or refs): `stepExp` merges
 * levels into buckets of 10^stepExp, and `nSigFigs` (2–4) asks the exchange
 * for a book already aggregated to that precision — it only sends ~20 levels
 * a side, so a coarse step needs the coarser book to have any depth to show.
 */
export function useHyperliquidOrderBook(coin, { levels = 10, nSigFigs = null, stepExp = null } = {}) {
  const bids = ref([]);
  const asks = ref([]);
  const mid = ref(null);
  const spread = ref(null);
  const spreadPct = ref(null);
  const loading = ref(false);
  const error = ref(null);
  const connected = ref(false);

  let ws = null;
  let pingTimer = null;
  let pollTimer = null;
  let reconnectTimer = null;
  let reconnectDelay = 1000;
  let backgrounded = false;
  let unmounted = false;
  let appListener = null;
  let sizeDecimals = DEFAULT_SIZE_DECIMALS;
  let lastSnapshot = null;

  function applySnapshot(data) {
    // REST answers and socket pushes race: keep the newest by exchange time.
    if (lastSnapshot?.time && data?.time && data.time < lastSnapshot.time) return;
    lastSnapshot = data;
    const rawBids = data?.levels?.[0] || [];
    const rawAsks = data?.levels?.[1] || [];
    bids.value = buildLevels(rawBids, levels, sizeDecimals, toValue(stepExp), true);
    asks.value = buildLevels(rawAsks, levels, sizeDecimals, toValue(stepExp), false);

    const bestBid = rawBids[0] ? Number(rawBids[0].px) : null;
    const bestAsk = rawAsks[0] ? Number(rawAsks[0].px) : null;
    if (bestBid != null && bestAsk != null) {
      mid.value = (bestBid + bestAsk) / 2;
      spread.value = bestAsk - bestBid;
      spreadPct.value = mid.value > 0 ? (spread.value / mid.value) * 100 : null;
    } else {
      mid.value = null;
      spread.value = null;
      spreadPct.value = null;
    }
    error.value = null;
  }

  // Puts a fresh best level on top of one side: levels the new best has
  // overtaken are gone (they would be the best otherwise), one at the same
  // price is replaced, the rest move down.
  function mergeTop(side, best, isBid) {
    if (!best) return side;
    const px = Number(best.px);
    return [best, ...side.filter((l) => (isBid ? Number(l.px) < px : Number(l.px) > px))];
  }

  // A `bbo` push: only meaningful on the full-precision book — an aggregated
  // one (nSigFigs) has buckets the raw top level doesn't line up with.
  function applyBbo(data) {
    if (!lastSnapshot || toValue(nSigFigs) != null) return;
    if (lastSnapshot.time && data?.time && data.time < lastSnapshot.time) return;
    const [bid, ask] = data?.bbo || [];
    const levels = [
      mergeTop(lastSnapshot.levels?.[0] || [], bid, true),
      mergeTop(lastSnapshot.levels?.[1] || [], ask, false),
    ];
    applySnapshot({ ...lastSnapshot, levels, time: data?.time ?? lastSnapshot.time });
  }

  let inFlight = false;

  async function fetchSnapshot() {
    const c = coin.value;
    if (!c || inFlight) return;
    inFlight = true;
    if (!lastSnapshot) loading.value = true;
    try {
      const sigFigs = toValue(nSigFigs);
      const data = await fetchL2Book(c, sigFigs);
      // Ignore an answer for a market / precision that was switched away from meanwhile.
      if (coin.value !== c || toValue(nSigFigs) !== sigFigs) return;
      applySnapshot(data);
    } catch (e) {
      console.error("[hyperliquid] order book snapshot failed:", e);
      error.value = e?.message || "unknown";
      // Last good bids/asks are left untouched — don't blank the UI.
    } finally {
      inFlight = false;
      loading.value = false;
    }
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // Runs the whole time the book is live, socket or no socket: this is
  // where the depth comes from (see POLL_MS).
  function startPolling() {
    stopPolling();
    fetchSnapshot();
    pollTimer = setInterval(() => {
      if (document.visibilityState === "visible") fetchSnapshot();
    }, POLL_MS);
  }

  function stopPing() {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  }

  function clearReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function closeSocket() {
    clearReconnect();
    stopPing();
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      try {
        ws.close();
      } catch {
        // socket already closing/closed — nothing to clean up
      }
      ws = null;
    }
    connected.value = false;
  }

  function scheduleReconnect() {
    if (unmounted || backgrounded || !coin.value) return;
    clearReconnect();
    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
      openSocket();
    }, reconnectDelay);
  }

  function openSocket() {
    if (unmounted || backgrounded) return;
    const c = coin.value;
    if (!c) return;
    closeSocket();

    console.log("[hyperliquid] order book ws connecting:", HL_WS_URL, "coin:", c);

    try {
      ws = new WebSocket(HL_WS_URL);
    } catch (e) {
      console.error("[hyperliquid] order book ws unavailable, REST polling only:", e);
      return;
    }

    ws.onopen = () => {
      console.log("[hyperliquid] order book ws open");
      reconnectDelay = 1000;
      connected.value = true;
      const sigFigs = toValue(nSigFigs);
      ws.send(JSON.stringify({ method: "subscribe", subscription: { type: "l2Book", coin: c, ...(sigFigs ? { nSigFigs: sigFigs } : {}) } }));
      // Top-of-book on every change; the raw level only fits the full-precision book.
      if (!sigFigs) ws.send(JSON.stringify({ method: "subscribe", subscription: { type: "bbo", coin: c } }));
      pingTimer = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ method: "ping" }));
      }, PING_INTERVAL_MS);
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.channel === "l2Book" && msg.data) applySnapshot(msg.data);
        else if (msg?.channel === "bbo" && msg.data?.coin === c) applyBbo(msg.data);
      } catch (e) {
        console.error("[hyperliquid] order book ws message parse failed:", e);
      }
    };
    ws.onclose = (event) => {
      console.log("[hyperliquid] order book ws closed — code:", event.code, "reason:", event.reason, "wasClean:", event.wasClean);
      connected.value = false;
      stopPing();
      if (unmounted || backgrounded || !coin.value) return;
      scheduleReconnect(); // REST polling carries on meanwhile
    };
    ws.onerror = (event) => {
      console.error("[hyperliquid] order book ws error:", event);
      try {
        ws?.close();
      } catch {
        // onclose handles fallback/reconnect either way
      }
    };
  }

  async function start() {
    const c = coin.value;
    if (!c) return;
    sizeDecimals = await resolveSizeDecimals(c);
    if (unmounted || backgrounded || coin.value !== c) return; // coin/state moved on while resolving
    startPolling();
    openSocket();
  }

  function stop() {
    closeSocket();
    stopPolling();
  }

  function reset() {
    reconnectDelay = 1000;
    lastSnapshot = null;
    bids.value = [];
    asks.value = [];
    mid.value = null;
    spread.value = null;
    spreadPct.value = null;
  }

  watch(coin, (c, prev) => {
    if (c === prev) return;
    reset();
    if (c) start();
    else stop();
  });

  // A different precision is a different subscription: start over.
  watch(() => toValue(nSigFigs), () => {
    if (!coin.value) return;
    stop();
    reset();
    start();
  });

  // The step alone only changes how the levels already here are merged.
  watch(() => toValue(stepExp), () => {
    if (lastSnapshot) applySnapshot(lastSnapshot);
  });

  onMounted(async () => {
    start();
    // appStateChange (not resume/pause) matches lib/chat/client.js's
    // existing resume-detection pattern elsewhere in this app. Guarded:
    // addListener has been observed to throw on some Android/Capacitor
    // builds, and an unhandled rejection here would otherwise abort the
    // whole page's render.
    try {
      const handle = await CapApp.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) {
          backgrounded = true;
          stop();
          return;
        }
        if (!backgrounded) return;
        backgrounded = false;
        reconnectDelay = 1000;
        start();
      });
      if (unmounted) {
        handle.remove();
        return;
      }
      appListener = handle;
    } catch (e) {
      console.error("[hyperliquid] appStateChange listener unavailable:", e);
    }
  });

  onUnmounted(() => {
    unmounted = true;
    stop();
    appListener?.remove();
  });

  return { bids, asks, spread, spreadPct, mid, loading, error, connected };
}
