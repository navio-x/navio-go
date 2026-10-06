import { ref, watch, onMounted, onUnmounted } from "vue";
import { App as CapApp } from "@capacitor/app";
import { fetchRecentTrades } from "@/lib/hyperliquid/api";

const POLL_MS = 5_000;
const MAX_ROWS = 30;

/**
 * The market's own most recent trades (everyone's, not this wallet's — that
 * is useHyperliquidTradeHistory) for `coin`, newest first. Only polls while
 * `active` is true (Ref<boolean>, e.g. "its tab is open"), since the list
 * moves fast and nothing else on the screen needs it. Read-only REST
 * polling, same lifecycle pattern as the other composables.
 */
export function useHyperliquidRecentTrades(coin, active) {
  const trades = ref([]);
  const loading = ref(false);
  const error = ref(null);

  let pollTimer = null;
  let backgrounded = false;
  let unmounted = false;
  let appListener = null;

  const shouldPoll = () => !!coin.value && !!active.value;

  async function load() {
    const c = coin.value;
    if (!c) return;
    loading.value = true;
    try {
      const rows = await fetchRecentTrades(c);
      if (coin.value !== c) return; // market changed while this was in flight
      trades.value = [...(rows || [])].sort((a, b) => b.time - a.time).slice(0, MAX_ROWS);
      error.value = null;
    } catch (e) {
      console.error("[hyperliquid] recent trades refresh failed:", e);
      error.value = e?.message || "unknown";
      // Last good `trades.value` is left untouched — don't blank the UI.
    } finally {
      loading.value = false;
    }
  }

  function startPolling() {
    stopPolling();
    load();
    pollTimer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  watch([coin, active], () => {
    if (shouldPoll()) startPolling();
    else stopPolling();
  });

  onMounted(async () => {
    if (shouldPoll()) startPolling();
    try {
      const handle = await CapApp.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) {
          backgrounded = true;
          stopPolling();
          return;
        }
        if (!backgrounded) return;
        backgrounded = false;
        if (shouldPoll()) startPolling();
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

  return { trades, loading, error };
}
