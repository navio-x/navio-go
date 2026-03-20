<script setup>
import { computed, ref, watch, onMounted, nextTick } from 'vue'

const props = defineProps({
  value: { type: Number, default: 0, validator: val => val >= 0 && val <= 100 },
  size: { type: Number, default: 200 },
  strokeWidth: { type: Number, default: 3 },
  label: { type: String, default: 'SYNCED' }
})

const currentValue = ref(0)
const displayedValue = ref(0)

const padding = 30
const svgSize = computed(() => props.size + padding * 2)
const svgCenter = computed(() => svgSize.value / 2)
const normalizedRadius = computed(() => props.size / 2 - props.strokeWidth / 2 - 10)
const circumference = computed(() => normalizedRadius.value * 2 * Math.PI)
const dotRadius = computed(() => 8)

const currentOffset = computed(() => {
  return circumference.value - (currentValue.value / 100) * circumference.value
})

const currentOffsetStyle = computed(() => `${currentOffset.value}px`)

const dotX = computed(() => {
  const rad = (currentValue.value / 100) * 2 * Math.PI
  return svgCenter.value + normalizedRadius.value * Math.cos(rad)
})

const dotY = computed(() => {
  const rad = (currentValue.value / 100) * 2 * Math.PI
  return svgCenter.value + normalizedRadius.value * Math.sin(rad)
})

// Component mount olduğunda ilk değeri ayarla
onMounted(async () => {
  currentValue.value = props.value
  await nextTick()
  displayedValue.value = props.value
})

// Props değişikliklerini izle
watch(
  () => props.value,
  async (newValue) => {
    currentValue.value = newValue
    await nextTick()
    displayedValue.value = newValue
  },
  { immediate: true } // İlk render'da da çalışır
)
</script>

<template>
  <div class="relative inline-flex items-center justify-center">
    <svg :width="svgSize" :height="svgSize" class="-rotate-90 overflow-visible">
      <circle
        class="fill-none stroke-white/8"
        :stroke-width="strokeWidth"
        :r="normalizedRadius"
        :cx="svgCenter"
        :cy="svgCenter"
      />
      <circle
        class="fill-none stroke-[#00ff88]"
        style="stroke-linecap: round;"
        :stroke-width="strokeWidth"
        :stroke-dasharray="circumference + ' ' + circumference"
        :style="{ strokeDashoffset: currentOffsetStyle }"
        :r="normalizedRadius"
        :cx="svgCenter"
        :cy="svgCenter"
      />
      <circle class="fill-[#00ff88] opacity-30" style="filter: blur(8px);" :r="dotRadius*2.5" :cx="dotX" :cy="dotY" />
      <circle class="fill-[#00ff88]" style="filter: drop-shadow(0 0 8px rgb(0 255 136 / 0.6)) drop-shadow(0 0 12px rgb(0 255 136 / 0.6));" :r="dotRadius" :cx="dotX" :cy="dotY" />
    </svg>
    <div class="absolute text-center">
      <div class="text-[2.5rem] font-semibold leading-none mb-1 text-black dark:text-gray-400">
        {{ displayedValue }}%
      </div>
      <div class="text-sm tracking-[0.15em] opacity-70 font-sm text-black dark:text-gray-400">
        {{ label }}
      </div>
    </div>
  </div>
</template>