<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">

    <h1 class="text-xl font-bold text-gray-900 dark:text-white px-5 pt-5 pb-5">{{ $t('wallet.transactionHistory') }}</h1>

      <!-- Loading state -->
      <div
        v-if="loading"
        class="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 space-y-3"
      >
        <Loader2 class="w-8 h-8 animate-spin opacity-60" />
        <p class="text-sm">{{ $t('wallet.loadingTransactions') }}</p>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="txHistory.length === 0"
        class="flex-1 flex items-center justify-center px-5 pb-6"
      >
        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-8 flex flex-col items-center gap-5 text-center w-full max-w-xs">
          <!-- Icon -->
          <div class="w-20 h-20 rounded-3xl bg-gray-100 dark:bg-gh-700 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M9 14l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <!-- Text -->
          <div class="space-y-1.5">
            <p class="font-semibold text-gray-800 dark:text-gray-100">{{ $t('wallet.noTransactionsYet') }}</p>
            <p class="text-sm text-gray-400 dark:text-gray-500 leading-relaxed">{{ $t('wallet.noTransactionsDesc') }}</p>
          </div>
        </div>
      </div>

      <!-- TX list -->
      <template v-else>
        <div class="px-5 pb-6 space-y-4">
        <!-- Summary cards -->
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div class="p-3 rounded-xl bg-green-50 dark:bg-green-900/15 border border-green-100 dark:border-green-800/30">
            <p class="text-xs font-medium text-green-700 dark:text-green-400 flex items-baseline justify-between">
              {{ $t('wallet.received') }}
              <span class="font-bold tabular-nums">{{ recvTxs.length }} {{ $t('wallet.txs') }}</span>
            </p>
            <p class="text-sm font-semibold text-green-700 dark:text-green-400 mt-1 tabular-nums">+{{ formatNav(recvTotal) }} NAV</p>
          </div>
          <div class="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/15 border border-rose-100 dark:border-rose-800/30">
            <p class="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-baseline justify-between">
              {{ $t('wallet.sent') }}
              <span class="font-bold tabular-nums">{{ sentTxs.length }} {{ $t('wallet.txs') }}</span>
            </p>
            <p class="text-sm font-semibold text-rose-600 dark:text-rose-400 mt-1 tabular-nums">{{ sentTotal > 0 ? '-' : '' }}{{ formatNav(sentTotal) }} NAV</p>
          </div>
        </div>

        <div
          v-for="tx in txHistory"
          :key="tx.txHash"
          class="p-4 rounded-xl border bg-gray-50 dark:bg-gh-800 space-y-2"
          :class="tx.isUnconfirmed
            ? 'border-yellow-400/40 dark:border-yellow-500/30'
            : 'border-gray-200 dark:border-gh-700'"
        >
          <!-- Row 1: icon + amount -->
          <div class="flex items-center gap-1.5">
            <span
              class="shrink-0 flex items-center justify-center w-5 h-5 rounded-full"
              :class="{
                'bg-green-100 dark:bg-green-900/40': tx.net > 0n,
                'bg-rose-100 dark:bg-rose-900/40':   tx.net < 0n,
                'bg-gray-100 dark:bg-gh-700':         tx.net === 0n,
              }"
            >
              <svg v-if="tx.net > 0n" xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-green-500 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m0 0l-6-6m6 6l6-6" />
              </svg>
              <svg v-else-if="tx.net < 0n" xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-rose-500 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 20V4m0 0l-6 6m6-6l6 6" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7h8M8 12h8m-8 5h8" />
              </svg>
            </span>
            <span
              class="font-semibold tabular-nums"
              :class="{
                'text-green-700 dark:text-green-400': tx.net > 0n,
                'text-rose-600 dark:text-rose-400':   tx.net < 0n,
                'text-gray-400':                       tx.net === 0n,
              }"
            >
              {{ tx.net > 0n ? '+' : tx.net < 0n ? '' : '±' }}{{ formatNav(tx.navAmount) }} NAV
            </span>
          </div>

          <!-- Row 2: badges + height -->
          <div class="flex items-center gap-2 flex-wrap">
            <!-- Type badge -->
            <span
              class="text-xs font-medium px-2 py-0.5 rounded-full"
              :class="{
                'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400': tx.type === 'recv',
                'bg-rose-50  text-rose-600  dark:bg-rose-900/30  dark:text-rose-400':  tx.type === 'sent',
                'bg-blue-100  text-blue-700  dark:bg-blue-900/40  dark:text-blue-400':  tx.type === 'self',
              }"
            >
              {{ typeLabel(tx.type) }}
            </span>

            <!-- Pending badge -->
            <span
              v-if="tx.isUnconfirmed"
              class="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
            >
              {{ $t('wallet.pending') }}
            </span>

            <!-- Block height -->
            <span class="text-xs text-gray-400 dark:text-gray-500">
              {{ tx.isUnconfirmed ? $t('wallet.unconfirmed') : `${$t('wallet.block')} ${tx.blockHeight}` }}
            </span>

            <!-- Output count -->
            <span v-if="tx.outputCount > 1" class="text-xs text-gray-400 dark:text-gray-500">
              {{ tx.outputCount }} {{ $t('wallet.outputs') }}
            </span>
          </div>

          <!-- Row 3: memos -->
          <div
            v-if="tx.memos.length > 0"
            class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 italic truncate"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 shrink-0 not-italic opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <span class="truncate">{{ tx.memos.join(', ') }}</span>
          </div>
        </div>

        <!-- Footer count -->
        <p class="text-center text-xs text-gray-400 dark:text-gray-600 pt-2">
          {{ $t('wallet.txCount', { n: txHistory.length }) }}
        </p>
        </div>
      </template>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import { txHistory, refreshHistory } from "@/stores/navio";
import { Loader2 } from "lucide-vue-next";

const { t } = useI18n();
const loading = ref(true);
let pollTimer = null;

onMounted(async () => {
  await refreshHistory();
  loading.value = false;
  pollTimer = setInterval(refreshHistory, 10000);
});

onUnmounted(() => {
  clearInterval(pollTimer);
});

const recvTxs = computed(() => txHistory.value.filter(tx => tx.type === 'recv'));
const sentTxs = computed(() => txHistory.value.filter(tx => tx.type === 'sent'));
const recvTotal = computed(() => recvTxs.value.reduce((sum, tx) => sum + Math.abs(tx.navAmount), 0));
const sentTotal = computed(() => sentTxs.value.reduce((sum, tx) => sum + Math.abs(tx.navAmount), 0));

const formatNav = (navAmount) => {
  const n = Math.abs(Number(navAmount))
  if (!n) return '0'
  return n.toLocaleString(undefined, { maximumFractionDigits: 8 })
}

const typeLabel = (type) =>
  ({
    recv: t('wallet.received'),
    sent: t('wallet.sent'),
    self: t('wallet.self'),
  }[type] ?? type);
</script>