<template>
  <div class="p-5 space-y-5 bg-white text-gray-900 dark:bg-gh-900 dark:text-white min-h-screen transition-colors duration-300">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold tracking-tight">{{ $t('walletList.title') }}</h2>
      <div v-if="wallets.length > 0" class="flex items-center gap-2">
        <button
          @click="router.push('/wallet/import')"
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition
          bg-gray-100 hover:bg-gray-200 text-gray-700
          dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
        >
          {{ $t('walletList.import') }}
        </button>
        <button
          @click="router.push('/wallet/create')"
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition
          bg-blue-600 hover:bg-blue-700 text-white"
        >
          + {{ $t('walletList.createNew') }}
        </button>
      </div>
    </div>

    <!-- Network -->
    <div v-if="wallets.length > 0">
      <label class="block mb-2 text-sm font-semibold text-gray-600 dark:text-gray-400">{{ $t('wizard.network') }}</label>
      <select
        v-model="network"
        class="border border-gray-200 dark:border-gh-700 rounded-lg p-2 w-full text-sm
        bg-white text-gray-900 dark:bg-gh-900 dark:text-white transition-colors"
      >
        <option value="testnet">{{ $t('wizard.testnet') }}</option>
        <option value="mainnet">{{ $t('wizard.mainnet') }}</option>
      </select>
    </div>

    <!-- Empty state -->
    <div
      v-if="wallets.length === 0"
      class="flex flex-col items-center justify-center py-20 space-y-6"
    >
      <div class="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gh-800 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M3 10h18M7 15h1m4 0h1M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <div class="text-center space-y-1">
        <p class="font-semibold text-gray-700 dark:text-gray-200">{{ $t('walletList.empty') }}</p>
        <p class="text-sm text-gray-400 dark:text-gray-500">{{ $t('walletList.getStarted') }}</p>
      </div>
      <div class="flex flex-col w-full gap-2">
        <button
          @click="router.push('/wallet/create')"
          class="w-full py-3 rounded-xl text-sm font-semibold transition
          bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
        >
          + {{ $t('walletList.createNew') }}
        </button>
        <button
          @click="router.push('/wallet/import')"
          class="w-full py-3 rounded-xl text-sm font-medium transition
          bg-gray-100 hover:bg-gray-200 text-gray-700
          dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
        >
          {{ $t('walletList.import') }}
        </button>
      </div>
    </div>

    <!-- Wallet cards -->
    <ul v-else class="space-y-3">
      <li
        v-for="wallet in wallets"
        :key="wallet.id"
        class="rounded-2xl border border-gray-200 dark:border-gh-700
        bg-white dark:bg-gh-800
        overflow-hidden transition-colors duration-200"
      >
        <!-- Card top: avatar + info -->
        <div class="flex items-center gap-4 px-4 pt-4 pb-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gray-900 dark:bg-gh-800">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M3 10h18M7 15h1m4 0h1M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-semibold truncate leading-tight">{{ wallet.name }}</p>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="text-xs text-gray-400 dark:text-gray-500">{{ formatDate(wallet.createdAt) }}</span>
              <span
                v-if="wallet.encrypted"
                class="inline-flex items-center gap-1 text-xs text-yellow-500 font-medium"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path fill-rule="evenodd" d="M12 1a5 5 0 00-5 5v3H6a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2v-9a2 2 0 00-2-2h-1V6a5 5 0 00-5-5zm3 8V6a3 3 0 10-6 0v3h6z" clip-rule="evenodd" />
                </svg>
                {{ $t('walletList.encrypted') }}
              </span>
            </div>
          </div>
        </div>

        <!-- Card bottom: divider + actions -->
        <div class="border-t border-gray-200 dark:border-gh-700 flex">
          <button
            @click="load(wallet)"
            :disabled="loadingId === wallet.id"
            class="flex-1 py-2.5 text-sm font-medium transition
            text-blue-600 dark:text-blue-400
            hover:bg-blue-50 dark:hover:bg-blue-900/20
            disabled:opacity-50 disabled:cursor-not-allowed
            inline-flex items-center justify-center gap-2"
          >
            <svg
              v-if="loadingId === wallet.id"
              class="w-3.5 h-3.5 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none" viewBox="0 0 24 24"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            {{ loadingId === wallet.id ? $t('walletList.loading') : $t('walletList.load') }}
          </button>

          <div class="w-px bg-gray-200 dark:bg-gh-700" />

          <button
            @click="confirmDelete(wallet)"
            :disabled="loadingId === wallet.id"
            class="flex-1 py-2.5 text-sm font-medium transition
            text-red-500 dark:text-red-400
            hover:bg-red-50 dark:hover:bg-red-900/20
            disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {{ $t('walletList.delete') }}
          </button>
        </div>
      </li>
    </ul>

    <!-- Unlock password modal -->
    <div
      v-if="walletToUnlock"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
    >
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <h3 class="text-base font-bold">{{ $t('walletList.unlockTitle') }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('walletList.unlockDesc', { name: walletToUnlock.name }) }}
        </p>
        <input
          ref="passwordInputEl"
          v-model="passwordInput"
          type="password"
          :placeholder="$t('walletList.unlockPlaceholder')"
          @keyup.enter="doUnlock"
          class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-sm
          bg-white dark:bg-gh-800 text-gray-900 dark:text-white
          focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p v-if="passwordError" class="text-sm text-red-500 dark:text-red-400">
          {{ passwordError }}
        </p>
        <div class="flex gap-2 pt-1">
          <button
            @click="cancelUnlock"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition
            bg-gray-100 hover:bg-gray-200 text-gray-700
            dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
          >
            {{ $t('walletList.cancel') }}
          </button>
          <button
            @click="doUnlock"
            :disabled="!passwordInput || loadingId === walletToUnlock.id"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition
            bg-blue-600 hover:bg-blue-700 text-white
            disabled:opacity-60 disabled:cursor-not-allowed
            inline-flex items-center justify-center gap-2"
          >
            <svg
              v-if="loadingId === walletToUnlock.id"
              class="w-3.5 h-3.5 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none" viewBox="0 0 24 24"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            {{ $t('walletList.unlockBtn') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <div
      v-if="walletToDelete"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
    >
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <h3 class="text-base font-bold">{{ $t('walletList.deleteTitle') }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t('walletList.deleteConfirm', { name: walletToDelete.name }) }}
        </p>
        <div class="flex gap-2 pt-1">
          <button
            @click="walletToDelete = null"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition
            bg-gray-100 hover:bg-gray-200 text-gray-700
            dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
          >
            {{ $t('walletList.cancel') }}
          </button>
          <button
            @click="doDelete"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition
            bg-red-600 hover:bg-red-700 text-white"
          >
            {{ $t('walletList.deleteConfirmBtn') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ❌ Connection error modal -->
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

        <!-- Error detail (collapsible) -->
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
            @click="retryLoad"
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
import { ref, onMounted, watch, nextTick } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { getAllWallets, deleteWalletFull } from "@/stores/wallet_management";
import { loadWallet } from "@/stores/navio";

const { t: $t }        = useI18n();
const network          = ref("testnet");
const router           = useRouter();
const wallets          = ref([]);
const walletToDelete   = ref(null);
const walletToUnlock   = ref(null);
const passwordInput    = ref("");
const passwordError    = ref("");
const passwordInputEl  = ref(null);

watch(walletToUnlock, async (val) => {
  if (val) {
    await nextTick();
    passwordInputEl.value?.focus();
  }
});
const loadingId        = ref(null);
const connectionError  = ref(null); // { message, wallet }

onMounted(() => {
  localStorage.setItem('user_agreement_accepted', true);
  console.log("Listing wallets...");
  wallets.value = getAllWallets();
  console.log(JSON.stringify(wallets.value, null, 2));
});

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

async function load(wallet) {
  if (wallet.encrypted) {
    walletToUnlock.value = wallet;
    passwordInput.value  = "";
    passwordError.value  = "";
    return;
  }
  await _doLoad(wallet, undefined);
}

async function doUnlock() {
  if (!walletToUnlock.value || !passwordInput.value) return;
  await _doLoad(walletToUnlock.value, passwordInput.value);
}

function cancelUnlock() {
  walletToUnlock.value = null;
  passwordInput.value  = "";
  passwordError.value  = "";
}

async function _doLoad(wallet, password) {
  console.log("Trying to load wallet : " + wallet.name);
  try {
    loadingId.value = wallet.id;
    passwordError.value = "";
    await loadWallet({
      wallet_id: wallet.name,
      network: network.value ?? "testnet",
      password,
    });
    sessionStorage.setItem("walletId",   wallet.id);
    sessionStorage.setItem("walletName", wallet.name);
    walletToUnlock.value = null;
    router.push("/wallet/balance");
  } catch (err) {
    if (err?.message === "wrong_password") {
      passwordError.value = $t('walletList.wrongPassword');
    } else {
      console.error("Wallet Load failed:", err);
      connectionError.value = { message: err?.message ?? String(err), wallet };
    }
  } finally {
    loadingId.value = null;
  }
}

async function retryLoad() {
  const wallet = connectionError.value?.wallet;
  connectionError.value = null;
  if (wallet) await load(wallet);
}

function confirmDelete(wallet) {
  walletToDelete.value = wallet;
}

async function doDelete() {
  if (!walletToDelete.value) return;
  await deleteWalletFull(walletToDelete.value.id);
  wallets.value = getAllWallets();
  walletToDelete.value = null;
}
</script>