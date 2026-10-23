<!-- The vertical timeline of one operation: every step the user can
     understand, with its state (done / active / waiting / approval / failed /
     upcoming) and one line of plain explanation. -->
<template>
  <ol class="relative">
    <li v-for="(item, i) in items" :key="i" class="relative flex gap-3 pb-5 last:pb-0">
      <!-- rail -->
      <span
        v-if="i < items.length - 1"
        class="absolute left-[11px] top-6 bottom-0 w-px"
        :class="item.state === 'done' ? 'bg-green-300 dark:bg-green-800' : 'bg-gray-200 dark:bg-gh-700'"
      />
      <!-- marker -->
      <span class="relative z-[1] mt-0.5 w-6 h-6 shrink-0 rounded-full flex items-center justify-center" :class="markerClass(item.state)">
        <Check v-if="item.state === 'done'" class="w-3.5 h-3.5" stroke-width="3" />
        <Loader2 v-else-if="item.state === 'active'" class="w-3.5 h-3.5 animate-spin" />
        <Clock v-else-if="item.state === 'waiting'" class="w-3.5 h-3.5" />
        <AlertTriangle v-else-if="item.state === 'failed'" class="w-3.5 h-3.5" />
        <Hand v-else-if="item.state === 'approval'" class="w-3.5 h-3.5" />
        <Pause v-else-if="item.state === 'paused'" class="w-3 h-3" />
        <span v-else class="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gh-600" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm leading-6" :class="labelClass(item.state)">{{ item.label }}</p>
        <p v-if="item.detail && item.state !== 'upcoming'" class="text-xs leading-snug" :class="detailClass(item.state)">{{ item.detail }}</p>
        <!-- The transaction behind the step, one tap away on the web -->
        <a
          v-for="link in item.links"
          :key="link.url"
          :href="link.url"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400"
        >
          <ExternalLink class="w-3.5 h-3.5" />
          {{ $t('dex.viewExplorer') }}
        </a>
        <slot name="after" :item="item" :index="i" />
      </div>
      <span v-if="item.state === 'waiting'" class="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">{{ $t('process.status.running') }}</span>
    </li>
  </ol>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Loader2, Clock, AlertTriangle, Hand, Pause, ExternalLink } from 'lucide-vue-next'
import { visibleSteps, describeStep, explorerLinks } from '@/lib/intent/present'

const props = defineProps({ op: { type: Object, required: true } })
const { t } = useI18n()

const items = computed(() =>
  visibleSteps(props.op).map((v) => ({ ...v, ...describeStep(v, props.op, t), links: explorerLinks(v.step) }))
)

function markerClass(state) {
  return {
    done: 'bg-green-500 text-white',
    active: 'bg-blue-600 text-white',
    waiting: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 ring-2 ring-amber-300 dark:ring-amber-700',
    approval: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 ring-2 ring-blue-400',
    failed: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 ring-2 ring-red-300 dark:ring-red-800',
    paused: 'bg-gray-200 dark:bg-gh-700 text-gray-500',
    upcoming: 'bg-white dark:bg-gh-800 border border-gray-200 dark:border-gh-600',
  }[state]
}
function labelClass(state) {
  if (state === 'upcoming') return 'text-gray-400 dark:text-gray-500'
  if (state === 'failed') return 'font-semibold text-red-700 dark:text-red-300'
  if (state === 'active' || state === 'waiting' || state === 'approval') return 'font-semibold text-gray-900 dark:text-white'
  return 'text-gray-700 dark:text-gray-200'
}
function detailClass(state) {
  if (state === 'failed') return 'text-red-600/80 dark:text-red-400/80'
  if (state === 'waiting') return 'text-amber-700 dark:text-amber-300'
  return 'text-gray-500 dark:text-gray-400'
}
</script>
