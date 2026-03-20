<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gh-900 p-5 pb-24 space-y-4">

    <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('wallet.transactionHistory') }}</h1>

      <!-- Loading state -->
      <div
        v-if="loading"
        class="flex flex-col items-center justify-center py-24 text-gray-400 dark:text-gray-500 space-y-3"
      >
        <Loader2 class="w-8 h-8 animate-spin opacity-60" />
        <p class="text-sm">{{ $t('wallet.loadingTransactions') }}</p>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="txHistory.length === 0"
        class="flex flex-col items-center justify-center h-full py-16 text-gray-400 dark:text-gray-500 space-y-3"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p class="text-sm">{{ $t('wallet.noTransactionsYet') }}</p>
      </div>

      <!-- TX list -->
      <template v-else>
        <!-- Summary cards -->
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div class="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40">
            <p class="text-xs font-medium text-green-600 dark:text-green-400 flex items-baseline justify-between">
              {{ $t('wallet.received') }}
              <span class="font-bold text-green-700 dark:text-green-300 tabular-nums">{{ recvTxs.length }} {{ $t('wallet.txs') }}</span>
            </p>
            <p class="text-sm font-semibold text-green-700 dark:text-green-300 mt-1 tabular-nums">+{{ formatNav(recvTotal) }} NAV</p>
          </div>
          <div class="p-3 rounded-xl bg-rose-100 dark:bg-rose-900/30 border border-rose-300 dark:border-rose-700/50">
            <p class="text-xs font-medium text-rose-500 dark:text-rose-400 flex items-baseline justify-between">
              {{ $t('wallet.sent') }}
              <span class="font-bold text-rose-600 dark:text-rose-400 tabular-nums">{{ sentTxs.length }} {{ $t('wallet.txs') }}</span>
            </p>
            <p class="text-sm font-semibold text-rose-600 dark:text-rose-400 mt-1 tabular-nums">-{{ formatNav(sentTotal) }} NAV</p>
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
          <!-- Row 1: hash + amount -->
          <div class="flex justify-between items-start">
            <span class="text-xs font-mono text-gray-400 dark:text-gray-500 truncate max-w-[55%]">
              {{ tx.txHash.slice(0, 16) }}…
            </span>
            <span
              class="font-semibold tabular-nums"
              :class="{
                'text-green-500 dark:text-green-400': tx.net > 0n,
                'text-rose-600 dark:text-rose-400':  tx.net < 0n,
                'text-gray-400':                      tx.net === 0n,
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
                'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400': tx.type === 'recv',
                'bg-rose-100  text-rose-600  dark:bg-rose-900/40  dark:text-rose-400':  tx.type === 'sent',
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
            class="text-xs text-gray-500 dark:text-gray-400 italic truncate"
          >
            {{ tx.memos.join(', ') }}
          </div>
        </div>

        <!-- Footer count -->
        <p class="text-center text-xs text-gray-400 dark:text-gray-600 pt-2">
          {{ $t('wallet.txCount', { n: txHistory.length }) }}
        </p>
      </template>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import { txHistory, refreshHistory } from "@/stores/navio";
import { Loader2 } from "lucide-vue-next";

const { t } = useI18n();
const loading = ref(true);

onMounted(async () => {
  await refreshHistory();
  loading.value = false;
});

const recvTxs = computed(() => txHistory.value.filter(tx => tx.type === 'recv'));
const sentTxs = computed(() => txHistory.value.filter(tx => tx.type === 'sent'));
const recvTotal = computed(() => recvTxs.value.reduce((sum, tx) => sum + Math.abs(tx.navAmount), 0));
const sentTotal = computed(() => sentTxs.value.reduce((sum, tx) => sum + Math.abs(tx.navAmount), 0));

const formatNav = (navAmount) =>
  parseFloat(Math.abs(navAmount).toFixed(8)).toString();

const typeLabel = (type) =>
  ({
    recv: t('wallet.received'),
    sent: t('wallet.sent'),
    self: t('wallet.self'),
  }[type] ?? type);
</script>