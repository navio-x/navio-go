import { ref, watch, onMounted, onUnmounted } from "vue";
import { App as CapApp } from "@capacitor/app";
import { fetchUserFills } from "@/lib/hyperliquid/api";

const POLL_MS = 30_000;
const MAX_ROWS = 30;

/**
 * Recent fills for `address`, filtered to `coin` (both Ref<string|null>) and
 * capped to the most recent MAX_ROWS — userFills returns every market's
 * history for the user, this narrows it to what this screen cares about.
 * Read-only REST polling, same lifecycle pattern as the other composables.
 */
export function useHyperliquidTradeHistory(address, coin) {
  const fills = ref([]);
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
      const all = await fetchUserFills(addr);
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

  return { fills, loading, error, refresh };
}
