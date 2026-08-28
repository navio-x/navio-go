<script setup>
import { ref, computed, nextTick, watch, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { Eye, EyeOff } from "lucide-vue-next";
import { getPendingRequest, resolveRequest, rejectRequest } from "@/lib/extensionMessaging";
import { readWalletSession } from "@/lib/extensionSession";
import { ERROR_CODE } from "@/lib/extensionProtocol";
import { getRpcExecutor, serializeRpcValue, describeRpcCall } from "@/lib/navioRpcExecutors";
import { getAllWallets } from "@/stores/wallet_management";
import { initNavioSDK, loadWallet } from "@/stores/navio";

// Generic approval + execution screen for every RPC method that has an
// entry in RPC_EXECUTORS (src/lib/navioRpcExecutors.js) but no bespoke view.
// Read-only methods (getTokenBalance, getAssetBalances, ...) execute as soon
// as a wallet is unlocked; mutating methods (createTokenCollection,
// mintToken, sendToken, ...) stop at the "confirm" phase for an explicit
// approve click. Methods with no executor at all fall back to "unsupported".

const { t } = useI18n();
const route = useRoute();
const requestId = route.params.id;

// loading -> picker (unlock a wallet) -> confirm (mutating: show params, wait
// for approve) -> working (executing) -> error (SDK/init failure) |
// unsupported (no executor registered for this method)
const phase = ref("loading");
const request = ref(null);
const executor = ref(null);
const executionError = ref("");

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
  executor.value = getRpcExecutor(request.value?.method);

  if (!executor.value) {
    phase.value = "unsupported";
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
    return;
  }

  const session = await readWalletSession();
  if (session?.walletName) {
    const match = wallets.value.find((w) => w.name === session.walletName);
    if (!match) return;

    if (!match.encrypted) {
      // No password needed at all — safe to unlock without asking.
      unlock(match, undefined);
    } else if (session.password) {
      // Wallet was already unlocked elsewhere this browser session; reuse
      // the cached password instead of prompting again. Falls back to the
      // manual picker below if it turns out to be stale.
      unlock(match, session.password, { silent: true });
    } else {
      selectWallet(match);
    }
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

async function unlock(wallet, password, { silent = false } = {}) {
  try {
    loadingId.value = wallet.id;
    passwordError.value = "";
    await loadWallet({
      wallet_id: wallet.name,
      network: wallet.network ?? "testnet",
      password,
    });
    walletToUnlock.value = null;

    if (executor.value.mutating) {
      phase.value = "confirm";
    } else {
      await run();
    }
  } catch (err) {
    if (err?.message === "wrong_password" && silent) {
      // Cached password is stale (changed elsewhere) — fall back to asking.
      selectWallet(wallet);
      return;
    }
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

const sdkCallPreview = computed(() =>
  request.value ? describeRpcCall(request.value.method, request.value.params) : ""
);

async function run() {
  phase.value = "working";
  executionError.value = "";
  try {
    const result = await executor.value.execute(request.value.params ?? {});
    await resolveRequest(requestId, serializeRpcValue(result));
    window.close();
  } catch (err) {
    console.error("RPC execution failed:", err);
    executionError.value = err?.message ?? String(err);
    phase.value = "confirm";
  }
}

async function reject() {
  await rejectRequest(requestId, {
    code: executor.value ? ERROR_CODE.USER_REJECTED : ERROR_CODE.UNSUPPORTED_METHOD,
    message: executor.value ? "User rejected the request" : "Method not implemented yet",
  });
  window.close();
}
</script>

<template>
  <!-- See ConnectRequest.vue for why this uses fixed inset-0 instead of
       h-full: anchors directly to the real window viewport, independent of
       App.vue's #app/scrollContainer sizing chain. -->
  <div class="fixed inset-0 z-[999] flex flex-col overflow-y-auto bg-white dark:bg-gh-900 p-5 transition-colors duration-300">
    <div v-if="phase === 'loading' || phase === 'working'" class="flex-1 flex items-center justify-center">
      <div class="animate-pulse text-sm text-gray-500 dark:text-gray-400">
        {{ phase === 'working' ? t('extension.executing') : t('extension.loading') }}
      </div>
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

    <div v-else-if="phase === 'unsupported'" class="flex-1 flex flex-col gap-5">
      <h1 class="text-lg font-bold text-gray-900 dark:text-white">{{ t('extension.unsupportedTitle') }}</h1>

      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-gray-50 dark:bg-gh-800 p-4 flex flex-col gap-1">
        <p class="font-semibold text-gray-900 dark:text-white break-all">{{ request?.origin }}</p>
        <p class="font-mono text-xs text-gray-500 dark:text-gray-400">{{ request?.method }}</p>
      </div>

      <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('extension.unsupportedDescription') }}</p>

      <button
        @click="reject"
        class="mt-auto py-2.5 rounded-xl text-sm font-medium transition bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
      >
        {{ t('extension.connectReject') }}
      </button>
    </div>

    <!-- No live wallet in this window yet: pick one and unlock it -->
    <div v-else-if="phase === 'picker'" class="flex-1 flex flex-col gap-4 min-h-0">
      <div>
        <h1 class="text-lg font-bold text-gray-900 dark:text-white">{{ t('extension.approveTitle') }}</h1>
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

    <!-- Wallet ready, method mutates state: show params and wait for approval -->
    <div v-else-if="phase === 'confirm'" class="flex-1 flex flex-col gap-5">
      <h1 class="text-lg font-bold text-gray-900 dark:text-white">{{ t('extension.approveTitle') }}</h1>

      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-gray-50 dark:bg-gh-800 p-4 flex flex-col gap-1">
        <p class="font-semibold text-gray-900 dark:text-white break-all">{{ request?.origin }}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('extension.approveDescription') }}</p>
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4 flex flex-col gap-2 min-h-0">
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('extension.requestMethod') }}</p>
        <p class="font-mono text-xs text-gray-700 dark:text-gray-300 break-all">{{ request?.method }}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">{{ t('extension.sdkCall') }}</p>
        <pre class="font-mono text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all overflow-y-auto max-h-48">{{ sdkCallPreview }}</pre>
      </div>

      <p v-if="executionError" class="text-sm text-red-500 dark:text-red-400 break-all">{{ executionError }}</p>

      <div class="mt-auto flex gap-2">
        <button
          @click="reject"
          class="flex-1 py-2.5 rounded-xl text-sm font-medium transition bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
        >
          {{ t('extension.connectReject') }}
        </button>
        <button
          @click="run"
          class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition bg-blue-600 hover:bg-blue-700 text-white"
        >
          {{ t('extension.approveConfirm') }}
        </button>
      </div>
    </div>
  </div>
</template>
