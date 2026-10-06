<!-- Amount + asset, the same in every flow (send, swap, move): label and
     available balance with Max on top, the number on the left, the asset on
     the right. The asset is a button when the flow lets the user pick it. -->
<template>
  <div class="rounded-2xl bg-white dark:bg-gh-800 border border-gray-200 dark:border-gh-700 p-3.5">
    <div class="flex items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500">
      <span>{{ label }}</span>
      <button
        v-if="balance != null"
        type="button"
        :disabled="readonly || !(balance > 0)"
        @click="$emit('max')"
        class="flex items-center gap-1 py-0.5 disabled:cursor-default"
      >
        <span class="truncate">{{ $t('tx.available') }}: {{ formatAmount(balance) }}</span>
        <span v-if="!readonly && balance > 0" class="font-semibold text-blue-600 dark:text-blue-400">{{ $t('tx.max') }}</span>
      </button>
    </div>

    <div class="mt-1.5 flex items-center gap-3">
      <p
        v-if="readonly"
        class="flex-1 min-w-0 text-2xl font-semibold tabular-nums truncate"
        :class="modelValue ? 'text-gray-900 dark:text-white' : 'text-gray-300 dark:text-gray-600'"
      >
        {{ modelValue || '0' }}
      </p>
      <input
        v-else
        :value="modelValue"
        @input="onInput"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        placeholder="0"
        class="flex-1 min-w-0 bg-transparent text-2xl font-semibold tabular-nums text-gray-900 dark:text-white outline-none
               placeholder-gray-300 dark:placeholder-gray-600"
      />

      <component
        :is="selectable ? 'button' : 'div'"
        :type="selectable ? 'button' : undefined"
        @click="selectable && $emit('pick')"
        class="shrink-0 flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full bg-gray-50 dark:bg-gh-700 border border-gray-200 dark:border-gh-600"
      >
        <TokenIcon :symbol="symbol" :logo="logo" :size="24" />
        <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ symbol }}</span>
        <ChevronDown v-if="selectable" class="w-4 h-4 -ml-0.5 text-gray-400" />
      </component>
    </div>

    <p v-if="fiat" class="mt-1 text-xs text-gray-400 dark:text-gray-500">≈ {{ fiat }}</p>
  </div>
</template>

<script setup>
import { ChevronDown } from 'lucide-vue-next'
import TokenIcon from '@/components/TokenIcon.vue'
import { formatAmount } from '@/lib/displayFormat'

defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, required: true },
  symbol: { type: String, required: true },
  logo: { type: String, default: null },
  balance: { type: Number, default: null },
  fiat: { type: String, default: null },
  readonly: { type: Boolean, default: false },
  selectable: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'max', 'pick'])

// Digits and one decimal separator only; a comma is read as the decimal
// point, never silently dropped.
function onInput(event) {
  let value = event.target.value.replace(',', '.').replace(/[^\d.]/g, '')
  const dot = value.indexOf('.')
  if (dot !== -1) value = value.slice(0, dot + 1) + value.slice(dot + 1).replace(/\./g, '')
  event.target.value = value
  emit('update:modelValue', value)
}
</script>
