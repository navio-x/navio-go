import { ref, watch, onMounted, onUnmounted } from "vue";
import { App as CapApp } from "@capacitor/app";
import { formatUnits } from "viem";
import { HL_TOKENS } from "@/lib/hyperliquid/config";
import { fetchSpotClearinghouseState, fetchSpotMetaAndAssetCtxs } from "@/lib/hyperliquid/api";
import { getSpotMeta, resolveTokens } from "@/lib/hyperliquid/meta";
import { safeParseUnits } from "@/lib/hyperliquid/decimal";

function zeroRow(symbol) {
  return { symbol, total: "0", hold: "0", available: "0", priceUsd: symbol === "USDC" ? 1 : null, valueUsd: null };
}

/**
 * Read-only Hyperliquid (HyperCore) spot balances for the wallet's existing
 * EVM address — no signing, no new keys. `address` is a Ref<string>.
 */
export function useHyperliquidBalances(address) {
  const balances = ref(HL_TOKENS.map((t) => zeroRow(t.symbol)));
  const loading = ref(false);
  const error = ref(null);

  let pollTimer = null;
  let backgrounded = false;
  let appListener = null;
  let unmounted = false;
  let inFlight = false;

  async function load() {
    const addr = address.value;
    if (!addr || inFlight) return;
    inFlight = true;
    loading.value = true;
    try {
      const meta = await getSpotMeta();
      const resolved = resolveTokens(meta);
      const [state, [ctxMeta, ctxs]] = await Promise.all([
        fetchSpotClearinghouseState(addr),
        fetchSpotMetaAndAssetCtxs(),
      ]);

      balances.value = resolved.map((tok) => {
        if (tok.index == null) return zeroRow(tok.symbol);

        const bal = state.balances?.find((b) => b.token === tok.index);
        const totalRaw = bal ? safeParseUnits(bal.total, tok.weiDecimals) : 0n;
        const holdRaw = bal ? safeParseUnits(bal.hold, tok.weiDecimals) : 0n;
        const availableRaw = totalRaw - holdRaw;
        const available = formatUnits(availableRaw, tok.weiDecimals);

        let priceUsd = tok.symbol === "USDC" ? 1 : null;
        if (priceUsd === null) {
          // ctxs is NOT aligned with universe positions — match on ctx.coin.
          const pair = ctxMeta.universe.find(
            (p) => Array.isArray(p.tokens) && p.tokens[0] === tok.index && p.tokens[1] === 0
          );
          const ctx = pair ? ctxs.find((c) => c.coin === `@${pair.index}` || c.coin === pair.name) : null;
          const px = ctx ? ctx.midPx ?? ctx.markPx : null;
          priceUsd = px != null ? Number(px) : null;
        }

        return {
          symbol: tok.symbol,
          total: formatUnits(totalRaw, tok.weiDecimals),
          hold: formatUnits(holdRaw, tok.weiDecimals),
          available,
          priceUsd,
          valueUsd: priceUsd != null ? Number(available) * priceUsd : null,
        };
      });
      error.value = null;
    } catch (e) {
      console.error("[hyperliquid] balance refresh failed:", e);
      error.value = e?.message || "unknown";
      // Last good `balances.value` is left untouched — don't blank the UI.
    } finally {
      loading.value = false;
      inFlight = false;
    }
  }

  function startPolling() {
    stopPolling();
    load();
    pollTimer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30_000);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  watch(address, (addr) => {
    if (addr) startPolling();
    else stopPolling();
  });

  onMounted(async () => {
    if (address.value) startPolling();
    // appStateChange (not resume/pause) matches lib/chat/client.js's
    // existing resume-detection pattern elsewhere in this app. Guarded:
    // addListener has been observed to throw on some Android/Capacitor
    // builds, and an unhandled rejection here would otherwise abort the
    // whole page's render — losing pause/resume on backgrounding is a far
    // smaller cost than that.
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

  return { balances, loading, error, refresh };
}
