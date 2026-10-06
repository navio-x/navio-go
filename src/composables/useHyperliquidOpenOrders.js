import { ref, watch, onMounted, onUnmounted } from "vue";
import { App as CapApp } from "@capacitor/app";
import { fetchOpenOrders } from "@/lib/hyperliquid/api";

const POLL_MS = 10_000;

/**
 * Open orders for `address`, filtered to `coin` (both Ref<string|null>) —
 * openOrders itself returns every market for the user, this narrows it to
 * the one this screen cares about. Read-only REST polling, same pattern as
 * useHyperliquidMarketSummary.
 */
export function useHyperliquidOpenOrders(address, coin) {
  const orders = ref([]);
  const loading = ref(false);
  const error = ref(null);

  let pollTimer = null;
  let backgrounded = false;
  let unmounted = false;
  let appListener = null;

  async function load() {
    const addr = address.value;
    if (!addr) return;
    loading.value = true;
    try {
      const all = await fetchOpenOrders(addr);
      const c = coin.value;
      orders.value = c ? all.filter((o) => o.coin === c) : all;
      error.value = null;
    } catch (e) {
      console.error("[hyperliquid] open orders refresh failed:", e);
      error.value = e?.message || "unknown";
      // Last good `orders.value` is left untouched — don't blank the UI.
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

  watch([address, coin], ([addr]) => {
    if (addr) startPolling();
    else stopPolling();
  });

  onMounted(async () => {
    if (address.value) startPolling();
    try {
      const handle = await CapApp.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) {
          backgrounded = true;
          stopPolling();
          return;
        }
        if (!backgrounded) return;
        backgrounded = false;
        if (address.value) startPolling();
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

  async function refresh() {
    await load();
  }

  return { orders, loading, error, refresh };
}
