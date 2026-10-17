<!-- Staking rewards over a chosen range: the range on top, then what was
     earned in it, then the same total spread over time. The headline is
     the chart's sum, so the two always agree. -->
<template>
  <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4 space-y-4">
    <p v-if="showTitle" class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
      <Sparkles class="w-3.5 h-3.5" /> {{ $t('staking.rewards.title') }}
    </p>

    <!-- Range -->
    <div class="grid grid-cols-6 p-1 rounded-xl bg-gray-100 dark:bg-gh-900/60 text-[11px] font-semibold" role="tablist" :aria-label="$t('staking.rewards.range')">
      <button
        v-for="r in REWARD_RANGES"
        :key="r.key"
        type="button"
        role="tab"
        :aria-selected="rangeKey === r.key"
        @click="$emit('update:range', r.key)"
        class="py-1.5 rounded-lg transition tabular-nums"
        :class="rangeKey === r.key
          ? 'bg-white dark:bg-gh-700 text-gray-900 dark:text-white shadow-sm'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
      >
        {{ r.key }}
      </button>
    </div>

    <!-- Earned -->
    <div>
      <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('staking.rewards.earned', { range: rangeKey }) }}</p>
      <p class="mt-0.5 text-2xl font-bold truncate" :class="series.total > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-300 dark:text-gray-600'">
        {{ series.total > 0 ? '+' : '' }}{{ formatAmount(series.total, 8) }}
        <span class="text-sm font-medium text-gray-500 dark:text-gray-400">NAV</span>
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        <template v-if="totalFiat">≈ {{ totalFiat }} · </template>
        {{ series.count
          ? $t('staking.rewards.count', { count: series.count }, series.count)
          : $t('staking.rewards.empty') }}
      </p>
    </div>

    <RewardsChart
      :buckets="series.buckets"
      :unit="series.range.unit"
      :step="series.range.step"
      :caption="$t('staking.rewards.earned', { range: rangeKey })"
    />

    <p v-if="!rewards.length" class="text-xs leading-snug text-gray-400 dark:text-gray-500">{{ $t('staking.rewards.none') }}</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Sparkles } from 'lucide-vue-next'
import { navPrice } from '@/stores/navPrice'
import { settings } from '@/stores/settings'
import { formatAmount, formatFiatFromUsd } from '@/lib/displayFormat'
import { REWARD_RANGES, rewardSeries } from '@/lib/staking'
import RewardsChart from './RewardsChart.vue'

const props = defineProps({
  // [{ at, amount }] from toRewards()
  rewards: { type: Array, default: () => [] },
  // The chosen range, owned by the host (StakingCard) so its tab can show it.
  range: { type: String, default: '30D' },
  // Off under a "Rewards" tab, which names the panel already.
  showTitle: { type: Boolean, default: true },
})
defineEmits(['update:range'])
const rangeKey = computed(() => props.range)

// Ranges end at the current hour or day, so the clock moves them on.
const now = ref(Date.now())
let timer = null
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 60_000) })
onUnmounted(() => clearInterval(timer))

const series = computed(() => rewardSeries(props.rewards, rangeKey.value, now.value))

const totalFiat = computed(() =>
  settings.showFiatValue && navPrice.usd != null && series.value.total > 0
    ? formatFiatFromUsd(series.value.total * navPrice.usd)
    : null
)
</script>
