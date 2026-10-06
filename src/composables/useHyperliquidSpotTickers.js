import { ref, watch, onMounted, onUnmounted } from "vue";
import { App as CapApp } from "@capacitor/app";
import { fetchSpotMetaAndAssetCtxs } from "@/lib/hyperliquid/api";

const POLL_MS = 30_000;

/**
 * Binance-style ticker rows for several Hyperliquid spot pairs: last price,
 * 24h change and 24h notional volume, all from one spotMetaAndAssetCtxs call
 * (REST, no websocket). `pairIndices` is a Ref<number[]> — resolve them with
 * lib/hyperliquid/market.js, never hardcode them. `tickers` is keyed by pair
 * index: { [idx]: { price, change24h, volume24h } }.
 */
export function useHyperliquidSpotTickers(pairIndices, { intervalMs = POLL_MS } = {}) {
  const tickers = ref({});
  const loading = ref(false);
  const error = ref(null);

  let pollTimer = null;
  let backgrounded = false;
  let unmounted = false;
  let appListener = null;

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
        if (!ctx) continue;
        const px = Number(ctx.midPx ?? ctx.markPx);
        const prev = Number(ctx.prevDayPx);
        next[idx] = {
          price: Number.isFinite(px) ? px : null,
          change24h: Number.isFinite(px) && prev > 0 ? ((px - prev) / prev) * 100 : null,
          volume24h: ctx.dayNtlVlm != null ? Number(ctx.dayNtlVlm) : null,
        };
      }
      tickers.value = next;
      error.value = null;
    } catch (e) {
      console.error("[hyperliquid] ticker refresh failed:", e);
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

  watch(
    () => pairIndices.value.join(","),
    (key) => {
      if (key) startPolling();
      else stopPolling();
    }
  );

  onMounted(async () => {
    if (pairIndices.value.length) startPolling();
    // Guarded: addListener has been observed to throw on some
    // Android/Capacitor builds (see useHyperliquidMarketSummary).
    try {
      const handle = await CapApp.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) {
          backgrounded = true;
          stopPolling();
          return;
        }
        if (!backgrounded) return;
        backgrounded = false;
        if (pairIndices.value.length) startPolling();
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

  return { tickers, loading, error };
}
