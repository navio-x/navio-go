<!-- A staker, recognisable at a glance: two hues taken from its delegation
     key, so the same operator always looks the same and two different ones
     rarely do. No key (a delegation the wallet can't read) is drawn grey. -->
<template>
  <span
    class="shrink-0 inline-flex items-center justify-center rounded-full ring-2 ring-white/70 dark:ring-gh-800/70"
    :style="{ width: `${size}px`, height: `${size}px`, background }"
    aria-hidden="true"
  >
    <Layers v-if="!stakerKey" class="text-white/90" :style="{ width: `${size / 2}px`, height: `${size / 2}px` }" />
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { Layers } from 'lucide-vue-next'

const props = defineProps({
  stakerKey: { type: String, default: '' },
  size: { type: Number, default: 36 },
})

const background = computed(() => {
  const key = props.stakerKey
  if (!key) return 'linear-gradient(135deg, #9ca3af, #6b7280)'
  // Skip the point's leading flag byte, which is the same for every key.
  const a = parseInt(key.slice(2, 6), 16) % 360
  const b = (a + 40 + (parseInt(key.slice(6, 8), 16) % 100)) % 360
  return `linear-gradient(135deg, hsl(${a} 80% 58%), hsl(${b} 85% 45%))`
})
</script>
