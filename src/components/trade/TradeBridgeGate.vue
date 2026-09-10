<template>
  <div v-if="bridgeStatus === 'idle' || bridgeStatus === 'checking'" class="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 space-y-3 px-5 pb-6">
    <Loader2 class="w-8 h-8 animate-spin opacity-60" />
    <p class="text-sm">{{ $t('trade.unavailable.checking') }}</p>
  </div>

  <div v-else-if="bridgeStatus !== 'available'" class="flex-1 flex items-center justify-center px-5 pb-6">
    <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-8 flex flex-col items-center gap-5 text-center w-full max-w-xs">
      <div class="w-20 h-20 rounded-3xl bg-gray-100 dark:bg-gh-700 flex items-center justify-center">
        <ArrowLeftRight class="w-10 h-10 text-gray-400 dark:text-gray-500" stroke-width="1.5" />
      </div>
      <div class="space-y-1.5">
        <p class="font-semibold text-gray-800 dark:text-gray-100">{{ $t('trade.unavailable.title') }}</p>
        <p class="text-sm text-gray-400 dark:text-gray-500 leading-relaxed">{{ $t('trade.unavailable.body') }}</p>
      </div>
      <button @click="probeBridge" :disabled="bridgeStatus === 'checking'" class="text-sm font-medium text-blue-600 dark:text-blue-400 disabled:opacity-40">
        {{ $t('trade.unavailable.retry') }}
      </button>
    </div>
  </div>

  <slot v-else />
</template>

<script setup>
import { Loader2, ArrowLeftRight } from 'lucide-vue-next'
import { bridgeStatus, probeBridge } from '@/stores/trade'
</script>
