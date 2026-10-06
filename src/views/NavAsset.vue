<!-- NAV, as one asset: the total first, where it is held one tap away, and
     the explicit wallet <-> exchange move (what used to be the bridge's
     deposit/withdraw screens) under Advanced for those who want it. -->
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
        <template v-if="settings.dexMode">
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
      </div>

      <!-- Actions -->
      <div class="grid gap-2" :class="settings.dexMode ? 'grid-cols-3' : 'grid-cols-2'">
        <button
          v-for="action in actions"
          :key="action.id"
          @click="router.push(action.to)"
          class="py-3 rounded-2xl flex flex-col items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
        >
          <component :is="action.icon" class="w-5 h-5" />
          {{ $t(action.label) }}
        </button>
      </div>

      <OperationCard v-for="op in operations" :key="op.id" :op="op" />

      <!-- Advanced: the explicit versions of what Swap does on its own -->
      <div v-if="settings.dexMode" class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
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
          <div class="space-y-2">
            <p class="text-xs text-gray-500 dark:text-gray-400 leading-snug">{{ $t('asset.moveDesc') }}</p>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="direction in ['toExchange', 'toWallet']"
                :key="direction"
                @click="openMove(direction)"
                class="px-2 py-2.5 rounded-xl text-xs font-semibold leading-tight border border-gray-200 dark:border-gh-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gh-700 flex items-center justify-center gap-1.5"
              >
                <component :is="direction === 'toExchange' ? ArrowUpFromLine : ArrowDownToLine" class="w-3.5 h-3.5 shrink-0" />
                {{ $t(`asset.move.${direction}`) }}
              </button>
            </div>
          </div>

          <div class="space-y-1">
            <button
              v-for="link in advancedLinks"
              :key="link.to"
              @click="router.push(link.to)"
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
    </div>

    <!-- Move: amount -->
    <BottomSheet :open="!!moveDirection && !showReview" :title="moveDirection ? $t(`asset.move.${moveDirection}`) : ''" @close="moveDirection = null">
      <div class="space-y-4">
        <AmountField
          v-model="moveInput"
          :label="$t('tx.amount')"
          symbol="NAV"
          :logo="HL_LOGOS.NAV"
          :balance="state ? moveMax : null"
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
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  ChevronLeft, ChevronDown, ChevronRight, SendHorizontal, Download, Repeat,
  ArrowUpFromLine, ArrowDownToLine, Loader2,
} from 'lucide-vue-next'
import { settings } from '@/stores/settings'
import { evmAddress } from '@/stores/evm'
import { receiveAddress } from '@/stores/navio'
import { operations, activeOperations, startOperation } from '@/stores/operations'
import { usePortfolio } from '@/composables/usePortfolio'
import { HL_LOGOS, HL_NAMES } from '@/lib/hyperliquid/config'
import { readAccountState } from '@/lib/intent/executors'
import { planMove, NAV_FEE_RESERVE } from '@/lib/intent/router'
import { toDecimalString } from '@/lib/intent/quote'
import { formatAmount, formatFiatFromUsd } from '@/lib/displayFormat'
import TokenIcon from '@/components/TokenIcon.vue'
import BottomSheet from '@/components/tx/BottomSheet.vue'
import AmountField from '@/components/tx/AmountField.vue'
import ReviewSheet from '@/components/tx/ReviewSheet.vue'
import OperationCard from '@/components/tx/OperationCard.vue'

const router = useRouter()
const { t, te } = useI18n()
const portfolio = usePortfolio()
const nav = portfolio.nav

const totalFiat = computed(() =>
  portfolio.navUsd.value != null ? formatFiatFromUsd(nav.value.total * portfolio.navUsd.value) : null
)

// Open by default as soon as anything is held outside the wallet.
const breakdownToggled = ref(null)
const showBreakdown = computed({
  get: () => breakdownToggled.value ?? (nav.value.exchange > 0 || nav.value.moving > 0),
  set: (v) => { breakdownToggled.value = v },
})

const breakdown = computed(() => {
  const rows = [
    { id: 'wallet', label: t('asset.where.wallet'), hint: t('asset.where.walletHint'), amount: nav.value.wallet },
    {
      id: 'exchange',
      label: t('asset.where.exchange'),
      hint: nav.value.inOrders > 0
        ? t('asset.where.exchangeHintOrders', { amount: formatAmount(nav.value.inOrders) })
        : t('asset.where.exchangeHint'),
      amount: nav.value.exchange,
    },
  ]
  if (nav.value.moving > 0) {
    rows.push({ id: 'moving', label: t('asset.where.moving'), hint: t('asset.where.movingHint'), amount: nav.value.moving })
  }
  return rows
})

const actions = computed(() => [
  { id: 'send', to: '/wallet/send', icon: SendHorizontal, label: 'wallet.send' },
  { id: 'receive', to: '/wallet/receive', icon: Download, label: 'wallet.receive' },
  ...(settings.dexMode ? [{ id: 'swap', to: '/swap?from=NAV', icon: Repeat, label: 'swap.title' }] : []),
])

const showAdvanced = ref(false)
const advancedLinks = computed(() => [
  { to: '/market/hl/NAV-USDC', label: t('asset.links.trade'), hint: t('asset.links.tradeHint') },
  { to: '/hl/asset/NAV', label: t('asset.links.hlTransfer'), hint: t('asset.links.hlTransferHint') },
  { to: '/bridge/deposit', label: t('asset.links.depositAddress'), hint: t('asset.links.depositAddressHint') },
  { to: '/bridge/withdraw', label: t('asset.links.manualWithdraw'), hint: t('asset.links.manualWithdrawHint') },
])

// --- Explicit move between wallet and exchange ---
const moveDirection = ref(null) // null | 'toExchange' | 'toWallet'
const moveInput = ref('')
const showReview = ref(false)
const state = ref(null)
const loadingState = ref(false)
const stateError = ref('')

const busyOperation = computed(() => activeOperations.value.length > 0)

async function openMove(direction) {
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

const liveState = computed(() => state.value && { ...state.value, navWallet: nav.value.wallet })

const moveAmount = computed(() => {
  const n = Number(moveInput.value)
  return Number.isFinite(n) && n > 0 ? n : 0
})

const moveMax = computed(() => {
  if (!liveState.value) return 0
  if (moveDirection.value === 'toWallet') return liveState.value.navExchange + liveState.value.navEvm
  const setupCost = !liveState.value.registered && liveState.value.faucet ? Number(liveState.value.faucet.amountNav) : 0
  return Math.max(0, liveState.value.navWallet - NAV_FEE_RESERVE - setupCost)
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

function confirmMove() {
  const p = movePlan.value
  if (!p || p.blocker || busyOperation.value) return
  startOperation(p, { minutes: p.minutes })
  showReview.value = false
  moveDirection.value = null
}
</script>
