<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">

    <div class="flex items-center gap-3 px-5 pt-5 pb-5">
      <button @click="router.back()" class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400">
        <ChevronLeft class="w-5 h-5" />
      </button>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('trade.history.title') }}</h1>
    </div>

    <div class="px-5 pb-6 space-y-4">

      <!-- Status filter -->
      <div class="flex gap-1.5 overflow-x-auto pb-1">
        <button
          v-for="f in filters"
          :key="f.value"
          @click="filter = f.value"
          class="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition"
          :class="filter === f.value
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-gh-800 text-gray-600 dark:text-gray-300'"
        >
          {{ f.label }}
        </button>
      </div>

      <div v-if="filtered.length === 0" class="text-center text-sm text-gray-400 dark:text-gray-500 py-8">
        {{ $t('trade.history.empty') }}
      </div>

      <div v-for="entry in filtered" :key="entry.id" class="p-4 rounded-xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ kindLabel(entry) }}</span>
          <span
            class="px-2 py-0.5 rounded text-xs font-semibold"
            :class="statusClass(entry.status)"
          >
            {{ $t(`trade.history.status.${entry.status}`) }}
          </span>
        </div>

        <p class="text-sm font-medium text-gray-900 dark:text-white">
          {{ tokenLabel(pairTokens(entry)[0]) }} → {{ tokenLabel(pairTokens(entry)[1]) }}
        </p>
        <p class="text-xs tabular-nums text-gray-500 dark:text-gray-400">
          {{ formatAmount(BigInt(amountFor(entry)), pairTokens(entry)[0] === null) }}
        </p>

        <p v-if="entry.role === 'taker'" class="text-xs text-gray-400 dark:text-gray-500">
          {{ $t('trade.history.quotesReceived', { n: entry.quotesReceived.length }) }}
        </p>

        <div v-if="entry.txId" class="flex items-center gap-2 pt-1">
          <span class="text-xs text-gray-400 dark:text-gray-500 shrink-0">{{ $t('trade.history.txId') }}</span>
          <span class="font-mono text-xs text-gray-700 dark:text-gray-300 truncate flex-1">{{ entry.txId }}</span>
          <button @click="copyId(entry.txId)" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
            <Copy class="w-3.5 h-3.5" />
          </button>
        </div>
        <p v-else-if="entry.status === 'settled' && entry.role === 'maker'" class="text-xs text-gray-400 dark:text-gray-500 pt-1">
          {{ $t('trade.history.noTxId') }}
        </p>

        <p v-if="entry.error" class="text-xs text-red-500 dark:text-red-400 pt-1">
          {{ $t('trade.history.errorLabel') }}: {{ entry.error }}
        </p>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, Copy } from 'lucide-vue-next'
import copy from 'copy-to-clipboard'
import { swapHistory, loadSwapHistory } from '@/stores/trade'
import { formatAmount } from '@/lib/trade/format'

const router = useRouter()
const { t } = useI18n()

const filter = ref('all')
const filters = computed(() => [
  { value: 'all', label: t('trade.history.filterAll') },
  { value: 'pending', label: t('trade.history.filterPending') },
  { value: 'settled', label: t('trade.history.filterSettled') },
  { value: 'expired', label: t('trade.history.filterExpired') },
  { value: 'failed', label: t('trade.history.filterFailed') },
])

const filtered = computed(() =>
  filter.value === 'all' ? swapHistory.value : swapHistory.value.filter((e) => e.status === filter.value)
)

function kindLabel(entry) {
  if (entry.role === 'taker') return t('trade.history.takerRequest')
  return entry.kind === 'order' ? t('trade.history.makerOrder') : t('trade.history.makerReply')
}

function pairTokens(entry) {
  return entry.role === 'taker' ? [entry.buyTokenId, entry.sellTokenId] : [entry.payTokenId, entry.recvTokenId]
}

function amountFor(entry) {
  return entry.role === 'taker' ? entry.amount : entry.payAmount
}

function tokenLabel(tokenId) {
  return tokenId === null ? 'NAV' : `${tokenId.slice(0, 8)}…`
}

function statusClass(status) {
  switch (status) {
    case 'pending': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'settled': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'failed': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    default: return 'bg-gray-100 text-gray-500 dark:bg-gh-700 dark:text-gray-400' // expired
  }
}

function copyId(id) {
  copy(id)
}

onMounted(() => {
  loadSwapHistory()
})
</script>
