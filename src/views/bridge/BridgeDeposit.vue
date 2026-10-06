<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">
    <div class="flex items-center gap-3 px-5 pt-5 pb-4">
      <button
        @click="router.back()"
        class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400"
      >
        <ChevronLeft class="w-5 h-5" />
      </button>
      <h1 class="text-lg font-bold text-gray-900 dark:text-white truncate flex-1 min-w-0">{{ $t('bridge.deposit.title') }}</h1>
    </div>

    <div v-if="derivationError" class="mx-5 mb-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4">
      <p class="text-sm text-red-700 dark:text-red-300 leading-snug">{{ derivationError }}</p>
    </div>

    <div v-else-if="bridge.checking.value && bridge.coreActivated.value === null" class="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 space-y-3">
      <Loader2 class="w-8 h-8 animate-spin opacity-60" />
    </div>

    <div v-else class="px-5 pb-6 space-y-4">
      <div v-if="bridge.bridgePaused.value" class="rounded-2xl border border-yellow-200 dark:border-yellow-900/50 bg-yellow-50 dark:bg-yellow-900/20 p-4 flex gap-3">
        <AlertTriangle class="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <p class="text-sm text-yellow-800 dark:text-yellow-300 leading-snug">{{ $t('bridge.deposit.pausedWarning') }}</p>
      </div>

      <div
        v-if="bridge.errorCode.value"
        class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-3 py-2.5 text-xs text-red-700 dark:text-red-300"
      >
        {{ $t('bridge.errors.' + bridge.errorCode.value) }}
      </div>

      <!-- Not yet activated on HyperCore -->
      <div v-if="bridge.coreActivated.value === false" class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-5 space-y-4 text-center">
        <div class="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mx-auto">
          <UserPlus class="w-7 h-7 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('bridge.deposit.activateTitle') }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-snug">{{ $t('bridge.deposit.activateDesc') }}</p>
        </div>
        <button
          @click="bridge.register"
          :disabled="bridge.registering.value"
          class="w-full py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Loader2 v-if="bridge.registering.value" class="w-4 h-4 animate-spin" />
          {{
            bridge.registerStep.value === 'moving_hype' ? $t('bridge.deposit.movingHype')
            : bridge.registering.value ? $t('bridge.deposit.activating')
            : $t('bridge.deposit.activateButton')
          }}
        </button>

        <!-- No HyperCore account yet (so no HYPE for register())? Buy a small
             USDC + HYPE package with NAV via navio-hl-faucet; receiving it
             creates the account, then Activate above registers with the bridge. -->
        <div v-if="bridge.coreExists.value === false" class="pt-1 border-t border-gray-100 dark:border-gh-700 space-y-2">
          <p class="text-xs text-gray-500 dark:text-gray-400 leading-snug pt-3">{{ $t('bridge.faucet.hint') }}</p>
          <button
            @click="openFaucet"
            :disabled="faucet.loading.value || bridge.registering.value"
            class="w-full py-3 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gh-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gh-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Loader2 v-if="faucet.loading.value" class="w-4 h-4 animate-spin" />
            <Droplets v-else class="w-4 h-4" />
            {{ $t('bridge.faucet.button') }}
          </button>
          <p
            v-if="faucet.errorCode.value && !showFaucetModal"
            class="text-xs text-red-600 dark:text-red-400 leading-snug"
          >
            {{ $t('bridge.faucet.errors.' + faucet.errorCode.value) }}
          </p>
        </div>
      </div>

      <!-- Activated: show deposit address -->
      <template v-else-if="bridge.depositAddress.value">
        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-5 flex flex-col items-center gap-4">
          <div class="p-3 bg-white rounded-xl ring-1 ring-gray-100 dark:ring-gh-700">
            <QRCode :value="bridge.depositAddress.value" :size="180" />
          </div>
          <div class="w-full bg-gray-50 dark:bg-gh-700 rounded-xl px-4 py-3">
            <p class="font-mono text-xs text-gray-700 dark:text-gray-300 break-all text-center leading-relaxed select-all">
              {{ bridge.depositAddress.value }}
            </p>
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
          <button
            @click="openSendModal"
            class="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gh-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gh-700"
          >
            <Send class="w-4 h-4" />
            {{ $t('bridge.deposit.sendFromWallet') }}
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
    </div>

    <!-- Send from wallet: amount -->
    <div v-if="showSendModal" class="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('bridge.deposit.sendFromWallet') }}</h3>
          <button @click="closeSendModal" :aria-label="$t('common.close')">
            <X class="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div class="rounded-xl bg-gray-50 dark:bg-gh-700 p-3 space-y-2">
          <div class="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
            <span>{{ $t('bridge.deposit.amountLabel') }}</span>
            <span>
              {{ $t('market.available') }}: {{ formatNavAmount(walletBalance) }} NAV
              <button @click="sendAmountInput = String(walletBalance)" class="ml-1 font-semibold text-blue-600 dark:text-blue-400">{{ $t('market.max') }}</button>
            </span>
          </div>
          <input
            v-model="sendAmountInput"
            type="number"
            min="0"
            step="any"
            placeholder="0.0"
            class="w-full bg-transparent text-lg font-semibold text-gray-900 dark:text-white outline-none"
          />
        </div>

        <p v-if="sendAmountValue !== null && sendAmountValue < 1" class="text-xs text-amber-600 dark:text-amber-400 leading-snug">
          {{ $t('bridge.deposit.minWarning') }}
        </p>

        <p class="text-xs text-gray-400 dark:text-gray-500 leading-snug">{{ $t('bridge.deposit.feeNote') }}</p>

        <button
          @click="openSendConfirm"
          :disabled="!canSend"
          class="w-full py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white"
        >
          {{ $t('bridge.deposit.reviewSend') }}
        </button>
      </div>
    </div>

    <!-- Send from wallet: confirm -->
    <div v-if="showSendConfirm" class="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <template v-if="sendStatus !== 'success'">
          <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('bridge.deposit.reviewTitle') }}</h3>
          <div class="rounded-xl bg-gray-50 dark:bg-gh-700 p-3 space-y-1.5 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-400 dark:text-gray-500">{{ $t('bridge.deposit.amountLabel') }}</span>
              <span class="font-semibold text-gray-800 dark:text-gray-100">{{ sendAmountInput }} NAV</span>
            </div>
            <div>
              <span class="text-gray-400 dark:text-gray-500 text-xs">{{ $t('bridge.deposit.title') }}</span>
              <p class="font-mono text-xs text-gray-700 dark:text-gray-300 break-all mt-0.5">{{ bridge.depositAddress.value }}</p>
            </div>
          </div>
          <p class="text-xs text-gray-400 dark:text-gray-500 leading-snug">{{ $t('bridge.deposit.feeNote') }}</p>

          <div
            v-if="sendStatus === 'error'"
            class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-3 py-2.5 text-xs text-red-700 dark:text-red-300"
          >
            {{ sendError }}
          </div>

          <div class="flex gap-2">
            <button
              @click="showSendConfirm = false"
              :disabled="sendStatus === 'sending'"
              class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gh-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gh-700 disabled:opacity-50"
            >
              {{ $t('common.cancel') }}
            </button>
            <button
              @click="confirmSend"
              :disabled="sendStatus === 'sending'"
              class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Loader2 v-if="sendStatus === 'sending'" class="w-4 h-4 animate-spin" />
              {{ sendStatus === 'sending' ? $t('bridge.withdraw.burning') : $t('market.confirmOrder') }}
            </button>
          </div>
        </template>

        <template v-else>
          <div class="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto">
            <Check class="w-6 h-6 text-green-500" />
          </div>
          <p class="text-sm text-gray-700 dark:text-gray-300 text-center leading-snug">{{ $t('bridge.deposit.sendSuccess') }}</p>
          <div v-if="sendTxId" class="rounded-xl bg-gray-50 dark:bg-gh-700 px-3 py-2.5 space-y-1">
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('bridge.deposit.txId') }}</p>
            <p class="font-mono text-xs text-gray-700 dark:text-gray-300 break-all select-all">{{ sendTxId }}</p>
          </div>
          <button
            @click="closeSendModal"
            class="w-full py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white"
          >
            {{ $t('common.close') }}
          </button>
        </template>
      </div>
    </div>

    <!-- Faucet: NAV -> USDC + HYPE on HyperCore, review & confirm -->
    <div v-if="showFaucetModal && faucet.quote.value" class="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <template v-if="faucetStatus !== 'success'">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('bridge.faucet.reviewTitle') }}</h3>
            <button @click="closeFaucet" :disabled="faucet.sending.value" :aria-label="$t('common.close')">
              <X class="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div class="rounded-xl bg-gray-50 dark:bg-gh-700 p-3 space-y-3 text-sm">
            <div class="flex justify-between gap-3">
              <span class="text-gray-400 dark:text-gray-500">{{ $t('bridge.faucet.youSend') }}</span>
              <span class="font-semibold text-gray-800 dark:text-gray-100">{{ faucet.quote.value.amountNav }} NAV</span>
            </div>
            <div>
              <span class="text-gray-400 dark:text-gray-500 text-xs">{{ $t('bridge.faucet.sendTo') }}</span>
              <p class="font-mono text-xs text-gray-700 dark:text-gray-300 break-all mt-0.5">{{ faucet.quote.value.navAddress }}</p>
            </div>
            <div class="border-t border-gray-200 dark:border-gh-600 pt-3 flex justify-between gap-3">
              <span class="text-gray-400 dark:text-gray-500">{{ $t('bridge.faucet.youReceive') }}</span>
              <span class="font-semibold text-gray-800 dark:text-gray-100 text-right">
                {{ faucet.quote.value.payout.usdc }} USDC<br />{{ faucet.quote.value.payout.hype }} HYPE
              </span>
            </div>
            <div>
              <span class="text-gray-400 dark:text-gray-500 text-xs">{{ $t('bridge.faucet.receiveTo') }}</span>
              <p class="font-mono text-xs text-gray-700 dark:text-gray-300 break-all mt-0.5">{{ evmAddress }}</p>
            </div>
          </div>

          <p v-if="faucetInsufficient" class="text-xs text-red-600 dark:text-red-400 leading-snug">
            {{ $t('bridge.faucet.insufficient', { balance: formatNavAmount(walletBalance) }) }}
          </p>
          <p class="text-xs text-gray-400 dark:text-gray-500 leading-snug">
            {{ $t('bridge.faucet.note', { time: faucetExpiresAt }) }}
          </p>

          <div
            v-if="faucetStatus === 'error'"
            class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-3 py-2.5 text-xs text-red-700 dark:text-red-300"
          >
            {{ faucetError }}
          </div>

          <div class="flex gap-2">
            <button
              @click="closeFaucet"
              :disabled="faucet.sending.value"
              class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gh-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gh-700 disabled:opacity-50"
            >
              {{ $t('common.cancel') }}
            </button>
            <button
              @click="confirmFaucet"
              :disabled="faucet.sending.value || faucet.loading.value || faucetInsufficient"
              class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Loader2 v-if="faucet.sending.value || faucet.loading.value" class="w-4 h-4 animate-spin" />
              {{ faucet.sending.value ? $t('bridge.faucet.sending') : $t('bridge.faucet.confirm') }}
            </button>
          </div>
        </template>

        <template v-else>
          <div class="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto">
            <Check class="w-6 h-6 text-green-500" />
          </div>
          <p class="text-sm text-gray-700 dark:text-gray-300 text-center leading-snug">{{ $t('bridge.faucet.success') }}</p>
          <div v-if="faucet.txId.value" class="rounded-xl bg-gray-50 dark:bg-gh-700 px-3 py-2.5 space-y-1">
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('bridge.deposit.txId') }}</p>
            <p class="font-mono text-xs text-gray-700 dark:text-gray-300 break-all select-all">{{ faucet.txId.value }}</p>
          </div>
          <button
            @click="closeFaucet"
            class="w-full py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white"
          >
            {{ $t('common.close') }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, Copy, Check, Loader2, AlertTriangle, UserPlus, Send, X, Droplets } from 'lucide-vue-next'
import copy from 'copy-to-clipboard'
import QRCode from 'qrcode.vue'
import { evmAddress } from '@/stores/evm'
import { deriveEvmAddress } from '@/composables/useEvmAccount'
import { useNavioBridgeDeposit } from '@/composables/useNavioBridgeDeposit'
import { useHlFaucet } from '@/composables/useHlFaucet'
import { getNavioClient, balance } from '@/stores/navio'
import { toSatoshi } from '@/lib/trade/format'

const router = useRouter()
const { t } = useI18n()

const derivationError = ref('')
const bridge = useNavioBridgeDeposit(evmAddress)

const copied = ref(false)
function copyAddress() {
  if (!bridge.depositAddress.value) return
  copy(bridge.depositAddress.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

// --- Send from wallet: existing NAV balance -> derived deposit address ---
const walletBalance = computed(() => Number(balance.value) || 0)
const showSendModal = ref(false)
const showSendConfirm = ref(false)
const sendAmountInput = ref('')
const sendStatus = ref('idle') // idle | sending | success | error
const sendError = ref('')
const sendTxId = ref('')

const sendAmountValue = computed(() => {
  const n = Number(sendAmountInput.value)
  return Number.isFinite(n) && n > 0 ? n : null
})

const canSend = computed(() =>
  sendAmountValue.value !== null && sendAmountValue.value <= walletBalance.value
)

function formatNavAmount(n) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 8 })
}

function openSendModal() {
  sendAmountInput.value = ''
  sendStatus.value = 'idle'
  sendError.value = ''
  sendTxId.value = ''
  showSendModal.value = true
}

function closeSendModal() {
  showSendModal.value = false
  showSendConfirm.value = false
}

function openSendConfirm() {
  if (!canSend.value) return
  sendStatus.value = 'idle'
  sendError.value = ''
  showSendConfirm.value = true
}

function confirmSend() {
  const client = getNavioClient()
  sendStatus.value = 'sending'
  sendError.value = ''
  client
    .sendTransaction({
      address: bridge.depositAddress.value,
      amount: toSatoshi(sendAmountValue.value),
      // Deposit is credited for exactly this amount — the network fee must
      // come out of the wallet's balance on top of it, never carved out of
      // the amount itself (a fee-reduced deposit would round down below
      // what the user asked to send).
      subtractFeeFromAmount: false,
    })
    .then((result) => {
      console.log('[bridge] send from wallet — tx id:', result?.txId)
      sendTxId.value = result?.txId || ''
      sendStatus.value = 'success'
    })
    .catch((e) => {
      console.error('[bridge] send from wallet failed:', e)
      sendStatus.value = 'error'
      sendError.value = e?.message || t('bridge.deposit.sendFailed')
    })
}

// --- Faucet: NAV -> USDC + HYPE on HyperCore (activates the account) ---
const faucet = useHlFaucet()
const showFaucetModal = ref(false)
const faucetStatus = ref('idle') // idle | error | success
const faucetError = ref('')

const faucetInsufficient = computed(() =>
  !!faucet.quote.value && Number(faucet.quote.value.amountNav) > walletBalance.value
)

const faucetExpiresAt = computed(() =>
  faucet.quote.value ? new Date(faucet.quote.value.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
)

async function openFaucet() {
  if (!evmAddress.value) return
  faucet.reset()
  faucetStatus.value = 'idle'
  faucetError.value = ''
  if (await faucet.fetchQuote(evmAddress.value)) showFaucetModal.value = true
}

function closeFaucet() {
  const sent = faucetStatus.value === 'success'
  showFaucetModal.value = false
  faucet.reset()
  // Payout lands after a few Navio confirmations; re-check so the page
  // switches to the deposit address once the account exists on HyperCore.
  if (sent) bridge.check()
}

async function confirmFaucet() {
  faucetStatus.value = 'idle'
  faucetError.value = ''
  // The quoted amount is only held until expiresAt — refresh it and let
  // the user review the new amount rather than sending on a stale quote.
  if (faucet.isExpired()) {
    // On failure the quote is gone, so close the modal; the error then
    // shows under the faucet button on the activation card.
    if (!(await faucet.fetchQuote(evmAddress.value))) showFaucetModal.value = false
    return
  }
  try {
    await faucet.send()
    faucetStatus.value = 'success'
  } catch (e) {
    faucetStatus.value = 'error'
    faucetError.value = e?.message || t('bridge.faucet.errors.send_failed')
  }
}

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
  await bridge.check()
})
</script>
