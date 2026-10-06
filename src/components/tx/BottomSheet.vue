<!-- The one sheet every transaction step uses (asset picker, review,
     progress): slides up from the bottom on phones, centred on wide
     screens. Tapping the backdrop closes it unless `locked`. -->
<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
    @click.self="!locked && $emit('close')"
  >
    <div
      class="bg-white dark:bg-gh-900 border-t sm:border border-gray-100 dark:border-gh-800 rounded-t-2xl sm:rounded-2xl
             w-full max-w-md shadow-2xl max-h-[90dvh] overflow-y-auto px-5 pt-3"
      :style="{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }"
      role="dialog"
      aria-modal="true"
    >
      <div class="w-10 h-1 rounded-full bg-gray-300 dark:bg-gh-700 mx-auto mb-3 sm:hidden" />
      <div v-if="title" class="flex items-center justify-between gap-3 mb-4">
        <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ title }}</h3>
        <button
          v-if="!locked"
          @click="$emit('close')"
          class="p-1.5 -mr-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gh-800"
          :aria-label="$t('common.close')"
        >
          <X class="w-5 h-5" />
        </button>
      </div>
      <slot />
    </div>
  </div>
</template>

<script setup>
import { X } from 'lucide-vue-next'

defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  // While a transaction is being submitted the sheet can't be dismissed.
  locked: { type: Boolean, default: false },
})
defineEmits(['close'])
</script>
