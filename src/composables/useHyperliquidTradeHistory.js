import { ref, watch, onMounted, onUnmounted } from "vue";
import { App as CapApp } from "@capacitor/app";
import { fetchUserFills } from "@/lib/hyperliquid/api";
import { subscribeUserStream } from "@/lib/hyperliquid/userStream";

// REST cadence while the socket is down; up, the stream pushes every fill.
const FALLBACK_POLL_MS = 30_000;
const MAX_ROWS = 30;

/**
 * Merges a userFills push into the list: a snapshot replaces it, a live
 * batch goes on top. Filtered to `coin` when set, deduplicated by trade id,
 * newest first, capped to MAX_ROWS. Pure — exported for tests.
 */
export function mergeFills(fills, incoming, isSnapshot, coin) {
  const fresh = incoming.filter((f) => !coin || f.coin === coin);
  const base = isSnapshot ? [] : fills;
  const seen = new Set(fresh.map((f) => f.tid));
  return [...fresh, ...base.filter((f) => !seen.has(f.tid))]
    .sort((a, b) => b.time - a.time)
    .slice(0, MAX_ROWS);
}

/**
 * Recent fills for `address`, filtered to `coin` (both Ref<string|null>) and
 * capped to the most recent MAX_ROWS — userFills returns every market's
 * history for the user, this narrows it to what this screen cares about.
 * REST gives the first rows; the user's websocket stream
 * (lib/hyperliquid/userStream.js) then sends a snapshot and each new fill as
 * it happens, with 30 s REST polling only while the socket is down.
 */
export function useHyperliquidTradeHistory(address, coin) {
  const fills = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const connected = ref(false);

  let pollTimer = null;
  let backgrounded = false;
  let unmounted = false;
  let appListener = null;
  let unsubscribe = null;

  async function load() {
    const addr = address.value;
    if (!addr) return;
    loading.value = true;
    try {
      const all = await fetchUserFills(addr);
      if (address.value !== addr) return; // account switched meanwhile
      const c = coin.value;
      const filtered = c ? all.filter((f) => f.coin === c) : all;
      fills.value = filtered.slice(0, MAX_ROWS);
      error.value = null;
    } catch (e) {
      console.error("[hyperliquid] trade history refresh failed:", e);
      error.value = e?.message || "unknown";
      // Last good `fills.value` is left untouched — don't blank the UI.
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

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, FALLBACK_POLL_MS);
  }

  function start() {
    stop();
    const addr = address.value;
    if (!addr) return;
    load();
    startPolling();
    unsubscribe = subscribeUserStream(addr, {
      onOpen() {
        connected.value = true;
        stopPolling(); // the subscription's own snapshot follows
      },
      onClose() {
        connected.value = false;
        startPolling();
      },
      onUserFills(incoming, isSnapshot) {
        fills.value = mergeFills(fills.value, incoming, isSnapshot, coin.value);
        error.value = null;
      },
    });
  }

  function stop() {
    stopPolling();
    unsubscribe?.();
    unsubscribe = null;
    connected.value = false;
  }

  watch(address, () => start());
  // Same stream, different market: the stream's filter changed, so the rows
  // already here are the wrong market's — fetch the new one's.
  watch(coin, () => load());

  onMounted(async () => {
    start();
    try {
      const handle = await CapApp.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) {
          backgrounded = true;
          stop();
          return;
        }
        if (!backgrounded) return;
        backgrounded = false;
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

  async function refresh() {
    await load();
  }

  return { fills, loading, error, connected, refresh };
}
