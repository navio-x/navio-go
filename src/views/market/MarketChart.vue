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
          {{ $t('market.venueSpot') }}
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
        <!-- Range: how far back, with the candle size chosen to fit -->
        <div class="range-strip flex items-center gap-0.5 text-[11px] overflow-x-auto">
          <template v-for="r in RANGES" :key="r.id">
            <!-- Candle sizes (1s 1m 5m) | look-back ranges -->
            <span v-if="r.id === '1D'" class="mx-1 h-3 w-px shrink-0 bg-gray-200 dark:bg-gh-600" />
            <button
              @click="rangeId = r.id"
              class="px-2 py-1 rounded-md font-medium tabular-nums shrink-0"
              :class="rangeId === r.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'"
            >
              {{ r.id === 'all' ? $t('market.range.all') : r.id }}
            </button>
          </template>
          <span
            class="ml-auto pl-2 flex items-center gap-1 shrink-0 text-[10px] font-semibold uppercase tracking-wide"
            :class="liveConnected ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'"
          >
            <span class="w-1.5 h-1.5 rounded-full" :class="liveConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-300 dark:bg-gh-600'" />
            {{ liveConnected ? $t('market.live') : $t('market.delayed') }}
          </span>
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
            <p v-if="range.live" class="text-[10px] text-gray-400 dark:text-gray-500">{{ $t('market.liveMidHint') }}</p>
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
          <p v-else-if="!candles.length" class="absolute inset-0 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500 text-center px-6">
            {{ $t(range.live ? 'common.loading' : range.span ? 'market.noTradesInRange' : 'market.noChartData') }}
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
import { HL_WS_URL } from '@/lib/hyperliquid/config'
import { HL_SPOT_MARKETS } from '@/lib/hyperliquid/market'
import { useHyperliquidSpotTickers } from '@/composables/useHyperliquidSpotTickers'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const HOUR = 3_600_000
const DAY = 24 * HOUR
const WEEK = 7 * DAY

// Each range picks the Hyperliquid candle interval that fills it with
// roughly 50–90 candles: enough shape, still wide enough to read and tap.
// The first three are named by candle size, the rest by how far back they
// look. 1m is the finest candle Hyperliquid serves: "1s" (`live`) is built
// on this device from the live mid price, one candle a second, starting
// when the chart opens — there is no history to fetch for it.
// "all" asks for daily candles from the market's first trade and folds them
// into weeks once there are too many to draw.
const RANGES = [
  { id: '1s', live: true, intervalMs: 1000, slots: 120 },
  { id: '1m', span: HOUR, interval: '1m', intervalMs: 60_000, slots: 60 },
  { id: '5m', span: 5 * HOUR, interval: '5m', intervalMs: 5 * 60_000, slots: 60 },
  { id: '1D', span: DAY, interval: '30m', intervalMs: 30 * 60_000, slots: 48 },
  { id: '1W', span: WEEK, interval: '2h', intervalMs: 2 * HOUR, slots: 84 },
  { id: '1M', span: 30 * DAY, interval: '12h', intervalMs: 12 * HOUR, slots: 60 },
  { id: '3M', span: 91 * DAY, interval: '1d', intervalMs: DAY, slots: 91 },
  { id: '1Y', span: 365 * DAY, interval: '1w', intervalMs: WEEK, slots: 52 },
  { id: 'all', span: null, interval: '1d', intervalMs: DAY, slots: 0 },
]
const ALL_FOLD_ABOVE = 180 // daily candles; beyond this "all" is drawn weekly
const MIN_SLOTS = 24 // a handful of candles should not become giant
const REFRESH_MS = 15_000

// Plot geometry (px). The price axis sits in the right gutter, the time
// axis in the bottom one.
const HEIGHT = 300
const PAD_TOP = 8
const PAD_BOTTOM = 20
const AXIS_W = 56

const market = ref(null)
const marketNotFound = ref(false)
const rangeId = ref('1W')
const range = computed(() => RANGES.find((r) => r.id === rangeId.value))
const candles = ref([]) // [{ t, o, h, l, c }] oldest first
const candleMs = ref(range.value.intervalMs) // width of the candles on screen ("all" may fold to weeks)
// Hyperliquid stops producing candles at the last trade, so on a quiet
// market the newest candle can be hours or days old. The empty slots between
// it and now are kept so the chart does not pretend the last trade was just now.
const trailingSlots = ref(0)
const status = ref('loading') // 'loading' | 'ready' | 'error'
const hoverIndex = ref(null)

const headerLabel = computed(() => {
  if (!market.value) return t('dex.hyperliquid.title')
  return t('market.headerFormat', { base: market.value.baseSymbol, quote: market.value.quoteSymbol })
})

const tickerIndices = computed(() => (market.value ? [market.value.pairIndex] : []))
const { tickers } = useHyperliquidSpotTickers(tickerIndices)
const change24h = computed(() => tickers.value[market.value?.pairIndex]?.change24h ?? null)
// The ticker's mid (about one a second, with its own REST fallback) keeps
// the 1s candles going even if this page's socket is down.
watch(() => tickers.value[market.value?.pairIndex]?.price, (px) => {
  if (px != null && !liveConnected.value) onMid(px)
})

// --- data ---
let requestSeq = 0
async function load() {
  if (!market.value || range.value.live) return
  const seq = ++requestSeq
  const r = range.value
  if (!candles.value.length) status.value = 'loading'
  try {
    const now = Date.now()
    const rows = await fetchCandleSnapshot(market.value.coin, r.interval, r.span ? now - r.span : 0, now)
    if (seq !== requestSeq) return // a newer request (range switch) superseded this one
    let list = (rows || [])
      .map((row) => ({ t: row.t, o: Number(row.o), h: Number(row.h), l: Number(row.l), c: Number(row.c) }))
      .filter((row) => [row.o, row.h, row.l, row.c].every(Number.isFinite))
    let ms = r.intervalMs
    let trailing = 0
    if (r.slots) {
      const last = list[list.length - 1]
      if (last) trailing = Math.min(r.slots - 1, Math.max(0, Math.floor((now - last.t) / ms) - 1))
      list = list.slice(-(r.slots - trailing))
    } else if (list.length > ALL_FOLD_ABOVE) { list = foldToWeeks(list); ms = WEEK }
    candles.value = list
    candleMs.value = ms
    trailingSlots.value = trailing
    status.value = 'ready'
  } catch (e) {
    if (seq !== requestSeq) return
    console.error('[market] candle load failed:', e)
    // Keep showing the last good candles on a failed refresh.
    status.value = candles.value.length ? 'ready' : 'error'
  }
}

/** Daily candles → weekly ones (Monday-aligned, like Hyperliquid's own 1w candles). */
function foldToWeeks(daily) {
  const weeks = new Map()
  for (const c of daily) {
    const d = new Date(c.t)
    const dow = (d.getUTCDay() + 6) % 7 // Monday = 0
    const key = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow)
    const w = weeks.get(key)
    if (!w) weeks.set(key, { t: key, o: c.o, h: c.h, l: c.l, c: c.c })
    else { w.h = Math.max(w.h, c.h); w.l = Math.min(w.l, c.l); w.c = c.c }
  }
  return [...weeks.values()]
}

// --- live ---
// One socket for the page: `bbo` (best bid/ask on every change) feeds the
// 1s candles, and a `candle` subscription for the range on screen moves its
// newest candle on every trade. The 15 s REST refresh stays as the backstop.
const MAX_RECONNECT_DELAY_MS = 30_000
const PING_INTERVAL_MS = 30_000
const liveConnected = ref(false)
let ws = null
let pingTimer = null
let reconnectTimer = null
let reconnectDelay = 1000
let unmounted = false
let candleSub = null // interval the socket is subscribed to

// 1s candles, kept from the moment the chart opens whatever range is shown,
// so switching to 1s has the last couple of minutes ready.
let secCandles = []
let lastMid = null
let secTimer = null
const SEC_SLOTS = RANGES[0].slots

function onMid(mid, now = Date.now()) {
  if (!Number.isFinite(mid) || mid <= 0) return
  lastMid = mid
  const bucket = Math.floor(now / 1000) * 1000
  let last = secCandles[secCandles.length - 1]
  if (last && bucket > last.t) {
    // Quiet seconds are flat candles at the price that stood through them.
    const from = Math.max(last.t + 1000, bucket - (SEC_SLOTS - 1) * 1000)
    for (let t = from; t < bucket; t += 1000) secCandles.push({ t, o: last.c, h: last.c, l: last.c, c: last.c })
  }
  if (!last || bucket > last.t) {
    const open = last ? last.c : mid
    secCandles.push({ t: bucket, o: open, h: Math.max(open, mid), l: Math.min(open, mid), c: mid })
  } else {
    last.h = Math.max(last.h, mid)
    last.l = Math.min(last.l, mid)
    last.c = mid
  }
  if (secCandles.length > SEC_SLOTS) secCandles = secCandles.slice(-SEC_SLOTS)
  if (range.value.live) showSeconds()
}

function showSeconds() {
  candles.value = secCandles.map((c) => ({ ...c }))
  candleMs.value = 1000
  trailingSlots.value = 0
  if (candles.value.length) status.value = 'ready'
}

// A `candle` push for the range on screen: the same candle again (a trade
// moved it) or the next one opening.
function onCandle(row) {
  const r = range.value
  if (r.live || row.i !== r.interval || row.s !== market.value?.coin) return
  const c = { t: row.t, o: Number(row.o), h: Number(row.h), l: Number(row.l), c: Number(row.c) }
  if (![c.o, c.h, c.l, c.c].every(Number.isFinite)) return
  const list = candles.value
  const last = list[list.length - 1]
  if (candleMs.value !== r.intervalMs) {
    // "all" folded into weeks: the day's candle only moves the week's.
    if (last) candles.value = [...list.slice(0, -1), { ...last, h: Math.max(last.h, c.h), l: Math.min(last.l, c.l), c: c.c }]
  } else if (last && c.t === last.t) {
    candles.value = [...list.slice(0, -1), c]
  } else if (!last || c.t > last.t) {
    candles.value = r.slots ? [...list, c].slice(-r.slots) : [...list, c]
    trailingSlots.value = 0
    status.value = 'ready'
  }
}

function wsSend(msg) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

function syncCandleSub() {
  const coin = market.value?.coin
  if (!coin || ws?.readyState !== WebSocket.OPEN) return
  const want = range.value.interval ?? null
  if (want === candleSub) return
  if (candleSub) wsSend({ method: 'unsubscribe', subscription: { type: 'candle', coin, interval: candleSub } })
  if (want) wsSend({ method: 'subscribe', subscription: { type: 'candle', coin, interval: want } })
  candleSub = want
}

function openSocket() {
  const coin = market.value?.coin
  if (unmounted || !coin) return
  try {
    ws = new WebSocket(HL_WS_URL)
  } catch (e) {
    console.error('[market] chart ws unavailable:', e)
    return
  }
  ws.onopen = () => {
    reconnectDelay = 1000
    liveConnected.value = true
    candleSub = null
    wsSend({ method: 'subscribe', subscription: { type: 'bbo', coin } })
    syncCandleSub()
    pingTimer = setInterval(() => wsSend({ method: 'ping' }), PING_INTERVAL_MS)
  }
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      if (msg?.channel === 'bbo' && msg.data?.coin === coin) {
        const [bid, ask] = msg.data.bbo || []
        if (bid && ask) onMid((Number(bid.px) + Number(ask.px)) / 2)
      } else if (msg?.channel === 'candle' && msg.data) {
        onCandle(msg.data)
      }
    } catch (e) {
      console.error('[market] chart ws message parse failed:', e)
    }
  }
  ws.onclose = () => {
    liveConnected.value = false
    clearInterval(pingTimer)
    if (unmounted) return
    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS)
      openSocket()
    }, reconnectDelay)
  }
  ws.onerror = () => {
    try { ws?.close() } catch { /* onclose reconnects */ }
  }
}

function closeSocket() {
  clearTimeout(reconnectTimer)
  clearInterval(pingTimer)
  if (ws) {
    ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null
    try { ws.close() } catch { /* already closed */ }
    ws = null
  }
  liveConnected.value = false
}

watch(rangeId, () => {
  candles.value = []
  trailingSlots.value = 0
  hoverIndex.value = null
  syncCandleSub()
  if (range.value.live) {
    status.value = 'loading'
    showSeconds()
  } else load()
})

// --- layout ---
const chartEl = ref(null)
const width = ref(0)
let resizeObserver = null

const plotW = computed(() => Math.max(0, width.value - AXIS_W))
// Fixed ranges keep their slot count so a young market visibly starts
// mid-chart; "all" sizes to what it has.
const slotCount = computed(() => Math.max(range.value.slots, candles.value.length + trailingSlots.value, MIN_SLOTS))
// Leading empty slots: a young market starts mid-chart.
const leadingSlots = computed(() => slotCount.value - candles.value.length - trailingSlots.value)
const step = computed(() => plotW.value / slotCount.value)
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

// Candles are right-aligned (less the trailing gap since the last trade)
// so a thinly traded pair with few candles still ends at the latest price.
const drawn = computed(() => {
  if (!priceRange.value) return []
  const offset = leadingSlots.value
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
  const every = Math.ceil(slotCount.value / 4)
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
  const i = Math.floor(x / step.value) - leadingSlots.value
  hoverIndex.value = Math.max(0, Math.min(list.length - 1, i))
}

const hovered = computed(() => (hoverIndex.value != null ? drawn.value[hoverIndex.value] ?? null : null))
const readout = computed(() => hovered.value ?? candles.value[candles.value.length - 1] ?? null)

// --- formatting ---
function formatPrice(value) {
  if (value == null) return '—'
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

// The readout names the candle exactly; axis labels say only what changes
// across the range: the hour within a day, the day within months, the month
// within a year or more.
function formatCandleTime(ms, full) {
  const d = new Date(ms)
  const date = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  if (full) {
    if (candleMs.value >= DAY) return date
    if (candleMs.value < 60_000) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    return `${date} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
  }
  if (candleMs.value < 60_000) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const first = candles.value[0]?.t ?? ms
  const span = Date.now() - first
  if (span <= DAY + HOUR) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (span >= 300 * DAY) return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
  return date
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
  openSocket()
  // Closes each second's candle on time, ticks or no ticks.
  secTimer = setInterval(() => {
    if (lastMid != null) onMid(lastMid)
  }, 1000)
})

onUnmounted(() => {
  requestSeq++
  unmounted = true
  clearInterval(refreshTimer)
  clearInterval(secTimer)
  closeSocket()
  resizeObserver?.disconnect()
})
</script>

<style scoped>
.range-strip {
  scrollbar-width: none;
}
.range-strip::-webkit-scrollbar {
  display: none;
}
</style>
