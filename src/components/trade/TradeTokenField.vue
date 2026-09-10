<template>
  <div class="space-y-1.5">
    <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ label }}</label>
    <input
      v-model="text"
      @input="onInput"
      type="text"
      :placeholder="placeholder"
      class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-xs font-mono
      bg-white dark:bg-gh-800 text-gray-900 dark:text-white
      focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    <!-- Wallet holdings as visible, tappable chips — not a hidden <select>,
         so "these are the tokens I actually hold" is obvious at a glance,
         not something you have to discover. Free typing above still works
         for a token you don't hold yet (e.g. what you're buying). -->
    <div class="flex flex-wrap gap-1.5">
      <button
        type="button"
        @click="onPick('NAV')"
        class="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
        :class="modelValue === null
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'bg-gray-50 dark:bg-gh-700 border-gray-200 dark:border-gh-600 text-gray-600 dark:text-gray-300'"
      >
        NAV
      </button>
      <button
        v-for="t in tokenAssets"
        :key="t.tokenId"
        type="button"
        @click="onPick(t.tokenId)"
        class="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors truncate max-w-[45%]"
        :class="modelValue === t.tokenId
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'bg-gray-50 dark:bg-gh-700 border-gray-200 dark:border-gh-600 text-gray-600 dark:text-gray-300'"
      >
        {{ tokenOptionLabel(t) }}
      </button>
      <p v-if="tokenAssets.length === 0" class="text-xs text-gray-400 dark:text-gray-500 py-1">
        {{ $t('trade.take.noWalletTokens') }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { assetBalances } from '@/stores/trade'

// v-model semantics: null = NAV, otherwise a trimmed token id string. A
// plain text input doubles as "paste any id" (you don't need to hold what
// you're buying) alongside visible chips for what the wallet actually
// holds — mirrors the reference app's TokenField.tsx at the protocol/UX
// level (free text + wallet-aware picker), not its hidden-<select> code.
const props = defineProps({
  modelValue: { type: String, default: null },
  label: { type: String, required: true },
  placeholder: { type: String, default: 'token id, or NAV' },
})
const emit = defineEmits(['update:modelValue'])

const tokenAssets = computed(() => assetBalances.value.filter((a) => a.kind === 'token'))

const text = ref(props.modelValue === null ? 'NAV' : props.modelValue)

function normalize(value) {
  const trimmed = value.trim()
  return trimmed === '' || trimmed.toUpperCase() === 'NAV' ? null : trimmed
}

function onInput() {
  emit('update:modelValue', normalize(text.value))
}

function onPick(value) {
  text.value = value
  emit('update:modelValue', value === 'NAV' ? null : value)
}

// Only re-sync from the prop when it changed for a reason other than our
// own emit (e.g. the parent resetting the form) — otherwise a normalize()
// round-trip (e.g. '' -> null -> 'NAV') would fight the user mid-keystroke.
watch(
  () => props.modelValue,
  (v) => {
    if (v !== normalize(text.value)) text.value = v === null ? 'NAV' : v
  }
)

function tokenOptionLabel(t) {
  const { name, symbol } = t.metadata ?? {}
  const label = name && symbol ? `${name} (${symbol})` : name || symbol || `${t.tokenId.slice(0, 8)}…`
  return `${label} · ${t.balance.toString()}`
}
</script>
