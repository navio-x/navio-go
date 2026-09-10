<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">

    <div class="flex items-center gap-3 px-5 pt-5 pb-5">
      <button @click="router.back()" class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400">
        <ChevronLeft class="w-5 h-5" />
      </button>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('trade.maker.respond.title') }}</h1>
    </div>

    <TradeBridgeGate>
      <div class="px-5 pb-6 space-y-4">

        <!-- Auto-reply toggle — off by default, visibly indicated while on -->
        <div class="rounded-xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ $t('trade.maker.respond.autoReplyLabel') }}</p>
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-snug">{{ $t('trade.maker.respond.autoReplyDesc') }}</p>
          </div>
          <button
            @click="onToggleAutoReply"
            :class="autoReplyEnabled ? 'bg-amber-500' : 'bg-gray-200 dark:bg-gh-600'"
            class="relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none"
            role="switch"
            :aria-checked="autoReplyEnabled"
          >
            <span
              :class="autoReplyEnabled ? 'translate-x-5' : 'translate-x-0'"
              class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
            />
          </button>
        </div>

        <div
          v-if="autoReplyEnabled"
          class="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-4 py-3 flex items-center gap-3"
        >
          <span class="relative flex h-2.5 w-2.5 shrink-0">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
          </span>
          <p class="text-xs text-amber-800 dark:text-amber-300">{{ $t('trade.maker.respond.autoReplyOnBanner') }}</p>
        </div>

        <!-- Pending requests -->
        <div v-if="pendingRequests.length === 0" class="text-center text-sm text-gray-400 dark:text-gray-500 py-8">
          {{ $t('trade.maker.respond.empty') }}
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="req in pendingRequests"
            :key="req.uuid"
            class="p-4 rounded-xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('trade.maker.respond.makerDelivers') }}</p>
                <p class="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{{ formatAmount(req.fill, req.buyTokenId === null) }}</p>
              </div>
              <div class="text-right">
                <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('trade.maker.respond.makerReceives') }}</p>
                <p class="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{{ formatAmount(req.sellCost, req.sellTokenId === null) }}</p>
              </div>
            </div>
            <button
              v-if="!autoReplyEnabled"
              @click="manualReply(req)"
              :disabled="replyingTo === req.uuid || repliedUuids.has(req.uuid)"
              class="mt-3 w-full py-2 rounded-xl text-sm font-medium transition bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              {{ replyingTo === req.uuid ? $t('trade.maker.respond.replying') : $t('trade.maker.respond.reply') }}
            </button>
            <p v-if="replyErrors[req.uuid]" class="mt-2 text-xs text-red-500 dark:text-red-400">{{ replyErrors[req.uuid] }}</p>
          </div>
        </div>

        <!-- Recent activity (mainly useful while auto-reply is running) -->
        <div v-if="autoReplyLog.length > 0" class="space-y-2">
          <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 px-1">{{ $t('trade.maker.respond.activityTitle') }}</h2>
          <div class="rounded-xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 divide-y divide-gray-100 dark:divide-gh-700 overflow-hidden">
            <div v-for="entry in autoReplyLog" :key="entry.time + entry.uuid" class="px-4 py-2.5 text-xs">
              <p v-if="entry.quoteId" class="text-gray-600 dark:text-gray-300">
                {{ $t('trade.maker.respond.activityReplied', { quoteId: entry.quoteId }) }}
              </p>
              <p v-else class="text-red-500 dark:text-red-400">
                {{ $t('trade.maker.respond.activityFailed', { error: entry.error }) }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </TradeBridgeGate>

    <!-- Auto-reply opt-in confirmation -->
    <div v-if="showAutoReplyConfirm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('trade.maker.respond.autoReplyConfirmTitle') }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{{ $t('trade.maker.respond.autoReplyConfirmBody') }}</p>
        <div class="flex gap-2 pt-1">
          <button
            @click="showAutoReplyConfirm = false"
            class="flex-1 py-2 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
          >
            {{ $t('trade.confirm.cancel') }}
          </button>
          <button
            @click="confirmEnableAutoReply"
            class="flex-1 py-2 rounded-xl text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white"
          >
            {{ $t('trade.maker.respond.autoReplyConfirmEnable') }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft } from 'lucide-vue-next'
import TradeBridgeGate from '@/components/trade/TradeBridgeGate.vue'
import {
  pendingRequests,
  autoReplyEnabled,
  autoReplyLog,
  setAutoReply,
  startPendingSubscription,
  stopPendingSubscription,
  makerReplyQuote,
} from '@/stores/trade'
import { formatAmount } from '@/lib/trade/format'

const router = useRouter()

const showAutoReplyConfirm = ref(false)
function onToggleAutoReply() {
  if (autoReplyEnabled.value) {
    setAutoReply(false)
  } else {
    showAutoReplyConfirm.value = true
  }
}
function confirmEnableAutoReply() {
  showAutoReplyConfirm.value = false
  setAutoReply(true)
}

const replyingTo = ref(null)
const repliedUuids = ref(new Set())
const replyErrors = ref({})

async function manualReply(request) {
  replyingTo.value = request.uuid
  replyErrors.value = { ...replyErrors.value, [request.uuid]: '' }
  try {
    await makerReplyQuote(request)
    repliedUuids.value = new Set([...repliedUuids.value, request.uuid])
  } catch (err) {
    replyErrors.value = { ...replyErrors.value, [request.uuid]: err?.message ?? String(err) }
  } finally {
    replyingTo.value = null
  }
}

onMounted(() => {
  startPendingSubscription()
})
onUnmounted(() => {
  if (!autoReplyEnabled.value) stopPendingSubscription()
})
</script>
