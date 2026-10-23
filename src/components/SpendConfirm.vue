<!-- Password / biometric check in front of a spend (see lib/spendConfirm.js).
     Mounted once in App.vue; shows whenever a request is pending. -->
<template>
  <div
    v-if="req"
    class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
  >
    <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-gray-100 dark:bg-gh-800 flex items-center justify-center shrink-0">
          <ShieldCheck class="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </div>
        <div class="min-w-0">
          <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('spendConfirm.title') }}</h3>
          <p v-if="summary" class="text-sm text-gray-500 dark:text-gray-400 break-words">{{ summary }}</p>
        </div>
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('spendConfirm.desc') }}</p>

      <div class="relative">
        <input
          ref="passwordInputEl"
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          :placeholder="$t('walletList.unlockPlaceholder')"
          autocomplete="current-password"
          @keyup.enter="confirmWithPassword"
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
        v-if="biometricReady"
        @click="confirmWithBiometric"
        :disabled="busy"
        class="w-full py-2.5 rounded-xl text-sm font-medium transition
        bg-gray-100 hover:bg-gray-200 text-gray-700
        dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300
        disabled:opacity-60 disabled:cursor-not-allowed
        inline-flex items-center justify-center gap-2"
      >
        <Fingerprint class="w-4 h-4" />
        {{ $t('biometric.useButton') }}
      </button>

      <div class="flex gap-2 pt-1">
        <button
          @click="cancel"
          :disabled="busy"
          class="flex-1 py-2 rounded-xl text-sm font-medium transition
          bg-gray-100 hover:bg-gray-200 text-gray-700
          dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          @click="confirmWithPassword"
          :disabled="!password || busy"
          class="flex-1 py-2 rounded-xl text-sm font-medium transition
          bg-blue-600 hover:bg-blue-700 text-white
          disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {{ $t('common.confirm') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { passwordWaitMs, recordPasswordFailure, recordPasswordSuccess, waitSeconds } from '../lib/passwordThrottle'
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ShieldCheck, Eye, EyeOff, Fingerprint } from 'lucide-vue-next'
import { pendingSpendConfirm as req, settleSpendConfirm, verifyWalletPassword } from '../lib/spendConfirm'
import { walletName } from '../stores/navio'
import { settings } from '../stores/settings'
import { hasBiometricPassword, readBiometricPassword, forgetBiometricPassword } from '../lib/biometric'

const { t } = useI18n()
const password = ref('')
const showPassword = ref(false)
const error = ref('')
const busy = ref(false)
const passwordInputEl = ref(null)
const biometricReady = ref(false)
const summary = computed(() => (req.value?.summaryKey ? t(req.value.summaryKey, req.value.summaryParams ?? {}) : ''))

watch(req, async (r) => {
  if (!r) return
  password.value = ''
  showPassword.value = false
  error.value = ''
  biometricReady.value = settings.biometricUnlock && (await hasBiometricPassword(walletName.value))
  await nextTick()
  if (biometricReady.value) confirmWithBiometric()
  else passwordInputEl.value?.focus()
})

async function confirmWithPassword() {
  if (!password.value || busy.value) return
  const wait = passwordWaitMs(walletName.value)
  if (wait) { error.value = t('password.wait', { seconds: waitSeconds(wait) }); return }
  busy.value = true
  error.value = ''
  try {
    if (await verifyWalletPassword(password.value)) {
      recordPasswordSuccess(walletName.value)
      password.value = ''
      settleSpendConfirm(true)
    } else {
      const w = recordPasswordFailure(walletName.value)
      error.value = w ? t('password.wait', { seconds: waitSeconds(w) }) : t('walletList.wrongPassword')
    }
  } catch (e) {
    error.value = e?.message ?? String(e)
  } finally {
    busy.value = false
  }
}

async function confirmWithBiometric() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const r = await readBiometricPassword(walletName.value, {
      title: t('spendConfirm.title'),
      subtitle: summary.value || t('spendConfirm.desc'),
      negativeButtonText: t('common.cancel'),
    })
    if (r.status === 'ok') {
      if (await verifyWalletPassword(r.password)) { settleSpendConfirm(true); return }
      await forgetBiometricPassword(walletName.value)
      biometricReady.value = false
      error.value = t('biometric.staleStored')
    } else if (r.status === 'none') {
      biometricReady.value = false
    } else if (r.status === 'error') {
      error.value = r.message
    }
  } finally {
    busy.value = false
    passwordInputEl.value?.focus()
  }
}

function cancel() {
  password.value = ''
  settleSpendConfirm(false)
}
</script>
