<!-- Why a deposit waits for the confirmations it does: the bridge's ladder of
     deposit size -> Navio confirmations, with the tier of this deposit marked. -->
<template>
  <BottomSheet :open="open" :title="$t('process.confirmInfo.title')" @close="$emit('close')">
    <p class="text-sm text-gray-600 dark:text-gray-300 leading-snug">{{ $t('process.confirmInfo.intro') }}</p>

    <table class="mt-4 w-full text-sm">
      <thead>
        <tr class="text-xs text-gray-500 dark:text-gray-400">
          <th class="py-2 pl-3 pr-2 text-left font-medium">{{ $t('process.confirmInfo.amount') }}</th>
          <th class="py-2 px-2 text-right font-medium">{{ $t('process.confirmInfo.confirmations') }}</th>
          <th class="py-2 pl-2 pr-3 text-right font-medium">{{ $t('process.confirmInfo.time') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.confirmations"
          class="border-t border-gray-100 dark:border-gh-800"
          :class="row.current ? 'bg-amber-50 dark:bg-amber-900/20 font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'"
          :aria-current="row.current ? 'true' : undefined"
        >
          <td class="py-2.5 pl-3 pr-2">
            {{ row.label }}
            <span v-if="row.current" class="block text-xs font-medium text-amber-700 dark:text-amber-300">{{ $t('process.confirmInfo.yours') }}</span>
          </td>
          <td class="py-2.5 px-2 text-right tabular-nums align-top">{{ row.confirmations }}</td>
          <td class="py-2.5 pl-2 pr-3 text-right tabular-nums align-top whitespace-nowrap">{{ $t('process.confirmInfo.minutes', { n: row.minutes }) }}</td>
        </tr>
      </tbody>
    </table>

    <p class="mt-4 text-xs text-gray-500 dark:text-gray-400 leading-snug">{{ $t('process.confirmInfo.chain', { minutes: NAVIO_BLOCK_MINUTES }) }}</p>
  </BottomSheet>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BottomSheet from '@/components/tx/BottomSheet.vue'
import { CONFIRMATION_LADDER } from '@/lib/hyperliquid/bridge/config'
import { NAVIO_BLOCK_MINUTES } from '@/lib/intent/requirements'

const props = defineProps({
  open: { type: Boolean, default: false },
  // Confirmations this deposit waits for; marks its row.
  required: { type: Number, default: 0 },
})
defineEmits(['close'])
const { t } = useI18n()

const nav = (n) => n.toLocaleString()

const rows = computed(() =>
  CONFIRMATION_LADDER.map((tier, i) => {
    const min = i ? CONFIRMATION_LADDER[i - 1].belowNav : 0
    const label = !min
      ? t('process.confirmInfo.below', { max: nav(tier.belowNav) })
      : Number.isFinite(tier.belowNav)
        ? t('process.confirmInfo.range', { min: nav(min), max: nav(tier.belowNav) })
        : t('process.confirmInfo.above', { min: nav(min) })
    return {
      label,
      confirmations: tier.confirmations,
      minutes: tier.confirmations * NAVIO_BLOCK_MINUTES,
      current: tier.confirmations === props.required,
    }
  })
)
</script>
