<template>
  <BottomSheet :open="open" :title="title" @close="$emit('close')">
    <button
      v-for="asset in assets"
      :key="asset.symbol"
      type="button"
      @click="$emit('select', asset.symbol)"
      class="w-full py-3 flex items-center justify-between gap-3 text-left"
    >
      <div class="flex items-center gap-3 min-w-0">
        <TokenIcon :symbol="asset.symbol" :logo="asset.logo" :size="36" />
        <div class="min-w-0">
          <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ asset.symbol }}</p>
          <p class="text-xs text-gray-400 dark:text-gray-500 truncate">{{ asset.name }}</p>
        </div>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <p class="text-sm font-mono text-gray-700 dark:text-gray-300">{{ formatAmount(asset.balance) }}</p>
        <Check v-if="asset.symbol === selected" class="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <span v-else class="w-4" />
      </div>
    </button>
  </BottomSheet>
</template>

<script setup>
import { Check } from 'lucide-vue-next'
import BottomSheet from './BottomSheet.vue'
import TokenIcon from '@/components/TokenIcon.vue'
import { formatAmount } from '@/lib/displayFormat'

defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  // [{ symbol, name, logo, balance }]
  assets: { type: Array, default: () => [] },
  selected: { type: String, default: '' },
})
defineEmits(['select', 'close'])
</script>
