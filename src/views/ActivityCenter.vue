<!-- Everything in progress, needing the user, or recently finished — one
     list, one card each. Completed financial outcomes also live in History;
     this page is about what is happening now. -->
<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">
    <div class="flex items-center gap-3 px-5 pt-5 pb-4">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white flex-1">{{ $t('process.activityTitle') }}</h1>
    </div>

    <div v-if="operations.length === 0" class="flex-1 flex items-center justify-center px-5 pb-6">
      <div class="flex flex-col items-center gap-4 text-center max-w-xs">
        <div class="w-16 h-16 rounded-3xl bg-gray-100 dark:bg-gh-800 flex items-center justify-center">
          <Activity class="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
        <div class="space-y-1.5">
          <p class="font-semibold text-gray-800 dark:text-gray-100">{{ $t('process.empty.title') }}</p>
          <p class="text-sm text-gray-400 dark:text-gray-500 leading-relaxed">{{ $t('process.empty.body') }}</p>
        </div>
      </div>
    </div>

    <div v-else class="px-5 pb-6 space-y-5">
      <section v-for="section in sections" :key="section.id" v-show="section.ops.length">
        <h2 class="px-1 pb-2 text-xs font-semibold text-gray-400 dark:text-gray-500">{{ $t(`process.sections.${section.id}`) }}</h2>
        <div class="space-y-3">
          <ProcessCard v-for="op in section.ops" :key="op.id" :op="op" />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Activity } from 'lucide-vue-next'
import { operations } from '@/stores/operations'
import ProcessCard from '@/components/process/ProcessCard.vue'

const sections = computed(() => [
  { id: 'attention', ops: operations.value.filter((o) => o.status === 'attention' || o.status === 'awaiting') },
  { id: 'active', ops: operations.value.filter((o) => o.status === 'running') },
  { id: 'recent', ops: operations.value.filter((o) => o.status === 'done' || o.status === 'cancelled') },
])
</script>
