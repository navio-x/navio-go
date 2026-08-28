<script setup>
import { ref, nextTick, watch, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { Eye, EyeOff } from "lucide-vue-next";
import { getPendingRequest, resolveRequest, rejectRequest } from "@/lib/extensionMessaging";
import { readWalletSession } from "@/lib/extensionSession";
import { ERROR_CODE } from "@/lib/extensionProtocol";
import { getAllWallets } from "@/stores/wallet_management";
import { initNavioSDK, loadWallet, getReceiveAddress } from "@/stores/navio";

const { t } = useI18n();
const route = useRoute();
const requestId = route.params.id;

// loading: fetching the pending request / checking for an existing session
// ready: an account is available (from session or just unlocked here), show connect/approve
// picker: no session yet — list wallets in this window so the user can unlock one
// error: SDK failed to start in this window
const phase = ref("loading");
const request = ref(null);
const address = ref("");

const wallets = ref([]);
const walletToUnlock = ref(null);
const passwordInput = ref("");
const passwordError = ref("");
const passwordInputEl = ref(null);
const showPassword = ref(false);
const loadingId = ref(null);
const sdkError = ref("");

watch(walletToUnlock, async (val) => {
  showPassword.value = false;
  if (val) {
    await nextTick();
    passwordInputEl.value?.focus();
  }
});

onMounted(async () => {
  request.value = await getPendingRequest(requestId);

  const session = await readWalletSession();
  if (session?.address) {
    address.value = session.address;
    phase.value = "ready";
    return;
  }

  try {
    await initNavioSDK();
    wallets.value = getAllWallets();
    phase.value = "picker";
  } catch (err) {
    console.error("initNavioSDK failed in approval window:", err);
    sdkError.value = err?.message ?? String(err);
    phase.value = "error";
  }
});

function selectWallet(wallet) {
  if (wallet.encrypted) {
    walletToUnlock.value = wallet;
    passwordInput.value = "";
    passwordError.value = "";
    return;
  }
  unlock(wallet, undefined);
}

function cancelUnlock() {
  walletToUnlock.value = null;
  passwordInput.value = "";
  passwordError.value = "";
}

async function doUnlock() {
  if (!walletToUnlock.value || !passwordInput.value) return;
  await unlock(walletToUnlock.value, passwordInput.value);
}

async function unlock(wallet, password) {
  try {
    loadingId.value = wallet.id;
    passwordError.value = "";
    await loadWallet({
      wallet_id: wallet.name,
      network: wallet.network ?? "testnet",
      password,
    });
    walletToUnlock.value = null;
    address.value = getReceiveAddress();
    phase.value = "ready";
  } catch (err) {
    if (err?.message === "wrong_password") {
      passwordError.value = t("walletList.wrongPassword");
    } else {
      console.error("Wallet load failed:", err);
      passwordError.value = err?.message ?? String(err);
    }
  } finally {
    loadingId.value = null;
  }
}

async function approve() {
  await resolveRequest(requestId, { accounts: [address.value] });
  window.close();
}

async function reject() {
  await rejectRequest(requestId, {
    code: ERROR_CODE.USER_REJECTED,
    message: "User rejected the request",
  });
  window.close();
}
</script>

<template>
  <!-- position:fixed anchors this to the real OS window viewport directly,
       independent of App.vue's #app/scrollContainer height chain (which is
       tuned for the mobile/PWA app, not this popup window) — that chain
       kept clipping/hiding content at certain window sizes. z-[999] sits
       above PwaInstallPrompt's fixed bottom banner (z-[998]) as a safety
       net, though App.vue also skips rendering it in extension contexts. -->
  <div class="fixed inset-0 z-[999] flex flex-col overflow-y-auto bg-white dark:bg-gh-900 p-5 transition-colors duration-300">
    <div v-if="phase === 'loading'" class="flex-1 flex items-center justify-center">
      <div class="animate-pulse text-sm text-gray-500 dark:text-gray-400">{{ t('extension.loading') }}</div>
    </div>

    <div v-else-if="phase === 'error'" class="flex-1 flex flex-col gap-4">
      <h1 class="text-lg font-bold text-gray-900 dark:text-white">{{ t('extension.unsupportedTitle') }}</h1>
      <p class="text-sm text-red-500 dark:text-red-400 font-mono break-all">{{ sdkError }}</p>
      <button
        @click="reject"
        class="mt-auto py-2.5 rounded-xl text-sm font-medium transition bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
      >
        {{ t('extension.connectReject') }}
      </button>
    </div>

    <!-- No shared session yet: pick a wallet and unlock it right here -->
    <div v-else-if="phase === 'picker'" class="flex-1 flex flex-col gap-4 min-h-0">
      <div>
        <h1 class="text-lg font-bold text-gray-900 dark:text-white">{{ t('extension.connectTitle') }}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ t('extension.selectWallet') }}</p>
      </div>

      <div v-if="wallets.length === 0" class="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-800 dark:text-amber-300">
        {{ t('extension.noWallets') }}
      </div>

      <ul v-else class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2">
        <li
          v-for="wallet in wallets"
          :key="wallet.id"
          class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-3 flex items-center justify-between gap-3"
        >
          <div class="min-w-0">
            <p class="font-semibold text-sm truncate text-gray-900 dark:text-white">{{ wallet.name }}</p>
            <span
              v-if="wallet.encrypted"
              class="text-xs text-yellow-500 font-medium"
            >{{ t('walletList.encrypted') }}</span>
          </div>
          <button
            @click="selectWallet(wallet)"
            :disabled="loadingId === wallet.id"
            class="shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            {{ loadingId === wallet.id ? t('walletList.loading') : t('walletList.load') }}
          </button>
        </li>
      </ul>

      <button
        @click="reject"
        class="py-2.5 rounded-xl text-sm font-medium transition bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
      >
        {{ t('extension.connectReject') }}
      </button>

      <!-- Unlock password modal -->
      <div
        v-if="walletToUnlock"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
      >
        <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
          <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ t('walletList.unlockTitle') }}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('walletList.unlockDesc', { name: walletToUnlock.name }) }}
          </p>
          <div class="relative">
            <input
              ref="passwordInputEl"
              v-model="passwordInput"
              :type="showPassword ? 'text' : 'password'"
              :placeholder="t('walletList.unlockPlaceholder')"
              @keyup.enter="doUnlock"
              class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 pr-10 text-sm bg-white dark:bg-gh-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <p v-if="passwordError" class="text-sm text-red-500 dark:text-red-400">{{ passwordError }}</p>
          <div class="flex gap-2 pt-1">
            <button
              @click="cancelUnlock"
              class="flex-1 py-2 rounded-xl text-sm font-medium transition bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
            >
              {{ t('walletList.cancel') }}
            </button>
            <button
              @click="doUnlock"
              :disabled="!passwordInput || loadingId === walletToUnlock.id"
              class="flex-1 py-2 rounded-xl text-sm font-medium transition bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
            >
              {{ t('walletList.unlockBtn') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Account ready: normal connect/approve UI -->
    <div v-else class="flex-1 flex flex-col gap-5">
      <h1 class="text-lg font-bold text-gray-900 dark:text-white">{{ t('extension.connectTitle') }}</h1>

      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-gray-50 dark:bg-gh-800 p-4 flex flex-col gap-1">
        <p class="font-semibold text-gray-900 dark:text-white break-all">{{ request?.origin }}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('extension.connectDescription') }}</p>
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('extension.connectAccount') }}</p>
        <p class="font-mono text-xs text-gray-700 dark:text-gray-300 break-all select-all">{{ address }}</p>
      </div>

      <div class="mt-auto flex gap-2">
        <button
          @click="reject"
          class="flex-1 py-2.5 rounded-xl text-sm font-medium transition bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
        >
          {{ t('extension.connectReject') }}
        </button>
        <button
          @click="approve"
          class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition bg-blue-600 hover:bg-blue-700 text-white"
        >
          {{ t('extension.connectApprove') }}
        </button>
      </div>
    </div>
  </div>
</template>
