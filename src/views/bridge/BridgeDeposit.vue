<!-- "Receive NAV into trading from another wallet": the deposit address the
     bridge watches for this account. It only works once the account has had
     its one-time setup — which is the same process Swap runs, started from
     here when needed. No manual Activate / faucet buttons: the app knows
     the order and does it. -->
<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">
    <div class="flex items-center gap-3 px-5 pt-5 pb-4">
      <button @click="router.back()" :aria-label="$t('common.back')" class="p-2 -ml-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400">
        <ChevronLeft class="w-5 h-5" />
      </button>
      <h1 class="text-lg font-bold text-gray-900 dark:text-white truncate flex-1 min-w-0">{{ $t('bridge.deposit.title') }}</h1>
    </div>

    <div v-if="derivationError" class="mx-5 mb-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4">
      <p class="text-sm text-red-700 dark:text-red-300 leading-snug">{{ derivationError }}</p>
    </div>

    <div v-else-if="!state && loading" class="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
      <Loader2 class="w-8 h-8 animate-spin opacity-60" />
    </div>

    <div v-else-if="state" class="px-5 pb-6 space-y-4">
      <p class="text-sm text-gray-500 dark:text-gray-400 leading-snug">{{ $t('bridge.deposit.intro') }}</p>

      <ProcessCard v-for="op in setupOps" :key="op.id" :op="op" />

      <div v-if="state.paused" class="rounded-2xl border border-yellow-200 dark:border-yellow-900/50 bg-yellow-50 dark:bg-yellow-900/20 p-4 flex gap-3">
        <AlertTriangle class="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <p class="text-sm text-yellow-800 dark:text-yellow-300 leading-snug">{{ $t('bridge.deposit.pausedWarning') }}</p>
      </div>

      <!-- Ready: the address -->
      <template v-if="state.registered && state.depositAddress">
        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-5 flex flex-col items-center gap-4">
          <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400">{{ $t('bridge.deposit.readyBadge') }}</span>
          <div class="p-3 bg-white rounded-xl ring-1 ring-gray-100 dark:ring-gh-700">
            <QRCode :value="state.depositAddress" :size="180" />
          </div>
          <div class="w-full bg-gray-50 dark:bg-gh-700 rounded-xl px-4 py-3">
            <p class="font-mono text-xs text-gray-700 dark:text-gray-300 break-all text-center leading-relaxed select-all">{{ state.depositAddress }}</p>
          </div>
          <button
            @click="copyAddress"
            class="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors"
            :class="copied ? 'bg-green-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'"
          >
            <Check v-if="copied" class="w-4 h-4" />
            <Copy v-else class="w-4 h-4" />
            {{ copied ? $t('common.copied') : $t('common.copy') }}
          </button>
        </div>

        <div class="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-2">
          <div class="flex gap-3">
            <AlertTriangle class="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p class="text-xs text-amber-800 dark:text-amber-300 leading-snug">{{ $t('bridge.deposit.addressWarning') }}</p>
          </div>
          <p class="text-xs text-amber-800 dark:text-amber-300 leading-snug">{{ $t('bridge.deposit.minWarning') }}</p>
        </div>

        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">{{ $t('bridge.deposit.confirmationTitle') }}</p>
          <div class="space-y-1 text-xs text-gray-600 dark:text-gray-300">
            <div class="flex justify-between"><span>&lt; 1,000 NAV</span><span>~6 {{ $t('bridge.deposit.minutes') }}</span></div>
            <div class="flex justify-between"><span>&lt; 10,000 NAV</span><span>~12 {{ $t('bridge.deposit.minutes') }}</span></div>
            <div class="flex justify-between"><span>&lt; 100,000 NAV</span><span>~48 {{ $t('bridge.deposit.minutes') }}</span></div>
            <div class="flex justify-between"><span>&ge; 100,000 NAV</span><span>~96 {{ $t('bridge.deposit.minutes') }}</span></div>
          </div>
        </div>
      </template>

      <!-- Not ready: one explanation, one button, the same process as Swap -->
      <div v-else-if="!setupOps.length" class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-5 space-y-4">
        <div class="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
          <Sparkles class="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('bridge.deposit.notReadyTitle') }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-snug">
            {{ plan && plan.blocker === 'insufficient_balance'
              ? $t('bridge.deposit.notReadyNoFunds', { amount: formatAmount(plan.blocked?.needed ?? plan.setupCost), have: formatAmount(walletNav) })
              : plan && plan.setupCost > 0
                ? $t('bridge.deposit.notReadyBody', { amount: formatAmount(plan.setupCost) })
                : $t('bridge.deposit.notReadyBodyFree') }}
          </p>
        </div>
        <p v-if="plan && plan.blocker && plan.blocker !== 'insufficient_balance'" class="rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300 leading-snug">
          {{ $te(`swap.errors.${plan.blocker}`) ? $t(`swap.errors.${plan.blocker}`) : $t('ops.errors.unknown') }}
        </p>
        <button
          v-if="plan && !plan.blocker"
          @click="showReview = true"
          class="w-full py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700"
        >
          {{ plan.setupCost > 0 ? $t('bridge.deposit.setupButton') : $t('bridge.deposit.setupButtonFree') }}
        </button>
        <button
          v-else-if="plan && plan.blocker === 'insufficient_balance'"
          @click="router.push('/wallet/receive')"
          class="w-full py-3 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gh-600 text-gray-700 dark:text-gray-300"
        >
          {{ $t('swap.blocked.receive') }}
        </button>
      </div>
    </div>

    <ReviewSheet
      v-if="plan && !plan.blocker"
      :open="showReview"
      :title="plan.setupCost > 0 ? $t('bridge.deposit.setupButton') : $t('bridge.deposit.setupButtonFree')"
      :from="{ amount: formatAmount(plan.setupCost), symbol: 'NAV', logo: HL_LOGOS.NAV }"
      :rows="[{ label: $t('swap.arrives'), value: $t('swap.arrivesMinutes', { minutes: plan.minutes }) }]"
      :notices="plan.setup ? [{ tone: 'info', text: $t('swap.notice.setup', { amount: formatAmount(plan.setup.amountNav), usdc: plan.setup.usdc, hype: plan.setup.hype }) }] : []"
      :steps="reviewSteps"
      :confirm-label="$t('common.confirm')"
      @confirm="confirmSetup"
      @close="showReview = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, Copy, Check, Loader2, AlertTriangle, Sparkles } from 'lucide-vue-next'
import copy from 'copy-to-clipboard'
import QRCode from 'qrcode.vue'
import { evmAddress } from '@/stores/evm'
import { balance } from '@/stores/navio'
import { deriveEvmAddress } from '@/composables/useEvmAccount'
import { operations, activeOperations, startOperation, reservedByOperations } from '@/stores/operations'
import { readAccountState } from '@/lib/intent/executors'
import { planReceiveViaBridge } from '@/lib/intent/router'
import { HL_LOGOS } from '@/lib/hyperliquid/config'
import { formatAmount } from '@/lib/displayFormat'
import ProcessCard from '@/components/process/ProcessCard.vue'
import ReviewSheet from '@/components/tx/ReviewSheet.vue'

const router = useRouter()
const { t } = useI18n()

const derivationError = ref('')
const state = ref(null)
const loading = ref(false)
const showReview = ref(false)
const copied = ref(false)

const walletNav = computed(() => Number(balance.value) || 0)
// Any running operation that is doing the setup covers this page's need too.
const setupOps = computed(() => activeOperations.value.filter((op) => op.steps.some((s) => ['faucet', 'waitAccount', 'register'].includes(s.type) && s.status !== 'done')))

const plan = computed(() => (state.value ? planReceiveViaBridge({ state: { ...state.value, navWallet: walletNav.value, reserved: reservedByOperations.value } }) : null))
const reviewSteps = computed(() => {
  const p = plan.value
  if (!p) return []
  return p.steps
    .filter((s) => s.type === 'faucet' || s.type === 'register')
    .map((s) => s.type === 'faucet'
      ? { label: t('swap.setupNeeded.faucet'), meta: t('swap.setupNeeded.faucetCost', { amount: formatAmount(s.amountNav) }) }
      : { label: t('swap.setupNeeded.register'), meta: t('swap.setupNeeded.registerCost') })
})

function copyAddress() {
  if (!state.value?.depositAddress) return
  copy(state.value.depositAddress)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

function confirmSetup() {
  const p = plan.value
  if (!p || p.blocker) return
  const op = startOperation(p, { minutes: p.minutes })
  showReview.value = false
  router.push(`/activity/${op.id}`)
}

async function refresh() {
  if (!evmAddress.value) return
  loading.value = true
  try { state.value = await readAccountState(evmAddress.value) } catch (e) { console.error('[bridge] state failed:', e?.message) } finally { loading.value = false }
}
watch(operations, refresh)

onMounted(async () => {
  if (!evmAddress.value) {
    try {
      await deriveEvmAddress(0)
    } catch (e) {
      console.error('[bridge] derivation error:', e)
      if (e.message === 'wallet_locked') derivationError.value = t('dex.errors.walletLocked')
      else if (e.message === 'wallet_not_ready') derivationError.value = t('dex.errors.walletNotReady')
      else derivationError.value = t('dex.errors.derivationFailed')
      return
    }
  }
  await refresh()
})
</script>
