<!-- PwaInstallPrompt.vue -->
<template>
  <Transition name="slide-up">
    <div
      v-if="visible"
      class="fixed bottom-0 left-0 right-0 z-[998] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div class="bg-white dark:bg-gh-800 border border-gray-100 dark:border-gh-700 rounded-2xl p-4 shadow-2xl max-w-sm mx-auto">
        <div class="flex items-center gap-3">
          <img src="/icons/icon-96.webp" alt="Navio Go" class="w-12 h-12 rounded-xl shrink-0" />
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-gray-900 dark:text-white text-sm">{{ $t('pwa.installTitle') }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ $t('pwa.installDesc') }}</p>
          </div>
          <button
            @click="dismiss"
            class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gh-700 transition shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- iOS manual instruction (Share icon) -->
        <div v-if="isIos" class="mt-3 bg-gray-50 dark:bg-gh-700 rounded-xl p-3">
          <p class="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
            {{ $t('pwa.iosStep1') }}
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 inline mx-0.5 align-text-bottom" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            {{ $t('pwa.iosStep2') }}
          </p>
        </div>

        <!-- Opera / Firefox manual instruction (browser menu) -->
        <div v-else-if="isManualBrowser" class="mt-3 bg-gray-50 dark:bg-gh-700 rounded-xl p-3">
          <p class="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
            {{ $t('pwa.browserStep') }}
          </p>
        </div>

        <!-- Install button for supported browsers (Chrome etc.) -->
        <button
          v-else
          @click="install"
          class="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold transition
          bg-gray-900 hover:bg-gray-700 text-white
          dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900"
        >
          {{ $t('pwa.installButton') }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Capacitor } from '@capacitor/core'

const DISMISSED_KEY = 'pwa-install-dismissed'

const visible = ref(false)
const isIos = ref(false)
const isManualBrowser = ref(false)
let deferredPrompt = null

function dismiss() {
  visible.value = false
  localStorage.setItem(DISMISSED_KEY, '1')
}

async function install() {
  if (!deferredPrompt) return
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  if (outcome === 'accepted') {
    visible.value = false
    localStorage.setItem(DISMISSED_KEY, '1')
  }
}

onMounted(() => {
  if (Capacitor.isNativePlatform()) return
  if (window.matchMedia('(display-mode: standalone)').matches) return
  if (localStorage.getItem(DISMISSED_KEY)) return

  const ua = navigator.userAgent
  const iosDevice = /iphone|ipad|ipod/i.test(ua) && !window.MSStream
  const isOpera = /OPR\/|Opera/i.test(ua)
  const isFirefox = /Firefox\//i.test(ua)

  if (iosDevice) {
    isIos.value = true
    visible.value = true
    return
  }

  if (isOpera || isFirefox) {
    isManualBrowser.value = true
    visible.value = true
    return
  }

  // Event may have already fired before Vue mounted — check captured reference first
  if (window.__pwaInstallPrompt) {
    deferredPrompt = window.__pwaInstallPrompt
    visible.value = true
    return
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    visible.value = true
  })
})
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
