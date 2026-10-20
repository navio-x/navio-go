<!-- One operation, compact: what it is, how far it is, what is happening
     now, and — only when the user is needed — the one button that moves it
     on. Tapping it opens the full page. -->
<template>
  <div class="rounded-2xl border bg-white dark:bg-gh-800" :class="borderClass">
    <button type="button" @click="router.push(`/activity/${op.id}`)" class="w-full p-4 text-left">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ head.title }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 tabular-nums truncate">{{ head.subtitle }}</p>
        </div>
        <span class="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums" :class="chip.class">{{ chip.label }}</span>
      </div>
      <div v-if="op.status === 'running' || op.status === 'awaiting' || op.status === 'attention'" class="mt-3">
        <div class="h-1 rounded-full bg-gray-100 dark:bg-gh-700 overflow-hidden">
          <div class="h-full rounded-full transition-[width] duration-500" :class="barClass" :style="{ width: percent + '%' }" />
        </div>
        <p class="mt-2 text-xs leading-snug" :class="lineClass">{{ line }}</p>
      </div>
      <p v-else class="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-snug">{{ outcome }}</p>
    </button>

    <div v-if="actions.length || op.status === 'running'" class="px-4 pb-4 flex items-center gap-2">
      <button
        v-for="action in primaryActions"
        :key="action.id"
        @click="action.run"
        class="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white"
      >
        {{ action.label }}
      </button>
      <button
        v-if="op.status === 'done' || op.status === 'cancelled'"
        @click="dismissOperation(op.id)"
        class="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gh-700 text-gray-700 dark:text-gray-300"
      >
        {{ $t('process.actions.dismiss') }}
      </button>
      <button
        type="button"
        @click="router.push(`/activity/${op.id}`)"
        class="ml-auto flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400"
      >
        {{ $t('process.view') }}
        <ChevronRight class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, toRef } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronRight } from 'lucide-vue-next'
import { dismissOperation } from '@/stores/operations'
import { useProcessActions } from '@/composables/useProcessActions'
import { titleOf, statusLine, progressOf } from '@/lib/intent/present'
import { formatAmount } from '@/lib/displayFormat'

const props = defineProps({ op: { type: Object, required: true } })
const router = useRouter()
const { t } = useI18n()
const { actions } = useProcessActions(toRef(props, 'op'))

const head = computed(() => titleOf(props.op, t))
const progress = computed(() => progressOf(props.op))
const percent = computed(() => (progress.value.total ? (progress.value.done / progress.value.total) * 100 : 0))
const line = computed(() => statusLine(props.op, t))
// On the card only the one action that moves things on; the rest is on the page.
const primaryActions = computed(() => actions.value.filter((a) => a.primary && a.id !== 'requote'))

const chip = computed(() => {
  const o = props.op
  if (o.status === 'running') return { label: t('process.progress', progress.value), class: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' }
  if (o.status === 'awaiting') return { label: t('process.status.awaiting'), class: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' }
  if (o.status === 'attention') return { label: t('process.status.attention'), class: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' }
  if (o.status === 'done') return { label: t('process.status.done'), class: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' }
  return { label: t('process.status.cancelled'), class: 'bg-gray-100 dark:bg-gh-700 text-gray-500 dark:text-gray-400' }
})
const borderClass = computed(() => ({
  attention: 'border-red-200 dark:border-red-900/60',
  awaiting: 'border-blue-300 dark:border-blue-800',
}[props.op.status] ?? 'border-gray-200 dark:border-gh-700'))
const barClass = computed(() => (props.op.status === 'attention' ? 'bg-red-500' : 'bg-blue-500'))
const lineClass = computed(() => (props.op.status === 'attention' ? 'text-red-600 dark:text-red-400' : props.op.status === 'awaiting' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-300'))

const outcome = computed(() => {
  const op = props.op
  if (op.status === 'cancelled') return t('ops.outcome.cancelled')
  if (op.kind === 'toExchange') return t('ops.outcome.toExchange')
  if (op.kind === 'toWallet') return t('ops.outcome.toWallet')
  if (op.kind === 'receiveViaBridge') return t('process.setupOnlyDone')
  const parts = [t('ops.outcome.swap', { amount: formatAmount(op.ctx.received), symbol: op.ctx.receivedSymbol ?? op.to })]
  if (op.ctx.partial) parts.push(t('ops.outcome.partial'))
  if (op.deliversToWallet) parts.push(t('ops.outcome.toWallet'))
  else if (op.to === 'NAV') parts.push(t('ops.outcome.keptOnExchange'))
  return parts.join(' ')
})
</script>
