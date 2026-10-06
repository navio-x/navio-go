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
    <!-- Two pickers depending on context. Plain chips: wallet holdings as
         visible, tappable buttons — not a hidden <select>, so "these are
         the tokens I actually hold" is obvious at a glance. Network-token
         mode (RFQ buy/sell side): a single dropdown, since the token you
         want may be one you've never held — chips alone can't name it.
         Free typing above still works either way (paste any id). -->
    <div v-if="!networkTokens" class="flex flex-wrap gap-1.5">
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
    <select
      v-else
      :value="modelValue ?? NAV_VALUE"
      @change="onPick($event.target.value)"
      class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-xs
      bg-white dark:bg-gh-800 text-gray-900 dark:text-white
      focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option :value="NAV_VALUE">NAV</option>
      <option v-for="t in dropdownTokens" :key="t.tokenId" :value="t.tokenId">
        {{ tokenOptionLabel(t) }}
      </option>
    </select>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { assetBalances } from '@/stores/trade'
import { fetchNetworkTokens } from '@/lib/trade/tokenDirectory'

// v-model semantics: null = NAV, otherwise a trimmed token id string. A
// plain text input doubles as "paste any id" (you don't need to hold what
// you're buying) alongside a wallet-aware picker — mirrors the reference
// app's TokenField.tsx at the protocol/UX level, not its hidden-<select>
// code (except in networkTokens mode, which needs a real <select> to hold
// every network token, not just what fits as chips).
const props = defineProps({
  modelValue: { type: String, default: null },
  label: { type: String, required: true },
  placeholder: { type: String, default: 'token id, or NAV' },
  // RFQ buy/sell side: the counterparty's token is one this wallet may
  // never have held, so chips (wallet-only) can't offer it — list every
  // token the explorer knows about for the active network instead.
  networkTokens: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const NAV_VALUE = '__NAV__'

const tokenAssets = computed(() => assetBalances.value.filter((a) => a.kind === 'token'))

const remoteTokens = ref([])
onMounted(() => {
  if (!props.networkTokens) return
  fetchNetworkTokens().then((list) => { remoteTokens.value = list })
})

// Wallet holdings first (so balance shows), then every other network token —
// skip ones already listed as a holding rather than showing the same token
// twice under two different labels.
const dropdownTokens = computed(() => {
  const owned = new Set(tokenAssets.value.map((t) => t.tokenId))
  return [...tokenAssets.value, ...remoteTokens.value.filter((t) => !owned.has(t.tokenId))]
})

const text = ref(props.modelValue === null ? 'NAV' : props.modelValue)

function normalize(value) {
  const trimmed = value.trim()
  return trimmed === '' || trimmed.toUpperCase() === 'NAV' ? null : trimmed
}

function onInput() {
  emit('update:modelValue', normalize(text.value))
}

function onPick(value) {
  const isNav = value === 'NAV' || value === NAV_VALUE
  text.value = isNav ? 'NAV' : value
  emit('update:modelValue', isNav ? null : value)
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
  // Wallet holdings nest name/symbol under metadata and always carry a
  // balance; network-only tokens (never held) come flat with neither.
  const { name, symbol } = t.metadata ?? t
  const label = name && symbol ? `${name} (${symbol})` : name || symbol || `${t.tokenId.slice(0, 8)}…`
  return t.balance !== undefined ? `${label} · ${t.balance.toString()}` : label
}
</script>
