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
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('backup.title') }}</h1>
    </div>

    <!-- Warning -->
    <div class="flex gap-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-2xl p-4 mb-5">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-yellow-500 dark:text-yellow-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <p class="text-sm text-yellow-800 dark:text-yellow-300 font-medium leading-snug">
        {{ $t('backup.warning') }}
      </p>
    </div>

    <!-- Hidden state: action buttons -->
    <div v-if="!revealed && !revealedSeed" class="space-y-3">
      <p class="text-sm text-gray-500 dark:text-gray-400 px-1 mb-1">
        {{ $t('backup.description') }}
      </p>

      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
        <button
          @click="revealMnemonic"
          class="w-full px-4 py-3.5 text-sm font-medium text-left
                 text-gray-700 dark:text-gray-300
                 hover:bg-gray-50 dark:hover:bg-gh-700
                 transition-colors flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span>{{ $t('backup.reveal') }}</span>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div class="border-t border-gray-200 dark:border-gh-700" />

        <button
          @click="revealSeed"
          class="w-full px-4 py-3.5 text-sm font-medium text-left
                 text-gray-700 dark:text-gray-300
                 hover:bg-gray-50 dark:hover:bg-gh-700
                 transition-colors flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <span>{{ $t('backup.revealSeed') }}</span>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Revealed state -->
    <div v-else class="space-y-5">

      <!-- Mnemonic -->
      <div v-if="revealed">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 px-1 mb-2">
          {{ $t('backup.reveal') }}
        </p>
        <div class="bg-white dark:bg-gh-800 rounded-2xl border border-gray-200 dark:border-gh-700 p-4">
          <div class="grid grid-cols-3 gap-2">
            <div
              v-for="(word, index) in mnemonicWords"
              :key="index"
              class="flex items-center gap-1.5 bg-gray-50 dark:bg-gh-700 rounded-xl px-2.5 py-2 border border-gray-100 dark:border-gh-600"
            >
              <span class="text-xs text-gray-400 dark:text-gray-500 w-4 shrink-0 text-right tabular-nums">{{ index + 1 }}</span>
              <span class="text-sm font-mono font-semibold text-gray-800 dark:text-white truncate">{{ word }}</span>
            </div>
          </div>
        </div>
        <button
          @click="copyMnemonic"
          class="mt-2 w-full py-3 rounded-2xl text-sm font-medium transition-colors flex items-center justify-center gap-2
                 border border-gray-200 dark:border-gh-700
                 bg-white dark:bg-gh-800
                 text-gray-700 dark:text-gray-300
                 hover:bg-gray-50 dark:hover:bg-gh-700"
        >
          <svg v-if="!copiedMnemonic" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span :class="copiedMnemonic ? 'text-green-500' : ''">
            {{ copiedMnemonic ? $t('backup.copied') : $t('backup.copy') }}
          </span>
        </button>
      </div>

      <!-- Master Seed -->
      <div v-if="revealedSeed">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 px-1 mb-2">
          {{ $t('backup.revealSeed') }}
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400 px-1 mb-2">{{ $t('backup.seedDescription') }}</p>
        <div class="bg-white dark:bg-gh-800 rounded-2xl border border-gray-200 dark:border-gh-700 p-4">
          <p class="text-xs font-mono break-all text-gray-700 dark:text-gray-300 leading-relaxed select-all">
            {{ masterSeed }}
          </p>
        </div>
        <button
          @click="copySeed"
          class="mt-2 w-full py-3 rounded-2xl text-sm font-medium transition-colors flex items-center justify-center gap-2
                 border border-gray-200 dark:border-gh-700
                 bg-white dark:bg-gh-800
                 text-gray-700 dark:text-gray-300
                 hover:bg-gray-50 dark:hover:bg-gh-700"
        >
          <svg v-if="!copiedSeed" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span :class="copiedSeed ? 'text-green-500' : ''">
            {{ copiedSeed ? $t('backup.copied') : $t('backup.copySeed') }}
          </span>
        </button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getNavioClient } from '@/stores/navio'

const router = useRouter()

const revealed = ref(false)
const mnemonic = ref('')
const copiedMnemonic = ref(false)

const revealedSeed = ref(false)
const masterSeed = ref('')
const copiedSeed = ref(false)

const mnemonicWords = computed(() =>
  mnemonic.value ? mnemonic.value.trim().split(' ') : []
)

const revealMnemonic = () => {
  try {
    const backupMnemonic = getNavioClient().keyManager.getMnemonic()
    if (!backupMnemonic) throw new Error('Mnemonic not found')
    mnemonic.value = backupMnemonic
    revealed.value = true
  } catch (e) {
    console.error('Backup mnemonic error:', e)
  }
}

const revealSeed = () => {
  try {
    const seedKey = getNavioClient().keyManager.getMasterSeedKey()
    if (!seedKey) throw new Error('Seed not found')
    masterSeed.value = seedKey.serialize()
    revealedSeed.value = true
  } catch (e) {
    console.error('Master seed error:', e)
  }
}

const copyMnemonic = async () => {
  try {
    await navigator.clipboard.writeText(mnemonic.value)
    copiedMnemonic.value = true
    setTimeout(() => (copiedMnemonic.value = false), 2000)
  } catch (e) {
    console.error('Clipboard error:', e)
  }
}

const copySeed = async () => {
  try {
    await navigator.clipboard.writeText(masterSeed.value)
    copiedSeed.value = true
    setTimeout(() => (copiedSeed.value = false), 2000)
  } catch (e) {
    console.error('Clipboard error:', e)
  }
}
</script>
