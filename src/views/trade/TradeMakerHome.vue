<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">

    <div class="flex items-center gap-3 px-5 pt-5 pb-5">
      <button @click="router.push('/trade')" class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400">
        <ChevronLeft class="w-5 h-5" />
      </button>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('trade.maker.title') }}</h1>
    </div>

    <TradeBridgeGate>
      <div class="px-5 pb-6 space-y-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('trade.maker.intro') }}</p>

        <!-- Persistent, visible while running — reachable from here even if
             the user isn't on the Respond screen (see stores/trade.js). -->
        <div
          v-if="autoReplyEnabled"
          class="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-4 py-3 flex items-center gap-3"
        >
          <span class="relative flex h-2.5 w-2.5 shrink-0">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
          </span>
          <p class="text-xs text-amber-800 dark:text-amber-300 flex-1">{{ $t('trade.maker.respond.autoReplyOnBanner') }}</p>
          <button @click="setAutoReply(false)" class="text-xs font-semibold text-amber-800 dark:text-amber-300 underline shrink-0">
            {{ $t('trade.maker.respond.turnOff') }}
          </button>
        </div>

        <button
          @click="router.push('/trade/maker/intent')"
          class="w-full p-4 rounded-xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gh-700 transition-colors"
        >
          <div class="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
            <Megaphone class="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ $t('trade.maker.intentCta') }}</p>
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('trade.maker.intentCtaDesc') }}</p>
          </div>
          <ChevronRight class="w-4 h-4 opacity-40 shrink-0" />
        </button>

        <button
          @click="router.push('/trade/maker/respond')"
          class="w-full p-4 rounded-xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gh-700 transition-colors"
        >
          <div class="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0 relative">
            <MessageSquareReply class="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span
              v-if="pendingRequests.length > 0"
              class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
            >
              {{ pendingRequests.length }}
            </span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ $t('trade.maker.respondCta') }}</p>
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('trade.maker.respondCtaDesc') }}</p>
          </div>
          <ChevronRight class="w-4 h-4 opacity-40 shrink-0" />
        </button>

        <button
          @click="router.push('/trade/maker/order')"
          class="w-full p-4 rounded-xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gh-700 transition-colors"
        >
          <div class="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
            <FileSignature class="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ $t('trade.maker.orderCta') }}</p>
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('trade.maker.orderCtaDesc') }}</p>
          </div>
          <ChevronRight class="w-4 h-4 opacity-40 shrink-0" />
        </button>

        <button
          @click="router.push('/trade/manage')"
          class="w-full p-4 rounded-xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gh-700 transition-colors"
        >
          <div class="w-9 h-9 rounded-full bg-gray-100 dark:bg-gh-700 flex items-center justify-center shrink-0">
            <LayoutList class="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ $t('trade.maker.manageCta') }}</p>
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('trade.maker.manageCtaDesc') }}</p>
          </div>
          <ChevronRight class="w-4 h-4 opacity-40 shrink-0" />
        </button>
      </div>
    </TradeBridgeGate>

  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, ChevronRight, Megaphone, MessageSquareReply, FileSignature, LayoutList } from 'lucide-vue-next'
import TradeBridgeGate from '@/components/trade/TradeBridgeGate.vue'
import {
  pendingRequests,
  autoReplyEnabled,
  setAutoReply,
  startPendingSubscription,
  stopPendingSubscription,
} from '@/stores/trade'

const router = useRouter()

// Live pending-count badge, same lifecycle discipline as the Respond
// screen: start on mount for a live count, but don't leave the
// subscription running just because someone glanced at this hub — unless
// auto-reply is the reason it's running, in which case it must survive
// navigating away (see stores/trade.js setAutoReply).
onMounted(() => {
  startPendingSubscription()
})
onUnmounted(() => {
  if (!autoReplyEnabled.value) stopPendingSubscription()
})
</script>
