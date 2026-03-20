<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gh-900 p-4 pb-24">

    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <button
        @click="router.back()"
        class="p-2 rounded-full transition-colors
               text-gray-700 hover:bg-gray-200
               dark:text-white dark:hover:bg-gh-700"
      >
        ←
      </button>
      <h1 class="text-xl font-bold dark:text-white">{{ $t('settings.about') }}</h1>
    </div>

    <!-- Card -->
    <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">

      <!-- Logo + title -->
      <div class="flex flex-col items-center px-6 pt-8 pb-6 gap-3">
        <div class="w-16 h-16">
          <img :src="logoSrc" alt="Navio" class="w-full h-full object-contain" />
        </div>
        <div class="text-center">
          <p class="text-lg font-bold tracking-tight text-gray-900 dark:text-white">Navio Go</p>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {{ $t('settings.version') }} {{ appVersion }}
          </p>
        </div>

        <!-- SDK badge -->
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full
                    bg-gray-100 dark:bg-gh-700
                    border border-gray-200 dark:border-gh-600">
          <span class="text-xs font-mono text-gray-500 dark:text-gray-400">navio-sdk</span>
          <span class="text-xs font-mono font-semibold text-gray-700 dark:text-gray-300">v{{ sdkVersion }}</span>
        </div>
      </div>

      <!-- Links -->
      <div class="border-t border-gray-200 dark:border-gh-700 flex">

        <a
          href="https://go.nav.io"
          target="_blank"
          rel="noopener noreferrer"
          class="flex-1 flex items-center justify-center gap-2 py-3.5
                 text-sm font-medium text-gray-600 dark:text-gray-400
                 hover:bg-gray-50 dark:hover:bg-gh-700
                 transition-colors"
        >
          <Globe class="w-4 h-4" />
          <span>go.nav.io</span>
        </a>

        <div class="w-px bg-gray-200 dark:bg-gh-700" />

        <a
          href="https://github.com/nav-io/navio-go"
          target="_blank"
          rel="noopener noreferrer"
          class="flex-1 flex items-center justify-center gap-2 py-3.5
                 text-sm font-medium text-gray-600 dark:text-gray-400
                 hover:bg-gray-50 dark:hover:bg-gh-700
                 transition-colors"
        >
          <Github class="w-4 h-4" />
          <span>GitHub</span>
        </a>

      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Globe, Github } from 'lucide-vue-next'
import { settings } from '../stores/settings'
import logoLight from '../assets/navio-symbol-light.svg'
import logoDark from '../assets/navio-symbol-dark.svg'

const router = useRouter()

const appVersion = __APP_VERSION__
const sdkVersion = __SDK_VERSION__

const darkMode = ref(document.documentElement.classList.contains('dark'))
const logoSrc = computed(() => darkMode.value ? logoDark : logoLight)

watch(() => settings.theme, async () => {
  await nextTick()
  darkMode.value = document.documentElement.classList.contains('dark')
})
</script>
