<!-- What the app shows while it is shrunk into Android's floating
     picture-in-picture window (lib/pip.js): the pairs the user picked for it
     (NAV/USDC …) with their live price and 24h change, nothing else — no balances, so it
     is safe on top of other apps and over a locked wallet. Sized in a unit that
     scales with the window (pipLayout); tapping the window is handled by the system
     (it expands back into the app). -->
<template>
  <!-- --u: the layout unit, as large as lets the w × h content box fit the window -->
  <div
    class="fixed inset-0 z-[1000] flex items-center justify-center bg-white dark:bg-gh-900 overflow-hidden"
    :style="{ '--u': `min(100vw / ${layout.w}, 100vh / ${layout.h})` }"
  >
    <!-- One to three pairs: pair and 24h change on one line, the price below -->
    <div v-if="layout.stacked" class="flex flex-col justify-center" :style="{ width: u(layout.w), height: u(layout.h), padding: `0 ${u(7)}` }">
      <div v-for="m in rows" :key="m.pair" class="flex flex-col justify-center shrink-0" :style="{ height: u(44) }">
        <div class="flex items-baseline justify-between whitespace-nowrap" :style="{ gap: u(2) }">
          <span class="font-bold text-gray-900 dark:text-white" :style="{ fontSize: u(10) }">
            {{ m.base }}<span class="font-normal text-gray-400 dark:text-gray-500" :style="{ fontSize: u(6.5) }">/{{ m.quote }}</span>
          </span>
          <span class="font-semibold tabular-nums" :class="changeClass(m.ticker?.change24h)" :style="{ fontSize: u(7.5) }">{{ formatChange(m.ticker?.change24h) }}</span>
        </div>
        <span class="font-mono font-semibold tabular-nums text-gray-900 dark:text-white whitespace-nowrap" :style="{ fontSize: u(14), lineHeight: 1.3 }">{{ formatPrice(m.ticker?.price) }}</span>
      </div>
    </div>

    <!-- Four or more: one line each -->
    <div v-else class="flex flex-col justify-center" :style="{ width: u(layout.w), height: u(layout.h), padding: `0 ${u(4)}` }">
      <div
        v-for="m in rows"
        :key="m.pair"
        class="flex items-center justify-between shrink-0"
        :style="{ height: u(15), gap: u(2) }"
      >
        <span class="font-bold text-gray-900 dark:text-white whitespace-nowrap" :style="{ fontSize: u(6) }">
          {{ m.base }}<span class="font-normal text-gray-400 dark:text-gray-500" :style="{ fontSize: u(4) }">/{{ m.quote }}</span>
        </span>
        <span class="flex items-baseline min-w-0" :style="{ gap: u(2.5) }">
          <span class="font-mono font-semibold tabular-nums text-gray-900 dark:text-white" :style="{ fontSize: u(6) }">{{ formatPrice(m.ticker?.price) }}</span>
          <span class="font-semibold tabular-nums text-right" :class="changeClass(m.ticker?.change24h)" :style="{ fontSize: u(4.5), minWidth: u(17) }">{{ formatChange(m.ticker?.change24h) }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { settings } from '@/stores/settings'
import { HL_SPOT_MARKETS } from '@/lib/hyperliquid/market'
import { useHyperliquidSpotTickers } from '@/composables/useHyperliquidSpotTickers'
import { pipLayout } from '@/lib/pip'

// The user's pick (the sheet behind "Floating prices"); drops keys no longer in HL_SPOT_MARKETS.
const pairs = computed(() => settings.pipPairs.filter((p) => HL_SPOT_MARKETS[p]))

// Pair index per pair key, resolved from spotMeta — never hardcoded.
const pairIndexByKey = ref({})
watch(pairs, (list) => {
  for (const pair of list) {
    if (pair in pairIndexByKey.value) continue
    HL_SPOT_MARKETS[pair].resolver()
      .then((r) => { pairIndexByKey.value = { ...pairIndexByKey.value, [pair]: r?.pairIndex ?? null } })
      .catch((e) => console.error(`[pip] failed to resolve ${pair} market:`, e))
  }
}, { immediate: true })

const tickerIndices = computed(() => pairs.value.map((p) => pairIndexByKey.value[p]).filter((i) => i != null))
const { tickers } = useHyperliquidSpotTickers(tickerIndices)

const layout = computed(() => pipLayout(pairs.value.length))
const u = (n) => `calc(var(--u) * ${n})`

const rows = computed(() => pairs.value.map((pair) => ({
  pair,
  base: HL_SPOT_MARKETS[pair].base,
  quote: HL_SPOT_MARKETS[pair].quote,
  ticker: tickers.value[pairIndexByKey.value[pair]] ?? null,
})))

// Kept short: the window is narrow, so big prices drop their decimals.
function formatPrice(value) {
  if (value == null) return '—'
  const digits = value >= 10_000 ? 0 : value >= 100 ? 2 : value >= 1 ? 3 : 5
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: Math.min(2, digits), maximumFractionDigits: digits })
}
function formatChange(value) {
  if (value == null) return ''
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}
function changeClass(value) {
  if (value == null) return 'text-gray-400 dark:text-gray-500'
  return value >= 0 ? 'text-buy' : 'text-sell'
}
</script>
