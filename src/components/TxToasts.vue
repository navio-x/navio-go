<!-- New-transaction toasts, at the top of the screen: green for NAV received,
     red for NAV sent, violet for a staking reward. Each leaves on its own
     after 5 seconds (see stores/txNotifications.js); tapping one opens the
     history, the cross just closes it. -->
<template>
  <div
    class="fixed inset-x-0 z-[300] flex flex-col items-center gap-2 px-4 pointer-events-none"
    :style="{ top: 'calc(env(safe-area-inset-top) + 0.75rem)' }"
    role="status"
    aria-live="polite"
  >
    <TransitionGroup
      enter-from-class="opacity-0 -translate-y-3"
      enter-active-class="transition duration-200 ease-out"
      leave-to-class="opacity-0 -translate-y-3"
      leave-active-class="transition duration-200 ease-in"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto w-full max-w-sm flex items-center gap-3 rounded-2xl border pl-3 pr-2 py-2.5 shadow-lg
               bg-white/95 dark:bg-gh-800/95 backdrop-blur border-gray-200 dark:border-gh-700"
      >
        <button type="button" @click="openHistory(toast.id)" class="min-w-0 flex-1 flex items-center gap-3 text-left">
          <span class="shrink-0 w-9 h-9 rounded-full flex items-center justify-center" :class="KINDS[toast.kind].badge">
            <component :is="KINDS[toast.kind].icon" class="w-4.5 h-4.5" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-semibold text-gray-900 dark:text-white truncate">{{ $t(KINDS[toast.kind].title) }}</span>
            <span v-if="toast.pending" class="block text-xs text-gray-400 dark:text-gray-500">{{ $t('wallet.pending') }}</span>
          </span>
          <span class="shrink-0 text-sm font-bold tabular-nums" :class="KINDS[toast.kind].amount">
            {{ KINDS[toast.kind].sign }}{{ formatAmount(toast.amount / 1e8, 8) }} NAV
          </span>
        </button>
        <button
          type="button"
          @click="dismissToast(toast.id)"
          class="shrink-0 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gh-700"
          :aria-label="$t('common.close')"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { ArrowDownLeft, ArrowUpRight, Sparkles, X } from 'lucide-vue-next'
import { toasts, dismissToast } from '@/stores/txNotifications'
import { formatAmount } from '@/lib/displayFormat'

const router = useRouter()

const KINDS = {
  in: {
    icon: ArrowDownLeft,
    title: 'toast.received',
    sign: '+',
    badge: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400',
    amount: 'text-green-600 dark:text-green-400',
  },
  out: {
    icon: ArrowUpRight,
    title: 'toast.sent',
    sign: '−',
    badge: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
    amount: 'text-red-600 dark:text-red-400',
  },
  reward: {
    icon: Sparkles,
    title: 'toast.reward',
    sign: '+',
    badge: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400',
    amount: 'text-violet-600 dark:text-violet-400',
  },
}

function openHistory(id) {
  dismissToast(id)
  router.push('/wallet/history')
}
</script>
