<!-- Full-screen overlay shown while the open wallet is locked (auto-lock,
     see lib/autoLock.js). Everything underneath stays mounted — sync keeps
     running — but nothing is reachable until the password is typed. -->
<template>
  <div class="fixed inset-0 z-[998] flex items-center justify-center bg-white dark:bg-gh-900 p-6">
    <div class="w-full max-w-sm space-y-4">
      <div class="flex flex-col items-center gap-3 text-center">
        <div class="w-14 h-14 rounded-full bg-gray-100 dark:bg-gh-800 flex items-center justify-center">
          <Lock class="w-6 h-6 text-gray-500 dark:text-gray-400" />
        </div>
        <h3 class="text-lg font-bold text-gray-900 dark:text-white">{{ $t('lock.title') }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('lock.desc', { name: walletName }) }}
        </p>
      </div>

      <div class="relative">
        <input
          ref="passwordInputEl"
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          :placeholder="$t('walletList.unlockPlaceholder')"
          autocomplete="current-password"
          @keyup.enter="unlock"
          class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 pr-10 text-sm
          bg-white dark:bg-gh-800 text-gray-900 dark:text-white
          focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          @click="showPassword = !showPassword"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <EyeOff v-if="showPassword" class="w-4 h-4" />
          <Eye v-else class="w-4 h-4" />
        </button>
      </div>

      <p v-if="error" class="text-sm text-red-500 dark:text-red-400">{{ error }}</p>

      <button
        @click="unlock"
        :disabled="!password || busy"
        class="w-full py-2.5 rounded-xl text-sm font-medium transition
        bg-blue-600 hover:bg-blue-700 text-white
        disabled:opacity-60 disabled:cursor-not-allowed
        inline-flex items-center justify-center gap-2"
      >
        <svg v-if="busy" class="w-3.5 h-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        {{ $t('walletList.unlockBtn') }}
      </button>

      <button
        @click="logout"
        :disabled="busy"
        class="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
      >
        {{ $t('lock.logout') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Lock, Eye, EyeOff } from 'lucide-vue-next'
import { walletName, unlockWallet, logoutWallet } from '../stores/navio'
import { unlockMaxAgeMs } from '../stores/settings'
import { rememberPassword } from '../lib/unlockCache'

const router = useRouter()
const { t } = useI18n()

const password = ref('')
const showPassword = ref(false)
const error = ref('')
const busy = ref(false)
const passwordInputEl = ref(null)
onMounted(() => passwordInputEl.value?.focus())

async function unlock() {
  if (!password.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const ok = await unlockWallet(password.value)
    if (!ok) {
      error.value = t('walletList.wrongPassword')
      return
    }
    // Same rule as the wallet list: a password typed by the user (re)starts
    // the optional "keep unlocked" window.
    if (unlockMaxAgeMs()) await rememberPassword(walletName.value, password.value)
    password.value = ''
  } catch (e) {
    console.error('Unlock failed:', e)
    error.value = e?.message ?? String(e)
  } finally {
    busy.value = false
  }
}

async function logout() {
  busy.value = true
  try {
    await logoutWallet()
    router.replace('/wallet/home')
  } finally {
    busy.value = false
  }
}
</script>
