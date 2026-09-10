<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">

    <div class="flex items-center gap-3 px-5 pt-5 pb-5">
      <button @click="router.push('/trade')" class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400">
        <ChevronLeft class="w-5 h-5" />
      </button>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('trade.quotes.title') }}</h1>
    </div>

    <TradeBridgeGate>
    <!-- Request context lost (e.g. page was reloaded mid-flow) -->
    <div v-if="!request" class="flex-1 flex items-center justify-center px-5 pb-6">
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-8 flex flex-col items-center gap-4 text-center w-full max-w-xs">
        <AlertCircle class="w-8 h-8 text-gray-400 dark:text-gray-500" />
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('trade.quotes.contextLost') }}</p>
        <button @click="router.push('/trade/take')" class="text-sm font-medium text-blue-600 dark:text-blue-400">
          {{ $t('trade.quotes.newRequest') }}
        </button>
      </div>
    </div>

    <div v-else class="px-5 pb-6 space-y-4">

      <!-- Status badge -->
      <div class="flex items-center justify-between text-xs">
        <span
          class="px-2 py-1 rounded-lg font-medium"
          :class="windowOpen ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-500 dark:bg-gh-800 dark:text-gray-400'"
        >
          {{ windowOpen ? $t('trade.quotes.collecting') + ` (${windowCountdown})` : $t('trade.quotes.windowClosed') }}
        </span>
        <button
          v-if="windowOpen"
          @click="cancelRequest"
          class="text-gray-400 hover:text-red-500 dark:hover:text-red-400 font-medium"
        >
          {{ $t('trade.quotes.cancelRequest') }}
        </button>
      </div>

      <!-- Waiting: window open, nothing yet -->
      <div v-if="windowOpen && quotes.length === 0" class="flex flex-col items-center justify-center text-center gap-3 py-12 text-gray-400 dark:text-gray-500">
        <Loader2 class="w-7 h-7 animate-spin opacity-60" />
        <p class="text-sm max-w-xs">{{ $t('trade.quotes.waiting') }}</p>
      </div>

      <!-- Terminal: window closed, never got a single quote -->
      <div v-else-if="!windowOpen && quotes.length === 0" class="flex flex-col items-center justify-center text-center gap-3 py-12">
        <AlertCircle class="w-8 h-8 text-gray-400 dark:text-gray-500" />
        <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ $t('trade.quotes.noQuotes') }}</p>
        <p class="text-sm text-gray-400 dark:text-gray-500 max-w-xs">{{ $t('trade.quotes.noQuotesHint') }}</p>
        <button @click="router.push('/trade/take')" class="text-sm font-medium text-blue-600 dark:text-blue-400 mt-2">
          {{ $t('trade.quotes.newRequest') }}
        </button>
      </div>

      <!-- Terminal: had quotes, but every one of them has since expired -->
      <div v-else-if="liveQuotes.length === 0" class="flex flex-col items-center justify-center text-center gap-3 py-12">
        <AlertCircle class="w-8 h-8 text-gray-400 dark:text-gray-500" />
        <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ $t('trade.quotes.allExpired') }}</p>
        <p class="text-sm text-gray-400 dark:text-gray-500 max-w-xs">{{ $t('trade.quotes.allExpiredHint') }}</p>
        <button @click="router.push('/trade/take')" class="text-sm font-medium text-blue-600 dark:text-blue-400 mt-2">
          {{ $t('trade.quotes.newRequest') }}
        </button>
      </div>

      <!-- Live, selectable quote list — cheapest first -->
      <div v-else class="space-y-2">
        <button
          v-for="(q, i) in liveQuotes"
          :key="q.quoteId"
          @click="selectedQuote = q"
          class="w-full text-left p-4 rounded-xl border bg-white dark:bg-gh-800 transition-colors hover:bg-gray-50 dark:hover:bg-gh-700"
          :class="i === 0 ? 'border-blue-300 dark:border-blue-700' : 'border-gray-200 dark:border-gh-700'"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('trade.quotes.makerDelivers') }}</p>
              <p class="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{{ formatAmount(q.fill, isBuyNav) }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('trade.quotes.youPay') }}</p>
              <p class="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{{ formatAmount(q.sellCost, isSellNav) }}</p>
            </div>
            <div class="text-right">
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('trade.quotes.unitPrice') }}</p>
              <p class="text-sm tabular-nums text-gray-700 dark:text-gray-300">{{ q.price.toPrecision(6) }}</p>
            </div>
          </div>
          <div class="flex items-center justify-between mt-2">
            <span v-if="i === 0" class="text-xs font-medium text-blue-600 dark:text-blue-400">{{ $t('trade.quotes.acceptBest') }}</span>
            <span v-else class="text-xs text-gray-400 dark:text-gray-500">{{ $t('trade.quotes.accept') }}</span>
            <span class="text-xs text-gray-400 dark:text-gray-500">{{ $t('trade.quotes.expiresIn', { t: formatCountdown(q.orderExpiry, now) }) }}</span>
          </div>
        </button>
      </div>

    </div>
    </TradeBridgeGate>

    <!-- Confirm / accept modal -->
    <div
      v-if="selectedQuote"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
    >
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">

        <template v-if="result">
          <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('trade.confirm.successTitle') }}</h3>
          <div class="space-y-1">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('trade.confirm.successTxId') }}</p>
            <div class="flex items-center gap-2">
              <p class="font-mono text-xs text-gray-700 dark:text-gray-300 break-all flex-1">{{ result.txId }}</p>
              <button @click="copyId(result.txId)" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
                <Copy class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <button @click="closeModal(true)" class="w-full py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white">
            {{ $t('trade.confirm.done') }}
          </button>
        </template>

        <template v-else>
          <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('trade.confirm.title') }}</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{{ $t('trade.confirm.atomicNotice') }}</p>

          <div class="rounded-xl border border-gray-200 dark:border-gh-700 divide-y divide-gray-100 dark:divide-gh-700 overflow-hidden">
            <div class="px-3 py-2.5 flex items-center justify-between">
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ $t('trade.confirm.youReceive') }}</span>
              <span class="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{{ formatAmount(selectedQuote.fill, isBuyNav) }}</span>
            </div>
            <div class="px-3 py-2.5 flex items-center justify-between">
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ $t('trade.confirm.youPay') }}</span>
              <span class="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{{ formatAmount(selectedQuote.sellCost, isSellNav) }}</span>
            </div>
          </div>

          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('trade.confirm.slippageLabel') }}</label>
              <span class="text-xs font-semibold text-gray-700 dark:text-gray-300">{{ slippagePct }}%</span>
            </div>
            <input v-model.number="slippagePct" type="range" min="0" max="10" step="0.5" class="w-full" />
          </div>

          <!-- The mandatory bounds — never blank, never unbounded -->
          <div class="rounded-xl bg-gray-50 dark:bg-gh-800 border border-gray-200 dark:border-gh-700 p-3 space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ $t('trade.confirm.maxPayLabel') }}</span>
              <span class="text-xs font-semibold tabular-nums text-gray-900 dark:text-white">{{ formatAmount(maxPay, isSellNav) }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ $t('trade.confirm.minRecvLabel') }}</span>
              <span class="text-xs font-semibold tabular-nums text-gray-900 dark:text-white">{{ formatAmount(minRecv, isBuyNav) }}</span>
            </div>
          </div>

          <p v-if="selectedQuoteExpired" class="text-sm text-amber-600 dark:text-amber-400">{{ $t('trade.confirm.expiredTitle') }}</p>
          <template v-else-if="acceptErrorKind">
            <p class="text-sm font-medium text-red-500 dark:text-red-400">
              {{ acceptErrorKind === 'bounds' ? $t('trade.confirm.boundsTitle') : acceptErrorKind === 'expired' ? $t('trade.confirm.expiredTitle') : acceptErrorMessage }}
            </p>
            <p v-if="acceptErrorKind === 'bounds' || acceptErrorKind === 'expired'" class="text-xs text-gray-400 dark:text-gray-500">
              {{ acceptErrorKind === 'bounds' ? $t('trade.confirm.boundsBody') : $t('trade.confirm.expiredBody') }}
            </p>
          </template>

          <div class="flex gap-2 pt-1">
            <button
              @click="closeModal(false)"
              :disabled="accepting"
              class="flex-1 py-2 rounded-xl text-sm font-medium transition
              bg-gray-100 hover:bg-gray-200 text-gray-700
              dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
            >
              {{ $t('trade.confirm.cancel') }}
            </button>
            <button
              @click="confirmAccept"
              :disabled="accepting || selectedQuoteExpired"
              class="flex-1 py-2 rounded-xl text-sm font-medium transition
              bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              {{ accepting ? $t('trade.confirm.confirming') : $t('trade.confirm.confirmButton') }}
            </button>
          </div>
        </template>

      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeft, Loader2, AlertCircle, Copy } from 'lucide-vue-next'
import copy from 'copy-to-clipboard'
import TradeBridgeGate from '@/components/trade/TradeBridgeGate.vue'
import {
  activeQuoteRequest,
  bridgeStatus,
  listQuotes as fetchQuotes,
  cancelQuoteRequest as storeCancelRequest,
  acceptQuote as storeAcceptQuote,
  classifyAcceptError,
} from '@/stores/trade'
import { formatAmount, formatCountdown, secondsUntil } from '@/lib/trade/format'

const route = useRoute()
const router = useRouter()

// Only meaningful when it matches this route's uuid — a stale request from
// a previous /trade/take visit shouldn't be treated as "this" request.
const request = computed(() =>
  activeQuoteRequest.value?.uuid === route.params.uuid ? activeQuoteRequest.value : null
)
const isBuyNav = computed(() => request.value?.buyTokenId === null)
const isSellNav = computed(() => request.value?.sellTokenId === null)

const quotes = ref([])
const now = ref(Date.now())
const windowOpen = computed(() => !!request.value && now.value / 1000 < request.value.expiry)
const windowCountdown = computed(() => (request.value ? formatCountdown(request.value.expiry, now.value) ?? '0s' : ''))

const liveQuotes = computed(() =>
  quotes.value
    .filter((q) => q.orderExpiry > now.value / 1000)
    .slice()
    .sort((a, b) => a.price - b.price)
)

let pollTimer = null
let tickTimer = null

async function poll() {
  if (!request.value || bridgeStatus.value !== 'available') return
  try {
    quotes.value = await fetchQuotes(request.value.uuid)
  } catch {
    // transient — next tick tries again
  }
}

async function cancelRequest() {
  if (!request.value) return
  await storeCancelRequest(request.value.uuid).catch(() => {})
  router.push('/trade/take')
}

onMounted(() => {
  if (request.value) poll()
  pollTimer = setInterval(() => {
    if (windowOpen.value) poll()
  }, 3000)
  tickTimer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})
onUnmounted(() => {
  clearInterval(pollTimer)
  clearInterval(tickTimer)
})

// ── Confirm / accept ──────────────────────────────────────────────────
const selectedQuote = ref(null)
const slippagePct = ref(1)
const accepting = ref(false)
const result = ref(null)
const acceptErrorKind = ref(null)
const acceptErrorMessage = ref('')

const selectedQuoteExpired = computed(
  () => !!selectedQuote.value && secondsUntil(selectedQuote.value.orderExpiry, now.value) === 0
)

// Slippage tolerance applies only to what you pay — the amount you receive
// is never allowed below what you originally asked for (see stores/trade.js
// Phase 3 note: listQuotes defaults to full-fill-or-better quotes only, so
// this is always satisfiable by every quote shown here).
const maxPay = computed(() => {
  if (!selectedQuote.value) return 0n
  const bps = BigInt(Math.round(slippagePct.value * 100))
  return selectedQuote.value.sellCost + (selectedQuote.value.sellCost * bps) / 10_000n
})
const minRecv = computed(() => request.value?.amount ?? 0n)

function closeModal(afterSuccess) {
  selectedQuote.value = null
  result.value = null
  acceptErrorKind.value = null
  acceptErrorMessage.value = ''
  if (afterSuccess) router.push('/trade')
}

async function confirmAccept() {
  if (!request.value || !selectedQuote.value || selectedQuoteExpired.value) return
  accepting.value = true
  acceptErrorKind.value = null
  acceptErrorMessage.value = ''
  try {
    result.value = await storeAcceptQuote({
      uuid: request.value.uuid,
      quoteId: selectedQuote.value.quoteId,
      buyTokenId: request.value.buyTokenId,
      sellTokenId: request.value.sellTokenId,
      maxPay: maxPay.value,
      minRecv: minRecv.value,
    })
  } catch (err) {
    acceptErrorKind.value = classifyAcceptError(err)
    acceptErrorMessage.value = err?.message ?? String(err)
  } finally {
    accepting.value = false
  }
}

function copyId(id) {
  copy(id)
}
</script>
