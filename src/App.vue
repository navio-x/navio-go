<!-- App.vue -->
<template>
  <div
    id="app"
    class="bg-white dark:bg-gh-900 transition-colors duration-300"
  >
    <div
      ref="scrollContainer"
      class="overflow-y-auto overflow-x-hidden"
      :style="{ height: '100dvh', paddingBottom: (isIos && showNavbar) ? 'calc(4.5rem + env(safe-area-inset-bottom))' : '0' }"
    >
      <router-view />
    </div>
    <BottomNavbar v-if="showNavbar" />

    <!-- Android back button exit confirmation -->
    <div
      v-if="showExitConfirm"
      class="fixed inset-0 z-[999] flex items-end justify-center bg-black/60 backdrop-blur-sm p-6"
    >
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl mb-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gray-100 dark:bg-gh-800 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
          <div>
            <p class="font-semibold text-gray-900 dark:text-white">{{ $t('common.exitTitle') }}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('common.exitDesc') }}</p>
          </div>
        </div>
        <div class="flex gap-2">
          <button
            @click="showExitConfirm = false"
            class="flex-1 py-2.5 rounded-xl text-sm font-medium transition
            bg-gray-100 hover:bg-gray-200 text-gray-700
            dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
          >
            {{ $t('common.exitCancel') }}
          </button>
          <button
            @click="confirmExit"
            class="flex-1 py-2.5 rounded-xl text-sm font-medium transition
            bg-red-600 hover:bg-red-700 text-white"
          >
            {{ $t('common.exitConfirm') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { settings, applyTheme } from './stores/settings'
import BottomNavbar from './components/BottomNavbar.vue'

const isIos = Capacitor.getPlatform() === 'ios'

const route = useRoute()
const router = useRouter()
const scrollContainer = ref(null)
const showExitConfirm = ref(false)

const showNavbar = computed(() => {
  return route.meta.showNavbar === true
})

watch(() => route.path, async () => {
  await nextTick()
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = 0
  }
})

function confirmExit() {
  CapApp.exitApp()
}

// Bu route'larda back basılınca çıkış onayı göster
const EXIT_ROUTES = ['/', '/welcome', '/wallet/home', '/wallet/balance']

let backButtonListener = null

onMounted(async () => {
  setTimeout(() => applyTheme(settings.theme), 100)

  backButtonListener = await CapApp.addListener('backButton', () => {
    if (showExitConfirm.value) {
      showExitConfirm.value = false
      return
    }
    if (EXIT_ROUTES.includes(route.path)) {
      showExitConfirm.value = true
    } else {
      router.back()
    }
  })
})

onUnmounted(() => {
  backButtonListener?.remove()
})
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  background-color: #ffffff;
}

.ios #app {
  padding-top: env(safe-area-inset-top);
}

html.dark, html.dark body {
  background-color: #1e2329;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

/* #app stil artık template'te Tailwind ile */
</style>