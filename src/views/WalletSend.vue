<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gh-900 p-5 pb-24 transition-colors duration-300">
    <div class="w-full max-w-md mx-auto flex flex-col gap-4">

      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('wallet.sendNav') }}</h1>

      <!-- Form Card -->
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">

        <!-- Recipient -->
        <div class="px-4 pt-4 pb-3">
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {{ $t('wallet.recipientAddress') }}
            </label>
            <button
              @click="scanQR"
              :disabled="isScanning"
              class="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition
                     text-blue-600 dark:text-blue-400
                     hover:bg-blue-50 dark:hover:bg-blue-900/20
                     disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Loader2 v-if="isScanning" class="w-3.5 h-3.5 animate-spin" />
              <QrCode v-else class="w-3.5 h-3.5" />
              {{ $t('wallet.scanQR') }}
            </button>
          </div>
          <textarea
            rows="6"
            v-model="recipient"
            :placeholder="$t('wallet.navAddress')"
            class="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none transition-colors
                   bg-gray-50 dark:bg-gh-700
                   border border-gray-200 dark:border-gh-600
                   text-gray-900 dark:text-white
                   placeholder-gray-400 dark:placeholder-gray-500
                   focus:border-blue-400 dark:focus:border-blue-500"
          />
        </div>

        <div class="border-t border-gray-100 dark:border-gh-700 px-4 py-3">
          <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">
            {{ $t('wallet.amount') }}
          </label>
          <input
            v-model.number="amount"
            type="number"
            min="0"
            placeholder="0.00"
            class="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors
                   bg-gray-50 dark:bg-gh-700
                   border border-gray-200 dark:border-gh-600
                   text-gray-900 dark:text-white
                   placeholder-gray-400 dark:placeholder-gray-500
                   focus:border-blue-400 dark:focus:border-blue-500"
          />
        </div>

        <div class="border-t border-gray-100 dark:border-gh-700 px-4 py-3">
          <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">
            {{ $t('wallet.memo') }}
          </label>
          <input
            v-model="memo"
            type="text"
            class="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors
                   bg-gray-50 dark:bg-gh-700
                   border border-gray-200 dark:border-gh-600
                   text-gray-900 dark:text-white
                   placeholder-gray-400 dark:placeholder-gray-500
                   focus:border-blue-400 dark:focus:border-blue-500"
          />
        </div>

        <div class="border-t border-gray-100 dark:border-gh-700 px-4 py-4">
          <button
            :disabled="!canSend"
            @click="openConfirm"
            class="w-full py-3 rounded-xl text-sm font-semibold transition-colors
                   bg-blue-600 hover:bg-blue-700 text-white
                   disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {{ $t('wallet.send') }}
          </button>
        </div>

      </div>
    </div>

    <!-- Loading Overlay -->
    <div
      v-if="isLoading"
      class="fixed inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-50"
    >
      <Loader2 class="w-12 h-12 text-blue-400 animate-spin mb-4" />
      <p class="text-white text-base font-semibold">{{ $t('wallet.sendingTransaction') }}</p>
    </div>

    <!-- Confirm Modal -->
    <div
      v-if="showConfirm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
    >
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <h2 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('wallet.confirmTransaction') }}</h2>

        <div class="space-y-2">
          <div class="rounded-xl bg-gray-50 dark:bg-gh-800 px-3 py-2.5">
            <p class="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{{ $t('wallet.recipient') }}</p>
            <p class="text-xs font-mono text-gray-800 dark:text-gray-200 break-all">{{ recipient }}</p>
          </div>
          <div class="rounded-xl bg-gray-50 dark:bg-gh-800 px-3 py-2.5">
            <p class="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{{ $t('wallet.amount') }}</p>
            <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ amount }} NAV</p>
          </div>
        </div>

        <div class="flex gap-2 pt-1">
          <button
            @click="showConfirm = false"
            class="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors
                   bg-gray-100 hover:bg-gray-200 text-gray-700
                   dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            @click="sendTransaction"
            class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors bg-blue-600 hover:bg-blue-700 text-white"
          >
            {{ $t('common.confirm') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Success / Error Modal -->
    <div
      v-if="showResult"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
    >
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl text-center">

        <div
          class="flex items-center justify-center w-14 h-14 rounded-full mx-auto"
          :class="resultSuccess ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'"
        >
          <Check v-if="resultSuccess" class="w-7 h-7 text-green-600 dark:text-green-400" />
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <div class="space-y-1">
          <h2
            class="text-base font-bold"
            :class="resultSuccess ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
          >
            {{ resultSuccess ? $t('wallet.transactionSuccessful') : $t('wallet.transactionFailed') }}
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 break-all max-h-28 overflow-y-auto">
            {{ resultSuccess ? $t('wallet.sentNavTo', { amount, address: recipient }) : errorMessage }}
          </p>
        </div>

        <button
          @click="closeResult"
          class="w-full py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
        >
          {{ $t('common.close') }}
        </button>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { getNavioClient } from "@/stores/navio";
import { BarcodeScanner, BarcodeFormat } from "@capacitor-mlkit/barcode-scanning";
import { QrCode, Loader2, Check } from "lucide-vue-next";

const recipient = ref("");
const amount = ref(null);
const memo = ref("");

const showConfirm = ref(false);
const showResult = ref(false);
const resultSuccess = ref(false);
const isLoading = ref(false);
const isScanning = ref(false);
const errorMessage = ref('');

const canSend = computed(() => recipient.value && amount.value > 0);

const openConfirm = () => { showConfirm.value = true; };

async function scanQR() {
  try {
    isScanning.value = true;
    const { camera } = await BarcodeScanner.requestPermissions();
    if (camera !== 'granted' && camera !== 'limited') return;
    const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
    if (barcodes.length > 0) {
      let raw = barcodes[0].rawValue ?? barcodes[0].displayValue ?? '';
      if (raw.toLowerCase().startsWith('nav:')) raw = raw.slice(4).split('?')[0].trim();
      recipient.value = raw;
    }
  } catch (err) {
    console.error('QR scan error:', err);
  } finally {
    isScanning.value = false;
  }
}

const toSatoshi = (nav) => BigInt(Math.round(nav * 1e8));

const sendTransaction = () => {
  const client = getNavioClient();
  showConfirm.value = false;
  isLoading.value = true;
  errorMessage.value = '';

  client.sendTransaction({ address: recipient.value, amount: toSatoshi(amount.value), memo: memo.value })
    .then((result) => {
      console.log('Transaction ID:', result.txId);
      resultSuccess.value = true;
      showResult.value = true;
    })
    .catch((error) => {
      errorMessage.value = error?.message || 'Something went wrong. Please try again.';
      resultSuccess.value = false;
      showResult.value = true;
    })
    .finally(() => { isLoading.value = false; });
};

const closeResult = () => {
  showResult.value = false;
  recipient.value = "";
  amount.value = null;
  memo.value = "";
};
</script>
