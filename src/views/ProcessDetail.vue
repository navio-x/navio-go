<!-- One operation, in full: the timeline, a plain explanation of the step
     that needs something (approval, retry, a decision), the actions, and
     the technical facts behind a disclosure. A full page on purpose — no
     sheet on top of a sheet on a phone. -->
<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">
    <div class="flex items-center gap-3 px-5 pt-5 pb-4">
      <button @click="goBack" :aria-label="$t('common.back')" class="p-2 -ml-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400">
        <ChevronLeft class="w-5 h-5" />
      </button>
      <div class="flex-1 min-w-0">
        <h1 class="text-lg font-bold leading-tight text-gray-900 dark:text-white truncate">{{ op ? head.title : $t('process.activityTitle') }}</h1>
        <p v-if="op" class="text-xs text-gray-500 dark:text-gray-400 tabular-nums truncate">{{ head.subtitle }}</p>
      </div>
      <span v-if="op" class="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums" :class="chip.class">{{ chip.label }}</span>
    </div>

    <div v-if="!op" class="flex-1 flex items-center justify-center px-5 pb-6 text-sm text-gray-400">{{ $t('process.empty.title') }}</div>

    <div v-else class="px-5 pb-6 space-y-4">
      <!-- What needs the user, right at the top, with the one button -->
      <div v-if="op.status === 'awaiting'" class="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-900/20 p-4 space-y-3">
        <p class="text-sm font-semibold text-blue-900 dark:text-blue-100">{{ $t('process.approval.title') }}</p>
        <p class="text-sm text-blue-800 dark:text-blue-200 leading-snug">{{ approvalText }}</p>
        <ActionRow :actions="actions" />
      </div>

      <div v-else-if="op.status === 'attention'" class="rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-900/20 p-4 space-y-3">
        <p class="text-sm font-semibold text-red-900 dark:text-red-100">{{ attentionCode === 'interrupted' ? $t('process.interrupted.title') : $t('process.failed.title') }}</p>
        <p class="text-sm text-red-800 dark:text-red-200 leading-snug">{{ attentionCode === 'interrupted' ? $t('process.interrupted.body') : attentionText }}</p>
        <p class="text-xs text-red-700/80 dark:text-red-300/80 leading-snug">{{ attentionCode === 'interrupted' ? $t('process.interrupted.checked') : $t('process.failed.keep') }}</p>

        <template v-if="requote">
          <p class="text-sm font-semibold text-gray-900 dark:text-white">
            {{ $t('ops.requote.offer', { amount: formatAmount(requote.minOut), symbol: requote.symbol }) }}
          </p>
          <div class="flex gap-2">
            <button @click="requote = null" class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-gh-800 border border-gray-200 dark:border-gh-600 text-gray-700 dark:text-gray-300">{{ $t('process.actions.back') }}</button>
            <button @click="acceptRequote" class="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white">{{ $t('process.actions.accept') }}</button>
          </div>
        </template>
        <ActionRow v-else :actions="actions" :busy="requoting" />
        <p v-if="requoteError" class="text-xs text-red-600 dark:text-red-400">{{ requoteError }}</p>
      </div>

      <!-- The timeline -->
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4">
        <ProcessTimeline :op="op" />
        <p v-if="op.status === 'running'" class="mt-4 pt-3 border-t border-gray-100 dark:border-gh-700 text-xs text-gray-400 dark:text-gray-500 leading-snug">{{ $t('process.leave') }}</p>
        <p v-else-if="op.status === 'done' || op.status === 'cancelled'" class="mt-4 pt-3 border-t border-gray-100 dark:border-gh-700 text-xs text-gray-500 dark:text-gray-400 leading-snug">{{ outcome }}</p>
      </div>

      <ActionRow v-if="op.status === 'running' || op.status === 'done' || op.status === 'cancelled'" :actions="actions" quiet />

      <!-- Technical details -->
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
        <button type="button" @click="showTech = !showTech" :aria-expanded="showTech" class="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-gray-600 dark:text-gray-300">
          {{ $t('process.actions.details') }}
          <ChevronDown class="w-4 h-4 text-gray-400 transition-transform" :class="{ 'rotate-180': showTech }" />
        </button>
        <dl v-if="showTech" class="border-t border-gray-100 dark:border-gh-700 px-4 py-3 space-y-2.5">
          <div v-for="row in tech" :key="row.label" class="text-xs">
            <dt class="text-gray-400 dark:text-gray-500">{{ row.label }}</dt>
            <dd class="text-gray-700 dark:text-gray-200 break-all" :class="{ 'font-mono text-[11px]': row.mono }">{{ row.value }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- Stop confirmation -->
    <BottomSheet :open="confirmStop" :title="$t('process.actions.stop')" @close="confirmStop = false">
      <p class="text-sm text-gray-600 dark:text-gray-300 leading-snug">{{ $t('process.stopConfirm') }}</p>
      <div class="mt-4 flex gap-2">
        <button @click="confirmStop = false" class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gh-800 text-gray-700 dark:text-gray-300">{{ $t('common.cancel') }}</button>
        <button @click="doStop" class="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white">{{ $t('process.actions.stop') }}</button>
      </div>
    </BottomSheet>
  </div>
</template>

<script setup>
import { computed, ref, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronDown, Loader2 } from 'lucide-vue-next'
import { findOperation, operations } from '@/stores/operations'
import { useProcessActions } from '@/composables/useProcessActions'
import { titleOf, progressOf, technicalDetails, outcomeOf } from '@/lib/intent/present'
import { formatAmount } from '@/lib/displayFormat'
import ProcessTimeline from '@/components/process/ProcessTimeline.vue'
import BottomSheet from '@/components/tx/BottomSheet.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const op = computed(() => (operations.value, findOperation(route.params.id)))
const { actions, attentionText, approvalText, attentionCode, requote, requoting, requoteError, acceptRequote, confirmStop, doStop } = useProcessActions(op)

const head = computed(() => titleOf(op.value, t))
const progress = computed(() => progressOf(op.value))
const chip = computed(() => {
  const o = op.value
  if (o.status === 'running') return { label: t('process.progress', progress.value), class: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' }
  if (o.status === 'awaiting') return { label: t('process.status.awaiting'), class: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' }
  if (o.status === 'attention') return { label: t('process.status.attention'), class: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' }
  if (o.status === 'done') return { label: t('process.status.done'), class: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' }
  return { label: t('process.status.cancelled'), class: 'bg-gray-100 dark:bg-gh-700 text-gray-500 dark:text-gray-400' }
})
const showTech = ref(false)
const tech = computed(() => technicalDetails(op.value, t))

const outcome = computed(() => outcomeOf(op.value, t))

function goBack() {
  if (window.history.length > 1) router.back()
  else router.replace('/activity')
}

// The action buttons, in one row: primary filled, the rest outlined; `quiet`
// renders them small and text-only (for Stop while running, OK when done).
const ActionRow = (props) =>
  h(
    'div',
    { class: props.quiet ? 'flex justify-end' : 'flex flex-wrap gap-2' },
    props.actions.map((a) =>
      h(
        'button',
        {
          key: a.id,
          onClick: a.run,
          disabled: props.busy,
          class: props.quiet
            ? 'px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gh-800 disabled:opacity-50'
            : a.primary
              ? 'flex-1 min-w-[40%] py-2.5 px-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 flex items-center justify-center gap-1.5'
              : 'flex-1 min-w-[40%] py-2.5 px-3 rounded-xl text-sm font-medium bg-white dark:bg-gh-800 border border-gray-200 dark:border-gh-600 text-gray-700 dark:text-gray-300 disabled:opacity-50',
        },
        [a.id === 'requote' && props.busy ? h(Loader2, { class: 'w-4 h-4 animate-spin' }) : null, a.label]
      )
    )
  )
ActionRow.props = { actions: Array, busy: Boolean, quiet: Boolean }
</script>
