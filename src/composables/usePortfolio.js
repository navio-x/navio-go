import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { formatUnits } from "viem";
import { settings } from "@/stores/settings";
import { balance } from "@/stores/navio";
import { navPrice } from "@/stores/navPrice";
import { evmAddress } from "@/stores/evm";
import { navInTransit, operations } from "@/stores/operations";
import { useHyperliquidBalances } from "@/composables/useHyperliquidBalances";
import { readNavEvmBalance } from "@/lib/hyperliquid/bridge/contract";
import { NAV_DECIMALS } from "@/lib/hyperliquid/bridge/config";
import { HL_LOGOS, HL_NAMES } from "@/lib/hyperliquid/config";

const ORDER = ["NAV", "USDC", "HYPE", "BTC", "ETH", "SOL", "ZEC", "AVAX"];
const EVM_POLL_MS = 30_000;

/**
 * Everything the user owns, as they think of it: NAV is ONE asset whether
 * it sits in the private wallet, on the exchange, or is moving between the
 * two — `nav` carries the breakdown for anyone who wants to look. With
 * dexMode off this is just the wallet and makes no request.
 */
export function usePortfolio() {
  const hlAddress = computed(() => (settings.dexMode ? evmAddress.value : ""));
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
  const ready = computed(() => !settings.dexMode || (!!hlAddress.value && hl.loaded.value && evmLoaded.value));
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

  const nav = computed(() => {
    const row = hlAddress.value ? rowOf("NAV") : null;
    const wallet = Number(balance.value) || 0;
    const exchange = Number(row?.total ?? 0);
    const inOrders = Number(row?.hold ?? 0);
    const { toExchange, toWallet } = navInTransit.value;
    const moving = navOnEvm.value + toExchange + toWallet;
    return {
      wallet,
      exchange,
      exchangeAvailable: Math.max(0, exchange - inOrders),
      inOrders,
      moving,
      total: wallet + exchange + moving,
    };
  });

  // The wallet's own price feed first; the exchange's mid price as a fallback.
  const navUsd = computed(() => navPrice.usd ?? rowOf("NAV")?.priceUsd ?? null);

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
    if (!settings.dexMode) return list;
    for (const row of hl.balances.value) {
      if (row.symbol === "NAV") continue;
      // Shown if the user added it or it holds a balance — funds are never hidden.
      if (!settings.homeAssets.includes(row.symbol) && !(Number(row.total) > 0)) continue;
      list.push({
        symbol: row.symbol,
        name: HL_NAMES[row.symbol] ?? row.symbol,
        logo: HL_LOGOS[row.symbol],
        amount: Number(row.total),
        usd: row.priceUsd != null ? Number(row.total) * row.priceUsd : null,
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
