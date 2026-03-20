<script setup>
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { getNavioClient } from "@/stores/navio";
import QRCode from "qrcode.vue";
import copy from "copy-to-clipboard";
import { Copy, Check } from "lucide-vue-next";

const { t } = useI18n();
const receiveAddress = ref("");
const loading = ref(true);
const copied = ref(false);

function copyToClipboard() {
  copy(receiveAddress.value);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
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
  <div class="min-h-screen bg-gray-50 dark:bg-gh-900 p-5 pb-24 transition-colors duration-300">

    <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-4">{{ $t('wallet.receiveNav') }}</h1>

    <div v-if="loading" class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-8 flex items-center justify-center">
      <div class="animate-pulse h-52 w-52 bg-gray-200 dark:bg-gh-700 rounded-xl" />
    </div>

    <div v-else class="w-full max-w-sm flex flex-col gap-4">

      <!-- QR Card -->
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-6 flex flex-col items-center gap-4">
        <div class="p-3 bg-white rounded-xl ring-1 ring-gray-100 dark:ring-gh-700">
          <QRCode :value="receiveAddress" :size="180" />
        </div>

        <!-- Address -->
        <div class="w-full bg-gray-50 dark:bg-gh-700 rounded-xl px-4 py-3">
          <p class="font-mono text-xs text-gray-700 dark:text-gray-300 break-all text-center leading-relaxed select-all">
            {{ receiveAddress }}
          </p>
        </div>

        <!-- Copy button -->
        <button
          @click="copyToClipboard"
          class="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors"
          :class="copied
            ? 'bg-green-500 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'"
        >
          <Check v-if="copied" class="w-4 h-4" />
          <Copy v-else class="w-4 h-4" />
          {{ copied ? $t('common.copied') : $t('common.copy') }}
        </button>
      </div>

    </div>
  </div>
</template>
