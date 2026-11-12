import { ref, watch, onMounted, onUnmounted } from "vue";
import { App as CapApp } from "@capacitor/app";
import { fetchOpenOrders } from "@/lib/hyperliquid/api";
import { subscribeUserStream } from "@/lib/hyperliquid/userStream";

// REST cadence while the socket is down, and the slower reconcile pass while
// it is up (orderUpdates carries status changes only, not partial fills).
const FALLBACK_POLL_MS = 10_000;
const RECONCILE_POLL_MS = 60_000;

/**
 * Folds a batch of orderUpdates pushes into the open-order list: an order
 * reported `open` is added or replaced, any other status (filled, canceled,
 * rejected, …) drops it. Orders for other markets are ignored when `coin`
 * is set. Pure — exported for tests.
 */
export function applyOrderUpdates(orders, updates, coin) {
  let next = orders;
  for (const u of updates) {
    const o = u?.order;
    if (!o || (coin && o.coin !== coin)) continue;
    const without = next.filter((x) => x.oid !== o.oid);
    next = u.status === "open" ? [o, ...without] : without;
  }
  return next;
}

/**
 * Open orders for `address`, filtered to `coin` (both Ref<string|null>) —
 * openOrders itself returns every market for the user, this narrows it to
 * the one this screen cares about. REST gives the snapshot; the user's
 * websocket stream (lib/hyperliquid/userStream.js) applies each status
 * change as it happens, with 10 s REST polling only while the socket is
 * down. `lastEvent` is the latest pushed change ({ status, oid, coin, at })
 * so the screen can refresh what else it touched (balances).
 */
export function useHyperliquidOpenOrders(address, coin) {
  const orders = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const connected = ref(false);
  const lastEvent = ref(null);

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
      const all = await fetchOpenOrders(addr);
      if (address.value !== addr) return; // account switched meanwhile
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

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function startPolling(ms) {
    stopPolling();
    pollTimer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, ms);
  }

  function start() {
    stop();
    const addr = address.value;
    if (!addr) return;
    load();
    startPolling(FALLBACK_POLL_MS);
    unsubscribe = subscribeUserStream(addr, {
      onOpen() {
        connected.value = true;
        load(); // anything that changed while the socket was down
        startPolling(RECONCILE_POLL_MS);
      },
      onClose() {
        connected.value = false;
        startPolling(FALLBACK_POLL_MS);
      },
      onOrderUpdates(updates) {
        const c = coin.value;
        orders.value = applyOrderUpdates(orders.value, updates, c);
        for (const u of updates) {
          if (u?.order && (!c || u.order.coin === c)) {
            lastEvent.value = { status: u.status, oid: u.order.oid, coin: u.order.coin, at: u.statusTimestamp };
          }
        }
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
  // Same stream, different market: only the filter changed.
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

  return { orders, loading, error, connected, lastEvent, refresh };
}
