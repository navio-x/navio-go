<!-- The single review screen for every transaction. What the user gives up
     and what they get come first; fees and limits follow; how it is done
     (route, contracts, steps) sits behind "Details". Once confirmed, the
     same sheet shows the outcome. -->
<template>
  <BottomSheet :open="open" :title="result ? '' : title" :locked="busy" @close="$emit('close')">
    <!-- Outcome -->
    <div v-if="result" class="space-y-4 text-center">
      <div
        class="flex items-center justify-center w-14 h-14 rounded-full mx-auto"
        :class="result.success ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'"
      >
        <Check v-if="result.success" class="w-7 h-7 text-green-600 dark:text-green-400" />
        <X v-else class="w-7 h-7 text-red-500" />
      </div>
      <div class="space-y-1">
        <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ result.title }}</h3>
        <p v-if="result.message" class="text-sm text-gray-500 dark:text-gray-400 break-words max-h-32 overflow-y-auto">{{ result.message }}</p>
      </div>
      <button
        @click="$emit('close')"
        class="w-full py-3.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white"
      >
        {{ $t('common.close') }}
      </button>
    </div>

    <div v-else class="space-y-4">
      <!-- You send -> you receive / who receives -->
      <div class="rounded-2xl bg-gray-50 dark:bg-gh-700 p-4 space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('tx.youSend') }}</p>
            <p class="text-xl font-bold tabular-nums text-gray-900 dark:text-white truncate">{{ from.amount }} {{ from.symbol }}</p>
          </div>
          <TokenIcon :symbol="from.symbol" :logo="from.logo" :size="36" />
        </div>
        <template v-if="to">
          <ArrowDown class="w-4 h-4 text-gray-400" />
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('tx.youReceive') }}</p>
              <p class="text-xl font-bold tabular-nums text-gray-900 dark:text-white truncate">
                <template v-if="to.approx">≈ </template>{{ to.amount }} {{ to.symbol }}
              </p>
            </div>
            <TokenIcon :symbol="to.symbol" :logo="to.logo" :size="36" />
          </div>
        </template>
        <div v-if="destination" class="pt-3 border-t border-gray-200 dark:border-gh-600">
          <p class="text-xs text-gray-400 dark:text-gray-500">{{ destinationLabel || $t('tx.to') }}</p>
          <p class="mt-0.5 font-mono text-xs text-gray-700 dark:text-gray-300 break-all">{{ destination }}</p>
        </div>
      </div>

      <!-- Fees, limits, timing -->
      <dl v-if="rows.length" class="space-y-2 text-sm">
        <div v-for="row in rows" :key="row.label" class="flex items-start justify-between gap-4">
          <dt class="text-gray-500 dark:text-gray-400 shrink-0">{{ row.label }}</dt>
          <dd class="font-medium text-gray-800 dark:text-gray-100 text-right">{{ row.value }}</dd>
        </div>
      </dl>

      <!-- Things the user must know before committing -->
      <div
        v-for="notice in notices"
        :key="notice.text"
        class="flex gap-2 rounded-xl px-3 py-2.5 text-xs leading-snug"
        :class="notice.tone === 'warn'
          ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300'
          : 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'"
      >
        <AlertTriangle v-if="notice.tone === 'warn'" class="w-4 h-4 shrink-0 mt-px" />
        <Info v-else class="w-4 h-4 shrink-0 mt-px" />
        <p>{{ notice.text }}</p>
      </div>

      <!-- How it is done: secondary -->
      <div v-if="details.length">
        <button
          type="button"
          @click="showDetails = !showDetails"
          class="flex items-center gap-1 py-1 text-xs font-medium text-gray-500 dark:text-gray-400"
          :aria-expanded="showDetails"
        >
          <ChevronDown class="w-3.5 h-3.5 transition-transform" :class="{ 'rotate-180': showDetails }" />
          {{ detailsLabel || $t('tx.details') }}
        </button>
        <ol v-if="showDetails" class="mt-1.5 space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
          <li v-for="(line, i) in details" :key="i" class="flex gap-2">
            <span class="shrink-0 tabular-nums text-gray-400 dark:text-gray-500">{{ i + 1 }}.</span>
            <span class="break-words min-w-0">{{ line }}</span>
          </li>
        </ol>
      </div>

      <p
        v-if="error"
        class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-3 py-2.5 text-xs text-red-700 dark:text-red-300 break-words"
      >
        {{ error }}
      </p>

      <button
        @click="$emit('confirm')"
        :disabled="busy || confirmDisabled"
        class="w-full py-3.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Loader2 v-if="busy" class="w-4 h-4 animate-spin" />
        {{ busy ? (busyLabel || $t('tx.sending')) : confirmLabel }}
      </button>
    </div>
  </BottomSheet>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ArrowDown, ChevronDown, Check, X, Loader2, Info, AlertTriangle } from 'lucide-vue-next'
import BottomSheet from './BottomSheet.vue'
import TokenIcon from '@/components/TokenIcon.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  // { amount, symbol, logo }
  from: { type: Object, required: true },
  // { amount, symbol, logo, approx } — omitted for a plain send
  to: { type: Object, default: null },
  destination: { type: String, default: '' },
  destinationLabel: { type: String, default: '' },
  // [{ label, value }]
  rows: { type: Array, default: () => [] },
  // [{ tone: 'info' | 'warn', text }]
  notices: { type: Array, default: () => [] },
  // Plain lines, shown as a numbered route behind "Details".
  details: { type: Array, default: () => [] },
  detailsLabel: { type: String, default: '' },
  confirmLabel: { type: String, required: true },
  confirmDisabled: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  busyLabel: { type: String, default: '' },
  error: { type: String, default: '' },
  // { success, title, message } once the transaction has been submitted
  result: { type: Object, default: null },
})
defineEmits(['confirm', 'close'])

const showDetails = ref(false)
watch(() => props.open, (open) => { if (open) showDetails.value = false })
</script>
