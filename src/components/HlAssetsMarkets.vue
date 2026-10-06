<!-- Hyperliquid "Assets | Markets" panel (Binance-style segment tabs): the
     wallet's Hyperliquid balances and the spot pairs it follows, each with an
     add/remove picker. Shared by the home screen and the DEX page's
     Hyperliquid tab; both read the same settings.homeAssets / homePairs.
     Renders nothing network-side while dexMode is off. -->
<template>
  <div>
    <!-- Segment tabs (Binance-style): Assets | Markets -->
    <div>
    <div class="flex gap-5 border-b border-gray-200 dark:border-gh-700" role="tablist">
      <button
        v-for="tab in ['assets', 'markets']"
        :key="tab"
        role="tab"
        :aria-selected="homeTab === tab"
        @click="setHomeTab(tab)"
        class="relative -mb-px pb-2 text-sm font-semibold transition-colors"
        :class="homeTab === tab
          ? 'text-gray-900 dark:text-white border-b-2 border-blue-500'
          : 'text-gray-400 dark:text-gray-500 border-b-2 border-transparent'"
      >
        {{ $t(tab === 'assets' ? 'home.hyperliquidAssets' : 'home.markets') }}
      </button>
    </div>

    <!-- HYPERLIQUID ASSETS -->
    <section v-if="homeTab === 'assets'" class="pt-1">
      <slot v-if="$slots.assets" name="assets" />
      <div v-else-if="!evmAddress" class="space-y-3 py-2">
        <div v-for="i in 4" :key="i" class="h-9 rounded-lg bg-gray-100 dark:bg-gh-800 animate-pulse" />
      </div>
      <component
        v-else
        :is="ROW_ROUTE[row.symbol] ? 'button' : 'div'"
        v-for="row in hlRows"
        :key="row.symbol"
        @click="ROW_ROUTE[row.symbol] ? router.push(ROW_ROUTE[row.symbol]) : undefined"
        class="w-full py-3 flex items-center justify-between gap-3 text-left"
      >
        <div class="flex items-center gap-3 min-w-0">
          <TokenIcon :symbol="row.symbol" :logo="HL_LOGOS[row.symbol]" :size="32" />
          <div class="min-w-0">
            <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ row.symbol }}</p>
            <p class="text-xs text-gray-400 dark:text-gray-500 truncate">{{ HL_NAMES[row.symbol] }}</p>
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <div class="text-right">
            <p class="text-sm font-mono text-gray-900 dark:text-white">{{ formatAmount(row.total) }}</p>
            <p v-if="settings.showFiatValue" class="text-xs text-gray-400 dark:text-gray-500">
              {{ row.fiat ?? '—' }}
            </p>
          </div>
          <ChevronRight v-if="ROW_ROUTE[row.symbol]" class="w-4 h-4 text-gray-300 dark:text-gray-600" />
        </div>
      </component>

      <button
        @click="showAssetPicker = true"
        class="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors
               border border-dashed border-gray-300 dark:border-gh-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gh-800"
      >
        <Plus class="w-4 h-4" />
        {{ $t('home.addAsset') }}
      </button>
    </section>

    <!-- MARKETS: user-chosen Hyperliquid pairs (settings.homePairs) -->
    <section v-else class="pt-1">
      <button
        v-for="m in homeMarkets"
        :key="m.pair"
        @click="goToMarket(m.pair)"
        class="w-full py-3 flex items-center justify-between gap-3 text-left"
      >
        <div class="flex items-center gap-3 min-w-0">
          <TokenIcon :symbol="m.base" :logo="m.logo" :size="32" />
          <div class="min-w-0">
            <p class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ m.base }}<span class="font-normal text-gray-400 dark:text-gray-500">/{{ m.quote }}</span>
            </p>
            <p class="text-xs text-gray-400 dark:text-gray-500 truncate">
              <template v-if="m.ticker?.volume24h != null">{{ $t('home.vol') }} {{ formatCompactUsd(m.ticker.volume24h) }}</template>
              <template v-else>Hyperliquid</template>
            </p>
          </div>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <p class="text-sm font-mono font-semibold text-gray-900 dark:text-white">{{ formatPrice(m.ticker?.price) }}</p>
          <span
            class="min-w-[4.5rem] px-2 py-1.5 rounded-md text-xs font-semibold text-white text-center"
            :class="changeClass(m.ticker?.change24h)"
          >
            {{ formatChange(m.ticker?.change24h) }}
          </span>
        </div>
      </button>

      <button
        @click="showPairPicker = true"
        class="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors
               border border-dashed border-gray-300 dark:border-gh-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gh-800"
      >
        <Plus class="w-4 h-4" />
        {{ $t('home.addPair') }}
      </button>
    </section>
    </div>

    <!-- Asset picker -->
    <div
      v-if="showAssetPicker"
      class="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="showAssetPicker = false"
    >
      <div class="bg-white dark:bg-gh-900 border-t border-gray-100 dark:border-gh-800 rounded-t-2xl sm:rounded-2xl p-4 w-full max-w-md shadow-2xl max-h-[80vh] overflow-y-auto">
        <div class="w-10 h-1 rounded-full bg-gray-300 dark:bg-gh-700 mx-auto mb-3 sm:hidden" />
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('home.addAssetTitle') }}</h3>
          <button
            @click="showAssetPicker = false"
            class="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gh-800"
            :aria-label="$t('common.close')"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
        <button
          v-for="a in pickerAssets"
          :key="a.symbol"
          @click="toggleAsset(a.symbol)"
          :disabled="a.hasBalance"
          class="w-full px-2 py-3 rounded-xl flex items-center justify-between gap-3 text-left hover:bg-gray-50 dark:hover:bg-gh-800"
        >
          <div class="flex items-center gap-3 min-w-0">
            <TokenIcon :symbol="a.symbol" :logo="HL_LOGOS[a.symbol]" :size="32" />
            <div class="min-w-0">
              <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ a.symbol }}</p>
              <p class="text-xs text-gray-400 dark:text-gray-500 truncate">{{ HL_NAMES[a.symbol] }}</p>
            </div>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <div class="text-right">
              <p class="text-sm font-mono text-gray-900 dark:text-white">{{ formatAmount(a.total) }}</p>
              <p v-if="a.hasBalance" class="text-[11px] text-gray-400 dark:text-gray-500">{{ $t('home.hasBalance') }}</p>
            </div>
            <span
              class="w-7 h-7 rounded-full flex items-center justify-center"
              :class="a.shown
                ? (a.hasBalance ? 'bg-blue-300 dark:bg-blue-900 text-white' : 'bg-blue-600 text-white')
                : 'border border-gray-300 dark:border-gh-600 text-gray-400'"
            >
              <Check v-if="a.shown" class="w-4 h-4" />
              <Plus v-else class="w-4 h-4" />
            </span>
          </div>
        </button>
      </div>
    </div>

    <!-- Pair picker -->
    <div
      v-if="showPairPicker"
      class="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="showPairPicker = false"
    >
      <div class="bg-white dark:bg-gh-900 border-t border-gray-100 dark:border-gh-800 rounded-t-2xl sm:rounded-2xl p-4 w-full max-w-md shadow-2xl">
        <div class="w-10 h-1 rounded-full bg-gray-300 dark:bg-gh-700 mx-auto mb-3 sm:hidden" />
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('home.addPairTitle') }}</h3>
          <button
            @click="showPairPicker = false"
            class="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gh-800"
            :aria-label="$t('common.close')"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
        <button
          v-for="m in allMarkets"
          :key="m.pair"
          @click="togglePair(m.pair)"
          class="w-full px-2 py-3 rounded-xl flex items-center justify-between gap-3 text-left hover:bg-gray-50 dark:hover:bg-gh-800"
        >
          <div class="flex items-center gap-3 min-w-0">
            <TokenIcon :symbol="m.base" :logo="m.logo" :size="32" />
            <div class="min-w-0">
              <p class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ m.base }}<span class="font-normal text-gray-400 dark:text-gray-500">/{{ m.quote }}</span>
              </p>
              <p class="text-xs text-gray-400 dark:text-gray-500 truncate">{{ m.name }}</p>
            </div>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <div class="text-right">
              <p class="text-sm font-mono text-gray-900 dark:text-white">{{ formatPrice(m.ticker?.price) }}</p>
              <p class="text-xs" :class="changeTextClass(m.ticker?.change24h)">{{ formatChange(m.ticker?.change24h) }}</p>
            </div>
            <span
              class="w-7 h-7 rounded-full flex items-center justify-center"
              :class="m.added ? 'bg-blue-600 text-white' : 'border border-gray-300 dark:border-gh-600 text-gray-400'"
            >
              <Check v-if="m.added" class="w-4 h-4" />
              <Plus v-else class="w-4 h-4" />
            </span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { settings } from '@/stores/settings'
import { navPrice } from '@/stores/navPrice'
import { evmAddress } from '@/stores/evm'
import { useHyperliquidBalances } from '@/composables/useHyperliquidBalances'
import { useHyperliquidSpotTickers } from '@/composables/useHyperliquidSpotTickers'
import { HL_SPOT_MARKETS } from '@/lib/hyperliquid/market'
import { HL_LOGOS, HL_NAMES } from '@/lib/hyperliquid/config'
import TokenIcon from '@/components/TokenIcon.vue'
import { ChevronRight, Plus, Check, X } from 'lucide-vue-next'

const props = defineProps({
  // localStorage key remembering which of the two tabs was last open —
  // separate per host screen.
  storageKey: { type: String, default: 'homeTab' },
  // Balance rows from a host that already loads them; when given, this
  // panel doesn't poll for its own.
  balances: { type: Array, default: null },
})

const router = useRouter()

function formatFiat(value, currency = settings.currency ?? 'USD') {
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// ===================== Hyperliquid (dexMode only) =====================
// Gated on dexMode the same way /dex and /market/hl are: with it off the
// address stays '' so neither composable makes a single request.
const hlAddress = computed(() => (settings.dexMode && !props.balances ? evmAddress.value : ''))
const hl = useHyperliquidBalances(hlAddress)
const balanceRows = computed(() => props.balances ?? hl.balances.value)

const HL_ORDER = ['NAV', 'USDC', 'HYPE', 'BTC', 'ETH', 'SOL', 'ZEC', 'AVAX']
// NAV opens its own page (wallet + exchange in one); the others open their
// asset page (receive / send, and a Trade link where a market exists).
const ROW_ROUTE = {
  NAV: '/asset/NAV',
  USDC: '/hl/asset/USDC',
  HYPE: '/hl/asset/HYPE',
  BTC: '/hl/asset/BTC',
  ETH: '/hl/asset/ETH',
  SOL: '/hl/asset/SOL',
  ZEC: '/hl/asset/ZEC',
  AVAX: '/hl/asset/AVAX',
}

// A row shows if the user added it, or if it holds a balance — funds
// are never hidden just because the token was removed from the list.
const isAssetShown = (row) => settings.homeAssets.includes(row.symbol) || Number(row.total) > 0

const hlRows = computed(() => {
  const rate = navPrice.rates[settings.currency ?? 'USD'] ?? null
  return balanceRows.value.filter(isAssetShown)
    .sort((a, b) => HL_ORDER.indexOf(a.symbol) - HL_ORDER.indexOf(b.symbol))
    .map((row) => ({
      ...row,
      fiat: row.priceUsd != null && rate != null
        ? formatFiat(Number(row.total) * row.priceUsd * rate)
        : null,
    }))
})

// Pair index per HL_SPOT_MARKETS key, resolved from spotMeta at runtime.
// Tickers are fetched for every known pair (one request either way) so the
// picker can show live prices too.
const pairIndexByKey = ref({})
const tickerIndices = computed(() =>
  settings.dexMode ? Object.values(pairIndexByKey.value).filter((i) => i != null) : []
)
const { tickers } = useHyperliquidSpotTickers(tickerIndices)

const allMarkets = computed(() =>
  Object.entries(HL_SPOT_MARKETS).map(([pair, m]) => ({
    pair,
    base: m.base,
    quote: m.quote,
    name: m.name,
    logo: m.logo,
    ticker: tickers.value[pairIndexByKey.value[pair]] ?? null,
    added: settings.homePairs.includes(pair),
  }))
)
// Keeps the user's order; drops keys no longer in HL_SPOT_MARKETS.
const homeMarkets = computed(() =>
  settings.homePairs.map((p) => allMarkets.value.find((m) => m.pair === p)).filter(Boolean)
)

// Last-picked tab is a per-device convenience only — storage can be
// unavailable (private mode), so every access is guarded.
const readTab = () => {
  try { return localStorage.getItem(props.storageKey) === 'markets' ? 'markets' : 'assets' } catch { return 'assets' }
}
const homeTab = ref(readTab())
function setHomeTab(tab) {
  homeTab.value = tab
  try { localStorage.setItem(props.storageKey, tab) } catch {}
}

const showAssetPicker = ref(false)
const pickerAssets = computed(() =>
  [...balanceRows.value]
    .sort((a, b) => HL_ORDER.indexOf(a.symbol) - HL_ORDER.indexOf(b.symbol))
    .map((row) => ({ symbol: row.symbol, total: row.total, hasBalance: Number(row.total) > 0, shown: isAssetShown(row) }))
)
function toggleAsset(symbol) {
  settings.homeAssets = settings.homeAssets.includes(symbol)
    ? settings.homeAssets.filter((x) => x !== symbol)
    : [...settings.homeAssets, symbol]
}

const showPairPicker = ref(false)
function togglePair(pair) {
  settings.homePairs = settings.homePairs.includes(pair)
    ? settings.homePairs.filter((p) => p !== pair)
    : [...settings.homePairs, pair]
}

function changeClass(value) {
  if (value == null) return 'bg-gray-300 dark:bg-gh-600'
  return value >= 0 ? 'bg-buy' : 'bg-sell'
}
function changeTextClass(value) {
  if (value == null) return 'text-gray-400 dark:text-gray-500'
  return value >= 0 ? 'text-buy' : 'text-sell'
}

function goToMarket(pair) {
  router.push(`/market/hl/${pair}`)
}

function formatAmount(value) {
  const n = Number(value)
  if (!n) return '0'
  return n.toLocaleString(undefined, { maximumFractionDigits: Math.abs(n) < 1 ? 8 : 4 })
}

function formatPrice(value) {
  if (value == null) return '—'
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

function formatChange(value) {
  if (value == null) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatCompactUsd(value) {
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 })
}

watch(
  () => settings.dexMode,
  (on) => {
    if (!on || Object.keys(pairIndexByKey.value).length) return
    for (const [pair, m] of Object.entries(HL_SPOT_MARKETS)) {
      m.resolver()
        .then((r) => { pairIndexByKey.value = { ...pairIndexByKey.value, [pair]: r?.pairIndex ?? null } })
        .catch((e) => console.error(`[home] failed to resolve ${pair} market:`, e))
    }
  },
  { immediate: true },
)

defineExpose({ refresh: () => hl.refresh() })
</script>
