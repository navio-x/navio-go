<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">

    <div class="flex items-center gap-3 px-5 pt-5 pb-5">
      <button @click="router.back()" class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400">
        <ChevronLeft class="w-5 h-5" />
      </button>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('trade.manage.title') }}</h1>
      <button @click="refresh" class="ml-auto p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-500 dark:text-gray-400">
        <RefreshCw class="w-4 h-4" :class="loading ? 'animate-spin' : ''" />
      </button>
    </div>

    <div class="px-5 pb-6 space-y-6">

      <!-- Active intents -->
      <div class="space-y-2">
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 px-1">{{ $t('trade.manage.intentsTitle') }}</h2>
        <p v-if="swapIntents.length === 0" class="text-sm text-gray-400 dark:text-gray-500 px-1">{{ $t('trade.manage.noIntents') }}</p>
        <div
          v-for="intent in swapIntents"
          :key="intent.id"
          class="p-4 rounded-xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 flex items-center gap-3"
        >
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ tokenLabel(intent.tokenIn) }} → {{ tokenLabel(intent.tokenOut) }}
            </p>
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {{ formatAmount(intent.minSize, intent.tokenIn === null) }} – {{ formatAmount(intent.maxSize, intent.tokenIn === null) }}
            </p>
            <p class="text-xs mt-0.5" :class="formatCountdown(intent.expiry, now) ? 'text-gray-400 dark:text-gray-500' : 'text-red-500 dark:text-red-400'">
              {{ formatCountdown(intent.expiry, now) ? $t('trade.manage.expiresIn', { t: formatCountdown(intent.expiry, now) }) : $t('trade.manage.expired') }}
            </p>
          </div>
          <button
            @click="onClearIntent(intent.id)"
            :disabled="clearingId === intent.id"
            class="text-xs font-medium text-red-500 dark:text-red-400 disabled:opacity-50 shrink-0"
          >
            {{ clearingId === intent.id ? $t('trade.manage.clearing') : $t('trade.manage.clear') }}
          </button>
        </div>
      </div>

      <!-- Outstanding quotes (locally reserved) -->
      <div class="space-y-2">
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 px-1">{{ $t('trade.manage.quotesTitle') }}</h2>
        <p v-if="quoteReservations.length === 0" class="text-sm text-gray-400 dark:text-gray-500 px-1">{{ $t('trade.manage.noneOutstanding') }}</p>
        <ReservationRow v-for="r in quoteReservations" :key="r.id" :reservation="r" :now="now" />
      </div>

      <!-- Published standing orders (locally reserved) -->
      <div class="space-y-2">
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 px-1">{{ $t('trade.manage.ordersTitle') }}</h2>
        <p v-if="orderReservations.length === 0" class="text-sm text-gray-400 dark:text-gray-500 px-1">{{ $t('trade.manage.noneOutstanding') }}</p>
        <ReservationRow v-for="r in orderReservations" :key="r.id" :reservation="r" :now="now" />
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, defineComponent, h } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, RefreshCw } from 'lucide-vue-next'
import { swapIntents, refreshSwapIntents, removeSwapIntent, reservations } from '@/stores/trade'
import { formatAmount, formatCountdown } from '@/lib/trade/format'

const router = useRouter()
const { t } = useI18n()

const loading = ref(false)
const now = ref(Date.now())
let tickTimer = null

async function refresh() {
  loading.value = true
  try {
    await refreshSwapIntents()
  } finally {
    loading.value = false
  }
}

const clearingId = ref(null)
async function onClearIntent(id) {
  clearingId.value = id
  try {
    await removeSwapIntent(id)
  } finally {
    clearingId.value = null
  }
}

const quoteReservations = computed(() => reservations.value.filter((r) => r.kind === 'quote'))
const orderReservations = computed(() => reservations.value.filter((r) => r.kind === 'order'))

function tokenLabel(tokenId) {
  return tokenId === null ? 'NAV' : `${tokenId.slice(0, 8)}…`
}

onMounted(() => {
  refresh()
  tickTimer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})
onUnmounted(() => clearInterval(tickTimer))

// Small local row component — used for both quote and order reservations,
// which share the exact same shape and display needs.
const ReservationRow = defineComponent({
  props: { reservation: { type: Object, required: true }, now: { type: Number, required: true } },
  setup(props) {
    return () => {
      const r = props.reservation
      const lockedTotal = [...r.payOutputs, ...r.navFeeOutputs].reduce((s, o) => s + BigInt(o.amount), 0n)
      const countdown = formatCountdown(r.expiry, props.now)
      return h('div', { class: 'p-4 rounded-xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 space-y-1' }, [
        h('p', { class: 'text-sm font-medium text-gray-900 dark:text-white' }, [
          `${tokenLabel(r.payTokenId)} → ${tokenLabel(r.recvTokenId)}`,
        ]),
        h('p', { class: 'text-xs text-gray-400 dark:text-gray-500' }, [
          `${t('trade.manage.locked')}: ${formatAmount(lockedTotal, r.payTokenId === null)}`,
        ]),
        h(
          'p',
          { class: countdown ? 'text-xs text-gray-400 dark:text-gray-500' : 'text-xs text-red-500 dark:text-red-400' },
          [countdown ? t('trade.manage.expiresIn', { t: countdown }) : t('trade.manage.expired')]
        ),
      ])
    }
  },
})
</script>
