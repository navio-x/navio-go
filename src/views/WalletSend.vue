<template>
  <div class="bg-gray-50 dark:bg-gh-900 p-5 pb-6 transition-colors duration-300">

    <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-5">{{ $t('wallet.sendNav') }}</h1>

    <div class="w-full max-w-md mx-auto flex flex-col gap-4">

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
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {{ $t('wallet.amount') }}
            </label>
            <button
              v-if="availableBalance > 0"
              @click="useAll"
              class="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition
                     text-blue-600 dark:text-blue-400
                     hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              <span class="text-gray-400 dark:text-gray-500">{{ formattedBalance }} NAV</span>
              <span class="mx-0.5 text-gray-300 dark:text-gray-600">·</span>
              {{ $t('wallet.useAll') }}
            </button>
          </div>
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
          <div class="flex items-center gap-1.5 mb-1.5">
            <label class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {{ $t('wallet.memoLabel') }}
            </label>
            <button
              type="button"
              @click="showMemoInfo = !showMemoInfo"
              class="text-gray-400 dark:text-gray-500 transition-colors"
              :class="showMemoInfo ? 'text-blue-500 dark:text-blue-400' : 'hover:text-blue-500 dark:hover:text-blue-400'"
            >
              <Info class="w-3.5 h-3.5" />
            </button>
          </div>

          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-1"
          >
            <div
              v-if="showMemoInfo"
              class="mb-2.5 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 flex items-start gap-2"
            >
              <Info class="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" />
              <p class="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">{{ $t('wallet.memoInfo') }}</p>
            </div>
          </Transition>

          <input
            v-model="memo"
            type="text"
            :placeholder="$t('wallet.memoPlaceholder')"
            class="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors
                   bg-gray-50 dark:bg-gh-700
                   border border-gray-200 dark:border-gh-600
                   text-gray-900 dark:text-white
                   placeholder-gray-400 dark:placeholder-gray-500
                   focus:border-blue-400 dark:focus:border-blue-500"
          />
        </div>

        <!-- Subtract fee toggle -->
        <div class="border-t border-gray-100 dark:border-gh-700 px-4 py-3 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
              {{ $t('wallet.subtractFeeFromAmount') }}
            </p>
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-snug">
              {{ $t('wallet.subtractFeeFromAmountDesc') }}
            </p>
          </div>
          <button
            @click="subtractFeeFromAmount = !subtractFeeFromAmount"
            :class="subtractFeeFromAmount
              ? 'bg-blue-600'
              : 'bg-gray-200 dark:bg-gh-600'"
            class="relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none"
            role="switch"
            :aria-checked="subtractFeeFromAmount"
          >
            <span
              :class="subtractFeeFromAmount ? 'translate-x-5' : 'translate-x-0'"
              class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
            />
          </button>
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

    <!-- POS payment request review (scanned navio: URI) -->
    <div
      v-if="posReview"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
    >
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">

        <template v-if="posReview.status === 'expired'">
          <div class="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 mx-auto">
            <Clock class="w-6 h-6 text-amber-500" />
          </div>
          <div class="text-center space-y-1">
            <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('scanRequest.expiredTitle') }}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('scanRequest.expiredDesc') }}</p>
          </div>
          <button
            @click="onPosReject"
            class="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors
                   bg-gray-100 hover:bg-gray-200 text-gray-700
                   dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
          >
            {{ $t('common.close') }}
          </button>
        </template>

        <template v-else-if="posReview.status === 'invalid_signature'">
          <div class="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto">
            <ShieldAlert class="w-6 h-6 text-red-500" />
          </div>
          <div class="text-center space-y-1">
            <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('scanRequest.invalidSignatureTitle') }}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('scanRequest.invalidSignatureDesc') }}</p>
          </div>
          <button
            @click="onPosReject"
            class="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors
                   bg-gray-100 hover:bg-gray-200 text-gray-700
                   dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
          >
            {{ $t('common.close') }}
          </button>
        </template>

        <template v-else-if="posReview.status === 'ok'">
          <h2 class="text-base font-bold text-gray-900 dark:text-white text-center">{{ $t('scanRequest.title') }}</h2>

          <div class="text-center space-y-1">
            <p class="text-lg font-semibold text-gray-900 dark:text-white break-words">{{ posReview.parsed.label }}</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{{ posDisplayAmount(posReview.parsed.amount) }} NAV</p>
            <p v-if="posFiatEquivalent" class="text-sm text-gray-400 dark:text-gray-500">
              ≈ {{ posFiatEquivalent }} {{ settings.currency }}
            </p>
            <p
              class="text-xs font-medium tabular-nums"
              :class="posExpired ? 'text-amber-500' : 'text-gray-400 dark:text-gray-500'"
            >
              {{ posExpired ? $t('pos.expired') : $t('pos.expiresIn', { time: posCountdownLabel }) }}
            </p>
          </div>

          <div v-if="!posReview.verified" class="rounded-xl px-3 py-2.5 bg-gray-50 dark:bg-gh-700/50">
            <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{{ $t('scanRequest.unverifiedNote') }}</p>
          </div>
          <div
            v-else
            class="rounded-xl px-3 py-2.5"
            :class="posReview.trust?.status === 'key_changed'
              ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50'
              : 'bg-gray-50 dark:bg-gh-700/50'"
          >
            <p
              class="text-xs leading-relaxed"
              :class="posReview.trust?.status === 'key_changed' ? 'text-amber-700 dark:text-amber-300' : 'text-gray-500 dark:text-gray-400'"
            >
              <template v-if="posReview.trust?.status === 'trusted'">{{ $t('scanRequest.previouslyPaid') }}</template>
              <template v-else-if="posReview.trust?.status === 'key_changed'">{{ $t('scanRequest.keyChangedWarning') }}</template>
              <template v-else>{{ $t('scanRequest.newMerchant') }}</template>
            </p>
            <label v-if="posReview.trust?.status === 'key_changed'" class="mt-2 flex items-start gap-2 cursor-pointer">
              <input type="checkbox" v-model="posKeyChangeAck" class="mt-0.5" />
              <span class="text-xs text-amber-700 dark:text-amber-300">{{ $t('scanRequest.keyChangedConfirm') }}</span>
            </label>
            <p class="mt-2 text-[10px] font-mono text-gray-400 dark:text-gray-500 break-all">
              {{ $t('scanRequest.fingerprintLabel') }}: {{ posReview.trust?.fingerprint }}
            </p>
          </div>

          <div class="flex gap-2 pt-1">
            <button
              @click="onPosReject"
              class="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors
                     bg-gray-100 hover:bg-gray-200 text-gray-700
                     dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
            >
              {{ $t('common.cancel') }}
            </button>
            <button
              @click="onPosApprove"
              :disabled="!posCanPay"
              class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors
                     bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white"
            >
              {{ $t('scanRequest.pay') }}
            </button>
          </div>
        </template>
      </div>
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
import { ref, computed, onMounted, onUnmounted } from "vue";
import { getNavioClient, balance } from "@/stores/navio";
import { BarcodeScanner, BarcodeFormat } from "@capacitor-mlkit/barcode-scanning";
import { QrCode, Loader2, Check, Info, Clock, ShieldAlert } from "lucide-vue-next";
import { settings } from "@/stores/settings";
import { getPriceIn } from "@/stores/navPrice";
// evaluateScannedRequest / trustMerchantKey are dynamically imported below
// (not statically here) so this always-loaded screen never pulls POS
// signing/storage code into the main bundle — only fetched the moment a
// navio: QR is actually scanned/approved.

const recipient = ref("");
const amount = ref(null);
const memo = ref("");
const showMemoInfo = ref(false);

const subtractFeeFromAmount = ref(false)

const showConfirm = ref(false);
const showResult = ref(false);
const resultSuccess = ref(false);
const isLoading = ref(false);
const isScanning = ref(false);
const errorMessage = ref('');

const posReview = ref(null); // evaluateScannedRequest() result for a scanned navio: URI
const posKeyChangeAck = ref(false);
const posNow = ref(Date.now());
let posTickTimer = null;

onMounted(() => {
  posTickTimer = setInterval(() => { posNow.value = Date.now(); }, 1000);
});
onUnmounted(() => {
  clearInterval(posTickTimer);
});

// The request's amount arrives as a canonical, always-8-decimal string (see
// uriScheme.js's formatAmount) — that's the right form to sign/compare, but
// "1337.00000000" reads oddly to a customer just confirming "1337 NAV".
function posDisplayAmount(nav) {
  const n = Number(nav || 0);
  return n.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
}

const posFiatEquivalent = computed(() => {
  if (posReview.value?.status !== 'ok' || !settings.showFiatValue) return null;
  const price = getPriceIn(settings.currency);
  if (price == null) return null;
  return (Number(posReview.value.parsed.amount) * price).toFixed(2);
});

const posSecondsLeft = computed(() => {
  if (posReview.value?.status !== 'ok') return 0;
  return Math.max(0, posReview.value.parsed.exp - Math.floor(posNow.value / 1000));
});
const posExpired = computed(() => posReview.value?.status === 'ok' && posSecondsLeft.value <= 0);
const posCountdownLabel = computed(() => {
  const s = posSecondsLeft.value;
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
});

const posCanPay = computed(() => {
  if (posReview.value?.status !== 'ok' || posExpired.value) return false;
  if (posReview.value.trust?.status === 'key_changed' && !posKeyChangeAck.value) return false;
  return true;
});

function onPosReject() {
  posReview.value = null;
}

async function onPosApprove() {
  if (!posCanPay.value) return;
  const { parsed, trust } = posReview.value;

  if (trust && (trust.status === 'unknown' || trust.status === 'key_changed')) {
    try {
      const { trustMerchantKey } = await import('@/lib/pos/merchantKeys.js');
      await trustMerchantKey({ label: parsed.label, publicKeyHex: parsed.publicKeyHex, userLabel: parsed.label });
    } catch (e) {
      // Non-blocking: a local trust-record write failing shouldn't stop an
      // otherwise-valid, already-verified payment from proceeding.
      console.error('Failed to store merchant trust:', e);
    }
  }

  recipient.value = parsed.address;
  amount.value = Number(parsed.amount);
  memo.value = "";
  posReview.value = null;
  openConfirm();
}

const availableBalance = computed(() => Number(balance.value) || 0)

const formattedBalance = computed(() =>
  availableBalance.value.toLocaleString(undefined, { maximumFractionDigits: 8 })
)

const useAll = () => { amount.value = availableBalance.value }

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
      if (raw.toLowerCase().startsWith('navio:')) {
        posKeyChangeAck.value = false;
        const { evaluateScannedRequest } = await import('@/lib/pos/scanRequest.js');
        posReview.value = await evaluateScannedRequest(raw);
        return;
      }
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

  client.sendTransaction({ address: recipient.value, amount: toSatoshi(amount.value), memo: memo.value, subtractFeeFromAmount: subtractFeeFromAmount.value })
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
  showMemoInfo.value = false;
  subtractFeeFromAmount.value = false;
};
</script>
