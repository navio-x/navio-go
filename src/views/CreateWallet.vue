<template>
  <div
    class="p-6 space-y-6 bg-white text-gray-900 dark:bg-gh-900 dark:text-white min-h-screen transition-colors duration-300"
  >
    <h2 class="text-xl font-bold">{{ $t('wizard.createWallet') }}</h2>

    <!-- Network -->
    <div>
      <label class="block mb-2 font-semibold">{{ $t('wizard.network') }}</label>
      <select
        v-model="network"
        class="border border-gray-300 dark:border-gh-600 rounded p-2 w-full bg-white text-gray-900 dark:bg-gh-800 dark:text-white transition-colors duration-300"
      >
        <option value="testnet">{{ $t('wizard.testnet') }}</option>
        <option value="mainnet">{{ $t('wizard.mainnet') }}</option>
      </select>
    </div>

    <!-- Wallet Name -->
    <div>
      <label class="block mb-2 font-semibold">{{ $t('wizard.walletName') }}</label>
      <input
        type="text"
        v-model="walletName"
        :placeholder="$t('wizard.walletNamePlaceholder')"
        class="border border-gray-300 dark:border-gh-600 rounded p-2 w-full bg-white dark:bg-gh-800"
      />
      <p v-if="walletName && !hasValidName" class="text-sm text-red-500 mt-1">
        {{ $t('wizard.walletNameRequired') }}
      </p>
    </div>

    <!-- Password -->
    <div>
      <label class="block mb-2 font-semibold">{{ $t('wizard.password') }}</label>
      <input
        type="password"
        v-model="password"
        class="border border-gray-300 dark:border-gh-600 rounded p-2 w-full bg-white dark:bg-gh-800"
      />
      <div class="mt-2 h-2 w-full rounded bg-gray-200 dark:bg-gh-700 overflow-hidden">
        <div
          class="h-full transition-all duration-300"
          :class="strengthColor"
          :style="{ width: strengthPercent + '%' }"
        ></div>
      </div>
      <p class="text-xs mt-1 text-gray-500">
        {{ $t('wizard.passwordHint') }}
      </p>
    </div>

    <!-- Verify Password -->
    <div>
      <label class="block mb-2 font-semibold">{{ $t('wizard.verifyPassword') }}</label>
      <input
        type="password"
        v-model="passwordVerify"
        class="border border-gray-300 dark:border-gh-600 rounded p-2 w-full bg-white dark:bg-gh-800"
      />
      <p v-if="passwordVerify && !passwordsMatch" class="text-sm text-red-500 mt-1">
        {{ $t('wizard.passwordsDontMatch') }}
      </p>
    </div>

    <!-- Button -->
    <button
      class="w-full text-white font-medium rounded-lg text-sm px-5 py-2.5 mb-2 transition
        disabled:bg-gray-400 disabled:cursor-not-allowed
        bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700"
      :disabled="!canContinue || isLoading"
      @click="MnemonicGenerate"
    >
      <span v-if="isLoading" class="inline-flex items-center gap-2">
        <svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        {{ $t('walletList.loading') }}
      </span>
      <span v-else>{{ $t('wizard.createWallet') }}</span>
    </button>
    <WizardNav :showBack="true" :showNext="false" />

    <!-- Connection error modal -->
    <div
      v-if="connectionError"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
    >
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <!-- Icon -->
        <div class="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M6.343 6.343a9 9 0 000 12.728M9.172 9.172a5 5 0 000 7.071M12 12h.01" />
          </svg>
        </div>

        <!-- Title -->
        <div class="text-center space-y-1">
          <h3 class="text-base font-bold text-gray-900 dark:text-white">
            {{ $t('walletList.connectionErrorTitle') }}
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ $t('walletList.connectionErrorDesc') }}
          </p>
        </div>

        <!-- Error detail -->
        <div v-if="connectionError.message" class="rounded-lg bg-gray-50 dark:bg-gh-800 px-3 py-2">
          <p class="text-xs font-mono text-red-500 dark:text-red-400 break-all">
            {{ connectionError.message }}
          </p>
        </div>

        <!-- Actions -->
        <div class="flex gap-2 pt-1">
          <button
            @click="connectionError = null"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition
            bg-gray-100 hover:bg-gray-200 text-gray-700
            dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
          >
            {{ $t('walletList.cancel') }}
          </button>
          <button
            @click="retryGenerate"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition
            bg-blue-600 hover:bg-blue-700 text-white"
          >
            {{ $t('walletList.retry') }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import WizardNav from "@/components/WizardNav.vue";

const router = useRouter();

const network         = ref("testnet");
const walletName      = ref("");
const password        = ref("Aa123456.");
const passwordVerify  = ref("Aa123456.");
const isLoading       = ref(false);
const connectionError = ref(null);

// validations
const hasValidName   = computed(() => walletName.value.trim().length > 0);
const hasMinLength   = computed(() => password.value.length >= 6);
const hasSpecialChar = computed(() => /[!@#$%^&*(),.?":{}|<>]/.test(password.value));
const passwordsMatch = computed(() => password.value === passwordVerify.value);

// strength
const strengthScore = computed(() => {
  let score = 0;
  if (password.value.length >= 6)   score++;
  if (password.value.length >= 10)  score++;
  if (/[A-Z]/.test(password.value)) score++;
  if (/[0-9]/.test(password.value)) score++;
  if (hasSpecialChar.value)          score++;
  return score;
});
const strengthPercent = computed(() => (strengthScore.value / 5) * 100);
const strengthColor   = computed(() => {
  if (strengthScore.value <= 2) return "bg-red-500";
  if (strengthScore.value <= 4) return "bg-yellow-500";
  return "bg-green-500";
});

// final check
const canContinue = computed(() =>
  hasValidName.value &&
  hasMinLength.value &&
  hasSpecialChar.value &&
  passwordsMatch.value
);

async function MnemonicGenerate() {
  try {
    isLoading.value = true;
    sessionStorage.setItem("network",     network.value);
    sessionStorage.setItem("wallet_name", walletName.value.trim());
    sessionStorage.setItem("password",    password.value);
    router.push("/wallet/mnemonic");
  } catch (err) {
    console.error("Mnemonic generate failed:", err);
    connectionError.value = { message: err?.message ?? String(err) };
  } finally {
    isLoading.value = false;
  }
}

function retryGenerate() {
  connectionError.value = null;
  MnemonicGenerate();
}
</script>