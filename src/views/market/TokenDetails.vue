<!-- Everything known about the base token of a Hyperliquid spot market —
     reached from the market screen's header. Exchange facts come from
     tokenDetails (supply, deployer, genesis), the holder count from
     Hypurrscan, the price from the same live ticker the market screen
     shows, and the project links from config.js. -->
<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">
    <div class="flex items-center gap-3 px-5 pt-5 pb-4">
      <button
        @click="router.back()"
        class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400"
      >
        <ChevronLeft class="w-5 h-5" />
      </button>
      <TokenIcon v-if="symbol" :symbol="symbol" :logo="logo" :size="32" />
      <div class="flex-1 min-w-0">
        <h1 class="text-lg font-bold leading-tight text-gray-900 dark:text-white truncate">{{ displayName }}</h1>
        <p class="text-[11px] leading-tight text-gray-400 dark:text-gray-500 truncate">
          {{ symbol }} · {{ $t('market.token.title') }}
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
      <!-- MARKET: live price and what the supply is worth at it -->
      <section class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4">
        <div class="flex items-end justify-between gap-3">
          <div>
            <p class="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">{{ $t('market.token.price') }}</p>
            <p class="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
              {{ formatPrice(price) }}
              <span class="text-xs font-medium text-gray-400 dark:text-gray-500">{{ market.quoteSymbol }}</span>
            </p>
          </div>
          <span
            v-if="ticker?.change24h != null"
            class="px-2 py-1 rounded-md text-xs font-semibold text-white tabular-nums"
            :class="ticker.change24h >= 0 ? 'bg-buy' : 'bg-sell'"
          >
            {{ ticker.change24h > 0 ? '+' : '' }}{{ ticker.change24h.toFixed(2) }}%
          </span>
        </div>
        <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          <Fact :label="$t('market.token.volume24h')" :value="ticker?.volume24h != null ? formatUsd(ticker.volume24h) : null" />
          <Fact :label="$t('market.token.marketCap')" :value="marketCap != null ? formatUsd(marketCap) : null" />
          <Fact :label="$t('market.token.fdv')" :value="fdv != null ? formatUsd(fdv) : null" />
          <Fact :label="$t('market.token.holders')" :value="holders ? formatInt(holders.count) : null" :pending="holdersLoading" />
        </dl>
      </section>

      <!-- Details failed: everything below needs them -->
      <div v-if="detailsError" class="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 flex items-center justify-between gap-3">
        <p class="text-sm text-red-700 dark:text-red-300 leading-snug">{{ $t('market.token.loadError') }}</p>
        <button @click="loadDetails" class="shrink-0 text-sm font-semibold text-red-700 dark:text-red-300">{{ $t('market.chartRetry') }}</button>
      </div>

      <div v-else-if="!details" class="py-8 flex justify-center text-gray-400 dark:text-gray-500">
        <Loader2 class="w-6 h-6 animate-spin opacity-60" />
      </div>

      <template v-else>
        <!-- SUPPLY -->
        <section class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4 space-y-3">
          <h2 class="text-sm font-bold text-gray-900 dark:text-white">{{ $t('market.token.supply') }}</h2>
          <!-- Issuer-held tokens (the bridge's unissued NAV) aren't out
               among people: when the issuer still sits on most of the
               supply, the bar is what has actually been issued. -->
          <div v-if="issued">
            <div class="h-2 rounded-full bg-gray-100 dark:bg-gh-700 overflow-hidden">
              <div class="h-full rounded-full bg-blue-500" :style="{ width: `${Math.max(0.5, Math.min(100, issued.pct))}%` }" />
            </div>
            <p class="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
              {{ $t('market.token.issuedPct', { pct: issued.pct.toFixed(issued.pct < 10 ? 2 : 1) }) }}
            </p>
          </div>
          <div v-else-if="circulatingPct != null">
            <div class="h-2 rounded-full bg-gray-100 dark:bg-gh-700 overflow-hidden">
              <div class="h-full rounded-full bg-blue-500" :style="{ width: `${Math.min(100, circulatingPct)}%` }" />
            </div>
            <p class="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
              {{ $t('market.token.circulatingPct', { pct: circulatingPct.toFixed(circulatingPct >= 99.99 ? 2 : 1) }) }}
            </p>
          </div>
          <dl class="grid grid-cols-1 gap-y-2.5">
            <template v-if="issued">
              <Row :label="$t('market.token.issued')" :value="formatAmount(issued.amount)" :unit="symbol" />
              <Row :label="$t('market.token.issuerReserve')" :value="formatAmount(issued.reserve)" :unit="symbol" />
            </template>
            <Row :label="$t('market.token.circulating')" :value="formatAmount(details.circulatingSupply)" :unit="symbol" />
            <Row :label="$t('market.token.totalSupply')" :value="formatAmount(details.totalSupply)" :unit="symbol" />
            <Row :label="$t('market.token.maxSupply')" :value="formatAmount(details.maxSupply)" :unit="symbol" />
            <Row
              v-if="nonCirculating.count && nonCirculating.amount >= 1e-8"
              :label="$t('market.token.nonCirculating')"
              :value="$t('market.token.nonCirculatingValue', { n: nonCirculating.count, amount: formatAmount(nonCirculating.amount) })"
              :unit="symbol"
            />
            <Row v-if="Number(details.futureEmissions) > 0" :label="$t('market.token.futureEmissions')" :value="formatAmount(details.futureEmissions)" :unit="symbol" />
          </dl>
        </section>

        <!-- HOLDERS -->
        <section class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4 space-y-2">
          <h2 class="text-sm font-bold text-gray-900 dark:text-white">{{ $t('market.token.holders') }}</h2>
          <template v-if="holders">
            <p class="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{{ formatInt(holders.count) }}</p>
            <p class="text-[11px] text-gray-400 dark:text-gray-500">
              {{ $t('market.token.holdersSource') }}<template v-if="holders.updatedAt"> · {{ $t('market.token.holdersUpdated', { time: formatRelative(holders.updatedAt) }) }}</template>
            </p>
          </template>
          <p v-else-if="holdersLoading" class="text-sm text-gray-400 dark:text-gray-500">{{ $t('common.loading') }}</p>
          <p v-else class="text-sm text-gray-400 dark:text-gray-500">{{ $t('market.token.holdersUnavailable') }}</p>
          <a
            :href="`${HYPURRSCAN_URL}/token/${market.baseTokenName}`"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400"
          >
            {{ $t('market.token.viewHolders') }}
            <ExternalLink class="w-3.5 h-3.5" />
          </a>
        </section>

        <!-- ISSUER: who mints this on Hyperliquid -->
        <section v-if="links.issuer" class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4 space-y-1.5">
          <h2 class="text-sm font-bold text-gray-900 dark:text-white">
            {{ links.issuer === 'unit' ? $t('market.token.issuerUnit') : $t('market.wrappedNav.title') }}
          </h2>
          <template v-if="links.issuer === 'unit'">
            <p class="text-xs text-gray-500 dark:text-gray-400 leading-snug">{{ $t('market.token.issuerUnitDesc', { symbol }) }}</p>
            <a :href="UNIT_URL" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
              hyperunit.xyz <ExternalLink class="w-3.5 h-3.5" />
            </a>
          </template>
          <template v-else>
            <p class="text-xs text-gray-500 dark:text-gray-400 leading-snug">{{ $t('market.wrappedNav.what') }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 leading-snug">{{ $t('market.wrappedNav.bridge') }}</p>
          </template>
        </section>

        <!-- ON HYPERLIQUID: the exchange's own record of the token -->
        <section class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4 space-y-3">
          <h2 class="text-sm font-bold text-gray-900 dark:text-white">{{ $t('market.token.onHyperliquid') }}</h2>
          <dl class="grid grid-cols-1 gap-y-2.5">
            <Row :label="$t('market.token.created')" :value="formatDate(details.deployTime)" />
            <Row :label="$t('market.token.name')" :value="details.name" />
            <Row :label="$t('market.token.tokenId')" :value="shortHex(market.baseTokenId)" :copy="market.baseTokenId" :copied="copied === market.baseTokenId" @copy="copy" />
            <Row :label="$t('market.token.deployer')" :value="shortHex(details.deployer)" :copy="details.deployer" :copied="copied === details.deployer" @copy="copy" />
            <Row :label="$t('market.token.market')" :value="`${market.baseSymbol}/${market.quoteSymbol} · #${market.pairIndex}`" />
            <Row :label="$t('market.token.decimals')" :value="$t('market.token.decimalsValue', { sz: details.szDecimals, wei: details.weiDecimals })" />
            <Row v-if="Number(details.deployGas) > 0" :label="$t('market.token.deployGas')" :value="formatAmount(details.deployGas)" />
            <Row v-if="Number(details.seededUsdc) > 0" :label="$t('market.token.seededUsdc')" :value="formatAmount(details.seededUsdc)" unit="USDC" />
            <Row :label="$t('market.token.genesis')" :value="$t('market.token.genesisValue', { n: genesisCount })" />
            <Row v-if="blacklistCount" :label="$t('market.token.blacklist')" :value="formatInt(blacklistCount)" />
          </dl>
        </section>

        <!-- LINKS -->
        <section class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4 space-y-1">
          <h2 class="text-sm font-bold text-gray-900 dark:text-white mb-2">{{ $t('market.token.links') }}</h2>
          <a
            v-for="l in linkRows"
            :key="l.href"
            :href="l.href"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center justify-between gap-3 py-2 text-sm text-gray-700 dark:text-gray-200"
          >
            <span class="flex items-center gap-2.5 min-w-0">
              <component :is="l.icon" class="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
              <span class="truncate">{{ l.label }}</span>
            </span>
            <span class="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 shrink-0">
              {{ l.host }}
              <ExternalLink class="w-3.5 h-3.5" />
            </span>
          </a>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, Loader2, ExternalLink, Globe, BookOpen, Github, Search, ChartCandlestick, Copy, Check, Twitter } from 'lucide-vue-next'
import TokenIcon from '@/components/TokenIcon.vue'
import { HL_SPOT_MARKETS } from '@/lib/hyperliquid/market'
import { fetchTokenDetails, fetchSpotClearinghouseState } from '@/lib/hyperliquid/api'
import { fetchHolderCount } from '@/lib/hyperliquid/holders'
import { HL_LOGOS, HL_NAMES, HL_TOKEN_LINKS, HL_APP_URL, HL_EXPLORER_URL, HYPURRSCAN_URL, UNIT_URL } from '@/lib/hyperliquid/config'
import { useHyperliquidSpotTickers } from '@/composables/useHyperliquidSpotTickers'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()

// A label/value pair in a two-column grid (the market card).
const Fact = (props) => h('div', { class: 'min-w-0' }, [
  h('dt', { class: 'text-[11px] text-gray-400 dark:text-gray-500 truncate' }, props.label),
  h('dd', { class: 'text-sm font-semibold tabular-nums text-gray-900 dark:text-white truncate' },
    props.value ?? (props.pending ? '…' : '—')),
])
Fact.props = ['label', 'value', 'pending']

// A label/value line (the other cards), optionally with a copy button.
const Row = (props, { emit }) => h('div', { class: 'flex items-start justify-between gap-3' }, [
  h('dt', { class: 'text-xs text-gray-500 dark:text-gray-400 shrink-0 pt-0.5' }, props.label),
  h('dd', { class: 'text-xs font-medium tabular-nums text-right text-gray-900 dark:text-white min-w-0 flex items-center gap-1.5' }, [
    h('span', { class: 'break-all' }, [props.value ?? '—', props.unit ? h('span', { class: 'text-gray-400 dark:text-gray-500 font-normal' }, ` ${props.unit}`) : null]),
    props.copy
      ? h('button', { class: 'shrink-0 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200', 'aria-label': t('market.token.copy'), onClick: () => emit('copy', props.copy) },
          [h(props.copied ? Check : Copy, { class: props.copied ? 'w-3.5 h-3.5 text-buy' : 'w-3.5 h-3.5' })])
      : null,
  ]),
])
Row.props = ['label', 'value', 'unit', 'copy', 'copied']
Row.emits = ['copy']

const pairKey = computed(() => String(route.params.pair))
const symbol = computed(() => HL_SPOT_MARKETS[pairKey.value]?.base ?? '')
const logo = computed(() => HL_LOGOS[symbol.value] ?? null)
const displayName = computed(() => HL_NAMES[symbol.value] ?? symbol.value ?? t('market.token.title'))
const links = computed(() => HL_TOKEN_LINKS[symbol.value] ?? {})

const marketNotFound = ref(false)
const market = ref(null) // resolveSpotMarket() result: coin, pairIndex, pairName, baseTokenName, baseTokenId, …
const details = ref(null)
const detailsError = ref(false)
const holders = ref(null)
const holdersLoading = ref(false)
const issuerReserve = ref(null) // what the genesis recipient(s) still hold, once looked up

const tickerIndices = computed(() => (market.value ? [market.value.pairIndex] : []))
const { tickers } = useHyperliquidSpotTickers(tickerIndices)
const ticker = computed(() => tickers.value[market.value?.pairIndex] ?? null)
// Live mid when the ticker has it, the exchange's own mark otherwise.
const price = computed(() => ticker.value?.price ?? num(details.value?.midPx ?? details.value?.markPx))

const marketCap = computed(() => mul(price.value, details.value?.circulatingSupply))
const fdv = computed(() => mul(price.value, details.value?.maxSupply))
const circulatingPct = computed(() => {
  const max = num(details.value?.maxSupply)
  const circ = num(details.value?.circulatingSupply)
  return max > 0 && circ != null ? (circ / max) * 100 : null
})
const nonCirculating = computed(() => {
  const rows = details.value?.nonCirculatingUserBalances ?? []
  return { count: rows.length, amount: rows.reduce((sum, [, amt]) => sum + (num(amt) ?? 0), 0) }
})
// Shown only while the genesis recipient(s) still hold most of the supply:
// that is an issuer's reserve (the NAV bridge's undeposited NAV), not tokens
// in people's hands. A token whose genesis went out wide (HYPE), or whose
// deployer passed it on (Unit's), has no such reserve to subtract.
const issued = computed(() => {
  const total = num(details.value?.totalSupply)
  const reserve = issuerReserve.value
  if (total == null || reserve == null || reserve < total / 2) return null
  const amount = Math.max(0, total - reserve)
  return { amount, reserve, pct: (amount / total) * 100 }
})
const genesisCount = computed(() => (details.value?.genesis?.userBalances?.length ?? 0) + (details.value?.genesis?.existingTokenBalances?.length ?? 0))
const blacklistCount = computed(() => details.value?.genesis?.blacklistUsers?.length ?? 0)

const linkRows = computed(() => {
  const l = links.value
  const m = market.value
  const rows = [
    l.website && { href: l.website, label: t('market.token.website'), icon: Globe },
    l.x && { href: l.x, label: 'X', icon: Twitter },
    l.docs && { href: l.docs, label: t('market.token.docs'), icon: BookOpen },
    l.github && { href: l.github, label: 'GitHub', icon: Github },
    l.explorer && { href: l.explorer, label: t('market.token.nativeExplorer', { name: displayName.value }), icon: Search },
    m && { href: `${HL_EXPLORER_URL}/token/${m.baseTokenId}`, label: t('market.token.hlExplorer'), icon: Search },
    m && { href: `${HYPURRSCAN_URL}/token/${m.baseTokenName}`, label: 'Hypurrscan', icon: Search },
    m && { href: `${HL_APP_URL}/trade/${m.baseTokenName}/${m.quoteSymbol}`, label: t('market.token.tradeOnHl'), icon: ChartCandlestick },
  ].filter(Boolean)
  return rows.map((r) => ({ ...r, host: new URL(r.href).host.replace(/^www\./, '') }))
})

function num(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function mul(a, b) {
  const x = num(a)
  const y = num(b)
  return x != null && y != null ? x * y : null
}

function formatPrice(value) {
  if (value == null) return '—'
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}
function formatUsd(value) {
  return Number(value).toLocaleString(undefined, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 })
}
function formatInt(value) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })
}
function formatAmount(value) {
  const n = num(value)
  if (n == null) return '—'
  return n.toLocaleString(undefined, { maximumFractionDigits: n >= 1000 ? 0 : 4 })
}
// tokenDetails' deployTime is UTC with nanoseconds and no zone suffix.
function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(`${String(iso).slice(0, 23)}Z`)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
function formatRelative(ms) {
  const diffMin = Math.round((ms - Date.now()) / 60_000)
  const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute')
  if (Math.abs(diffMin) < 60 * 48) return rtf.format(Math.round(diffMin / 60), 'hour')
  return rtf.format(Math.round(diffMin / (60 * 24)), 'day')
}
function shortHex(hex) {
  if (!hex) return '—'
  return hex.length > 18 ? `${hex.slice(0, 10)}…${hex.slice(-8)}` : hex
}

const copied = ref(null)
let copiedTimer = null
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = text
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { copied.value = null }, 1500)
  } catch (e) {
    console.error('[token] copy failed:', e)
  }
}

async function loadDetails() {
  detailsError.value = false
  try {
    details.value = await fetchTokenDetails(market.value.baseTokenId)
    loadIssuerReserve()
  } catch (e) {
    console.error('[token] token details failed:', e)
    detailsError.value = true
  }
}

// Up to three genesis recipients' current balance of the token; more than
// that is a distribution, not an issuer.
async function loadIssuerReserve() {
  const d = details.value
  const recipients = (d?.genesis?.userBalances ?? []).map(([addr]) => addr)
  if (!recipients.length || recipients.length > 3) return
  try {
    const states = await Promise.all(recipients.map((addr) => fetchSpotClearinghouseState(addr)))
    issuerReserve.value = states.reduce((sum, st) => {
      const bal = st?.balances?.find((b) => b.coin === d.name)
      return sum + (num(bal?.total) ?? 0)
    }, 0)
  } catch (e) {
    console.error('[token] issuer reserve lookup failed:', e)
  }
}

async function loadHolders() {
  holdersLoading.value = true
  try {
    holders.value = await fetchHolderCount(market.value.baseTokenName)
  } finally {
    holdersLoading.value = false
  }
}

onMounted(async () => {
  const resolver = HL_SPOT_MARKETS[pairKey.value]?.resolver
  try {
    const resolved = resolver ? await resolver() : null
    if (!resolved) marketNotFound.value = true
    else market.value = resolved
  } catch (e) {
    console.error('[token] failed to resolve market:', e)
    marketNotFound.value = true
  }
  if (!market.value) return
  loadDetails()
  loadHolders()
})
</script>
