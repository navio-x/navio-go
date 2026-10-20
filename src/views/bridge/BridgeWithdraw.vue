<!-- "Bring NAV back to any address": the explicit withdrawal, for a
     destination other than this wallet. Same planner and process as the NAV
     page's "Bring NAV back to wallet"; the HyperCore/HyperEVM split that used
     to be on this screen is handled by the process and shown under its
     technical details. -->
<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">
    <div class="flex items-center gap-3 px-5 pt-5 pb-4">
      <button @click="router.back()" :aria-label="$t('common.back')" class="p-2 -ml-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400">
        <ChevronLeft class="w-5 h-5" />
      </button>
      <h1 class="text-lg font-bold text-gray-900 dark:text-white truncate flex-1 min-w-0">{{ $t('bridge.withdraw.title') }}</h1>
    </div>

    <div v-if="derivationError" class="mx-5 mb-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4">
      <p class="text-sm text-red-700 dark:text-red-300 leading-snug">{{ derivationError }}</p>
    </div>

    <div v-else-if="!state && loading" class="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
      <Loader2 class="w-8 h-8 animate-spin opacity-60" />
    </div>

    <div v-else-if="state" class="px-5 pb-6 space-y-4">
      <p class="text-sm text-gray-500 dark:text-gray-400 leading-snug">{{ $t('bridge.withdraw.intro') }}</p>

      <ProcessCard v-for="op in withdrawOps" :key="op.id" :op="op" />

      <AmountField
        v-model="amountInput"
        :label="$t('bridge.withdraw.available')"
        symbol="NAV"
        :logo="HL_LOGOS.NAV"
        :balance="available"
        @max="amountInput = toDecimalString(available, 8)"
      />

      <div class="rounded-2xl bg-white dark:bg-gh-800 border border-gray-200 dark:border-gh-700 p-3.5 space-y-2">
        <div class="flex items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500">
          <span>{{ $t('bridge.withdraw.destinationLabel') }}</span>
          <button v-if="destinationInput !== receiveAddress" @click="destinationInput = receiveAddress" class="font-semibold text-blue-600 dark:text-blue-400">{{ $t('bridge.withdraw.ownWallet') }}</button>
        </div>
        <input
          v-model.trim="destinationInput"
          type="text"
          autocomplete="off"
          spellcheck="false"
          :placeholder="$t('bridge.withdraw.destinationPlaceholder')"
          class="w-full bg-transparent text-sm font-mono text-gray-900 dark:text-white outline-none"
        />
      </div>
      <p class="text-xs text-gray-400 dark:text-gray-500 leading-snug">{{ $t('bridge.withdraw.privacyNote') }}</p>

      <p v-if="problem" class="rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300 leading-snug">{{ problem }}</p>

      <button
        @click="showReview = true"
        :disabled="!plan || !!plan.blocker || !destinationInput"
        class="w-full py-3.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
      >
        {{ amount > 0 ? $t('tx.review') : $t('tx.enterAmount') }}
      </button>
    </div>

    <ReviewSheet
      v-if="plan && !plan.blocker"
      :open="showReview"
      :title="$t('bridge.withdraw.reviewTitle')"
      :from="{ amount: formatAmount(plan.send, 8), symbol: 'NAV', logo: HL_LOGOS.NAV }"
      :destination="destinationInput"
      :destination-label="$t('bridge.withdraw.destinationLabel')"
      :rows="[{ label: $t('swap.arrives'), value: $t('swap.arrivesWallet') }]"
      :notices="[{ tone: 'info', text: $t('asset.move.privateAgain') }]"
      :steps="reviewSteps"
      :confirm-label="$t('bridge.withdraw.submit')"
      @confirm="confirmWithdraw"
      @close="showReview = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, Loader2 } from 'lucide-vue-next'
import { evmAddress } from '@/stores/evm'
import { receiveAddress } from '@/stores/navio'
import { deriveEvmAddress } from '@/composables/useEvmAccount'
import { operations, activeOperations, startOperation, reservedByOperations } from '@/stores/operations'
import { readAccountState } from '@/lib/intent/executors'
import { planMove } from '@/lib/intent/router'
import { exchangeSpendable } from '@/lib/intent/requirements'
import { toDecimalString } from '@/lib/intent/quote'
import { HL_LOGOS } from '@/lib/hyperliquid/config'
import { formatAmount } from '@/lib/displayFormat'
import AmountField from '@/components/tx/AmountField.vue'
import ReviewSheet from '@/components/tx/ReviewSheet.vue'
import ProcessCard from '@/components/process/ProcessCard.vue'

const router = useRouter()
const { t, te } = useI18n()

const derivationError = ref('')
const state = ref(null)
const loading = ref(false)
const amountInput = ref('')
const destinationInput = ref(receiveAddress.value)
const showReview = ref(false)

const withdrawOps = computed(() => activeOperations.value.filter((op) => op.kind === 'toWallet'))
const liveState = computed(() => state.value && { ...state.value, reserved: reservedByOperations.value })
const available = computed(() => (liveState.value ? exchangeSpendable(liveState.value) + (liveState.value.navEvm || 0) : 0))
const amount = computed(() => {
  const n = Number(amountInput.value)
  return Number.isFinite(n) && n > 0 ? n : 0
})
const plan = computed(() => (liveState.value && amount.value > 0 ? planMove({ direction: 'toWallet', amount: amount.value, state: liveState.value, destination: destinationInput.value }) : null))
const problem = computed(() => {
  if (!amount.value) return ''
  if (!state.value?.registered) return t('bridge.withdraw.notReady')
  const code = plan.value?.blocker
  if (!code) return ''
  return te(`swap.errors.${code}`) ? t(`swap.errors.${code}`, { symbol: 'NAV', available: formatAmount(available.value) }) : t('ops.errors.unknown')
})
const reviewSteps = computed(() => {
  const p = plan.value
  if (!p) return []
  const lines = []
  for (const s of p.steps) {
    if (s.type === 'register') lines.push({ label: t('swap.setupNeeded.register'), meta: t('swap.setupNeeded.registerCost') })
    else if (s.type === 'toEvm') lines.push({ label: t('process.step.toEvm'), meta: '' })
    else if (s.type === 'burn') lines.push({ label: t('process.step.burn'), meta: t('swap.arrivesWallet') })
  }
  return lines
})

function confirmWithdraw() {
  const p = plan.value
  if (!p || p.blocker) return
  const op = startOperation(p, { minutes: p.minutes })
  showReview.value = false
  amountInput.value = ''
  router.push(`/activity/${op.id}`)
}

async function refresh() {
  if (!evmAddress.value) return
  loading.value = true
  try { state.value = await readAccountState(evmAddress.value) } catch (e) { console.error('[bridge] state failed:', e?.message) } finally { loading.value = false }
}
watch(operations, refresh)
watch(receiveAddress, (a) => { if (!destinationInput.value && a) destinationInput.value = a })

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
