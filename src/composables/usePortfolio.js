import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { formatUnits } from "viem";
import { settings } from "@/stores/settings";
import { hlEnabled } from "@/stores/network";
import { balance, stakedBalance } from "@/stores/navio";
import { navPrice } from "@/stores/navPrice";
import { evmAddress } from "@/stores/evm";
import { navInTransit, operations } from "@/stores/operations";
import { useHyperliquidBalances } from "@/composables/useHyperliquidBalances";
import { readNavEvmBalance } from "@/lib/hyperliquid/bridge/contract";
import { NAV_DECIMALS } from "@/lib/hyperliquid/bridge/config";
import { HL_LOGOS, HL_NAMES } from "@/lib/hyperliquid/config";
import { HL_SPOT_MARKETS } from "@/lib/hyperliquid/market";
import { useHyperliquidSpotTickers } from "@/composables/useHyperliquidSpotTickers";

const ORDER = ["NAV", "USDC", "HYPE", "BTC", "ETH", "SOL", "ZEC", "AVAX"];
const EVM_POLL_MS = 30_000;

/**
 * Everything the user owns, as they think of it: NAV is ONE asset whether
 * it sits in the private wallet, on the exchange, or is moving between the
 * two — `nav` carries the breakdown for anyone who wants to look. With
 * Hyperliquid unavailable (dexMode off, or not on mainnet) this is just the
 * wallet and makes no request.
 *
 * `livePrices`: price held assets from the exchange's ticker socket (about
 * one push a second) instead of the 30–60s REST snapshots, so the total
 * moves with the market. Opens a websocket, so only the home screen asks.
 */
export function usePortfolio({ livePrices = false } = {}) {
  const hlAddress = computed(() => (hlEnabled.value ? evmAddress.value : ""));
  const hl = useHyperliquidBalances(hlAddress);

  // NAV held as the ERC20 on HyperEVM — only ever a stop on the way back to
  // the wallet, but it is the user's and must not vanish from the total.
  const navOnEvm = ref(0);
  const evmLoaded = ref(false);
  const evmCacheKey = (address) => `navOnEvm:${address.toLowerCase()}`;
  // Last saved value, shown with the cached exchange balances until the fresh read lands.
  function seedEvm(address) {
    let cached = 0;
    try { cached = address ? Number(localStorage.getItem(evmCacheKey(address))) || 0 : 0; } catch {}
    navOnEvm.value = cached;
  }
  let timer = null;
  async function loadEvm() {
    const address = hlAddress.value;
    if (!address) {
      navOnEvm.value = 0;
      return;
    }
    try {
      navOnEvm.value = Number(formatUnits(await readNavEvmBalance(address), NAV_DECIMALS));
      try { localStorage.setItem(evmCacheKey(address), String(navOnEvm.value)); } catch {}
    } catch (e) {
      console.error("[portfolio] EVM NAV balance read failed:", e?.message);
    } finally {
      if (hlAddress.value === address) evmLoaded.value = true;
    }
  }
  watch(hlAddress, (address) => {
    evmLoaded.value = false;
    seedEvm(address);
    loadEvm();
  });
  seedEvm(hlAddress.value);

  // False until the exchange side has answered once, so a total is never
  // shown as wallet-only and then corrected a moment later. With dexMode
  // off there is nothing to wait for.
  const ready = computed(() => !hlEnabled.value || (!!hlAddress.value && hl.loaded.value && evmLoaded.value));
  // True as soon as there is something truthful to show: fresh balances, or
  // the ones saved from the last visit while the fresh ones load.
  const hasData = computed(() => ready.value || (!!hlAddress.value && hl.fromCache.value));
  // An operation moving on is exactly when these balances change.
  watch(operations, () => { loadEvm(); hl.refresh(); });
  onMounted(() => {
    loadEvm();
    timer = setInterval(() => {
      if (document.visibilityState === "visible") loadEvm();
    }, EVM_POLL_MS);
  });
  onUnmounted(() => clearInterval(timer));

  const rowOf = (symbol) => hl.balances.value.find((b) => b.symbol === symbol) ?? null;

  // Live <symbol>/USDC prices for what the user holds (NAV always). Pair
  // indices are resolved from spotMeta once per symbol — never hardcoded.
  const pairIndexBySymbol = ref({});
  const liveSymbols = computed(() => {
    if (!livePrices || !hlEnabled.value) return [];
    const held = hl.balances.value.filter((r) => Number(r.total) > 0).map((r) => r.symbol);
    return [...new Set(["NAV", ...held])].filter((s) => HL_SPOT_MARKETS[`${s}-USDC`]);
  });
  watch(liveSymbols, (list) => {
    for (const symbol of list) {
      if (symbol in pairIndexBySymbol.value) continue;
      pairIndexBySymbol.value = { ...pairIndexBySymbol.value, [symbol]: null };
      HL_SPOT_MARKETS[`${symbol}-USDC`].resolver()
        .then((m) => { pairIndexBySymbol.value = { ...pairIndexBySymbol.value, [symbol]: m?.pairIndex ?? null }; })
        .catch((e) => {
          console.error(`[portfolio] ${symbol}/USDC market resolve failed:`, e?.message);
          // Forget it so the next change of holdings tries again.
          const { [symbol]: _, ...rest } = pairIndexBySymbol.value;
          pairIndexBySymbol.value = rest;
        });
    }
  }, { immediate: true });
  const tickerIndices = computed(() =>
    liveSymbols.value.map((s) => pairIndexBySymbol.value[s]).filter((i) => i != null));
  const { tickers } = livePrices ? useHyperliquidSpotTickers(tickerIndices) : { tickers: ref({}) };
  const livePriceOf = (symbol) => {
    const idx = pairIndexBySymbol.value[symbol];
    return idx != null ? tickers.value[idx]?.price ?? null : null;
  };

  const nav = computed(() => {
    const row = hlAddress.value ? rowOf("NAV") : null;
    const wallet = Number(balance.value) || 0;
    const exchange = Number(row?.total ?? 0);
    const inOrders = Number(row?.hold ?? 0);
    const { toExchange, toWallet } = navInTransit.value;
    const moving = navOnEvm.value + toExchange + toWallet;
    // Locked in cold staking: still the user's, just not spendable.
    const staked = Number(stakedBalance.value) || 0;
    return {
      wallet,
      staked,
      exchange,
      exchangeAvailable: Math.max(0, exchange - inOrders),
      inOrders,
      moving,
      total: wallet + staked + exchange + moving,
    };
  });

  // Live: the exchange's ticking mid price, where NAV actually trades.
  // Otherwise the wallet's own price feed first, the exchange's snapshot mid
  // price as a fallback.
  const navUsd = computed(() => livePriceOf("NAV") ?? navPrice.usd ?? rowOf("NAV")?.priceUsd ?? null);

  const assets = computed(() => {
    const list = [{
      symbol: "NAV",
      name: HL_NAMES.NAV,
      logo: HL_LOGOS.NAV,
      amount: nav.value.total,
      usd: navUsd.value != null ? nav.value.total * navUsd.value : null,
      route: "/asset/NAV",
    }];
    // Before the exchange account is known the rows are still listed (at
    // zero) — hosts show a loading mark in place of the amounts until `hasData`.
    if (!hlEnabled.value) return list;
    for (const row of hl.balances.value) {
      if (row.symbol === "NAV") continue;
      // Shown if the user added it or it holds a balance — funds are never hidden.
      if (!settings.homeAssets.includes(row.symbol) && !(Number(row.total) > 0)) continue;
      const priceUsd = livePriceOf(row.symbol) ?? row.priceUsd;
      list.push({
        symbol: row.symbol,
        name: HL_NAMES[row.symbol] ?? row.symbol,
        logo: HL_LOGOS[row.symbol],
        amount: Number(row.total),
        usd: priceUsd != null ? Number(row.total) * priceUsd : null,
        route: `/hl/asset/${row.symbol}`,
      });
    }
    return list.sort((a, b) => ORDER.indexOf(a.symbol) - ORDER.indexOf(b.symbol));
  });

  /** Total value in USD, or null while a held asset still has no price. */
  const totalUsd = computed(() => {
    let sum = 0;
    for (const a of assets.value) {
      if (!(a.amount > 0)) continue;
      if (a.usd == null) return null;
      sum += a.usd;
    }
    return sum;
  });

  return { nav, navUsd, assets, totalUsd, ready, hasData, hl, refresh: () => Promise.all([hl.refresh(), loadEvm()]) };
}
