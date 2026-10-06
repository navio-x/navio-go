<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">
    <div class="flex items-center gap-3 px-5 pt-5 pb-4">
      <button
        @click="router.back()"
        class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400"
      >
        <ChevronLeft class="w-5 h-5" />
      </button>
      <div class="flex-1 min-w-0">
        <h1 class="text-lg font-bold leading-tight text-gray-900 dark:text-white truncate">{{ headerLabel }}</h1>
        <!-- Venue, small and muted, with the 24h change beside it -->
        <p v-if="market" class="text-[11px] leading-tight tabular-nums text-gray-400 dark:text-gray-500 truncate">
          {{ $t('dex.hyperliquid.title') }}
          <template v-if="change24h != null">
            ·
            <span class="font-medium" :class="change24h >= 0 ? 'text-buy' : 'text-sell'">{{ change24h > 0 ? '+' : '' }}{{ change24h.toFixed(2) }}%</span>
            {{ $t('market.change24h') }}
          </template>
        </p>
      </div>
      <button
        v-if="market"
        @click="router.push(`/market/hl/${route.params.pair}/chart`)"
        :title="$t('market.chart')"
        :aria-label="$t('market.chart')"
        class="order-last p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400 shrink-0"
      >
        <ChartCandlestick class="w-5 h-5" />
      </button>
      <span
        v-if="market"
        class="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide shrink-0"
        :class="book.connected.value
          ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'
          : 'bg-gray-100 dark:bg-gh-700 text-gray-400 dark:text-gray-500'"
      >
        {{ book.connected.value ? $t('market.live') : $t('market.delayed') }}
      </span>
    </div>

    <div v-if="derivationError" class="mx-5 mb-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4">
      <p class="text-sm text-red-700 dark:text-red-300 leading-snug">{{ derivationError }}</p>
    </div>

    <div v-else-if="marketNotFound" class="flex-1 flex items-center justify-center px-5 pb-6">
      <p class="text-sm text-gray-400 dark:text-gray-500 text-center">{{ $t('market.notFound') }}</p>
    </div>

    <div v-else-if="!market" class="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 space-y-3">
      <Loader2 class="w-8 h-8 animate-spin opacity-60" />
      <p class="text-sm">{{ $t('market.resolving') }}</p>
    </div>

    <div v-else class="px-5 pb-6 space-y-4">
      <!-- Trade panel — Binance-style: order entry on the left, compact
           order book on the right (5 asks / mid / 5 bids, or 10 levels of a
           single side — see bookView). -->
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-3 grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-3">
        <!-- LEFT: Buy/Sell order entry -->
        <div class="min-w-0 space-y-2.5">
          <div class="grid grid-cols-2 gap-1">
            <button
              @click="orderSide = 'buy'"
              class="py-1.5 rounded-lg text-xs font-semibold transition-colors"
              :class="orderSide === 'buy'
                ? 'bg-buy text-white'
                : 'bg-gray-100 dark:bg-gh-700 text-gray-500 dark:text-gray-400'"
            >
              {{ $t('market.buy') }}
            </button>
            <button
              @click="orderSide = 'sell'"
              class="py-1.5 rounded-lg text-xs font-semibold transition-colors"
              :class="orderSide === 'sell'
                ? 'bg-sell text-white'
                : 'bg-gray-100 dark:bg-gh-700 text-gray-500 dark:text-gray-400'"
            >
              {{ $t('market.sell') }}
            </button>
          </div>

          <div class="flex gap-1 text-[11px]">
            <button
              @click="orderType = 'limit'"
              class="px-2 py-1 rounded-md font-medium"
              :class="orderType === 'limit' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'"
            >
              {{ $t('market.orderTypeLimit') }}
            </button>
            <button
              @click="orderType = 'market'"
              class="px-2 py-1 rounded-md font-medium"
              :class="orderType === 'market' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'"
            >
              {{ $t('market.orderTypeMarket') }}
            </button>
          </div>

          <div class="rounded-lg bg-gray-50 dark:bg-gh-700 px-2.5 py-2">
            <div class="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
              <span>{{ $t('market.priceLabel') }}</span>
              <span>{{ market.quoteSymbol }}</span>
            </div>
            <input
              v-if="orderType === 'limit'"
              v-model="priceInput"
              type="number"
              min="0"
              step="any"
              placeholder="0.0"
              class="w-full bg-transparent text-sm font-semibold tabular-nums text-gray-900 dark:text-white outline-none"
            />
            <p v-else class="text-sm font-semibold tabular-nums text-gray-400 dark:text-gray-500 truncate">
              {{ marketOrderPrice != null ? formatPrice(marketOrderPrice) : '—' }}
            </p>
          </div>

          <div class="rounded-lg bg-gray-50 dark:bg-gh-700 px-2.5 py-2">
            <div class="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
              <span>{{ $t('market.sizeLabel') }}</span>
              <span>{{ market.baseSymbol }}</span>
            </div>
            <input
              v-model="sizeInput"
              type="number"
              min="0"
              step="any"
              placeholder="0.0"
              class="w-full bg-transparent text-sm font-semibold tabular-nums text-gray-900 dark:text-white outline-none"
            />
          </div>

          <!-- Share of the available balance to trade. A thin line with
               diamond stops; the (invisible) native range input on top does
               the actual dragging/keyboard handling. -->
          <div class="relative h-5 mx-1.5" :class="maxSize <= 0 ? 'opacity-40' : ''">
            <input
              v-model.number="sizePct"
              type="range"
              min="0"
              max="100"
              step="1"
              :disabled="maxSize <= 0"
              :aria-label="$t('market.sizePercent')"
              class="peer absolute z-10 inset-y-0 -inset-x-2 w-[calc(100%+1rem)] h-full m-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <div class="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-gray-300 dark:bg-gh-600" />
            <div
              class="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 h-px bg-gray-900 dark:bg-white"
              :style="{ width: sizePct + '%' }"
            />
            <span
              v-for="stop in SIZE_PCT_STOPS"
              :key="stop"
              class="pointer-events-none absolute top-1/2 w-[7px] h-[7px] -translate-x-1/2 -translate-y-1/2 rotate-45 border"
              :class="sizePct >= stop
                ? 'bg-gray-900 border-gray-900 dark:bg-white dark:border-white'
                : 'bg-white border-gray-300 dark:bg-gh-800 dark:border-gh-600'"
              :style="{ left: stop + '%' }"
            />
            <span
              class="pointer-events-none absolute top-1/2 w-[11px] h-[11px] -translate-x-1/2 -translate-y-1/2 rotate-45 border-2
                     bg-white border-gray-900 dark:bg-gh-800 dark:border-white
                     peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500"
              :style="{ left: sizePct + '%' }"
            />
          </div>

          <div class="flex items-center justify-between gap-1 text-[10px] text-gray-400 dark:text-gray-500">
            <span class="truncate">{{ $t('market.available') }}: {{ formatSize(maxSize) }} {{ market.baseSymbol }}</span>
            <span class="shrink-0 tabular-nums">{{ sizePct }}%</span>
          </div>

          <div v-if="estimatedTotal != null" class="flex justify-between gap-1 text-[11px] text-gray-500 dark:text-gray-400">
            <span>{{ $t('market.total') }}</span>
            <span class="font-medium text-gray-700 dark:text-gray-300 truncate">≈ {{ formatPrice(estimatedTotal) }} {{ market.quoteSymbol }}</span>
          </div>

          <div
            v-if="trading.status.value === 'error'"
            class="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-2.5 py-2 text-[11px] text-red-700 dark:text-red-300 space-y-1"
          >
            <p>{{ $t('market.orderErrors.' + (trading.errorCode.value || 'unknown')) }}</p>
            <p v-if="trading.errorDetail.value" class="font-mono text-[10px] text-red-500 dark:text-red-400/80 break-words">
              {{ trading.errorDetail.value }}
            </p>
          </div>

          <button
            @click="openConfirm"
            :disabled="!canSubmit || trading.status.value === 'placing'"
            class="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            :class="orderSide === 'buy' ? 'bg-buy hover:bg-buy/90' : 'bg-sell hover:bg-sell/90'"
          >
            <Loader2 v-if="trading.status.value === 'placing'" class="w-4 h-4 animate-spin" />
            {{ orderSide === 'buy' ? $t('market.buy') : $t('market.sell') }} {{ market.baseSymbol }}
          </button>
        </div>

        <!-- RIGHT: compact order book. Tapping a level fills the limit price. -->
        <div class="min-w-0 flex flex-col">
          <div class="pb-1 grid grid-cols-2 text-[10px] font-medium text-gray-400 dark:text-gray-500">
            <span>{{ $t('market.price') }}</span>
            <span class="text-right">{{ $t('market.size') }}</span>
          </div>

          <!-- Asks (red) — best ask nearest the mid -->
          <div v-if="bookView !== 'bids'" class="flex-1 flex flex-col justify-end">
            <p v-if="book.asks.value.length === 0" class="py-3 text-[11px] text-gray-400 dark:text-gray-500 text-center">
              {{ $t('market.noOrders') }}
            </p>
            <button
              v-for="lvl in shownAsks"
              :key="'ask-' + lvl.px"
              @click="pickLevel(lvl)"
              class="relative w-full py-[3px] grid grid-cols-2 text-[11px] tabular-nums text-left"
            >
              <div class="absolute inset-y-0 right-0 bg-sell/15 dark:bg-sell/25" :style="{ width: depthPct(lvl) }" />
              <span class="relative truncate text-sell">{{ formatPrice(lvl.px) }}</span>
              <span class="relative truncate text-right text-gray-600 dark:text-gray-300">{{ formatSize(lvl.sz) }}</span>
            </button>
          </div>

          <p class="my-1 py-1 text-base font-bold tabular-nums text-gray-900 dark:text-white truncate">{{ formatPrice(book.mid.value) }}</p>

          <!-- Bids (green) — best bid nearest the mid -->
          <div v-if="bookView !== 'asks'" class="flex-1">
            <p v-if="book.bids.value.length === 0" class="py-3 text-[11px] text-gray-400 dark:text-gray-500 text-center">
              {{ $t('market.noOrders') }}
            </p>
            <button
              v-for="lvl in shownBids"
              :key="'bid-' + lvl.px"
              @click="pickLevel(lvl)"
              class="relative w-full py-[3px] grid grid-cols-2 text-[11px] tabular-nums text-left"
            >
              <div class="absolute inset-y-0 right-0 bg-buy/15 dark:bg-buy/25" :style="{ width: depthPct(lvl) }" />
              <span class="relative truncate text-buy">{{ formatPrice(lvl.px) }}</span>
              <span class="relative truncate text-right text-gray-600 dark:text-gray-300">{{ formatSize(lvl.sz) }}</span>
            </button>
          </div>

          <!-- Which side(s) of the book to show -->
          <div class="pt-2 flex justify-end gap-1">
            <button
              v-for="view in BOOK_VIEWS"
              :key="view.id"
              @click="bookView = view.id"
              :title="$t(view.label)"
              :aria-label="$t(view.label)"
              :aria-pressed="bookView === view.id"
              class="w-6 h-6 rounded-md flex flex-col items-stretch justify-center gap-[2px] px-[5px] transition-colors"
              :class="bookView === view.id ? 'bg-gray-200 dark:bg-gh-600' : 'bg-gray-100 dark:bg-gh-700 opacity-60'"
            >
              <span v-for="(bar, i) in view.bars" :key="i" class="h-[2px] rounded-full" :class="bar" />
            </button>
          </div>
        </div>
      </div>

      <!-- Open orders / own trade history / the market's recent trades — tabs -->
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
        <div class="tab-strip px-4 flex gap-5 overflow-x-auto whitespace-nowrap">
          <button
            v-for="tab in ORDER_TABS"
            :key="tab.id"
            @click="ordersTab = tab.id"
            class="shrink-0 py-3 -mb-px text-sm font-semibold border-b-2 transition-colors"
            :class="ordersTab === tab.id
              ? 'border-blue-600 text-gray-900 dark:text-white'
              : 'border-transparent text-gray-400 dark:text-gray-500'"
          >
            {{ $t(tab.label) }}<template v-if="tab.id === 'open'"> ({{ openOrders.orders.value.length }})</template>
          </button>
        </div>

        <template v-if="ordersTab === 'open'">
          <p v-if="openOrders.orders.value.length === 0" class="border-t border-gray-200 dark:border-gh-700 px-4 py-4 text-xs text-gray-400 dark:text-gray-500 text-center">
            {{ $t('market.noOpenOrders') }}
          </p>
          <div
            v-for="o in openOrders.orders.value"
            :key="o.oid"
            class="border-t border-gray-200 dark:border-gh-700 px-4 py-3 flex items-center justify-between gap-2"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium" :class="o.side === 'B' ? 'text-buy' : 'text-sell'">
                {{ o.side === 'B' ? $t('market.buy') : $t('market.sell') }} {{ formatSize(o.sz) }} {{ market.baseSymbol }}
              </p>
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('market.priceLabel') }}: {{ formatPrice(o.limitPx) }}</p>
            </div>
            <button
              @click="askCancel(o.oid)"
              :disabled="trading.status.value === 'cancelling'"
              class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gh-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gh-700 disabled:opacity-50"
            >
              {{ $t('market.cancelOrder') }}
            </button>
          </div>
        </template>

        <template v-else-if="ordersTab === 'history'">
          <p v-if="tradeHistory.fills.value.length === 0" class="border-t border-gray-200 dark:border-gh-700 px-4 py-4 text-xs text-gray-400 dark:text-gray-500 text-center">
            {{ $t('market.noTradeHistory') }}
          </p>
          <div
            v-for="f in tradeHistory.fills.value"
            :key="f.hash + f.oid"
            class="border-t border-gray-200 dark:border-gh-700 px-4 py-3 flex items-center justify-between gap-2"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium" :class="f.side === 'B' ? 'text-buy' : 'text-sell'">
                {{ f.side === 'B' ? $t('market.buy') : $t('market.sell') }} {{ formatSize(f.sz) }} {{ market.baseSymbol }}
              </p>
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ formatFillTime(f.time) }}</p>
            </div>
            <p class="text-sm font-mono text-gray-700 dark:text-gray-300 shrink-0">{{ formatPrice(f.px) }}</p>
          </div>
        </template>

        <!-- Market trades: time / price / size, newest first. Price is
             coloured by the taker's side, as on an exchange tape. -->
        <template v-else>
          <div class="border-t border-gray-200 dark:border-gh-700 px-4 pt-2 pb-1 grid grid-cols-3 text-[10px] font-medium text-gray-400 dark:text-gray-500">
            <span>{{ $t('market.time') }}</span>
            <span class="text-right">{{ $t('market.price') }} ({{ market.quoteSymbol }})</span>
            <span class="text-right">{{ $t('market.size') }} ({{ market.baseSymbol }})</span>
          </div>
          <p v-if="recentTrades.trades.value.length === 0" class="px-4 py-4 text-xs text-gray-400 dark:text-gray-500 text-center">
            {{ recentTrades.loading.value ? $t('common.loading') : $t('market.noMarketTrades') }}
          </p>
          <div
            v-for="tr in recentTrades.trades.value"
            :key="tr.tid"
            class="px-4 py-1 grid grid-cols-3 text-xs tabular-nums"
          >
            <span class="text-gray-500 dark:text-gray-400">{{ formatTradeTime(tr.time) }}</span>
            <span class="text-right font-medium" :class="tr.side === 'B' ? 'text-buy' : 'text-sell'">{{ formatPrice(tr.px) }}</span>
            <span class="text-right text-gray-600 dark:text-gray-300">{{ formatSize(tr.sz) }}</span>
          </div>
          <div class="h-2" />
        </template>
      </div>
    </div>

    <!-- Confirm order modal -->
    <div v-if="showConfirm" class="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('market.reviewOrder') }}</h3>
        <div class="rounded-xl bg-gray-50 dark:bg-gh-700 p-3 space-y-1.5 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-400 dark:text-gray-500">{{ orderSide === 'buy' ? $t('market.buy') : $t('market.sell') }}</span>
            <span class="font-semibold text-gray-800 dark:text-gray-100">{{ formatSize(sizeInput) }} {{ market.baseSymbol }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400 dark:text-gray-500">{{ $t('market.priceLabel') }}</span>
            <span class="font-medium text-gray-700 dark:text-gray-300">
              {{ effectivePrice != null ? formatPrice(effectivePrice) : '—' }} {{ market.quoteSymbol }}
              <template v-if="orderType === 'market'"> ({{ $t('market.orderTypeMarket') }})</template>
            </span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-400 dark:text-gray-500">{{ $t('market.total') }}</span>
            <span class="font-medium text-gray-700 dark:text-gray-300">≈ {{ estimatedTotal != null ? formatPrice(estimatedTotal) : '—' }} {{ market.quoteSymbol }}</span>
          </div>
        </div>
        <div class="flex gap-2">
          <button
            @click="showConfirm = false"
            class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gh-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gh-700"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            @click="confirmSubmit"
            class="flex-1 py-2.5 rounded-xl text-sm font-medium text-white"
            :class="orderSide === 'buy' ? 'bg-buy hover:bg-buy/90' : 'bg-sell hover:bg-sell/90'"
          >
            {{ $t('market.confirmOrder') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Confirm cancel modal -->
    <div v-if="cancelConfirmOid !== null" class="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <div class="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto">
          <AlertTriangle class="w-6 h-6 text-red-500" />
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-300 text-center">{{ $t('market.cancelConfirmDesc') }}</p>
        <div class="flex gap-2">
          <button
            @click="cancelConfirmOid = null"
            class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gh-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gh-700"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            @click="confirmCancel"
            class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-700 text-white"
          >
            {{ $t('market.cancelOrder') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, Loader2, X, AlertTriangle, ChartCandlestick } from 'lucide-vue-next'
import { settings } from '@/stores/settings'
import { evmAddress } from '@/stores/evm'
import { deriveEvmAddress } from '@/composables/useEvmAccount'
import { useHyperliquidBalances } from '@/composables/useHyperliquidBalances'
import { useHyperliquidOrderBook } from '@/composables/useHyperliquidOrderBook'
import { useHyperliquidOpenOrders } from '@/composables/useHyperliquidOpenOrders'
import { useHyperliquidTradeHistory } from '@/composables/useHyperliquidTradeHistory'
import { useHyperliquidTrading } from '@/composables/useHyperliquidTrading'
import { useHyperliquidSpotTickers } from '@/composables/useHyperliquidSpotTickers'
import { useHyperliquidRecentTrades } from '@/composables/useHyperliquidRecentTrades'
import { HL_SPOT_MARKETS } from '@/lib/hyperliquid/market'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

// Keyed by the route's :pair segment (e.g. "NAV-USDC") — add an entry here
// whenever a new Hyperliquid spot market gets a screen.
const MARKET_RESOLVERS = Object.fromEntries(
  Object.entries(HL_SPOT_MARKETS).map(([pair, m]) => [pair, m.resolver])
)

const derivationError = ref('')
const marketNotFound = ref(false)
const market = ref(null) // { coin, pairName, baseSymbol, quoteSymbol, baseSzDecimals }
const coin = computed(() => market.value?.coin ?? null)

// Order book rows: both sides share the column, a single side gets all of it.
const BOOK_LEVELS_BOTH = 5
const BOOK_LEVELS_SINGLE = 10

// The websocket connection lives only on this screen — closed automatically
// on unmount/background by the composable itself.
const book = useHyperliquidOrderBook(coin, { levels: BOOK_LEVELS_SINGLE })
const hl = useHyperliquidBalances(evmAddress)
const openOrders = useHyperliquidOpenOrders(evmAddress, coin)
const tradeHistory = useHyperliquidTradeHistory(evmAddress, coin)
const trading = useHyperliquidTrading()

// 24h change shown under the pair name — same REST ticker the home screen's
// market list uses.
const tickerIndices = computed(() => (market.value ? [market.value.pairIndex] : []))
const { tickers } = useHyperliquidSpotTickers(tickerIndices)
const change24h = computed(() => tickers.value[market.value?.pairIndex]?.change24h ?? null)

const headerLabel = computed(() => {
  if (!market.value) return t('dex.hyperliquid.title')
  return t('market.headerFormat', { base: market.value.baseSymbol, quote: market.value.quoteSymbol })
})

const baseBalance = computed(() => hl.balances.value.find((b) => b.symbol === market.value?.baseSymbol) ?? null)
const quoteBalance = computed(() => hl.balances.value.find((b) => b.symbol === market.value?.quoteSymbol) ?? null)

// --- Order book side filter ---
const bookView = ref('both') // 'both' | 'bids' | 'asks'
const BOOK_VIEWS = [
  { id: 'both', label: 'market.bookBoth', bars: ['bg-sell', 'bg-sell', 'bg-buy', 'bg-buy'] },
  { id: 'bids', label: 'market.bids', bars: ['bg-buy', 'bg-buy', 'bg-buy', 'bg-buy'] },
  { id: 'asks', label: 'market.asks', bars: ['bg-sell', 'bg-sell', 'bg-sell', 'bg-sell'] },
]
const shownLevelCount = computed(() => (bookView.value === 'both' ? BOOK_LEVELS_BOTH : BOOK_LEVELS_SINGLE))
const shownBids = computed(() => book.bids.value.slice(0, shownLevelCount.value))
// Reversed so the best ask sits nearest the mid price.
const shownAsks = computed(() => book.asks.value.slice(0, shownLevelCount.value).reverse())

const maxDepth = computed(() => {
  const bidsMax = bookView.value === 'asks' ? 0 : Number(shownBids.value[shownBids.value.length - 1]?.total ?? 0)
  const asksMax = bookView.value === 'bids' ? 0 : Number(shownAsks.value[0]?.total ?? 0)
  return Math.max(bidsMax, asksMax) || 1
})

function depthPct(level) {
  return `${Math.min(100, (Number(level.total) / maxDepth.value) * 100)}%`
}

function formatPrice(value) {
  if (value == null) return '—'
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

function formatSize(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return value
  return num.toLocaleString(undefined, { maximumFractionDigits: 6 })
}

function formatFillTime(ms) {
  return new Date(ms).toLocaleString()
}

// --- Buy/Sell order entry ---
const orderSide = ref('buy') // 'buy' | 'sell'
const orderType = ref('limit') // 'limit' | 'market'
const priceInput = ref('')
const sizeInput = ref('')
const showConfirm = ref(false)

// Hyperliquid has no separate "market order" action — it's an IOC limit
// order priced aggressively past the best opposing price so it fills like
// one. Reuses the BSC swap card's own slippage setting (same concept: how
// much price movement to tolerate) rather than adding a second one.
const marketOrderPrice = computed(() => {
  const level = orderSide.value === 'buy' ? book.asks.value[0] : book.bids.value[0]
  const px = level ? Number(level.px) : null
  if (!Number.isFinite(px)) return null
  const slip = settings.slippageBps / 10000
  return orderSide.value === 'buy' ? px * (1 + slip) : px * (1 - slip)
})

const effectivePrice = computed(() => {
  if (orderType.value === 'market') return marketOrderPrice.value
  const p = Number(priceInput.value)
  return Number.isFinite(p) && p > 0 ? p : null
})

const maxSize = computed(() => {
  if (orderSide.value === 'sell') return baseBalance.value ? Number(baseBalance.value.available) : 0
  const price = effectivePrice.value
  if (!price || !quoteBalance.value) return 0
  return Number(quoteBalance.value.available) / price
})

function pickLevel(level) {
  orderType.value = 'limit'
  priceInput.value = String(level.px)
}

// Slider: share of maxSize. Derived from sizeInput rather than stored, so
// typing a size by hand moves the slider too.
const SIZE_PCT_STOPS = [0, 25, 50, 75, 100]
// Dragging to within this many points of a stop lands exactly on it.
const SIZE_PCT_SNAP = 2

// Rounds down to the market's lot size — rounding up at 100% would ask for
// more than the balance covers.
function floorSize(value) {
  const decimals = market.value?.baseSzDecimals ?? 0
  const factor = 10 ** decimals
  const floored = Math.floor(value * factor + 1e-9) / factor
  if (!(floored > 0)) return ''
  const fixed = floored.toFixed(decimals)
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
}

const sizePct = computed({
  get() {
    const size = Number(sizeInput.value)
    if (!(maxSize.value > 0) || !Number.isFinite(size) || size <= 0) return 0
    return Math.min(100, Math.round((size / maxSize.value) * 100))
  },
  set(pct) {
    // Single-point moves (arrow keys, slow drags) are left alone — snapping
    // those would make it impossible to step away from a stop.
    const stop = Math.abs(pct - sizePct.value) > 1
      ? SIZE_PCT_STOPS.find((s) => Math.abs(s - pct) <= SIZE_PCT_SNAP)
      : undefined
    sizeInput.value = maxSize.value > 0 ? floorSize((maxSize.value * (stop ?? pct)) / 100) : ''
  },
})

const estimatedTotal = computed(() => {
  const price = effectivePrice.value
  const size = Number(sizeInput.value)
  if (!price || !Number.isFinite(size) || size <= 0) return null
  return price * size
})

const canSubmit = computed(() => {
  if (!market.value || !evmAddress.value) return false
  if (trading.status.value === 'placing') return false
  if (!effectivePrice.value) return false
  const size = Number(sizeInput.value)
  return Number.isFinite(size) && size > 0
})

function openConfirm() {
  if (!canSubmit.value) return
  showConfirm.value = true
}

async function confirmSubmit() {
  showConfirm.value = false
  await trading.placeOrder({
    market: market.value,
    side: orderSide.value,
    price: effectivePrice.value,
    size: sizeInput.value,
    orderType: orderType.value,
  })
  if (trading.status.value === 'placed') {
    sizeInput.value = ''
    priceInput.value = ''
    trading.reset()
    hl.refresh()
    openOrders.refresh()
    tradeHistory.refresh()
  }
}

// --- Open orders / trade history ---
const ordersTab = ref('open') // 'open' | 'history' | 'trades'
const ORDER_TABS = [
  { id: 'open', label: 'market.openOrders' },
  { id: 'history', label: 'market.tradeHistory' },
  { id: 'trades', label: 'market.marketTrades' },
]

// Only fetched while its tab is the one showing.
const recentTrades = useHyperliquidRecentTrades(coin, computed(() => ordersTab.value === 'trades'))

function formatTradeTime(ms) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}
const cancelConfirmOid = ref(null)
function askCancel(oid) {
  cancelConfirmOid.value = oid
}
async function confirmCancel() {
  const oid = cancelConfirmOid.value
  cancelConfirmOid.value = null
  await trading.cancelOrder({ market: market.value, oid })
  openOrders.refresh()
  tradeHistory.refresh()
}

onMounted(async () => {
  const resolver = MARKET_RESOLVERS[route.params.pair]
  if (!resolver) {
    marketNotFound.value = true
  } else {
    try {
      const resolved = await resolver()
      if (!resolved) marketNotFound.value = true
      else market.value = resolved
    } catch (e) {
      console.error('[market] failed to resolve market:', e)
      marketNotFound.value = true
    }
  }

  // A visitor can land here directly (deep link / assets-list tap) without
  // ever having opened the DEX tab, so the EVM address may not be derived
  // yet — same derivation flow as DexView.vue's onMounted.
  if (!evmAddress.value) {
    try {
      await deriveEvmAddress(0)
    } catch (e) {
      console.error('[market] derivation error:', e)
      if (e.message === 'wallet_locked') derivationError.value = t('dex.errors.walletLocked')
      else if (e.message === 'wallet_not_ready') derivationError.value = t('dex.errors.walletNotReady')
      else derivationError.value = t('dex.errors.derivationFailed')
    }
  }
})
</script>

<style scoped>
.tab-strip {
  scrollbar-width: none;
}
.tab-strip::-webkit-scrollbar {
  display: none;
}
</style>
