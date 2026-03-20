<template>
  <div class="mx-auto p-6 bg-white text-gray-900 dark:bg-gh-900 dark:text-white min-h-screen transition-colors duration-300">
    <!-- LOADING -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 space-y-6">
      <div class="w-14 h-14 border-4 border-slate-300 dark:border-gh-600 border-t-black dark:border-t-white rounded-full animate-spin"></div>
      <p class="text-slate-600 dark:text-gray-300 text-sm text-center">
        {{ $t('wizard.creatingWallet') }}
      </p>
    </div>

    <!-- MNEMONIC -->
    <div v-else-if="mnemonic_words.length > 0">
      <h2 class="font-bold text-xl mb-4 text-center">
        {{ $t('wizard.seedPhrase') }}
      </h2>
      <button
        @click="copyMnemonic"
        class="border border-gray-700 rounded-lg p-2 text-sm text-center bg-slate-50 dark:bg-gh-800 transition-colors duration-300 mb-5"
      >
        📋 {{ $t('common.copy') }}
      </button>
      <div class="grid grid-cols-3 gap-2">
        <div
          v-for="(word, i) in mnemonic_words"
          :key="i"
          class="border border-gray-700 rounded-lg p-2 text-sm text-center bg-slate-50 dark:bg-gh-800 transition-colors duration-300"
        >
          <span class="text-slate-400 dark:text-gray-400 mr-1">{{ i + 1 }}.</span>
          <span class="font-medium">{{ word }}</span>
        </div>
      </div>
      <button
        class="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800 py-3 mt-6"
        @click="next"
      >
        {{ $t('wizard.iHaveWrittenDown') }}
      </button>
      <WizardNav :showBack="true" :showNext="false" />
    </div>

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
            @click="router.back()"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition
            bg-gray-100 hover:bg-gray-200 text-gray-700
            dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
          >
            {{ $t('walletList.cancel') }}
          </button>
          <button
            @click="initWallet"
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
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { createWallet } from "@/stores/navio";
import WizardNav from "@/components/WizardNav.vue";
import copy from "copy-to-clipboard";

const router         = useRouter();
const { t }          = useI18n();
const mnemonic_words = ref([]);
const client         = ref(null);
const loading        = ref(true);
const connectionError = ref(null);

async function initWallet() {
  try {
    connectionError.value = null;
    loading.value = true;

    const cached = sessionStorage.getItem("mnemonic_words");
    if (cached) {
      mnemonic_words.value = JSON.parse(cached);
      return;
    }

    const result = await createWallet({
      wallet_name: sessionStorage.getItem("wallet_name"),
      network:     sessionStorage.getItem("network"),
      password:    sessionStorage.getItem("password"),
    });

    client.value         = result.client;
    mnemonic_words.value = result.mnemonic_words;

    sessionStorage.setItem("mnemonic_words", JSON.stringify(result.mnemonic_words));
  } catch (err) {
    console.error("Navio init failed", err);
    connectionError.value = { message: err?.message ?? String(err) };
  } finally {
    loading.value = false;
  }
}

onMounted(initWallet);

function next() {
  router.push("/wallet/verify");
}

function copyMnemonic() {
  const text = mnemonic_words.value.join(" ");
  if (copy(text)) {
    alert(t('common.copied'));
  }
}
</script>