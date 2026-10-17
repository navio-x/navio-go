<!-- Rewards per bucket as columns: one series, one colour, so no legend —
     the card's title names it. Each column's whole slot is its hit target;
     hovering, tapping or focusing it shows the period and the amount. A
     hidden table carries the same numbers for screen readers. -->
<template>
  <div class="relative select-none" :class="{ 'opacity-60': stale }">
    <div class="flex gap-2">
      <!-- Y axis: round ticks only -->
      <div class="relative w-9 shrink-0 h-32 text-[10px] tabular-nums text-gray-400 dark:text-gray-500" aria-hidden="true">
        <span
          v-for="tick in ticks"
          :key="tick"
          class="absolute right-0 -translate-y-1/2 leading-none"
          :style="{ top: `${100 - (tick / axisMax) * 100}%` }"
        >{{ compact(tick) }}</span>
      </div>

      <div class="relative flex-1 min-w-0">
        <!-- Gridlines: hairline, recessive -->
        <div class="absolute inset-x-0 top-0 h-32 pointer-events-none" aria-hidden="true">
          <div
            v-for="tick in ticks"
            :key="tick"
            class="absolute inset-x-0 border-t"
            :class="tick === 0 ? 'border-gray-200 dark:border-gh-600' : 'border-gray-100 dark:border-gh-700'"
            :style="{ top: `${100 - (tick / axisMax) * 100}%` }"
          />
        </div>

        <!-- Columns -->
        <div class="relative h-32 flex items-end gap-[2px]" role="list" @pointerleave="active = -1">
          <button
            v-for="(b, i) in buckets"
            :key="b.start"
            type="button"
            role="listitem"
            class="group relative flex-1 min-w-0 h-full flex items-end justify-center outline-none"
            :aria-label="`${periodLabel(b)}: ${formatAmount(b.amount, 8)} NAV`"
            @pointerenter="active = i"
            @pointerdown="active = i"
            @focus="active = i"
            @blur="active = -1"
          >
            <span
              class="block w-full max-w-[24px] rounded-t-[4px] transition-colors"
              :class="[
                b.amount > 0 ? 'bg-blue-500' : 'bg-transparent',
                active === i && b.amount > 0 ? 'bg-blue-600 dark:bg-blue-400' : '',
                active === i ? 'ring-2 ring-blue-500/30 ring-offset-0' : '',
              ]"
              :style="{ height: b.amount > 0 ? `max(2px, ${(b.amount / axisMax) * 100}%)` : '0' }"
            />
            <span v-if="active === i" class="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-gray-200 dark:bg-gh-600 -z-10" />
          </button>
        </div>

        <!-- X axis: first, middle, last -->
        <div class="relative mt-1.5 h-4 text-[10px] text-gray-400 dark:text-gray-500" aria-hidden="true">
          <span
            v-for="mark in xMarks"
            :key="mark.index"
            class="absolute top-0 whitespace-nowrap"
            :style="mark.style"
          >{{ mark.label }}</span>
        </div>

        <!-- Tooltip: value leads, period follows -->
        <div
          v-if="activeBucket"
          class="absolute -top-2 z-10 pointer-events-none rounded-lg px-2.5 py-1.5 shadow-lg
                 bg-white dark:bg-gh-900 border border-gray-200 dark:border-gh-600 whitespace-nowrap"
          :style="tooltipStyle"
        >
          <p class="text-xs font-semibold tabular-nums text-gray-900 dark:text-white">+{{ formatAmount(activeBucket.amount, 8) }} NAV</p>
          <p class="text-[10px] text-gray-500 dark:text-gray-400">
            {{ periodLabel(activeBucket) }}<template v-if="activeBucket.count"> · {{ $t('staking.rewards.count', { count: activeBucket.count }, activeBucket.count) }}</template>
          </p>
        </div>
      </div>
    </div>

    <!-- sr-only on a wrapper, not the table: a table ignores the 1px height
         and overflow, and its full height would stretch the page's scroll. -->
    <div class="sr-only">
      <table>
        <caption>{{ caption }}</caption>
        <thead><tr><th scope="col">{{ $t('staking.rewards.period') }}</th><th scope="col">NAV</th></tr></thead>
        <tbody>
          <tr v-for="b in buckets" :key="b.start"><td>{{ periodLabel(b) }}</td><td>{{ formatAmount(b.amount, 8) }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatAmount } from '@/lib/displayFormat'
import { niceCeil } from '@/lib/staking'

const props = defineProps({
  // [{ start, end, amount, count }], oldest first, from rewardSeries()
  buckets: { type: Array, required: true },
  unit: { type: String, default: 'day' }, // 'hour' | 'day'
  step: { type: Number, default: 1 },
  caption: { type: String, default: '' },
  // Holds the previous render dimmed while fresh data loads.
  stale: { type: Boolean, default: false },
})
const { locale } = useI18n()

const active = ref(-1)
watch(() => props.buckets, () => { active.value = -1 })
const activeBucket = computed(() => props.buckets[active.value] ?? null)

const axisMax = computed(() => niceCeil(Math.max(0, ...props.buckets.map((b) => b.amount))))
const ticks = computed(() => [0, axisMax.value / 2, axisMax.value])

function compact(n) {
  return n.toLocaleString(locale.value, { notation: 'compact', maximumFractionDigits: n < 1 ? 4 : 1 })
}

function fmt(ms, opts) {
  return new Date(ms).toLocaleString(locale.value, opts)
}

// A bucket as a reader would name it: an hour, a day, or a span of days.
function periodLabel(b) {
  if (props.unit === 'hour') return `${fmt(b.start, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}–${fmt(b.end, { hour: '2-digit', minute: '2-digit' })}`
  if (props.step === 1) return fmt(b.start, { weekday: 'short', day: 'numeric', month: 'short' })
  const opts = { day: 'numeric', month: 'short' }
  return `${fmt(b.start, opts)} – ${fmt(b.end - 1, opts)}`
}

function axisLabel(b) {
  if (props.unit === 'hour') return fmt(b.start, { hour: '2-digit', minute: '2-digit' })
  if (props.step >= 30) return fmt(b.start, { month: 'short' })
  return fmt(b.start, { day: 'numeric', month: 'short' })
}

const xMarks = computed(() => {
  const n = props.buckets.length
  if (!n) return []
  const at = (index, style) => ({ index, label: axisLabel(props.buckets[index]), style })
  const marks = [at(0, { left: '0' }), at(n - 1, { right: '0' })]
  if (n > 4) {
    const mid = Math.floor(n / 2)
    marks.splice(1, 0, at(mid, { left: `${((mid + 0.5) / n) * 100}%`, transform: 'translateX(-50%)' }))
  }
  return marks
})

// Above its column, centred on it, kept inside the chart at the edges.
const tooltipStyle = computed(() => {
  const x = ((active.value + 0.5) / props.buckets.length) * 100
  if (x < 25) return { left: '0', transform: 'translateY(-100%)' }
  if (x > 75) return { right: '0', transform: 'translateY(-100%)' }
  return { left: `${x}%`, transform: 'translate(-50%, -100%)' }
})
</script>
