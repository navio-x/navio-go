import { ref, watch, onMounted, onUnmounted } from "vue";
import { App as CapApp } from "@capacitor/app";
import { fetchL2Book } from "@/lib/hyperliquid/api";

const POLL_MS = 15_000;

/**
 * Compact, REST-only market summary (best bid/ask, mid, spread) — no
 * websocket, deliberately: this is what the DEX tab's tap-to-open market
 * card shows. The full live book (useHyperliquidOrderBook) only runs on the
 * dedicated market screen.
 */
export function useHyperliquidMarketSummary(coin, { intervalMs = POLL_MS } = {}) {
  const bestBid = ref(null);
  const bestAsk = ref(null);
  const mid = ref(null);
  const spread = ref(null);
  const spreadPct = ref(null);
  const loading = ref(false);
  const error = ref(null);

  let pollTimer = null;
  let backgrounded = false;
  let unmounted = false;
  let appListener = null;

  async function load() {
    const c = coin.value;
    if (!c) return;
    loading.value = true;
    try {
      const data = await fetchL2Book(c);
      const rawBid = data?.levels?.[0]?.[0];
      const rawAsk = data?.levels?.[1]?.[0];
      bestBid.value = rawBid ? Number(rawBid.px) : null;
      bestAsk.value = rawAsk ? Number(rawAsk.px) : null;
      if (bestBid.value != null && bestAsk.value != null) {
        mid.value = (bestBid.value + bestAsk.value) / 2;
        spread.value = bestAsk.value - bestBid.value;
        spreadPct.value = mid.value > 0 ? (spread.value / mid.value) * 100 : null;
      } else {
        mid.value = null;
        spread.value = null;
        spreadPct.value = null;
      }
      error.value = null;
    } catch (e) {
      console.error("[hyperliquid] market summary refresh failed:", e);
      error.value = e?.message || "unknown";
      // Last good values are left untouched — don't blank the UI.
    } finally {
      loading.value = false;
    }
  }

  function startPolling() {
    stopPolling();
    load();
    pollTimer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, intervalMs);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  watch(coin, (c) => {
    if (c) startPolling();
    else stopPolling();
  });

  onMounted(async () => {
    if (coin.value) startPolling();
    // Guarded: addListener has been observed to throw on some
    // Android/Capacitor builds, and an unhandled rejection here would
    // otherwise abort the whole page's render.
    try {
      const handle = await CapApp.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) {
          backgrounded = true;
          stopPolling();
          return;
        }
        if (!backgrounded) return;
        backgrounded = false;
        if (coin.value) startPolling();
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
    stopPolling();
    appListener?.remove();
  });

  return { bestBid, bestAsk, mid, spread, spreadPct, loading, error };
}
