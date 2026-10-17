<!-- Choose a staker from the public operator directory: name, fee, how long
     it has been listed, and its key at a glance. Picking one hands its key
     back to the stake form. The list is someone else's data, so it is shown
     as text only and with a word that listing is not an endorsement. -->
<template>
  <BottomSheet :open="open" :title="$t('staking.operators.title')" @close="$emit('close')">
    <div class="space-y-3">
      <!-- Loading, first time only: a refresh keeps the old list on screen -->
      <ul v-if="operatorsStatus === 'loading' && !list.length" class="space-y-2" aria-hidden="true">
        <li v-for="n in 3" :key="n" class="h-[72px] rounded-2xl bg-gray-100 dark:bg-gh-800 animate-pulse" />
      </ul>

      <div v-else-if="operatorsStatus === 'error' && !list.length" class="py-6 text-center space-y-3">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('staking.operators.error') }}</p>
        <button
          type="button"
          @click="loadOperators({ force: true })"
          class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gh-600 text-gray-700 dark:text-gray-200"
        >
          <RotateCw class="w-4 h-4" /> {{ $t('staking.operators.retry') }}
        </button>
      </div>

      <p v-else-if="!list.length" class="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
        {{ $t('staking.operators.empty', { network: walletNetwork || '—' }) }}
      </p>

      <ul v-else class="space-y-2" :class="{ 'opacity-60': operatorsStatus === 'loading' }">
        <li v-for="op in list" :key="op.delegationKey">
          <button
            type="button"
            @click="$emit('pick', op.delegationKey)"
            class="w-full flex items-start gap-3 rounded-2xl border p-3.5 text-left transition"
            :class="op.delegationKey === selectedKey
              ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 hover:bg-gray-50 dark:hover:bg-gh-700/60'"
          >
            <StakerAvatar :staker-key="op.delegationKey" :size="40" />
            <span class="min-w-0 flex-1">
              <span class="flex items-center justify-between gap-2">
                <span class="min-w-0 flex items-center gap-1.5">
                  <span class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ op.name }}</span>
                  <span
                    v-if="op.isDefault"
                    class="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  >
                    <Star class="w-2.5 h-2.5 fill-current" /> {{ $t('staking.operators.default') }}
                  </span>
                </span>
                <span
                  class="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  :class="op.feeBps === 0
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-gray-100 dark:bg-gh-700 text-gray-600 dark:text-gray-300'"
                >
                  {{ feeLabel(op) }}
                </span>
              </span>
              <span v-if="op.description" class="mt-0.5 block text-xs leading-snug text-gray-500 dark:text-gray-400">{{ op.description }}</span>
              <span class="mt-1.5 flex items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500">
                <span class="font-mono">{{ shortKey(op.delegationKey, 6, 4) }}</span>
                <template v-if="op.createdAt">
                  <span aria-hidden="true">·</span>
                  <span>{{ $t('staking.operators.since', { date: sinceLabel(op.createdAt) }) }}</span>
                </template>
              </span>
            </span>
            <Check v-if="op.delegationKey === selectedKey" class="w-5 h-5 shrink-0 text-blue-600 dark:text-blue-400" />
          </button>
        </li>
      </ul>

      <p class="flex gap-2 text-[11px] leading-snug text-gray-400 dark:text-gray-500">
        <Info class="w-3.5 h-3.5 shrink-0 mt-px" />
        {{ $t('staking.operators.disclaimer') }}
      </p>
    </div>
  </BottomSheet>
</template>

<script setup>
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Info, RotateCw, Star } from 'lucide-vue-next'
import { walletNetwork } from '@/stores/network'
import { networkOperators, operatorsStatus, loadOperators } from '@/stores/stakingOperators'
import { shortKey } from '@/lib/staking'
import BottomSheet from '@/components/tx/BottomSheet.vue'
import StakerAvatar from './StakerAvatar.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  selectedKey: { type: String, default: '' },
})
defineEmits(['pick', 'close'])
const { t, locale } = useI18n()

watch(() => props.open, (open) => { if (open) loadOperators() })

// Already sorted: the default first, then cheapest, then longest listed.
const list = networkOperators

function feeLabel(op) {
  if (op.feeBps === 0) return t('staking.operators.noFee')
  return t('staking.operators.fee', { fee: (op.feeBps / 100).toLocaleString(locale.value, { maximumFractionDigits: 2 }) })
}

function sinceLabel(ms) {
  return new Date(ms).toLocaleDateString(locale.value, { month: 'short', year: 'numeric' })
}
</script>
