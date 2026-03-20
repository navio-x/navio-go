<template>
  <div class="space-y-4">

    <!-- Preferences -->
    <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">

      <div class="px-4 py-3">
        <label class="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {{ $t('settings.language') }}
        </label>
        <select
          v-model="currentLanguage"
          @change="changeLanguage"
          class="w-full px-3 py-2 rounded-lg text-sm
                 bg-gray-100 dark:bg-gh-700
                 text-gray-900 dark:text-white
                 border border-gray-200 dark:border-gh-600
                 hover:bg-gray-200 dark:hover:bg-gh-600
                 transition-colors outline-none cursor-pointer"
        >
          <option v-for="opt in languageOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div class="border-t border-gray-200 dark:border-gh-700 px-4 py-3">
        <label class="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {{ $t('settings.fiat') }}
        </label>
        <select
          v-model="settings.currency"
          class="w-full px-3 py-2 rounded-lg text-sm
                 bg-gray-100 dark:bg-gh-700
                 text-gray-900 dark:text-white
                 border border-gray-200 dark:border-gh-600
                 hover:bg-gray-200 dark:hover:bg-gh-600
                 transition-colors outline-none cursor-pointer"
        >
          <option v-for="opt in currencyOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div class="border-t border-gray-200 dark:border-gh-700 px-4 py-3 flex items-center justify-between">
        <label class="text-sm text-gray-700 dark:text-gray-300">{{ $t('settings.showBlockNumber') }}</label>
        <button
          @click="settings.showBlockNumber = !settings.showBlockNumber"
          class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
          :class="settings.showBlockNumber ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gh-600'"
        >
          <span
            class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
            :class="settings.showBlockNumber ? 'translate-x-6' : 'translate-x-1'"
          />
        </button>
      </div>

      <div class="border-t border-gray-200 dark:border-gh-700 px-4 py-3">
        <label class="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {{ $t('settings.theme') }}
        </label>
        <select
          v-model="settings.theme"
          class="w-full px-3 py-2 rounded-lg text-sm
                 bg-gray-100 dark:bg-gh-700
                 text-gray-900 dark:text-white
                 border border-gray-200 dark:border-gh-600
                 hover:bg-gray-200 dark:hover:bg-gh-600
                 transition-colors outline-none cursor-pointer"
        >
          <option v-for="opt in themeOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

    </div>

    <!-- Actions -->
    <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
      <button
        @click="router.push('/settings/wallpaper')"
        class="w-full px-4 py-3.5 text-sm font-medium text-left
               text-gray-700 dark:text-gray-300
               hover:bg-gray-50 dark:hover:bg-gh-700
               transition-colors flex items-center justify-between"
      >
        <div class="flex items-center gap-3">
          <span>{{ $t('settings.wallpaper') }}</span>
        </div>
        <div class="flex items-center gap-2">
          <div
            class="w-6 h-6 rounded-md ring-1 ring-gray-200 dark:ring-gh-600"
            :style="{ backgroundImage: isDark ? currentWallpaper.previewDark : currentWallpaper.previewLight, backgroundSize: 'cover' }"
          />
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>

      <div class="border-t border-gray-200 dark:border-gh-700" />

      <button
        @click="goToBackup"
        class="w-full px-4 py-3.5 text-sm font-medium text-left
               text-gray-700 dark:text-gray-300
               hover:bg-gray-50 dark:hover:bg-gh-700
               transition-colors flex items-center justify-between"
      >
        <span>{{ $t('settings.backupWallet') }}</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div class="border-t border-gray-200 dark:border-gh-700" />

      <button
        @click="router.push('/settings/network')"
        class="w-full px-4 py-3.5 text-sm font-medium text-left
               text-gray-700 dark:text-gray-300
               hover:bg-gray-50 dark:hover:bg-gh-700
               transition-colors flex items-center justify-between"
      >
        <span>{{ $t('settings.networkStatus') }}</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div class="border-t border-gray-200 dark:border-gh-700" />

      <button
        @click="router.push('/about')"
        class="w-full px-4 py-3.5 text-sm font-medium text-left
               text-gray-700 dark:text-gray-300
               hover:bg-gray-50 dark:hover:bg-gh-700
               transition-colors flex items-center justify-between"
      >
        <span>{{ $t('settings.about') }}</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <!-- Danger zone -->
    <div class="rounded-2xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-gh-800 overflow-hidden">
      <button
        @click="showConfirm = true"
        class="w-full px-4 py-3.5 text-sm font-medium text-left
               text-red-500 dark:text-red-400
               hover:bg-red-50 dark:hover:bg-red-900/20
               transition-colors flex items-center justify-between"
      >
        <span>{{ $t('settings.clearStorage') }}</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>

    <!-- Confirmation modal -->
    <div
      v-if="showConfirm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
    >
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <div class="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <div class="text-center space-y-1">
          <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('settings.clearStorage') }}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('settings.clearStorageDesc') }}</p>
        </div>
        <div class="flex gap-2 pt-1">
          <button
            @click="showConfirm = false"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition-colors
                   bg-gray-100 hover:bg-gray-200 text-gray-700
                   dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            @click="clearStorage"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition-colors
                   bg-red-600 hover:bg-red-700 text-white"
          >
            {{ $t('common.delete') }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { wallpapers } from '@/assets/wallpapers'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { settings } from '../stores/settings'
import { disconnectWallet } from '../stores/navio'
import { FIAT_CURRENCIES } from '../stores/navPrice'

const { locale, t } = useI18n()

const isDark = computed(() => {
  if (settings.theme === 'dark') return true
  if (settings.theme === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
})

const currentWallpaper = computed(() =>
  wallpapers.find(w => w.id === settings.wallpaper) ?? wallpapers[0]
)
const router = useRouter()
const currentLanguage = ref(locale.value)

const languageOptions = [
  { value: 'en',    label: 'English' },
  { value: 'tr',    label: 'Türkçe' },
  { value: 'zh',    label: '中文' },
  { value: 'ru',    label: 'Русский' },
  { value: 'es',    label: 'Español' },
  { value: 'pt-BR', label: 'Português (BR)' },
  { value: 'ko',    label: '한국어' },
  { value: 'de',    label: 'Deutsch' },
  { value: 'fr',    label: 'Français' },
  { value: 'ja',    label: '日本語' },
]

const currencyOptions = FIAT_CURRENCIES

const themeOptions = ref([
  { value: 'light',  label: t('settings.light') },
  { value: 'dark',   label: t('settings.dark') },
  { value: 'device', label: t('settings.system') },
])

watch(locale, () => {
  themeOptions.value = [
    { value: 'light',  label: t('settings.light') },
    { value: 'dark',   label: t('settings.dark') },
    { value: 'device', label: t('settings.system') },
  ]
})

const changeLanguage = () => {
  locale.value = currentLanguage.value
  settings.language = currentLanguage.value
}

onMounted(() => {
  if (settings.language && settings.language !== locale.value) {
    currentLanguage.value = settings.language
    locale.value = settings.language
  }
})

const goToBackup = () => {
  router.push('/wallet/backup')
}

const showConfirm = ref(false)

const clearStorage = async () => {
  await disconnectWallet()

  localStorage.clear()
  sessionStorage.clear()

  try {
    const databases = await indexedDB.databases()
    await Promise.all(
      databases.map(db => new Promise((resolve) => {
        const req = indexedDB.deleteDatabase(db.name)
        req.onsuccess = resolve
        req.onerror   = resolve
        req.onblocked = resolve
      }))
    )
  } catch {
    // indexedDB.databases() desteklenmiyorsa geç
  }

  router.replace('/welcome')
}
</script>
