<!-- NAV, as one asset: the total first with where it is held and the
     explicit wallet <-> exchange transfer (what used to be the bridge's
     deposit/withdraw screens) inside that card, then the actions, Advanced
     (order book, bridge addresses, diagnostics) and cold staking. -->
<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">
    <div class="flex items-center gap-3 px-5 pt-5 pb-4">
      <button
        @click="router.back()"
        :aria-label="$t('common.back')"
        class="p-2 -ml-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400"
      >
        <ChevronLeft class="w-5 h-5" />
      </button>
      <TokenIcon symbol="NAV" :logo="HL_LOGOS.NAV" :size="28" />
      <h1 class="text-lg font-bold text-gray-900 dark:text-white truncate flex-1 min-w-0">{{ HL_NAMES.NAV }}</h1>
    </div>

    <div class="px-5 pb-6 space-y-4">
      <!-- Total -->
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4">
        <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('asset.total') }}</p>
        <p class="mt-1 text-3xl font-bold tabular-nums text-gray-900 dark:text-white truncate">
          {{ formatAmount(nav.total, 8) }} <span class="text-base font-medium text-gray-500 dark:text-gray-400">NAV</span>
        </p>
        <p v-if="settings.showFiatValue && totalFiat" class="text-sm text-gray-500 dark:text-gray-400">≈ {{ totalFiat }}</p>

        <!-- Where it is: exact, but secondary -->
        <template v-if="hlEnabled || nav.staked > 0">
          <button
            type="button"
            @click="showBreakdown = !showBreakdown"
            :aria-expanded="showBreakdown"
            class="mt-3 pt-3 w-full border-t border-gray-100 dark:border-gh-700 flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400"
          >
            {{ $t('tx.details') }}
            <ChevronDown class="w-4 h-4 transition-transform" :class="{ 'rotate-180': showBreakdown }" />
          </button>
          <dl v-if="showBreakdown" class="mt-2 space-y-2.5">
            <div v-for="row in breakdown" :key="row.id" class="flex items-start justify-between gap-3">
              <dt class="min-w-0">
                <span class="block text-sm text-gray-700 dark:text-gray-200">{{ row.label }}</span>
                <span class="block text-xs text-gray-400 dark:text-gray-500 leading-snug">{{ row.hint }}</span>
              </dt>
              <dd class="shrink-0 text-sm font-mono text-gray-900 dark:text-white">{{ formatAmount(row.amount, 8) }}</dd>
            </div>
          </dl>
        </template>

        <!-- The explicit wallet <-> exchange transfer, right under the two accounts it moves between -->
        <button
          v-if="hlEnabled"
          @click="openMove()"
          :disabled="busyOperation"
          class="mt-3 w-full px-3 py-2.5 rounded-xl flex items-center gap-3 text-left transition-colors
                 bg-gray-50 dark:bg-gh-700/60 hover:bg-gray-100 dark:hover:bg-gh-700 active:scale-[0.99] disabled:opacity-50"
        >
          <span class="w-8 h-8 shrink-0 rounded-full flex items-center justify-center bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400">
            <ArrowLeftRight class="w-4 h-4" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-semibold text-gray-800 dark:text-gray-100">{{ $t('asset.transfer.title') }}</span>
            <span class="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 leading-snug">
              <span class="truncate">{{ $t('asset.transfer.navio') }}</span>
              <ArrowRightLeft class="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" stroke-width="2.5" />
              <span class="truncate">{{ $t('asset.transfer.hl') }}</span>
            </span>
          </span>
          <ChevronRight class="w-4 h-4 shrink-0 text-gray-300 dark:text-gray-600" />
        </button>
      </div>

      <!-- Actions -->
      <div class="grid gap-2" :class="hlEnabled ? 'grid-cols-3' : 'grid-cols-2'">
        <button
          v-for="action in actions"
          :key="action.id"
          @click="router.push(action.to)"
          class="py-3 rounded-2xl flex flex-col items-center gap-1.5 text-xs font-semibold transition-colors
                 border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 text-gray-700 dark:text-gray-200
                 hover:bg-gray-50 dark:hover:bg-gh-700 active:scale-[0.98]"
        >
          <!-- Tonal: colour only in the icon's disc, so the page's real
               primary actions (stake, review, confirm) stay the loud ones. -->
          <span class="w-9 h-9 rounded-full flex items-center justify-center bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400">
            <component :is="action.icon" class="w-[18px] h-[18px]" />
          </span>
          {{ $t(action.label) }}
        </button>
      </div>

      <!-- Advanced: order book, bridge addresses and the trading account's facts -->
      <div v-if="hlEnabled" class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
        <button
          type="button"
          @click="showAdvanced = !showAdvanced"
          :aria-expanded="showAdvanced"
          class="w-full px-4 py-3.5 flex items-center justify-between text-sm font-semibold text-gray-700 dark:text-gray-200"
        >
          {{ $t('asset.advanced') }}
          <ChevronDown class="w-4 h-4 text-gray-400 transition-transform" :class="{ 'rotate-180': showAdvanced }" />
        </button>

        <div v-if="showAdvanced" class="border-t border-gray-100 dark:border-gh-700 px-4 py-4 space-y-4">
          <div class="space-y-1">
            <button
              v-for="link in advancedLinks"
              :key="link.to"
              @click="openLink(link)"
              class="w-full py-2.5 flex items-center justify-between gap-3 text-left"
            >
              <span class="min-w-0">
                <span class="block text-sm text-gray-700 dark:text-gray-200">{{ link.label }}</span>
                <span class="block text-xs text-gray-400 dark:text-gray-500 leading-snug">{{ link.hint }}</span>
              </span>
              <ChevronRight class="w-4 h-4 shrink-0 text-gray-300 dark:text-gray-600" />
            </button>
          </div>

          <p class="text-xs leading-relaxed text-gray-400 dark:text-gray-500">{{ $t('asset.explain') }}</p>
        </div>
      </div>

      <ProcessCard v-for="op in activeOperations" :key="op.id" :op="op" />

      <StakingCard />
    </div>

    <!-- Trading account: the facts behind the setup, read-only -->
    <BottomSheet :open="showDiag" :title="$t('asset.diag.title')" @close="showDiag = false">
      <div v-if="diagLoading && !diag" class="py-8 flex justify-center"><Loader2 class="w-6 h-6 animate-spin text-gray-400" /></div>
      <div v-else-if="diag" class="space-y-4">
        <div class="rounded-xl px-3 py-2.5 text-sm font-medium" :class="diag.registered ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300'">
          {{ diag.registered ? $t('asset.diag.ready') : $t('asset.diag.notReady') }}
          <span v-if="!diag.registered && diag.faucet" class="block text-xs font-normal mt-0.5">{{ $t('asset.diag.setupCost', { amount: formatAmount(diag.faucet.amountNav) }) }}</span>
        </div>
        <dl class="space-y-2.5 text-sm">
          <div v-for="row in diagRows" :key="row.label" class="flex items-start justify-between gap-3">
            <dt class="text-gray-500 dark:text-gray-400 shrink-0">{{ row.label }}</dt>
            <dd class="text-right text-gray-800 dark:text-gray-100 min-w-0 break-all" :class="{ 'font-mono text-xs': row.mono }">{{ row.value }}</dd>
          </div>
        </dl>
        <div class="flex gap-2">
          <button @click="loadDiag" :disabled="diagLoading" class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gh-800 text-gray-700 dark:text-gray-300 disabled:opacity-50">{{ $t('asset.diag.refresh') }}</button>
          <button v-if="!diag.registered" @click="startSetup" :disabled="busyOperation || !canSetup" class="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">{{ $t('asset.diag.setup') }}</button>
        </div>
      </div>
    </BottomSheet>

    <!-- Transfer: direction, then amount -->
    <BottomSheet :open="!!moveDirection && !showReview" :title="$t('asset.transfer.title')" @close="moveDirection = null">
      <div class="space-y-4">
        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 flex items-stretch overflow-hidden">
          <div class="flex-1 min-w-0 divide-y divide-gray-100 dark:divide-gh-700">
            <div v-for="end in moveEnds" :key="end.id" class="px-4 py-3 flex items-center justify-between gap-3">
              <span class="min-w-0">
                <span class="block text-xs text-gray-400 dark:text-gray-500">{{ end.role }}</span>
                <span class="block text-sm font-semibold text-gray-900 dark:text-white truncate">{{ end.label }}</span>
              </span>
              <span class="shrink-0 text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400">{{ formatAmount(end.amount, 8) }} NAV</span>
            </div>
          </div>
          <button
            type="button"
            @click="flipMove"
            :aria-label="$t('swap.flip')"
            class="px-3.5 shrink-0 flex items-center justify-center border-l border-gray-100 dark:border-gh-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gh-700"
          >
            <ArrowDownUp class="w-4 h-4" />
          </button>
        </div>

        <AmountField
          v-model="moveInput"
          :label="$t('tx.amount')"
          symbol="NAV"
          :logo="HL_LOGOS.NAV"
          :balance="state ? moveMax : null"
          :hint="moveFeeLine"
          @max="moveInput = toDecimalString(moveMax, 8)"
        />
        <p v-if="moveProblem" class="rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300 leading-snug">
          {{ moveProblem }}
        </p>
        <button
          @click="showReview = true"
          :disabled="!movePlan || !!movePlan.blocker || busyOperation"
          class="w-full py-3.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Loader2 v-if="loadingState" class="w-4 h-4 animate-spin" />
          {{ moveAmount > 0 ? $t('tx.review') : $t('tx.enterAmount') }}
        </button>
      </div>
    </BottomSheet>

    <!-- Move: review -->
    <ReviewSheet
      v-if="movePlan && moveDirection"
      :open="showReview"
      :title="$t(`asset.move.${moveDirection}`)"
      :from="{ amount: formatAmount(movePlan.send, 8), symbol: 'NAV', logo: HL_LOGOS.NAV }"
      :destination="moveDirection === 'toWallet' ? receiveAddress : ''"
      :destination-label="$t('asset.move.walletAddress')"
      :rows="moveRows"
      :notices="moveNotices"
      :confirm-label="$t('common.confirm')"
      @confirm="confirmMove"
      @close="showReview = false"
    />
  </div>
</template>

<script setup>
import { confirmProcess } from '@/lib/spendConfirm'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  ChevronLeft, ChevronDown, ChevronRight, SendHorizontal, Download, Repeat,
  ArrowLeftRight, ArrowRightLeft, ArrowDownUp, Loader2,
} from 'lucide-vue-next'
import { settings } from '@/stores/settings'
import { hlEnabled } from '@/stores/network'
import { evmAddress } from '@/stores/evm'
import { receiveAddress } from '@/stores/navio'
import { activeOperations, startOperation, reservedByOperations, setupInProgress } from '@/stores/operations'
import { usePortfolio } from '@/composables/usePortfolio'
import { HL_LOGOS, HL_NAMES } from '@/lib/hyperliquid/config'
import { readAccountState } from '@/lib/intent/executors'
import { planMove, planReceiveViaBridge } from '@/lib/intent/router'
import { walletSpendable, walletSendFee } from '@/lib/intent/requirements'
import { toDecimalString } from '@/lib/intent/quote'
import { formatAmount, formatFiatFromUsd } from '@/lib/displayFormat'
import TokenIcon from '@/components/TokenIcon.vue'
import BottomSheet from '@/components/tx/BottomSheet.vue'
import AmountField from '@/components/tx/AmountField.vue'
import ReviewSheet from '@/components/tx/ReviewSheet.vue'
import ProcessCard from '@/components/process/ProcessCard.vue'
import StakingCard from '@/components/staking/StakingCard.vue'

const router = useRouter()
const { t, te } = useI18n()
const portfolio = usePortfolio()
const nav = portfolio.nav

const totalFiat = computed(() =>
  portfolio.navUsd.value != null ? formatFiatFromUsd(nav.value.total * portfolio.navUsd.value) : null
)

// Where the NAV is held is shown up front; the toggle only lets it be tucked away.
const showBreakdown = ref(true)

const breakdown = computed(() => {
  const rows = [
    { id: 'wallet', label: t('asset.where.wallet'), hint: t('asset.where.walletHint'), amount: nav.value.wallet },
  ]
  if (nav.value.staked > 0) {
    rows.push({ id: 'staked', label: t('asset.where.staked'), hint: t('asset.where.stakedHint'), amount: nav.value.staked })
  }
  if (!hlEnabled.value) return rows
  rows.push(
    {
      id: 'exchange',
      label: t('asset.where.exchange'),
      hint: nav.value.inOrders > 0
        ? t('asset.where.exchangeHintOrders', { amount: formatAmount(nav.value.inOrders) })
        : t('asset.where.exchangeHint'),
      amount: nav.value.exchange,
    },
  )
  if (nav.value.moving > 0) {
    rows.push({ id: 'moving', label: t('asset.where.moving'), hint: t('asset.where.movingHint'), amount: nav.value.moving })
  }
  return rows
})

const actions = computed(() => [
  { id: 'send', to: '/wallet/send', icon: SendHorizontal, label: 'wallet.send' },
  { id: 'receive', to: '/wallet/receive', icon: Download, label: 'wallet.receive' },
  ...(hlEnabled.value ? [{ id: 'swap', to: '/swap?from=NAV', icon: Repeat, label: 'swap.title' }] : []),
])

const showAdvanced = ref(false)
const advancedLinks = computed(() => [
  { to: '/market/hl/NAV-USDC', label: t('asset.links.trade'), hint: t('asset.links.tradeHint') },
  { to: '/hl/asset/NAV', label: t('asset.links.hlTransfer'), hint: t('asset.links.hlTransferHint') },
  { to: '/bridge/deposit', label: t('asset.links.depositAddress'), hint: t('asset.links.depositAddressHint') },
  { to: '/bridge/withdraw', label: t('asset.links.manualWithdraw'), hint: t('asset.links.manualWithdrawHint') },
  { to: 'diag', label: t('asset.links.diagnostics'), hint: t('asset.links.diagnosticsHint') },
])

// --- Trading account diagnostics ---
const showDiag = ref(false)
const diag = ref(null)
const diagLoading = ref(false)
async function loadDiag() {
  if (!evmAddress.value) return
  diagLoading.value = true
  try { diag.value = await readAccountState(evmAddress.value) } catch (e) { console.error('[asset] diagnostics failed:', e?.message) } finally { diagLoading.value = false }
}
function openLink(link) {
  if (link.to === 'diag') { showDiag.value = true; loadDiag(); return }
  router.push(link.to)
}
const diagRows = computed(() => {
  const d = diag.value
  if (!d) return []
  const yes = t('asset.diag.yes'), no = t('asset.diag.no')
  return [
    { label: t('asset.diag.account'), value: d.coreExists ? yes : no },
    { label: t('asset.diag.registered'), value: d.registered ? yes : no },
    { label: t('asset.diag.gas'), value: `${formatAmount(d.hypeEvm ?? 0, 6)} + ${formatAmount(d.hypeCore ?? 0, 6)} HYPE` },
    { label: t('asset.diag.navCore'), value: `${formatAmount(d.navExchange, 8)} NAV` },
    { label: t('asset.diag.navEvm'), value: `${formatAmount(d.navEvm, 8)} NAV` },
    { label: t('asset.diag.usdc'), value: `${formatAmount(d.balances?.USDC ?? 0)} USDC` },
    { label: t('asset.diag.evmAddress'), value: evmAddress.value, mono: true },
    { label: t('asset.diag.depositAddress'), value: d.depositAddress ?? t('asset.diag.depositAddressNone'), mono: !!d.depositAddress },
  ]
})
const setupPlan = computed(() => (diag.value ? planReceiveViaBridge({ state: { ...diag.value, navWallet: nav.value.wallet, reserved: reservedByOperations.value } }) : null))
const canSetup = computed(() => !!setupPlan.value && !setupPlan.value.blocker && !setupInProgress.value)
async function startSetup() {
  const p = setupPlan.value
  if (!p || p.blocker) return
  if (!(await confirmProcess(p))) return
  const op = startOperation(p, { minutes: p.minutes })
  showDiag.value = false
  router.push(`/activity/${op.id}`)
}

// --- Explicit move between wallet and exchange ---
const moveDirection = ref(null) // null | 'toExchange' | 'toWallet'
const moveInput = ref('')
const showReview = ref(false)
const state = ref(null)
const loadingState = ref(false)
const stateError = ref('')

// A second explicit move while one is still moving the same NAV would plan
// against balances that are about to change; the reserved amounts handle the
// arithmetic, the one-time setup must simply not be started twice.
const busyOperation = computed(() => setupInProgress.value)

// Wallet -> exchange unless the wallet is empty and the exchange is not.
function defaultDirection() {
  return nav.value.wallet <= 0 && nav.value.exchange > 0 ? 'toWallet' : 'toExchange'
}

function flipMove() {
  moveDirection.value = moveDirection.value === 'toExchange' ? 'toWallet' : 'toExchange'
  moveInput.value = ''
}

const moveAccounts = computed(() => ({
  wallet: { label: t('asset.transfer.navio'), amount: nav.value.wallet },
  exchange: { label: t('asset.transfer.hl'), amount: nav.value.exchange },
}))

// The two rows of the direction card: from on top, to below.
const moveEnds = computed(() => {
  const toExchange = moveDirection.value !== 'toWallet'
  const from = toExchange ? 'wallet' : 'exchange'
  const to = toExchange ? 'exchange' : 'wallet'
  return [
    { id: 'from', role: t('asset.move.from'), ...moveAccounts.value[from] },
    { id: 'to', role: t('asset.move.to'), ...moveAccounts.value[to] },
  ]
})

async function openMove(direction = defaultDirection()) {
  moveDirection.value = direction
  moveInput.value = ''
  showReview.value = false
  stateError.value = ''
  if (!evmAddress.value) {
    stateError.value = 'wallet_locked'
    return
  }
  loadingState.value = true
  try {
    state.value = await readAccountState(evmAddress.value)
  } catch (e) {
    console.error('[asset] account state failed:', e?.message)
    stateError.value = 'network_error'
  } finally {
    loadingState.value = false
  }
}

const liveState = computed(() => state.value && { ...state.value, navWallet: nav.value.wallet, reserved: reservedByOperations.value })

const moveAmount = computed(() => {
  const n = Number(moveInput.value)
  return Number.isFinite(n) && n > 0 ? n : 0
})

const moveMax = computed(() => {
  if (!liveState.value) return 0
  if (moveDirection.value === 'toWallet') return liveState.value.navExchange + liveState.value.navEvm
  // Everything the wallet can send, less the setup payment (its own transaction, with its own fee).
  const setupCost = !liveState.value.registered && liveState.value.faucet ? Number(liveState.value.faucet.amountNav) : 0
  const setup = setupCost > 0 ? setupCost + walletSendFee(liveState.value, setupCost) : 0
  return Math.max(0, walletSpendable(liveState.value) - setup)
})

// What the wallet pays on top for this direction: the send itself and, on a
// first move, the setup payment (two transactions). Going the other way the
// network fee is HYPE from the trading account, so no NAV comes off.
const moveSetupCost = computed(() => (liveState.value && !liveState.value.registered && liveState.value.faucet ? Number(liveState.value.faucet.amountNav) : 0))
const moveFee = computed(() => {
  if (!liveState.value || moveDirection.value !== 'toExchange' || !(moveAmount.value > 0)) return 0
  const s = liveState.value
  return walletSendFee(s, moveAmount.value) + (moveSetupCost.value > 0 ? walletSendFee(s, moveSetupCost.value) : 0)
})
const moveFeeLine = computed(() => {
  if (moveDirection.value === 'toWallet') return t('asset.transfer.feeHype')
  return moveFee.value > 0 ? t('asset.transfer.feeOnTop', { fee: formatAmount(moveFee.value, 8) }) : ''
})

const movePlan = computed(() => {
  if (!liveState.value || !moveDirection.value || !(moveAmount.value > 0)) return null
  return planMove({
    direction: moveDirection.value,
    amount: moveAmount.value,
    state: liveState.value,
    destination: receiveAddress.value,
  })
})

const moveProblem = computed(() => {
  const code = busyOperation.value ? 'busy' : stateError.value || movePlan.value?.blocker
  if (!code) return ''
  const params = { symbol: 'NAV', available: formatAmount(moveMax.value) }
  return te(`swap.errors.${code}`) ? t(`swap.errors.${code}`, params) : t('ops.errors.unknown')
})

const moveRows = computed(() => {
  const p = movePlan.value
  const toExchange = moveDirection.value === 'toExchange'
  const rows = [
    { label: t('asset.move.from'), value: t(toExchange ? 'asset.where.wallet' : 'asset.where.exchange') },
    { label: t('asset.move.to'), value: t(toExchange ? 'asset.where.exchange' : 'asset.where.wallet') },
    { label: t('swap.arrives'), value: toExchange ? t('swap.arrivesMinutes', { minutes: p.minutes }) : t('swap.arrivesWallet') },
  ]
  if (p.setup) rows.push({ label: t('swap.setup'), value: `${formatAmount(p.setup.amountNav)} NAV` })
  if (toExchange) rows.push({ label: t('wallet.networkFee'), value: `${formatAmount(moveFee.value, 8)} NAV` })
  return rows
})

const moveNotices = computed(() => {
  const p = movePlan.value
  const notices = []
  if (p.leavesWallet > 0) notices.push({ tone: 'info', text: t('swap.notice.leavesWallet', { amount: formatAmount(p.leavesWallet, 8) }) })
  if (p.setup) notices.push({ tone: 'info', text: t('swap.notice.setup', { amount: formatAmount(p.setup.amountNav), usdc: p.setup.usdc, hype: p.setup.hype }) })
  if (moveDirection.value === 'toWallet') notices.push({ tone: 'info', text: t('asset.move.privateAgain') })
  return notices
})

async function confirmMove() {
  const p = movePlan.value
  if (!p || p.blocker || busyOperation.value) return
  if (!(await confirmProcess(p))) return
  const op = startOperation(p, { minutes: p.minutes })
  showReview.value = false
  moveDirection.value = null
  router.push(`/activity/${op.id}`)
}
</script>
