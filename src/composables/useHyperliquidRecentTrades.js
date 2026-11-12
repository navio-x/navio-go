import { ref, watch, onMounted, onUnmounted } from "vue";
import { App as CapApp } from "@capacitor/app";
import { HL_WS_URL } from "@/lib/hyperliquid/config";
import { fetchRecentTrades } from "@/lib/hyperliquid/api";

const FALLBACK_POLL_MS = 5_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const PING_INTERVAL_MS = 30_000;
const MAX_ROWS = 30;

/**
 * Merges a `trades` push into the tape: new trades go on top, duplicates
 * (by trade id) are dropped, newest first, capped to MAX_ROWS. The
 * subscription's first message is the recent history, oldest first, so a
 * sort is needed either way. Pure — exported for tests.
 */
export function mergeTrades(trades, incoming) {
  const seen = new Set(incoming.map((t) => t.tid));
  return [...incoming, ...trades.filter((t) => !seen.has(t.tid))]
    .sort((a, b) => b.time - a.time)
    .slice(0, MAX_ROWS);
}

/**
 * The market's own most recent trades (everyone's, not this wallet's — that
 * is useHyperliquidTradeHistory) for `coin`, newest first. Live over the
 * `trades` websocket subscription (a batch of recent trades on subscribe,
 * then each trade as it happens), with 5 s REST polling only while the
 * socket is down. Only runs while `active` is true (Ref<boolean>, e.g. "its
 * tab is open"), since nothing else on the screen needs it.
 */
export function useHyperliquidRecentTrades(coin, active) {
  const trades = ref([]);
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

  const shouldRun = () => !!coin.value && !!active.value;

  async function load() {
    const c = coin.value;
    if (!c) return;
    loading.value = true;
    try {
      const rows = await fetchRecentTrades(c);
      if (coin.value !== c) return; // market changed while this was in flight
      // A socket batch that landed meanwhile is newer than this answer.
      trades.value = connected.value ? mergeTrades(trades.value, rows || []) : mergeTrades([], rows || []);
      error.value = null;
    } catch (e) {
      console.error("[hyperliquid] recent trades refresh failed:", e);
      error.value = e?.message || "unknown";
      // Last good `trades.value` is left untouched — don't blank the UI.
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
    if (unmounted || backgrounded || !shouldRun()) return;
    clearReconnect();
    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
      openSocket();
    }, reconnectDelay);
  }

  function openSocket() {
    if (unmounted || backgrounded || !shouldRun()) return;
    const c = coin.value;
    closeSocket();

    // REST first so the tape isn't empty while the socket connects.
    load();

    try {
      ws = new WebSocket(HL_WS_URL);
    } catch (e) {
      console.error("[hyperliquid] trades ws unavailable, falling back to polling:", e);
      startPolling();
      return;
    }

    ws.onopen = () => {
      reconnectDelay = 1000;
      connected.value = true;
      stopPolling(); // socket is live — stop the REST fallback
      ws.send(JSON.stringify({ method: "subscribe", subscription: { type: "trades", coin: c } }));
      pingTimer = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ method: "ping" }));
      }, PING_INTERVAL_MS);
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.channel !== "trades" || !Array.isArray(msg.data)) return;
        const rows = msg.data.filter((t) => t.coin === c);
        if (rows.length) {
          trades.value = mergeTrades(trades.value, rows);
          error.value = null;
        }
      } catch (e) {
        console.error("[hyperliquid] trades ws message parse failed:", e);
      }
    };
    ws.onclose = (event) => {
      console.log("[hyperliquid] trades ws closed — code:", event.code, "reason:", event.reason, "wasClean:", event.wasClean);
      connected.value = false;
      stopPing();
      if (unmounted || backgrounded || !shouldRun()) return;
      startPolling(); // keep the tape fresh-ish while reconnecting
      scheduleReconnect();
    };
    ws.onerror = (event) => {
      console.error("[hyperliquid] trades ws error:", event);
      try {
        ws?.close();
      } catch {
        // onclose handles fallback/reconnect either way
      }
    };
  }

  function start() {
    reconnectDelay = 1000;
    openSocket();
  }

  function stop() {
    closeSocket();
    stopPolling();
  }

  watch([coin, active], ([c], [prevCoin]) => {
    if (c !== prevCoin) trades.value = []; // another market's tape
    if (shouldRun()) start();
    else stop();
  });

  onMounted(async () => {
    if (shouldRun()) start();
    try {
      const handle = await CapApp.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) {
          backgrounded = true;
          stop();
          return;
        }
        if (!backgrounded) return;
        backgrounded = false;
        if (shouldRun()) start();
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

  return { trades, loading, error, connected };
}
