<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">

    <div class="flex items-center justify-between px-5 pt-5 pb-5">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('trade.title') }}</h1>
      <div class="flex items-center gap-1">
        <!-- Inventory and history browsing don't need the trading bridge — always reachable. -->
        <button
          @click="router.push('/trade/assets')"
          class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-500 dark:text-gray-400"
          :aria-label="$t('trade.viewAssets')"
        >
          <Layers class="w-4 h-4" />
        </button>
        <button
          @click="router.push('/trade/history')"
          class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-500 dark:text-gray-400"
          :aria-label="$t('trade.history.title')"
        >
          <History class="w-4 h-4" />
        </button>
        <button
          @click="probeBridge"
          :disabled="bridgeStatus === 'checking'"
          class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-500 dark:text-gray-400 disabled:opacity-40"
          :aria-label="$t('trade.unavailable.retry')"
        >
          <RefreshCw class="w-4 h-4" :class="bridgeStatus === 'checking' ? 'animate-spin' : ''" />
        </button>
      </div>
    </div>

    <!-- Checking -->
    <div
      v-if="bridgeStatus === 'idle' || bridgeStatus === 'checking'"
      class="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 space-y-3 px-5 pb-6"
    >
      <Loader2 class="w-8 h-8 animate-spin opacity-60" />
      <p class="text-sm">{{ $t('trade.unavailable.checking') }}</p>
    </div>

    <!-- Unavailable: plain, calm connectivity state — not an error dialog -->
    <div
      v-else-if="bridgeStatus === 'unavailable' || bridgeStatus === 'disabled'"
      class="flex-1 flex items-center justify-center px-5 pb-6"
    >
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-8 flex flex-col items-center gap-5 text-center w-full max-w-xs">
        <div class="w-20 h-20 rounded-3xl bg-gray-100 dark:bg-gh-700 flex items-center justify-center">
          <ArrowLeftRight class="w-10 h-10 text-gray-400 dark:text-gray-500" stroke-width="1.5" />
        </div>
        <div class="space-y-1.5">
          <p class="font-semibold text-gray-800 dark:text-gray-100">{{ $t('trade.unavailable.title') }}</p>
          <p class="text-sm text-gray-400 dark:text-gray-500 leading-relaxed">{{ $t('trade.unavailable.body') }}</p>
        </div>
        <div class="flex items-center gap-4">
          <button
            @click="probeBridge"
            :disabled="bridgeStatus === 'checking'"
            class="text-sm font-medium text-blue-600 dark:text-blue-400 disabled:opacity-40"
          >
            {{ $t('trade.unavailable.retry') }}
          </button>
          <button
            @click="router.push('/trade/assets')"
            class="text-sm font-medium text-gray-500 dark:text-gray-400"
          >
            {{ $t('trade.viewAssets') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Available: bridge is up. -->
    <div v-else class="px-5 pb-6 space-y-3">
      <div
        v-if="autoReplyEnabled"
        class="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 flex items-center gap-3"
      >
        <span class="relative flex h-2.5 w-2.5 shrink-0">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
        </span>
        <p class="text-xs text-amber-800 dark:text-amber-300 flex-1">{{ $t('trade.maker.respond.autoReplyOnBanner') }}</p>
      </div>

      <button
        v-if="activeQuoteRequest"
        @click="router.push(`/trade/take/${activeQuoteRequest.uuid}`)"
        class="w-full p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 flex items-center gap-3 text-left"
      >
        <Loader2 class="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-blue-800 dark:text-blue-300">{{ $t('trade.quotes.collecting') }}</p>
          <p class="text-xs text-blue-600/70 dark:text-blue-400/70">{{ $t('trade.quotes.title') }}</p>
        </div>
      </button>

      <button
        @click="router.push('/trade/take')"
        class="w-full p-4 rounded-xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gh-700 transition-colors"
      >
        <div class="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
          <ArrowLeftRight class="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ $t('trade.take.cta') }}</p>
          <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('trade.take.intro') }}</p>
        </div>
        <ChevronRight class="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
      </button>

      <button
        @click="router.push('/trade/maker')"
        class="w-full p-4 rounded-xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gh-700 transition-colors"
      >
        <div class="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0">
          <Megaphone class="w-4 h-4 text-purple-600 dark:text-purple-400" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ $t('trade.maker.cta') }}</p>
          <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('trade.maker.intro') }}</p>
        </div>
        <ChevronRight class="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
      </button>
    </div>

  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Loader2, RefreshCw, ArrowLeftRight, ChevronRight, Layers, Megaphone, History } from 'lucide-vue-next'
import { bridgeStatus, probeBridge, activeQuoteRequest, autoReplyEnabled } from '@/stores/trade'

const router = useRouter()

onMounted(() => {
  probeBridge()
})
</script>
