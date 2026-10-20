<!-- The one place an in-flight operation is always visible: a slim bar above
     the bottom navigation on every screen. It never blocks anything; tapping
     it opens Activity. Hidden while nothing is in progress and on the
     Activity pages themselves. -->
<template>
  <button
    v-if="show"
    type="button"
    @click="router.push(target)"
    class="w-full flex items-center gap-3 px-4 py-2 text-left border-t transition-colors"
    :class="tone"
  >
    <span class="shrink-0 w-6 h-6 rounded-full flex items-center justify-center" :class="iconTone">
      <AlertTriangle v-if="attention.length" class="w-3.5 h-3.5" />
      <Hand v-else-if="awaiting.length" class="w-3.5 h-3.5" />
      <Loader2 v-else class="w-3.5 h-3.5 animate-spin" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block text-xs font-semibold truncate">{{ title }}</span>
      <span class="block text-[11px] leading-tight truncate opacity-80">{{ subtitle }}</span>
    </span>
    <span class="shrink-0 text-[11px] font-semibold flex items-center gap-0.5">
      {{ $t('process.open') }}
      <ChevronRight class="w-3.5 h-3.5" />
    </span>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Loader2, AlertTriangle, Hand, ChevronRight } from 'lucide-vue-next'
import { activeOperations } from '@/stores/operations'
import { titleOf, statusLine, progressOf } from '@/lib/intent/present'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const attention = computed(() => activeOperations.value.filter((o) => o.status === 'attention'))
const awaiting = computed(() => activeOperations.value.filter((o) => o.status === 'awaiting'))
const first = computed(() => attention.value[0] ?? awaiting.value[0] ?? activeOperations.value[0] ?? null)

const show = computed(() => !!first.value && !route.path.startsWith('/activity'))
const target = computed(() => (activeOperations.value.length === 1 ? `/activity/${first.value.id}` : '/activity'))

const title = computed(() => {
  const n = activeOperations.value.length
  if (n > 1) {
    const needs = attention.value.length + awaiting.value.length
    return needs ? t('process.tray.needsYou', { n: needs }) : t('process.tray.many', { n })
  }
  const { title: label } = titleOf(first.value, t)
  const p = progressOf(first.value)
  return `${label} · ${t('process.progress', p)}`
})
// With several operations the first line counts them; the second says what
// the most urgent one is doing, prefixed with its name.
const subtitle = computed(() =>
  activeOperations.value.length > 1 ? `${titleOf(first.value, t).title} · ${statusLine(first.value, t)}` : statusLine(first.value, t)
)

const tone = computed(() => {
  if (attention.value.length) return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-200'
  if (awaiting.value.length) return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/50 text-blue-800 dark:text-blue-200'
  return 'bg-white/95 dark:bg-gh-900/95 border-gray-200 dark:border-gh-700 text-gray-800 dark:text-gray-100'
})
const iconTone = computed(() => {
  if (attention.value.length) return 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300'
  if (awaiting.value.length) return 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300'
  return 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
})
</script>
