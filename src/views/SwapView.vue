<!-- Swap: from, to, amount — and the truth about the balance. NAV is shown
     as one amount, wherever it sits; what has to happen to it (one-time
     setup, moving it to trading) is worked out by lib/intent and explained
     before Review, approved in Review, and tracked as a process afterwards. -->
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
      <ProcessCard v-for="op in activeOperations" :key="op.id" :op="op" />

      <div class="space-y-1.5">
        <AmountField
          v-model="amountInput"
          :label="$t('swap.from')"
          :symbol="from"
          :logo="HL_LOGOS[from]"
          :balance="state ? fromBalance : null"
          :fiat="fromFiat"
          :hint="whereLine"
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

      <!-- What this swap needs first, said before Review, not after -->
      <div v-if="prep && !problem" class="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-900/15 p-4 space-y-3">
        <div class="flex items-start gap-2.5">
          <Sparkles class="w-4 h-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div class="min-w-0">
            <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ prep.title }}</p>
            <p class="text-xs text-gray-600 dark:text-gray-300 leading-snug">{{ prep.body }}</p>
          </div>
        </div>
        <ul class="space-y-1.5">
          <li v-for="item in prep.items" :key="item.label" class="flex items-baseline justify-between gap-3 text-sm">
            <span class="text-gray-700 dark:text-gray-200">{{ item.label }}</span>
            <span class="shrink-0 text-xs text-gray-500 dark:text-gray-400 tabular-nums">{{ item.meta }}</span>
          </li>
        </ul>
        <div v-if="prep.total" class="pt-2 border-t border-blue-100 dark:border-blue-900/40 flex items-baseline justify-between gap-3 text-sm">
          <span class="text-gray-500 dark:text-gray-400">{{ $t('swap.setupNeeded.total') }}</span>
          <span class="font-semibold text-gray-900 dark:text-white tabular-nums">{{ prep.total }}</span>
        </div>
      </div>

      <!-- Why it can't happen, with the real numbers and a way forward -->
      <div v-if="problem" class="rounded-2xl px-4 py-3.5 space-y-2.5" :class="problem.tone === 'error' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20'">
        <p class="text-sm font-semibold" :class="problem.tone === 'error' ? 'text-red-800 dark:text-red-200' : 'text-amber-900 dark:text-amber-200'">{{ problem.title }}</p>
        <p v-if="problem.body" class="text-xs leading-snug" :class="problem.tone === 'error' ? 'text-red-700 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'">{{ problem.body }}</p>
        <button
          v-if="problem.action"
          @click="problem.action.run"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-gh-800 border border-gray-200 dark:border-gh-600 text-gray-800 dark:text-gray-100"
        >
          {{ problem.action.label }}
        </button>
      </div>

      <button
        @click="showReview = true"
        :disabled="!plan || !!plan.blocker || !!problem"
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
      :steps="reviewSteps"
      :steps-title="plan.setup ? $t('swap.review.setupTitle') : ''"
      :steps-intro="plan.setup ? $t('swap.review.setupBody') : ''"
      :steps-total="reviewTotal"
      :details="reviewDetails"
      :details-label="$t('swap.review.setupDetails')"
      :confirm-label="confirmLabel"
      @confirm="confirm"
      @close="showReview = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowDownUp, Loader2, Sparkles } from 'lucide-vue-next'
import { settings } from '@/stores/settings'
import { evmAddress } from '@/stores/evm'
import { balance, receiveAddress, getNavioClient } from '@/stores/navio'
import { operations, activeOperations, startOperation, reservedByOperations, setupInProgress } from '@/stores/operations'
import { deriveEvmAddress } from '@/composables/useEvmAccount'
import { HL_LOGOS, HL_NAMES } from '@/lib/hyperliquid/config'
import { HL_SPOT_MARKETS } from '@/lib/hyperliquid/market'
import { readAccountState, readBooks, readTakerFeeRate } from '@/lib/intent/executors'
import { quoteSwap, floorTo, toDecimalString, MIN_ORDER_USDC } from '@/lib/intent/quote'
import { planSwap, spendable, swappableNav } from '@/lib/intent/router'
import { exchangeSpendable } from '@/lib/intent/requirements'
import { formatAmount, formatFiatFromUsd } from '@/lib/displayFormat'
import AmountField from '@/components/tx/AmountField.vue'
import AssetPickerSheet from '@/components/tx/AssetPickerSheet.vue'
import ReviewSheet from '@/components/tx/ReviewSheet.vue'
import ProcessCard from '@/components/process/ProcessCard.vue'

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

// The wallet balance is live; the rest of the snapshot is polled. Funds other
// operations are about to spend are not offered twice.
const liveState = computed(() => state.value && { ...state.value, navWallet: Number(balance.value) || 0, reserved: reservedByOperations.value })

// What the user owns of this asset: for NAV, wallet + trading account
// together — the economic balance, not where it happens to sit. (The
// one-time setup cost, when still unpaid, is explained below, not hidden
// in this number; Max accounts for it.)
const fromBalance = computed(() => {
  const s = liveState.value
  if (!s) return 0
  return from.value === 'NAV' ? (s.navWallet || 0) + (s.navExchange || 0) : spendable(from.value, s)
})
const maxSwappable = computed(() => (liveState.value ? (from.value === 'NAV' ? swappableNav(liveState.value) : spendable(from.value, liveState.value)) : 0))
// Where the NAV is — secondary, under the amount.
const whereLine = computed(() => {
  const s = liveState.value
  if (!s || from.value !== 'NAV') return ''
  let line = t('swap.where', { wallet: formatAmount(s.navWallet, 8), exchange: formatAmount(s.navExchange, 8) })
  const moving = s.navEvm || 0
  if (moving > 0) line += t('swap.whereMoving', { moving: formatAmount(moving) })
  return line
})

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

// NAV worth of the exchange's 10 USDC order minimum, at the current bid.
const navBid = computed(() => Number(books.value.NAV?.bids?.[0]?.px) || null)
const minimumNav = computed(() => (navBid.value ? Math.ceil(MIN_ORDER_USDC / navBid.value) : null))

const goReceive = { label: t('swap.blocked.receive'), run: () => router.push('/wallet/receive') }

/** { title, body, tone, action } when the swap cannot be started, else null. */
const problem = computed(() => {
  if (loadError.value) return { title: t('swap.errors.network_error'), tone: 'warn' }
  if (!(amount.value > 0)) return null
  const s = liveState.value
  const q = quote.value
  const p = plan.value

  if (q?.error === 'below_minimum') {
    const inWallet = from.value === 'NAV' ? Number(balance.value) || 0 : null
    const body = minimumNav.value ? t('swap.blocked.belowMinimum', { nav: formatAmount(minimumNav.value) }) : t('swap.blocked.belowMinimumNoPrice')
    // A wallet that can't reach the minimum at all gets the whole picture at once.
    if (inWallet != null && s && inWallet < (minimumNav.value ?? 0) + (s.registered ? 0 : (Number(s.faucet?.amountNav) || 0))) {
      return {
        title: t('swap.blocked.insufficient', { needed: formatAmount(Math.ceil((minimumNav.value ?? 0) + (s.registered ? 0 : Number(s.faucet?.amountNav) || 0) + 1)), have: formatAmount(inWallet) }),
        body,
        tone: 'warn',
        action: goReceive,
      }
    }
    return { title: body, tone: 'warn' }
  }
  if (q?.error) return { title: te(`swap.errors.${q.error}`) ? t(`swap.errors.${q.error}`, { symbol: from.value }) : t('ops.errors.unknown'), tone: 'warn' }
  if (!p) return null

  if (p.blocker === 'insufficient_balance') {
    const b = p.blocked ?? {}
    if (from.value !== 'NAV' || b.id === 'tradingBalance' && b.symbol) {
      return { title: t('swap.blocked.otherAsset', { symbol: from.value, available: formatAmount(b.have ?? fromBalance.value) }), tone: 'warn' }
    }
    const breakdown = b.setupCost > 0
      ? t('swap.blocked.breakdown', { deposit: formatAmount(b.deposit), setup: formatAmount(b.setupCost) })
      : t('swap.blocked.breakdownNoSetup', { deposit: formatAmount(b.deposit) })
    return {
      title: t('swap.blocked.insufficient', { needed: formatAmount(b.needed), have: formatAmount(b.have) }),
      body: breakdown,
      tone: 'warn',
      action: goReceive,
    }
  }
  if (p.blocker) {
    const params = { symbol: from.value, available: formatAmount(fromBalance.value), onExchange: formatAmount(exchangeSpendable(s)) }
    return { title: te(`swap.errors.${p.blocker}`) ? t(`swap.errors.${p.blocker}`, params) : t('ops.errors.unknown'), tone: 'warn' }
  }
  // Two operations must not both pay for the one-time setup.
  if (setupInProgress.value && (p.unmet.includes('tradingAccount') || p.unmet.includes('bridgeRegistered'))) {
    return { title: t('swap.blocked.setupBusy'), tone: 'warn' }
  }
  return null
})

/** The "one-time setup needed" / "NAV will be moved" explanation, before Review. */
const prep = computed(() => {
  const p = plan.value
  if (!p || p.blocker || !p.unmet.length) return null
  const items = []
  const setupReq = p.requirements.find((r) => r.id === 'tradingAccount' && !r.satisfied)
  const regReq = p.requirements.find((r) => r.id === 'bridgeRegistered' && !r.satisfied)
  const depReq = p.requirements.find((r) => r.id === 'tradingBalance' && !r.satisfied)
  if (setupReq) items.push({ label: t('swap.setupNeeded.faucet'), meta: t('swap.setupNeeded.faucetCost', { amount: formatAmount(setupReq.costNav) }) })
  if (regReq) items.push({ label: t('swap.setupNeeded.register'), meta: t('swap.setupNeeded.registerCost') })
  if (depReq) items.push({ label: t('swap.setupNeeded.deposit', { amount: formatAmount(depReq.deposit, 8) }), meta: t('swap.setupNeeded.depositTime', { minutes: depReq.minutes }) })
  if (!items.length) return null
  const total = p.leavesWallet + p.setupCost
  if (setupReq || regReq) {
    return { title: t('swap.setupNeeded.title'), body: t('swap.setupNeeded.body'), items, total: total > 0 ? `${formatAmount(total, 8)} NAV` : '' }
  }
  return { title: t('swap.moveNeeded.title'), body: t('swap.moveNeeded.body', { amount: formatAmount(depReq.deposit, 8), minutes: depReq.minutes }), items: [], total: '' }
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
    balance: liveState.value ? spendable(symbol, liveState.value) : 0,
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
  amountInput.value = toDecimalString(floorTo(maxSwappable.value, decimals), decimals)
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
  return rows
})

const reviewNotices = computed(() => {
  const p = plan.value
  const notices = []
  if (p.leavesWallet > 0) {
    notices.push({ tone: 'info', text: t('swap.notice.leavesWallet', { amount: formatAmount(p.leavesWallet, 8) }) })
  }
  const kept = p.notes.find((n) => n.startsWith('stays_on_exchange:'))
  if (kept) notices.push({ tone: 'warn', text: t(`swap.notice.kept.${kept.split(':')[1]}`) })
  if (quote.value.priceImpact > 0.05) {
    notices.push({ tone: 'warn', text: t('swap.notice.priceImpact', { percent: (quote.value.priceImpact * 100).toFixed(1) }) })
  }
  return notices
})

// What Navio Go will do, in order and in the user's words — shown whenever
// the swap is more than one order.
const reviewSteps = computed(() => {
  const p = plan.value
  if (p.steps.length <= 1) return []
  const lines = []
  for (const step of p.steps) {
    if (step.type === 'faucet') lines.push({ label: t('swap.setupNeeded.faucet'), meta: t('swap.setupNeeded.faucetCost', { amount: formatAmount(step.amountNav) }) })
    else if (step.type === 'register') lines.push({ label: t('swap.setupNeeded.register'), meta: t('swap.setupNeeded.registerCost') })
    else if (step.type === 'deposit') lines.push({ label: t('swap.setupNeeded.deposit', { amount: formatAmount(step.amount, 8) }), meta: t('swap.setupNeeded.depositTime', { minutes: p.minutes - (p.setup ? 6 : 0) }) })
    else if (step.type === 'order') lines.push({ label: step.side === 'sell' ? t('process.step.sell', { base: step.base }) : t('process.step.buy', { base: step.base }), meta: '' })
    else if (step.type === 'burn') lines.push({ label: t('process.step.burn'), meta: t('swap.arrivesWallet') })
  }
  return lines
})
const reviewTotal = computed(() => {
  const p = plan.value
  const total = p.leavesWallet + p.setupCost
  if (!(total > 0)) return null
  return { label: t('swap.review.totalLeaving'), value: `${formatAmount(total, 8)} NAV`, note: t('swap.review.plusFees') }
})
// How it is done, technically — for anyone who wants to see it.
const reviewDetails = computed(() => {
  const lines = []
  for (const step of plan.value.steps) {
    if (step.type === 'faucet') lines.push(t('swap.routeStep.faucet', { amount: formatAmount(step.amountNav) }))
    else if (step.type === 'register') lines.push(t('swap.routeStep.register'))
    else if (step.type === 'deposit') lines.push(t('swap.routeStep.deposit', { amount: formatAmount(step.amount, 8) }))
    else if (step.type === 'order') lines.push(t(`swap.routeStep.${step.side}`, { base: step.base, price: step.limitPx }))
    else if (step.type === 'burn') lines.push(t('swap.routeStep.burn'))
  }
  if (plan.value.notes.includes('deposit_rounded_up')) lines.push(t('swap.routeStep.roundedUp'))
  if (plan.value.setup) lines.push(t('swap.notice.setup', { amount: formatAmount(plan.value.setup.amountNav), usdc: plan.value.setup.usdc, hype: plan.value.setup.hype }))
  lines.push(t('swap.routeStep.slippage', { percent: (settings.slippageBps / 100).toFixed(2) }))
  return lines
})
const confirmLabel = computed(() => {
  const payments = plan.value.steps.filter((s) => s.type === 'faucet' || s.type === 'deposit' || s.type === 'burn').length
  return payments > 1 ? t('swap.review.confirmPayments', { n: payments }) : t('swap.review.confirmOne')
})

function confirm() {
  const p = plan.value
  if (!p || p.blocker || problem.value) return
  const op = startOperation(p, { minutes: p.minutes })
  try { localStorage.setItem(LAST_PAIR_KEY, JSON.stringify([from.value, to.value])) } catch {}
  showReview.value = false
  amountInput.value = ''
  refreshState()
  // A swap that needs setup or a move is a process worth watching; a plain
  // order is over in seconds and its card appears right here.
  if (p.steps.length > 1) router.push(`/activity/${op.id}`)
}

// --- Data ---
let bookTimer = null
let stateTimer = null
let unmounted = false

async function refreshBooks() {
  const symbols = [...new Set([from.value, to.value, 'NAV'])].filter((s) => s !== 'USDC')
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
