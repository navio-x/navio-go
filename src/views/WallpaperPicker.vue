<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gh-900 p-5 space-y-5">

    <div class="flex items-center gap-3">
      <button
        @click="router.back()"
        class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400"
      >
        <ChevronLeft class="w-5 h-5" />
      </button>
      <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ $t('settings.wallpaper') }}</h2>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <button
        v-for="wp in wallpapers"
        :key="wp.id"
        @click="select(wp.id)"
        class="relative rounded-2xl overflow-hidden aspect-[9/16] transition-all"
        :class="settings.wallpaper === wp.id
          ? 'ring-2 ring-blue-500 dark:ring-blue-400 scale-[0.98]'
          : 'ring-1 ring-gray-200 dark:ring-gh-700'"
      >
        <!-- Preview background -->
        <div
          class="absolute inset-0"
          :style="{ backgroundImage: isDark ? wp.previewDark : wp.previewLight, backgroundSize: 'cover', backgroundPosition: 'center' }"
        />

        <!-- Simulated wallet card overlay -->
        <div class="absolute inset-0 flex flex-col justify-between p-3">
          <div class="flex justify-between items-start">
            <div class="w-6 h-6 rounded-full bg-white/20 backdrop-blur-sm" />
            <div v-if="settings.wallpaper === wp.id" class="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow">
              <Check class="w-3 h-3 text-white" />
            </div>
          </div>
          <div class="space-y-1">
            <div class="h-1.5 rounded-full bg-white/30 w-2/3" />
            <div class="h-1.5 rounded-full bg-white/20 w-1/2" />
          </div>
        </div>

        <!-- Label -->
        <div class="absolute bottom-0 inset-x-0 px-3 py-2 bg-gradient-to-t from-black/50 to-transparent">
          <span class="text-xs font-semibold text-white drop-shadow">{{ wp.label }}</span>
        </div>
      </button>
    </div>

  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Check, ChevronLeft } from 'lucide-vue-next'
import { wallpapers } from '@/assets/wallpapers'
import { settings } from '@/stores/settings'

const router = useRouter()

const isDark = computed(() => {
  if (settings.theme === 'dark') return true
  if (settings.theme === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
})

function select(id) {
  settings.wallpaper = id
  router.back()
}
</script>
