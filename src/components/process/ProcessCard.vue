<!-- One operation, compact: what it is, how far it is, what is happening
     now, and — only when the user is needed — the one button that moves it
     on. Tapping it opens the full page. -->
<template>
  <div class="rounded-2xl border bg-white dark:bg-gh-800" :class="borderClass">
    <button type="button" @click="router.push(`/activity/${op.id}`)" class="w-full p-4 text-left" :class="{ 'pb-0': inProgress }">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ head.title }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 tabular-nums truncate">{{ head.subtitle }}</p>
        </div>
        <span class="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums" :class="chip.class">{{ chip.label }}</span>
      </div>
      <div v-if="inProgress" class="mt-3 h-1 rounded-full bg-gray-100 dark:bg-gh-700 overflow-hidden">
        <div class="h-full rounded-full transition-[width] duration-500" :class="barClass" :style="{ width: percent + '%' }" />
      </div>
      <p v-else class="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-snug">{{ outcome }}</p>
    </button>

    <!-- What is happening now. Outside the button above so the info button
         can sit beside it (a button can't hold a button). -->
    <div v-if="inProgress" class="px-4 pt-2 pb-4 flex items-start gap-1" :class="lineClass">
      <button type="button" @click="router.push(`/activity/${op.id}`)" class="min-w-0 flex-1 text-left text-xs leading-snug">{{ line }}</button>
      <button
        v-if="ladderConfirmations"
        type="button"
        class="shrink-0 -mt-1 -mr-1 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
        :aria-label="$t('process.confirmInfo.button')"
        :title="$t('process.confirmInfo.button')"
        @click="showLadder = true"
      >
        <Info class="w-4 h-4" />
      </button>
    </div>

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
    <ConfirmationLadderSheet :open="showLadder" :required="ladderConfirmations" @close="showLadder = false" />
  </div>
</template>

<script setup>
import { computed, ref, toRef } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronRight, Info } from 'lucide-vue-next'
import { dismissOperation } from '@/stores/operations'
import { useProcessActions } from '@/composables/useProcessActions'
import { titleOf, statusLine, progressOf, fractionOf, outcomeOf, visibleSteps } from '@/lib/intent/present'
import ConfirmationLadderSheet from './ConfirmationLadderSheet.vue'

const props = defineProps({ op: { type: Object, required: true } })
const router = useRouter()
const { t } = useI18n()
const { actions } = useProcessActions(toRef(props, 'op'))

const inProgress = computed(() => ['running', 'awaiting', 'attention'].includes(props.op.status))
// Confirmations the bridge deposit being waited on needs (0 when the line is about something else).
const ladderConfirmations = computed(() => {
  const v = visibleSteps(props.op).find((v) => v.state === 'waiting' && v.step.type === 'deposit')
  return v?.wait?.confirmations > 0 ? v.wait.confirmations : 0
})
const showLadder = ref(false)

const head = computed(() => titleOf(props.op, t))
const progress = computed(() => progressOf(props.op))
const percent = computed(() => fractionOf(props.op) * 100)
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

const outcome = computed(() => outcomeOf(props.op, t))
</script>
