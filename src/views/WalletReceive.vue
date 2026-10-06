<script setup>
import { ref, computed, onMounted } from "vue";
import { getNavioClient } from "@/stores/navio";
import { settings } from "@/stores/settings";
import { evmAddress } from "@/stores/evm";
import { deriveEvmAddress } from "@/composables/useEvmAccount";
import QRCode from "qrcode.vue";
import copy from "copy-to-clipboard";
import { Copy, Check, AlertTriangle } from "lucide-vue-next";

const receiveAddress = ref("");
const loading = ref(true);
const copied = ref(false);

// What is being received decides which address to show — the user never
// has to know that the two live on different networks.
const kind = ref("nav"); // 'nav' | 'other'
const shownAddress = computed(() => (kind.value === "nav" ? receiveAddress.value : evmAddress.value));

function copyToClipboard() {
  if (!shownAddress.value) return;
  copy(shownAddress.value);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
}

async function selectKind(next) {
  kind.value = next;
  copied.value = false;
  if (next === "other" && !evmAddress.value) {
    try {
      await deriveEvmAddress(0);
    } catch (e) {
      console.error("[receive] EVM derivation error:", e);
    }
  }
}

onMounted(async () => {
  const c = getNavioClient();
  const km = c.getKeyManager();
  if (km) {
    receiveAddress.value = km.getSubAddressBech32m(
      { account: 0, address: 0 },
      sessionStorage.getItem("network")
    );
    loading.value = false;
  }
});
</script>

<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col transition-colors duration-300">
    <h1 class="text-xl font-bold text-gray-900 dark:text-white px-5 pt-5 pb-4">{{ $t('wallet.receiveNav') }}</h1>

    <div class="px-5 pb-6 flex justify-center">
      <div class="w-full max-w-sm flex flex-col gap-4">
        <!-- What are you receiving? -->
        <div v-if="settings.dexMode" class="grid grid-cols-2 gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gh-800" role="tablist">
          <button
            v-for="option in ['nav', 'other']"
            :key="option"
            role="tab"
            :aria-selected="kind === option"
            @click="selectKind(option)"
            class="py-2 rounded-lg text-sm font-semibold transition-colors"
            :class="kind === option
              ? 'bg-white dark:bg-gh-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400'"
          >
            {{ $t(`receive.${option}`) }}
          </button>
        </div>

        <div v-if="loading || !shownAddress" class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-8 flex items-center justify-center">
          <div class="animate-pulse h-52 w-52 bg-gray-200 dark:bg-gh-700 rounded-xl" />
        </div>

        <!-- QR Card -->
        <div v-else class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-6 flex flex-col items-center gap-4">
          <div class="p-3 bg-white rounded-xl ring-1 ring-gray-100 dark:ring-gh-700">
            <QRCode :value="shownAddress" :size="180" />
          </div>

          <!-- Address -->
          <div class="w-full bg-gray-50 dark:bg-gh-700 rounded-xl px-4 py-3">
            <p class="font-mono text-xs text-gray-700 dark:text-gray-300 break-all text-center leading-relaxed select-all">
              {{ shownAddress }}
            </p>
          </div>

          <!-- Copy button -->
          <button
            @click="copyToClipboard"
            class="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-colors"
            :class="copied
              ? 'bg-green-500 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'"
          >
            <Check v-if="copied" class="w-4 h-4" />
            <Copy v-else class="w-4 h-4" />
            {{ copied ? $t('common.copied') : $t('common.copy') }}
          </button>

          <p v-if="kind === 'nav'" class="w-full text-xs text-gray-400 dark:text-gray-500 leading-snug text-center">
            {{ $t('receive.navHint') }}
          </p>
          <div v-else class="w-full flex gap-2 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2.5">
            <AlertTriangle class="w-4 h-4 shrink-0 mt-0.5 text-yellow-600 dark:text-yellow-400" />
            <p class="text-xs text-yellow-800 dark:text-yellow-300 leading-snug">{{ $t('receive.otherWarning') }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
