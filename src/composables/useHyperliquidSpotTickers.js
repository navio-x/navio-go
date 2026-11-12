import { ref, watch, onMounted, onUnmounted } from "vue";
import { App as CapApp } from "@capacitor/app";
import { HL_WS_URL } from "@/lib/hyperliquid/config";
import { fetchSpotMetaAndAssetCtxs } from "@/lib/hyperliquid/api";

const FALLBACK_POLL_MS = 30_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const PING_INTERVAL_MS = 30_000;

/**
 * One ticker row from a spot asset ctx — the same shape whether it came from
 * the spotMetaAndAssetCtxs REST call or an activeSpotAssetCtx socket push.
 */
export function ctxToTicker(ctx) {
  const px = Number(ctx.midPx ?? ctx.markPx);
  const prev = Number(ctx.prevDayPx);
  return {
    price: Number.isFinite(px) ? px : null,
    change24h: Number.isFinite(px) && prev > 0 ? ((px - prev) / prev) * 100 : null,
    volume24h: ctx.dayNtlVlm != null ? Number(ctx.dayNtlVlm) : null,
  };
}

/**
 * Binance-style ticker rows for several Hyperliquid spot pairs: last price,
 * 24h change and 24h notional volume. `pairIndices` is a Ref<number[]> —
 * resolve them with lib/hyperliquid/market.js, never hardcode them.
 * `tickers` is keyed by pair index: { [idx]: { price, change24h, volume24h } }.
 *
 * Live path: one websocket with an `activeAssetCtx` subscription per pair
 * (the exchange pushes each pair's ctx about once a second). A REST
 * spotMetaAndAssetCtxs snapshot fills the rows before the socket is up, and
 * 30s REST polling takes over whenever the socket is down. Only runs while
 * the owning component is mounted and the app is foregrounded.
 */
export function useHyperliquidSpotTickers(pairIndices, { intervalMs = FALLBACK_POLL_MS } = {}) {
  const tickers = ref({});
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
  // Pair indices the open socket is subscribed to.
  let subscribed = new Set();

  async function load() {
    const indices = pairIndices.value;
    if (!indices.length) return;
    loading.value = true;
    try {
      const [meta, ctxs] = await fetchSpotMetaAndAssetCtxs();
      const next = {};
      for (const idx of indices) {
        // ctxs is NOT aligned with meta.universe (the API returns more ctxs
        // than universe entries) — match on ctx.coin, never on position.
        const pair = meta.universe.find((p) => p.index === idx);
        const ctx = ctxs.find((c) => c.coin === `@${idx}` || (pair && c.coin === pair.name));
        if (ctx) next[idx] = ctxToTicker(ctx);
      }
      // A socket push that landed while this request was in flight is newer
      // than the snapshot — keep it. With the socket down, REST is the truth.
      tickers.value = connected.value ? { ...next, ...tickers.value } : next;
      error.value = null;
    } catch (e) {
      console.error("[hyperliquid] ticker refresh failed:", e);
      error.value = e?.message || "unknown";
      // Last good values are left untouched — don't blank the UI.
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
    load();
    pollTimer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, intervalMs);
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

  function send(msg) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  // Brings the socket's subscriptions in line with pairIndices: the pair
  // resolvers finish one at a time, so this runs several times right after
  // launch — on the one socket, never by reconnecting.
  function syncSubscriptions() {
    if (ws?.readyState !== WebSocket.OPEN) return;
    const wanted = new Set(pairIndices.value);
    for (const idx of subscribed) {
      if (!wanted.has(idx)) {
        send({ method: "unsubscribe", subscription: { type: "activeAssetCtx", coin: `@${idx}` } });
        subscribed.delete(idx);
      }
    }
    for (const idx of wanted) {
      if (!subscribed.has(idx)) {
        send({ method: "subscribe", subscription: { type: "activeAssetCtx", coin: `@${idx}` } });
        subscribed.add(idx);
      }
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
    subscribed = new Set();
    connected.value = false;
  }

  function scheduleReconnect() {
    if (unmounted || backgrounded || !pairIndices.value.length) return;
    clearReconnect();
    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
      openSocket();
    }, reconnectDelay);
  }

  function openSocket() {
    if (unmounted || backgrounded || !pairIndices.value.length) return;
    closeSocket();

    // REST snapshot first so the rows aren't empty while the socket connects.
    load();

    try {
      ws = new WebSocket(HL_WS_URL);
    } catch (e) {
      console.error("[hyperliquid] ticker ws unavailable, falling back to polling:", e);
      startPolling();
      return;
    }

    ws.onopen = () => {
      reconnectDelay = 1000;
      connected.value = true;
      stopPolling(); // socket is live — stop the REST fallback
      syncSubscriptions();
      pingTimer = setInterval(() => send({ method: "ping" }), PING_INTERVAL_MS);
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.channel !== "activeSpotAssetCtx") return;
        const ctx = msg.data?.ctx;
        const idx = Number(String(msg.data?.coin ?? "").slice(1));
        if (!ctx || !Number.isFinite(idx) || !subscribed.has(idx)) return;
        tickers.value = { ...tickers.value, [idx]: ctxToTicker(ctx) };
        error.value = null;
      } catch (e) {
        console.error("[hyperliquid] ticker ws message parse failed:", e);
      }
    };
    ws.onclose = (event) => {
      console.log("[hyperliquid] ticker ws closed — code:", event.code, "reason:", event.reason, "wasClean:", event.wasClean);
      connected.value = false;
      subscribed = new Set();
      stopPing();
      if (unmounted || backgrounded || !pairIndices.value.length) return;
      startPolling(); // keep the rows fresh-ish while reconnecting
      scheduleReconnect();
    };
    ws.onerror = (event) => {
      console.error("[hyperliquid] ticker ws error:", event);
      try {
        ws?.close();
      } catch {
        // onclose handles fallback/reconnect either way
      }
    };
  }

  function start() {
    if (!pairIndices.value.length) return;
    if (ws && ws.readyState <= WebSocket.OPEN) {
      // Already connecting or connected: only the pair list changed.
      syncSubscriptions();
      return;
    }
    openSocket();
  }

  function stop() {
    closeSocket();
    stopPolling();
  }

  watch(
    () => pairIndices.value.join(","),
    (key) => {
      if (key) start();
      else stop();
    }
  );

  onMounted(async () => {
    start();
    // Guarded: addListener has been observed to throw on some
    // Android/Capacitor builds (see useHyperliquidMarketSummary).
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

  return { tickers, loading, error, connected };
}
