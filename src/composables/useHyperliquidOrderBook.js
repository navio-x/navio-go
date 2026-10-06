import { ref, watch, onMounted, onUnmounted } from "vue";
import { App as CapApp } from "@capacitor/app";
import { formatUnits } from "viem";
import { HL_WS_URL } from "@/lib/hyperliquid/config";
import { fetchL2Book } from "@/lib/hyperliquid/api";
import { getSpotMeta } from "@/lib/hyperliquid/meta";
import { safeParseUnits } from "@/lib/hyperliquid/decimal";

const MAX_RECONNECT_DELAY_MS = 30_000;
const PING_INTERVAL_MS = 30_000;
const FALLBACK_POLL_MS = 5_000;
const DEFAULT_SIZE_DECIMALS = 8;

function buildLevels(rawLevels, count, decimals) {
  let cumRaw = 0n;
  return (rawLevels || []).slice(0, count).map((lvl) => {
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
 * "@7" — a Ref<string|null>, resolved by lib/hyperliquid/market.js). Primary
 * transport is the l2Book websocket subscription (each message is a full
 * snapshot, not a diff); falls back to 5s REST polling if the socket can't
 * stay up. Only ever runs while the owning component is mounted and the app
 * is foregrounded.
 */
export function useHyperliquidOrderBook(coin, { levels = 10 } = {}) {
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

  function applySnapshot(data) {
    const rawBids = data?.levels?.[0] || [];
    const rawAsks = data?.levels?.[1] || [];
    bids.value = buildLevels(rawBids, levels, sizeDecimals);
    asks.value = buildLevels(rawAsks, levels, sizeDecimals);

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

  async function fetchSnapshot() {
    const c = coin.value;
    if (!c) return;
    loading.value = true;
    try {
      applySnapshot(await fetchL2Book(c));
    } catch (e) {
      console.error("[hyperliquid] order book snapshot failed:", e);
      error.value = e?.message || "unknown";
      // Last good bids/asks are left untouched — don't blank the UI.
    } finally {
      loading.value = false;
    }
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // Fallback path only — used while the socket is down/reconnecting.
  function startPolling() {
    stopPolling();
    fetchSnapshot();
    pollTimer = setInterval(() => {
      if (document.visibilityState === "visible") fetchSnapshot();
    }, FALLBACK_POLL_MS);
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

    // REST snapshot first so the book isn't empty while the socket connects.
    fetchSnapshot();

    console.log("[hyperliquid] order book ws connecting:", HL_WS_URL, "coin:", c);

    try {
      ws = new WebSocket(HL_WS_URL);
    } catch (e) {
      console.error("[hyperliquid] order book ws unavailable, falling back to polling:", e);
      startPolling();
      return;
    }

    ws.onopen = () => {
      console.log("[hyperliquid] order book ws open");
      reconnectDelay = 1000;
      connected.value = true;
      stopPolling(); // socket is live — stop the REST fallback
      ws.send(JSON.stringify({ method: "subscribe", subscription: { type: "l2Book", coin: c } }));
      pingTimer = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ method: "ping" }));
      }, PING_INTERVAL_MS);
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.channel === "l2Book" && msg.data) applySnapshot(msg.data);
      } catch (e) {
        console.error("[hyperliquid] order book ws message parse failed:", e);
      }
    };
    ws.onclose = (event) => {
      console.log("[hyperliquid] order book ws closed — code:", event.code, "reason:", event.reason, "wasClean:", event.wasClean);
      connected.value = false;
      stopPing();
      if (unmounted || backgrounded || !coin.value) return;
      startPolling(); // keep the book fresh-ish while reconnecting
      scheduleReconnect();
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
    openSocket();
  }

  function stop() {
    closeSocket();
    stopPolling();
  }

  watch(coin, (c, prev) => {
    if (c === prev) return;
    reconnectDelay = 1000;
    bids.value = [];
    asks.value = [];
    mid.value = null;
    spread.value = null;
    spreadPct.value = null;
    if (c) start();
    else stop();
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
