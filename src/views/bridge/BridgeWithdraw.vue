<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">
    <div class="flex items-center gap-3 px-5 pt-5 pb-4">
      <button
        @click="router.back()"
        class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400"
      >
        <ChevronLeft class="w-5 h-5" />
      </button>
      <h1 class="text-lg font-bold text-gray-900 dark:text-white truncate flex-1 min-w-0">{{ $t('bridge.withdraw.title') }}</h1>
    </div>

    <div v-if="derivationError" class="mx-5 mb-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4">
      <p class="text-sm text-red-700 dark:text-red-300 leading-snug">{{ derivationError }}</p>
    </div>

    <div v-else-if="bridge.loading.value && bridge.coreActivated.value === null" class="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 space-y-3">
      <Loader2 class="w-8 h-8 animate-spin opacity-60" />
    </div>

    <div v-else class="px-5 pb-6 space-y-4">
      <div v-if="bridge.bridgePaused.value" class="rounded-2xl border border-yellow-200 dark:border-yellow-900/50 bg-yellow-50 dark:bg-yellow-900/20 p-4 flex gap-3">
        <AlertTriangle class="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <p class="text-sm text-yellow-800 dark:text-yellow-300 leading-snug">{{ $t('bridge.withdraw.pausedWarning') }}</p>
      </div>

      <div v-if="bridge.coreActivated.value === false" class="rounded-2xl border border-yellow-200 dark:border-yellow-900/50 bg-yellow-50 dark:bg-yellow-900/20 p-4 flex gap-3">
        <AlertTriangle class="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <p class="text-sm text-yellow-800 dark:text-yellow-300 leading-snug">{{ $t('bridge.withdraw.burnerNotActivated') }}</p>
      </div>

      <div v-if="hypeIsZero" class="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 flex gap-3">
        <AlertTriangle class="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <p class="text-sm text-red-700 dark:text-red-300 leading-snug">{{ $t('bridge.withdraw.hypeWarning') }}</p>
      </div>

      <!-- Balances -->
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
        <div class="px-4 py-2.5 flex items-center justify-between border-b border-gray-100 dark:border-gh-700">
          <span class="text-xs text-gray-400 dark:text-gray-500">{{ $t('bridge.withdraw.onEvm') }}</span>
          <span class="text-sm font-mono text-gray-800 dark:text-gray-100">{{ formatNav(bridge.navOnEvm.value) }} NAV</span>
        </div>
        <div class="px-4 py-2.5 flex items-center justify-between">
          <span class="text-xs text-gray-400 dark:text-gray-500">{{ $t('bridge.withdraw.onCore') }}</span>
          <div class="flex items-center gap-2">
            <span class="text-sm font-mono text-gray-800 dark:text-gray-100">{{ formatNav(bridge.navOnCore.value) }} NAV</span>
            <button
              v-if="bridge.navOnCore.value > 0n"
              @click="bridge.moveCoreToEvm"
              :disabled="bridge.moving.value"
              class="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 disabled:opacity-50"
            >
              {{ bridge.moving.value ? $t('bridge.withdraw.moving') : $t('bridge.withdraw.moveToEvm') }}
            </button>
          </div>
        </div>
        <div
          v-if="bridge.moveErrorCode.value"
          class="border-t border-gray-100 dark:border-gh-700 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 space-y-1"
        >
          <p class="text-xs text-red-700 dark:text-red-300">{{ $t('bridge.errors.' + bridge.moveErrorCode.value) }}</p>
          <p v-if="bridge.moveErrorDetail.value" class="font-mono text-[11px] text-red-500 dark:text-red-400/80 break-words">
            {{ bridge.moveErrorDetail.value }}
          </p>
        </div>
      </div>

      <!-- Withdraw form -->
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4 space-y-3">
        <div class="rounded-xl bg-gray-50 dark:bg-gh-700 p-3 space-y-2">
          <div class="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
            <span>{{ $t('bridge.withdraw.amountLabel') }}</span>
            <span>
              {{ $t('market.available') }}: {{ formatNav(bridge.navOnEvm.value) }}
              <button @click="setMax" class="ml-1 font-semibold text-blue-600 dark:text-blue-400">{{ $t('market.max') }}</button>
            </span>
          </div>
          <input
            v-model="amountInput"
            type="text"
            inputmode="decimal"
            placeholder="0.0"
            class="w-full bg-transparent text-lg font-semibold text-gray-900 dark:text-white outline-none"
          />
        </div>

        <div class="rounded-xl bg-gray-50 dark:bg-gh-700 p-3 space-y-2">
          <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('bridge.withdraw.destinationLabel') }}</p>
          <input
            v-model.trim="destinationInput"
            type="text"
            :placeholder="$t('bridge.withdraw.destinationPlaceholder')"
            class="w-full bg-transparent text-sm font-mono text-gray-900 dark:text-white outline-none"
          />
        </div>

        <p class="text-xs text-gray-400 dark:text-gray-500 leading-snug">{{ $t('bridge.withdraw.privacyNote') }}</p>

        <div
          v-if="bridge.status.value === 'error'"
          class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-3 py-2.5 text-xs text-red-700 dark:text-red-300"
        >
          {{ $t('bridge.errors.' + (bridge.errorCode.value || 'unknown')) }}
        </div>

        <div
          v-if="bridge.status.value === 'done'"
          class="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 px-3 py-2.5 text-xs text-green-700 dark:text-green-300"
        >
          {{ $t('bridge.withdraw.done') }}
        </div>

        <button
          @click="openConfirm"
          :disabled="!canSubmit"
          class="w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 bg-blue-600 hover:bg-blue-700"
        >
          <Loader2 v-if="isBusy" class="w-4 h-4 animate-spin" />
          {{ submitLabel }}
        </button>
      </div>
    </div>

    <!-- Confirm modal -->
    <div v-if="showConfirm" class="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('bridge.withdraw.reviewTitle') }}</h3>
        <div class="rounded-xl bg-gray-50 dark:bg-gh-700 p-3 space-y-1.5 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-400 dark:text-gray-500">{{ $t('bridge.withdraw.amountLabel') }}</span>
            <span class="font-semibold text-gray-800 dark:text-gray-100">{{ amountInput }} NAV</span>
          </div>
          <div>
            <span class="text-gray-400 dark:text-gray-500 text-xs">{{ $t('bridge.withdraw.destinationLabel') }}</span>
            <p class="font-mono text-xs text-gray-700 dark:text-gray-300 break-all mt-0.5">{{ destinationInput }}</p>
          </div>
        </div>
        <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('bridge.withdraw.privacyNote') }}</p>
        <div class="flex gap-2">
          <button
            @click="showConfirm = false"
            class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gh-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gh-700"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            @click="confirmSubmit"
            class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white"
          >
            {{ $t('market.confirmOrder') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { formatUnits } from 'viem'
import { ChevronLeft, AlertTriangle, Loader2 } from 'lucide-vue-next'
import { evmAddress } from '@/stores/evm'
import { deriveEvmAddress } from '@/composables/useEvmAccount'
import { useNavioBridgeWithdraw } from '@/composables/useNavioBridgeWithdraw'
import { parseStrictAmount } from '@/lib/hyperliquid/bridge/amount'
import { NAV_DECIMALS } from '@/lib/hyperliquid/bridge/config'
import { receiveAddress } from '@/stores/navio'

const router = useRouter()
const { t } = useI18n()

const derivationError = ref('')
const bridge = useNavioBridgeWithdraw()

const amountInput = ref('')
// Defaults to the wallet's own receive address (same one shown on the
// Receive tab) — the common case is withdrawing back into this same
// wallet. Still a plain editable field, not locked to it.
const destinationInput = ref(receiveAddress.value)
const showConfirm = ref(false)

const hypeIsZero = computed(() => bridge.coreActivated.value !== null && bridge.hypeBalance.value === 0n)

function formatNav(raw) {
  return Number(formatUnits(raw, NAV_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 8 })
}

function setMax() {
  amountInput.value = formatUnits(bridge.navOnEvm.value, NAV_DECIMALS)
}

const canSubmit = computed(() => {
  if (!evmAddress.value || bridge.bridgePaused.value || isBusy.value) return false
  if (!destinationInput.value) return false
  const parsed = parseStrictAmount(amountInput.value)
  return !!parsed
})

const isBusy = computed(() => bridge.status.value === 'encrypting' || bridge.status.value === 'burning')

const submitLabel = computed(() => {
  if (bridge.status.value === 'encrypting') return t('bridge.withdraw.encrypting')
  if (bridge.status.value === 'burning') return t('bridge.withdraw.burning')
  return t('bridge.withdraw.submit')
})

function openConfirm() {
  if (!canSubmit.value) return
  bridge.reset()
  showConfirm.value = true
}

async function confirmSubmit() {
  showConfirm.value = false
  await bridge.withdraw({ amountInput: amountInput.value, destination: destinationInput.value })
  if (bridge.status.value === 'done') {
    amountInput.value = ''
    destinationInput.value = ''
  }
}

onMounted(async () => {
  // Covers the rare case where the wallet store hadn't populated
  // receiveAddress yet when this component was created.
  if (!destinationInput.value && receiveAddress.value) {
    destinationInput.value = receiveAddress.value
  }
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
  await bridge.refreshBalances()
})
</script>
