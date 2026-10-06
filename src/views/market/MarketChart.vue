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
    </div>

    <div v-if="marketNotFound" class="flex-1 flex items-center justify-center px-5 pb-6">
      <p class="text-sm text-gray-400 dark:text-gray-500 text-center">{{ $t('market.notFound') }}</p>
    </div>

    <div v-else-if="!market" class="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 space-y-3">
      <Loader2 class="w-8 h-8 animate-spin opacity-60" />
      <p class="text-sm">{{ $t('market.resolving') }}</p>
    </div>

    <div v-else class="px-5 pb-6 space-y-3">
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-3 space-y-3">
        <!-- Interval -->
        <div class="flex gap-1 text-[11px]">
          <button
            v-for="iv in INTERVALS"
            :key="iv.id"
            @click="interval = iv.id"
            class="px-2.5 py-1 rounded-md font-medium tabular-nums"
            :class="interval === iv.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'"
          >
            {{ iv.id }}
          </button>
        </div>

        <!-- Readout: the candle under the crosshair, else the latest one -->
        <div class="min-h-[2.75rem]">
          <template v-if="readout">
            <p class="text-xl font-bold tabular-nums text-gray-900 dark:text-white">
              {{ formatPrice(readout.c) }}
              <span class="text-xs font-medium text-gray-400 dark:text-gray-500">{{ market.quoteSymbol }}</span>
            </p>
            <p class="text-[10px] tabular-nums text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-2">
              <span>{{ formatCandleTime(readout.t, true) }}</span>
              <span>{{ $t('market.ohlc.open') }} {{ formatPrice(readout.o) }}</span>
              <span>{{ $t('market.ohlc.high') }} {{ formatPrice(readout.h) }}</span>
              <span>{{ $t('market.ohlc.low') }} {{ formatPrice(readout.l) }}</span>
              <span>{{ $t('market.ohlc.close') }} {{ formatPrice(readout.c) }}</span>
            </p>
          </template>
        </div>

        <!-- Chart -->
        <div ref="chartEl" class="relative w-full" :style="{ height: HEIGHT + 'px' }">
          <div v-if="status === 'loading' && !candles.length" class="absolute inset-0 flex items-center justify-center text-gray-400 dark:text-gray-500">
            <Loader2 class="w-6 h-6 animate-spin opacity-60" />
          </div>
          <div v-else-if="status === 'error' && !candles.length" class="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('market.chartError') }}</p>
            <button @click="load" class="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gh-600 text-gray-600 dark:text-gray-300">
              {{ $t('market.chartRetry') }}
            </button>
          </div>
          <p v-else-if="!candles.length" class="absolute inset-0 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
            {{ $t('market.noChartData') }}
          </p>

          <svg
            v-else-if="width > 0"
            :width="width"
            :height="HEIGHT"
            class="block select-none"
            style="touch-action: pan-y"
            role="img"
            :aria-label="$t('market.chart')"
            @pointermove="onPointer"
            @pointerdown="onPointer"
            @pointerleave="hoverIndex = null"
            @pointercancel="hoverIndex = null"
          >
            <!-- Grid + price axis (right) -->
            <g v-for="tick in yTicks" :key="tick.value">
              <line :x1="0" :x2="plotW" :y1="tick.y" :y2="tick.y" class="stroke-gray-100 dark:stroke-gh-700" stroke-width="1" />
              <text :x="plotW + 6" :y="tick.y + 3" class="fill-gray-400 dark:fill-gray-500 text-[10px] tabular-nums">{{ formatPrice(tick.value) }}</text>
            </g>

            <!-- Time axis -->
            <text
              v-for="label in xLabels"
              :key="label.i"
              :x="label.x"
              :y="HEIGHT - 5"
              text-anchor="middle"
              class="fill-gray-400 dark:fill-gray-500 text-[10px] tabular-nums"
            >{{ label.text }}</text>

            <!-- Candles -->
            <g
              v-for="c in drawn"
              :key="c.t"
              :class="c.up
                ? 'fill-buy stroke-buy'
                : 'fill-sell stroke-sell'"
            >
              <line :x1="c.x" :x2="c.x" :y1="c.yHigh" :y2="c.yLow" stroke-width="1" />
              <rect :x="c.x - bodyW / 2" :y="c.yTop" :width="bodyW" :height="c.bodyH" stroke="none" />
            </g>

            <!-- Latest price -->
            <line
              v-if="lastY != null"
              :x1="0" :x2="plotW" :y1="lastY" :y2="lastY"
              class="stroke-gray-400 dark:stroke-gray-500" stroke-width="1" stroke-dasharray="3 3"
            />

            <!-- Crosshair -->
            <line
              v-if="hovered"
              :x1="hovered.x" :x2="hovered.x" :y1="PAD_TOP" :y2="HEIGHT - PAD_BOTTOM"
              class="stroke-gray-400 dark:stroke-gray-400" stroke-width="1"
            />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, Loader2 } from 'lucide-vue-next'
import { fetchCandleSnapshot } from '@/lib/hyperliquid/api'
import { HL_SPOT_MARKETS } from '@/lib/hyperliquid/market'
import { useHyperliquidSpotTickers } from '@/composables/useHyperliquidSpotTickers'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const MINUTE = 60_000
const INTERVALS = [
  { id: '15m', ms: 15 * MINUTE },
  { id: '1h', ms: 60 * MINUTE },
  { id: '4h', ms: 240 * MINUTE },
  { id: '1d', ms: 1440 * MINUTE },
]
const CANDLE_COUNT = 60
const REFRESH_MS = 15_000

// Plot geometry (px). The price axis sits in the right gutter, the time
// axis in the bottom one.
const HEIGHT = 300
const PAD_TOP = 8
const PAD_BOTTOM = 20
const AXIS_W = 56

const market = ref(null)
const marketNotFound = ref(false)
const interval = ref('1h')
const candles = ref([]) // [{ t, o, h, l, c }] oldest first
const status = ref('loading') // 'loading' | 'ready' | 'error'
const hoverIndex = ref(null)

const headerLabel = computed(() => {
  if (!market.value) return t('dex.hyperliquid.title')
  return t('market.headerFormat', { base: market.value.baseSymbol, quote: market.value.quoteSymbol })
})

const tickerIndices = computed(() => (market.value ? [market.value.pairIndex] : []))
const { tickers } = useHyperliquidSpotTickers(tickerIndices)
const change24h = computed(() => tickers.value[market.value?.pairIndex]?.change24h ?? null)

// --- data ---
let requestSeq = 0
async function load() {
  if (!market.value) return
  const seq = ++requestSeq
  const iv = INTERVALS.find((i) => i.id === interval.value)
  if (!candles.value.length) status.value = 'loading'
  try {
    const now = Date.now()
    const rows = await fetchCandleSnapshot(market.value.coin, iv.id, now - CANDLE_COUNT * iv.ms, now)
    if (seq !== requestSeq) return // a newer request (interval switch) superseded this one
    candles.value = (rows || [])
      .map((r) => ({ t: r.t, o: Number(r.o), h: Number(r.h), l: Number(r.l), c: Number(r.c) }))
      .filter((r) => [r.o, r.h, r.l, r.c].every(Number.isFinite))
      .slice(-CANDLE_COUNT)
    status.value = 'ready'
  } catch (e) {
    if (seq !== requestSeq) return
    console.error('[market] candle load failed:', e)
    // Keep showing the last good candles on a failed refresh.
    status.value = candles.value.length ? 'ready' : 'error'
  }
}

watch(interval, () => {
  candles.value = []
  hoverIndex.value = null
  load()
})

// --- layout ---
const chartEl = ref(null)
const width = ref(0)
let resizeObserver = null

const plotW = computed(() => Math.max(0, width.value - AXIS_W))
const step = computed(() => plotW.value / CANDLE_COUNT)
const bodyW = computed(() => Math.max(1, Math.min(10, step.value * 0.7)))

const priceRange = computed(() => {
  if (!candles.value.length) return null
  let lo = Infinity
  let hi = -Infinity
  for (const c of candles.value) {
    if (c.l < lo) lo = c.l
    if (c.h > hi) hi = c.h
  }
  const pad = (hi - lo) * 0.06 || hi * 0.01 || 1
  return { lo: lo - pad, hi: hi + pad }
})

function yFor(price) {
  const { lo, hi } = priceRange.value
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM
  return PAD_TOP + ((hi - price) / (hi - lo)) * plotH
}

// Candles are right-aligned so a thinly traded pair with few candles still
// ends at the latest price.
const drawn = computed(() => {
  if (!priceRange.value) return []
  const offset = CANDLE_COUNT - candles.value.length
  return candles.value.map((c, i) => {
    const yOpen = yFor(c.o)
    const yClose = yFor(c.c)
    return {
      ...c,
      up: c.c >= c.o,
      x: (offset + i + 0.5) * step.value,
      yHigh: yFor(c.h),
      yLow: yFor(c.l),
      yTop: Math.min(yOpen, yClose),
      bodyH: Math.max(1, Math.abs(yClose - yOpen)),
    }
  })
})

const yTicks = computed(() => {
  if (!priceRange.value) return []
  const { lo, hi } = priceRange.value
  const rawStep = (hi - lo) / 4
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const niceStep = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep)
  const ticks = []
  for (let v = Math.ceil(lo / niceStep) * niceStep; v <= hi; v += niceStep) {
    ticks.push({ value: Number(v.toPrecision(12)), y: yFor(v) })
  }
  return ticks
})

const xLabels = computed(() => {
  const list = drawn.value
  if (!list.length) return []
  // Hourly labels carry date + time, so fewer of them fit.
  const every = Math.ceil(CANDLE_COUNT / (interval.value === '1h' ? 3 : 4))
  return list
    .map((c, i) => ({ c, i }))
    .filter(({ i }) => (list.length - 1 - i) % every === Math.floor(every / 2))
    .map(({ c, i }) => ({ i, x: c.x, text: formatCandleTime(c.t, false) }))
})

const lastY = computed(() => {
  const last = candles.value[candles.value.length - 1]
  return last && priceRange.value ? yFor(last.c) : null
})

// --- crosshair ---
function onPointer(e) {
  const list = drawn.value
  if (!list.length || !step.value) return
  const x = e.clientX - e.currentTarget.getBoundingClientRect().left
  const offset = CANDLE_COUNT - list.length
  const i = Math.floor(x / step.value) - offset
  hoverIndex.value = Math.max(0, Math.min(list.length - 1, i))
}

const hovered = computed(() => (hoverIndex.value != null ? drawn.value[hoverIndex.value] ?? null : null))
const readout = computed(() => hovered.value ?? candles.value[candles.value.length - 1] ?? null)

// --- formatting ---
function formatPrice(value) {
  if (value == null) return '—'
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

function formatCandleTime(ms, full) {
  const d = new Date(ms)
  const date = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (interval.value === '1d') return date
  // Axis labels: 60 × 15m fits in one day (time is enough), 60 × 1h spans
  // days (needs both), 60 × 4h spans over a week (date is enough).
  if (full || interval.value === '1h') return `${date} ${time}`
  return interval.value === '4h' ? date : time
}

// --- lifecycle ---
let refreshTimer = null

onMounted(async () => {
  resizeObserver = new ResizeObserver(([entry]) => {
    width.value = Math.floor(entry.contentRect.width)
  })
  // chartEl only exists once the market has resolved.
  watch(chartEl, (el, prev) => {
    if (prev) resizeObserver.unobserve(prev)
    if (el) resizeObserver.observe(el)
  }, { immediate: true })

  const resolver = HL_SPOT_MARKETS[route.params.pair]?.resolver
  try {
    const resolved = resolver ? await resolver() : null
    if (!resolved) marketNotFound.value = true
    else market.value = resolved
  } catch (e) {
    console.error('[market] failed to resolve market:', e)
    marketNotFound.value = true
  }
  if (!market.value) return

  load()
  refreshTimer = setInterval(() => {
    if (document.visibilityState === 'visible') load()
  }, REFRESH_MS)
})

onUnmounted(() => {
  requestSeq++
  clearInterval(refreshTimer)
  resizeObserver?.disconnect()
})
</script>
