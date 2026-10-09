<!-- Swap: from, to, amount — nothing else. Where the NAV currently sits and
     what has to happen to it (move to the exchange, one-time setup, move
     back to the wallet) is worked out by lib/intent/router.js and shown on
     the review sheet as an outcome, with the route behind "Details". -->
<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">
    <div class="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('swap.title') }}</h1>
      <button
        @click="router.push(`/market/hl/${advancedPair}`)"
        class="text-xs font-medium text-blue-600 dark:text-blue-400"
      >
        {{ $t('swap.advanced') }}
      </button>
    </div>

    <div v-if="derivationError" class="mx-5 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4">
      <p class="text-sm text-red-700 dark:text-red-300 leading-snug">{{ derivationError }}</p>
    </div>

    <div v-else class="px-5 pb-6 space-y-4">
      <OperationCard v-for="op in operations" :key="op.id" :op="op" />

      <div class="space-y-1.5">
        <AmountField
          v-model="amountInput"
          :label="$t('swap.from')"
          :symbol="from"
          :logo="HL_LOGOS[from]"
          :balance="state ? fromBalance : null"
          :fiat="fromFiat"
          selectable
          @pick="picking = 'from'"
          @max="setMax"
        />

        <div class="flex justify-center -my-3.5 relative z-[1]">
          <button
            @click="flip"
            :aria-label="$t('swap.flip')"
            class="w-9 h-9 rounded-full flex items-center justify-center bg-white dark:bg-gh-800 border border-gray-200 dark:border-gh-600 text-gray-500 dark:text-gray-400"
          >
            <ArrowDownUp class="w-4 h-4" />
          </button>
        </div>

        <AmountField
          :model-value="quote && !quote.error ? `≈ ${formatAmount(quote.estReceive)}` : ''"
          :label="$t('swap.to')"
          :symbol="to"
          :logo="HL_LOGOS[to]"
          readonly
          selectable
          @pick="picking = 'to'"
        />
      </div>

      <p v-if="quote && !quote.error" class="text-xs text-gray-500 dark:text-gray-400 text-center tabular-nums">
        {{ rateLabel }}
      </p>

      <!-- The one choice left to the user, and only when it applies -->
      <label v-if="to === 'NAV'" class="flex items-center justify-between gap-3 rounded-2xl bg-white dark:bg-gh-800 border border-gray-200 dark:border-gh-700 px-4 py-3">
        <span class="min-w-0">
          <span class="block text-sm font-medium text-gray-800 dark:text-gray-200">{{ $t('swap.toWallet') }}</span>
          <span class="block text-xs text-gray-400 dark:text-gray-500 leading-snug">{{ $t('swap.toWalletDesc') }}</span>
        </span>
        <button
          type="button"
          role="switch"
          :aria-checked="deliverToWallet"
          @click="deliverToWallet = !deliverToWallet"
          :class="deliverToWallet ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gh-600'"
          class="relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
        >
          <span :class="deliverToWallet ? 'translate-x-5' : 'translate-x-0'" class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200" />
        </button>
      </label>

      <p v-if="walletHint && !problem" class="text-xs text-gray-500 dark:text-gray-400 leading-snug">{{ walletHint }}</p>

      <p v-if="problem" class="rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300 leading-snug">
        {{ problem }}
      </p>

      <button
        @click="showReview = true"
        :disabled="!plan || !!plan.blocker || busyOperation"
        class="w-full py-3.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Loader2 v-if="loading && amount > 0" class="w-4 h-4 animate-spin" />
        {{ amount > 0 ? $t('tx.review') : $t('tx.enterAmount') }}
      </button>
    </div>

    <AssetPickerSheet
      :open="!!picking"
      :title="picking === 'from' ? $t('swap.from') : $t('swap.to')"
      :assets="pickerAssets"
      :selected="picking === 'from' ? from : to"
      @select="onPick"
      @close="picking = null"
    />

    <ReviewSheet
      v-if="plan && quote && !quote.error"
      :open="showReview"
      :title="$t('swap.reviewTitle')"
      :from="{ amount: quote.fixedReceive ? `≈ ${formatAmount(quote.estSend)}` : formatAmount(plan.send, 8), symbol: from, logo: HL_LOGOS[from] }"
      :to="{ amount: formatAmount(plan.estReceive), symbol: to, logo: HL_LOGOS[to], approx: !quote.fixedReceive }"
      :rows="reviewRows"
      :notices="reviewNotices"
      :details="reviewDetails"
      :details-label="$t('swap.route')"
      :confirm-label="$t('swap.confirm')"
      @confirm="confirm"
      @close="showReview = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowDownUp, Loader2 } from 'lucide-vue-next'
import { settings } from '@/stores/settings'
import { evmAddress } from '@/stores/evm'
import { balance, receiveAddress, getNavioClient } from '@/stores/navio'
import { operations, activeOperations, startOperation } from '@/stores/operations'
import { deriveEvmAddress } from '@/composables/useEvmAccount'
import { HL_LOGOS, HL_NAMES } from '@/lib/hyperliquid/config'
import { HL_SPOT_MARKETS } from '@/lib/hyperliquid/market'
import { readAccountState, readBooks, readTakerFeeRate } from '@/lib/intent/executors'
import { quoteSwap, floorTo, toDecimalString } from '@/lib/intent/quote'
import { planSwap, spendable } from '@/lib/intent/router'
import { formatAmount, formatFiatFromUsd } from '@/lib/displayFormat'
import AmountField from '@/components/tx/AmountField.vue'
import AssetPickerSheet from '@/components/tx/AssetPickerSheet.vue'
import ReviewSheet from '@/components/tx/ReviewSheet.vue'
import OperationCard from '@/components/tx/OperationCard.vue'

const route = useRoute()
const router = useRouter()
const { t, te } = useI18n()

// Every asset with a USDC market, plus USDC itself.
const SYMBOLS = ['NAV', 'USDC', ...Object.values(HL_SPOT_MARKETS).map((m) => m.base).filter((s) => s !== 'NAV')]
const BOOK_POLL_MS = 5_000
const STATE_POLL_MS = 60_000
const LAST_PAIR_KEY = 'swapPair'

// Starts from a link's ?from=/?to=, else the pair used last time, else NAV -> USDC.
function initialPair() {
  let saved = []
  try { saved = JSON.parse(localStorage.getItem(LAST_PAIR_KEY) || '[]') } catch {}
  const valid = (s) => SYMBOLS.includes(s)
  const qFrom = String(route.query.from || '').toUpperCase()
  const qTo = String(route.query.to || '').toUpperCase()
  let a = valid(qFrom) ? qFrom : valid(saved[0]) ? saved[0] : 'NAV'
  let b = valid(qTo) ? qTo : valid(saved[1]) && !valid(qFrom) ? saved[1] : a === 'USDC' ? 'NAV' : 'USDC'
  if (a === b) b = a === 'USDC' ? 'NAV' : 'USDC'
  return [a, b]
}
const [initialFrom, initialTo] = initialPair()
const from = ref(initialFrom)
const to = ref(initialTo)
const amountInput = ref('')
const deliverToWallet = ref(true)
const picking = ref(null) // null | 'from' | 'to'
const showReview = ref(false)
const derivationError = ref('')

const state = ref(null) // account snapshot, see executors.js readAccountState()
const books = ref({})
const feeRate = ref(null)
const loadError = ref('')
const loading = ref(false)

const amount = computed(() => {
  const n = Number(amountInput.value)
  return Number.isFinite(n) && n > 0 ? n : 0
})

// The wallet balance is live; the rest of the snapshot is polled.
const liveState = computed(() => state.value && { ...state.value, navWallet: Number(balance.value) || 0 })
// "Available" and Max are what can be swapped right now: the balance on the
// exchange. NAV still in the wallet is not counted here — a larger amount
// can be entered and the router moves the difference over (see walletHint),
// but that takes minutes, so it is never presented as available.
const onExchange = (symbol, state) => (symbol === 'NAV' ? state.navExchange : Number(state.balances?.[symbol] ?? 0))
const fromBalance = computed(() => (liveState.value ? onExchange(from.value, liveState.value) : 0))
// Everything a swap could draw on, wallet included — the real upper limit.
const fromLimit = computed(() => (liveState.value ? spendable(from.value, liveState.value) : 0))
const walletExtra = computed(() => Math.max(0, fromLimit.value - fromBalance.value))
const walletHint = computed(() =>
  from.value === 'NAV' && walletExtra.value >= 1 && !liveState.value.bridgeUnavailable
    ? t('swap.walletHint', { amount: formatAmount(walletExtra.value) })
    : ''
)

const quote = computed(() => {
  if (!(amount.value > 0)) return null
  const needed = [from.value, to.value].filter((s) => s !== 'USDC')
  if (needed.some((s) => !books.value[s])) return null
  return quoteSwap({
    from: from.value,
    to: to.value,
    amount: amount.value,
    books: books.value,
    slippageBps: settings.slippageBps,
    feeRate: feeRate.value,
  })
})

const plan = computed(() => {
  if (!quote.value || quote.value.error || !liveState.value) return null
  return planSwap({
    from: from.value,
    to: to.value,
    quote: quote.value,
    state: liveState.value,
    destination: receiveAddress.value,
    deliverToWallet: deliverToWallet.value,
  })
})

// One operation at a time: a second one would plan against balances the
// first is still about to spend.
const busyOperation = computed(() => activeOperations.value.length > 0)

const problem = computed(() => {
  if (busyOperation.value) return t('swap.errors.busy')
  if (loadError.value) return t('swap.errors.network_error')
  if (!(amount.value > 0)) return ''
  const code = quote.value?.error || plan.value?.blocker
  if (!code) return ''
  const params = { symbol: from.value, available: formatAmount(fromLimit.value), onExchange: formatAmount(liveState.value?.navExchange ?? 0) }
  return te(`swap.errors.${code}`) ? t(`swap.errors.${code}`, params) : t('ops.errors.unknown')
})

// Valued at the market the swap itself uses, so the hint under the amount
// agrees with the rate below it.
const usdOf = (symbol, value) => {
  if (symbol === 'USDC') return value
  const bid = Number(books.value[symbol]?.bids?.[0]?.px)
  return Number.isFinite(bid) ? value * bid : null
}
const fromFiat = computed(() =>
  settings.showFiatValue && amount.value > 0 ? formatFiatFromUsd(usdOf(from.value, amount.value)) : null
)

const rateLabel = computed(() => `1 ${from.value} ≈ ${formatAmount(quote.value.rate)} ${to.value}`)

// The order book screen for whichever non-USDC asset is in play.
const advancedPair = computed(() => `${from.value !== 'USDC' ? from.value : to.value}-USDC`)

const pickerAssets = computed(() =>
  SYMBOLS.map((symbol) => ({
    symbol,
    name: HL_NAMES[symbol] ?? symbol,
    logo: HL_LOGOS[symbol],
    balance: liveState.value ? onExchange(symbol, liveState.value) : 0,
  }))
)

function onPick(symbol) {
  const other = picking.value === 'from' ? to : from
  const mine = picking.value === 'from' ? from : to
  // Picking the asset already on the other side swaps the two.
  if (symbol === other.value) other.value = mine.value
  mine.value = symbol
  picking.value = null
}

function flip() {
  ;[from.value, to.value] = [to.value, from.value]
  amountInput.value = ''
}

function setMax() {
  // Rounded down to what the market can actually trade, so "Max" never
  // leaves the review showing a different amount than was entered.
  const decimals = from.value === 'USDC' ? 6 : books.value[from.value]?.szDecimals ?? 8
  amountInput.value = toDecimalString(floorTo(fromBalance.value, decimals), decimals)
}

// --- Review ---
const reviewRows = computed(() => {
  const p = plan.value
  const q = quote.value
  const rows = [{ label: t('swap.rate'), value: rateLabel.value }]
  const lastLeg = q.legs[q.legs.length - 1]
  if (feeRate.value != null && lastLeg.feeOut != null) {
    rows.push({ label: t('swap.fee'), value: `${formatAmount(lastLeg.feeOut)} ${to.value} (${(feeRate.value * 100).toFixed(3)}%)` })
  }
  rows.push(q.fixedReceive
    ? { label: t('swap.maxSpent'), value: `${formatAmount(q.maxSend)} ${from.value}` }
    : { label: t('swap.minReceived'), value: `${formatAmount(p.minReceive)} ${to.value}` })
  rows.push({
    label: t('swap.arrives'),
    value: p.minutes > 0
      ? t('swap.arrivesMinutes', { minutes: p.minutes })
      : p.deliversToWallet ? t('swap.arrivesWallet') : t('swap.arrivesNow'),
  })
  if (p.setup) {
    rows.push({ label: t('swap.setup'), value: `${formatAmount(p.setup.amountNav)} NAV` })
  }
  return rows
})

const reviewNotices = computed(() => {
  const p = plan.value
  const notices = []
  if (p.leavesWallet > 0) {
    notices.push({ tone: 'info', text: t('swap.notice.leavesWallet', { amount: formatAmount(p.leavesWallet, 8) }) })
  }
  if (p.setup) {
    notices.push({ tone: 'info', text: t('swap.notice.setup', { amount: formatAmount(p.setup.amountNav), usdc: p.setup.usdc, hype: p.setup.hype }) })
  }
  if (p.minutes > 0) notices.push({ tone: 'info', text: t('swap.notice.takesTime', { minutes: p.minutes }) })
  const kept = p.notes.find((n) => n.startsWith('stays_on_exchange:'))
  if (kept) notices.push({ tone: 'warn', text: t(`swap.notice.kept.${kept.split(':')[1]}`) })
  if (quote.value.priceImpact > 0.05) {
    notices.push({ tone: 'warn', text: t('swap.notice.priceImpact', { percent: (quote.value.priceImpact * 100).toFixed(1) }) })
  }
  return notices
})

// The route, in the order it happens — for anyone who wants to see it.
const reviewDetails = computed(() => {
  const lines = []
  for (const step of plan.value.steps) {
    if (step.type === 'faucet') lines.push(t('swap.routeStep.faucet', { amount: formatAmount(step.amountNav) }))
    else if (step.type === 'register') lines.push(t('swap.routeStep.register'))
    else if (step.type === 'deposit') lines.push(t('swap.routeStep.deposit', { amount: formatAmount(step.amount, 8) }))
    else if (step.type === 'order') {
      lines.push(t(`swap.routeStep.${step.side}`, { base: step.base, price: step.limitPx }))
    } else if (step.type === 'burn') lines.push(t('swap.routeStep.burn'))
  }
  if (plan.value.notes.includes('deposit_rounded_up')) lines.push(t('swap.routeStep.roundedUp'))
  lines.push(t('swap.routeStep.slippage', { percent: (settings.slippageBps / 100).toFixed(2) }))
  return lines
})

function confirm() {
  const p = plan.value
  if (!p || p.blocker || busyOperation.value) return
  startOperation(p, { minutes: p.minutes })
  try { localStorage.setItem(LAST_PAIR_KEY, JSON.stringify([from.value, to.value])) } catch {}
  showReview.value = false
  amountInput.value = ''
  refreshState()
}

// --- Data ---
let bookTimer = null
let stateTimer = null
let unmounted = false

async function refreshBooks() {
  const symbols = [from.value, to.value].filter((s) => s !== 'USDC')
  try {
    const fresh = await readBooks(symbols)
    if (!unmounted) books.value = { ...books.value, ...fresh }
    loadError.value = ''
  } catch (e) {
    console.error('[swap] order book refresh failed:', e?.message)
    loadError.value = e?.message || 'network_error'
  }
}

async function refreshState() {
  if (!evmAddress.value) return
  loading.value = true
  try {
    const [snapshot, fee] = await Promise.all([readAccountState(evmAddress.value), readTakerFeeRate(evmAddress.value)])
    if (unmounted) return
    state.value = snapshot
    feeRate.value = fee
    loadError.value = ''
  } catch (e) {
    console.error('[swap] account refresh failed:', e?.message)
    loadError.value = e?.message || 'network_error'
  } finally {
    loading.value = false
  }
}

watch([from, to], refreshBooks)
watch(evmAddress, (address) => { if (address) refreshState() })
// An operation moving on changes what can be spent.
watch(operations, refreshState)

onMounted(async () => {
  refreshBooks()
  bookTimer = setInterval(() => { if (document.visibilityState === 'visible') refreshBooks() }, BOOK_POLL_MS)
  stateTimer = setInterval(() => { if (document.visibilityState === 'visible') refreshState() }, STATE_POLL_MS)

  if (!evmAddress.value && getNavioClient()) {
    try {
      await deriveEvmAddress(0)
    } catch (e) {
      console.error('[swap] derivation error:', e)
      if (e.message === 'wallet_locked') derivationError.value = t('dex.errors.walletLocked')
      else if (e.message === 'wallet_not_ready') derivationError.value = t('dex.errors.walletNotReady')
      else derivationError.value = t('dex.errors.derivationFailed')
    }
  } else {
    refreshState()
  }
})

onUnmounted(() => {
  unmounted = true
  clearInterval(bookTimer)
  clearInterval(stateTimer)
})
</script>
