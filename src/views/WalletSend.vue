<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">
    <h1 class="text-xl font-bold text-gray-900 dark:text-white px-5 pt-5 pb-4">{{ $t('wallet.sendNav') }}</h1>

    <div class="w-full max-w-md mx-auto px-5 pb-6 flex flex-col gap-4">
      <!-- Recipient -->
      <div class="rounded-2xl bg-white dark:bg-gh-800 border border-gray-200 dark:border-gh-700 p-3.5">
        <div class="flex items-center justify-between">
          <label for="send-recipient" class="text-xs text-gray-400 dark:text-gray-500">{{ $t('tx.to') }}</label>
          <button
            @click="scanQR"
            :disabled="isScanning"
            class="flex items-center gap-1 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400 disabled:opacity-40"
          >
            <Loader2 v-if="isScanning" class="w-3.5 h-3.5 animate-spin" />
            <QrCode v-else class="w-3.5 h-3.5" />
            {{ $t('wallet.scanQR') }}
          </button>
        </div>
        <textarea
          id="send-recipient"
          rows="3"
          v-model.trim="recipient"
          :placeholder="$t('wallet.navAddress')"
          autocomplete="off"
          spellcheck="false"
          class="mt-1.5 w-full bg-transparent text-sm font-mono resize-none outline-none
                 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
      </div>

      <AmountField
        v-model="amountInput"
        :label="$t('wallet.amount')"
        symbol="NAV"
        :logo="HL_LOGOS.NAV"
        :balance="availableBalance"
        :fiat="amountFiat"
        @max="useAll"
      />

      <p v-if="reservedNav > 0" class="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
        {{ $t('trade.reserved.warning', { amount: `${reservedNav} NAV` }) }}
      </p>

      <!-- More NAV exists, just not in the wallet: say where and offer the way -->
      <div v-if="insufficient" class="rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 space-y-2">
        <p class="text-xs text-amber-800 dark:text-amber-300 leading-snug">
          {{ onExchange > 0
            ? $t('send.insufficientWithExchange', { available: formatAmount(availableBalance, 8), exchange: formatAmount(onExchange, 8) })
            : $t('send.insufficient', { available: formatAmount(availableBalance, 8) }) }}
        </p>
        <button
          v-if="onExchange > 0"
          @click="router.push('/asset/NAV')"
          class="w-full py-2 rounded-lg text-xs font-semibold border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300"
        >
          {{ $t('send.bringBack') }}
        </button>
      </div>

      <!-- Optional extras, out of the way -->
      <div>
        <button
          type="button"
          @click="showOptions = !showOptions"
          :aria-expanded="showOptions"
          class="flex items-center gap-1 py-1 text-xs font-medium text-gray-500 dark:text-gray-400"
        >
          <ChevronDown class="w-3.5 h-3.5 transition-transform" :class="{ 'rotate-180': showOptions }" />
          {{ $t('send.moreOptions') }}
        </button>

        <div v-if="showOptions" class="mt-2 rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
          <div class="px-4 py-3">
            <label for="send-memo" class="text-xs text-gray-400 dark:text-gray-500">{{ $t('wallet.memoLabel') }}</label>
            <input
              id="send-memo"
              v-model="memo"
              type="text"
              :placeholder="$t('wallet.memoPlaceholder')"
              class="mt-1 w-full bg-transparent text-sm outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
            <p class="mt-1 text-xs text-gray-400 dark:text-gray-500 leading-snug">{{ $t('wallet.memoInfo') }}</p>
          </div>
          <div class="border-t border-gray-100 dark:border-gh-700 px-4 py-3 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ $t('wallet.subtractFeeFromAmount') }}</p>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-snug">{{ $t('wallet.subtractFeeFromAmountDesc') }}</p>
            </div>
            <button
              @click="subtractFeeFromAmount = !subtractFeeFromAmount"
              :class="subtractFeeFromAmount ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gh-600'"
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
        </div>
      </div>

      <button
        :disabled="!canSend"
        @click="openConfirm"
        class="w-full py-3.5 rounded-xl text-sm font-semibold transition-colors
               bg-blue-600 hover:bg-blue-700 text-white
               disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {{ amount > 0 ? $t('tx.review') : $t('tx.enterAmount') }}
      </button>
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

    <!-- Review -> sending -> outcome, in the one sheet every transaction uses -->
    <ReviewSheet
      :open="showConfirm || isLoading || showResult"
      :title="$t('wallet.confirmTransaction')"
      :from="{ amount: formatAmount(amount, 8), symbol: 'NAV', logo: HL_LOGOS.NAV }"
      :destination="recipient"
      :rows="reviewRows"
      :notices="[{ tone: 'warn', text: $t('send.irreversible') }]"
      :confirm-label="$t('send.confirm')"
      :busy="isLoading"
      :busy-label="$t('wallet.sendingTransaction')"
      :result="sendResult"
      @confirm="sendTransaction"
      @close="closeSheet"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { getNavioClient, balance } from "@/stores/navio";
import { BarcodeScanner, BarcodeFormat } from "@capacitor-mlkit/barcode-scanning";
import { QrCode, Loader2, Clock, ShieldAlert, ChevronDown } from "lucide-vue-next";
import ReviewSheet from "@/components/tx/ReviewSheet.vue";
import AmountField from "@/components/tx/AmountField.vue";
import { usePortfolio } from "@/composables/usePortfolio";
import { HL_LOGOS } from "@/lib/hyperliquid/config";
import { formatAmount, formatFiatFromUsd } from "@/lib/displayFormat";
import { toDecimalString } from "@/lib/intent/quote";
import { settings } from "@/stores/settings";
import { getPriceIn } from "@/stores/navPrice";
// Coin-locking safety net for the trade module (see stores/trade.js's Phase
// 4 note): reads only, and every read is a no-op when there are no
// outstanding maker commitments — a wallet that has never touched trading
// sees identical behavior to before this import existed. loadReservations()
// is called unconditionally on mount (not gated by settings.tradeMode)
// because an outstanding commitment is real regardless of whether the
// trading UI is currently toggled on.
import { getReservedAmount, getSendableUtxos, loadReservations } from "@/stores/trade";
// evaluateScannedRequest / trustMerchantKey are dynamically imported below
// (not statically here) so this always-loaded screen never pulls POS
// signing/storage code into the main bundle — only fetched the moment a
// navio: QR is actually scanned/approved.

const router = useRouter();
const { t } = useI18n();
const portfolio = usePortfolio();

const recipient = ref("");
// The field holds text; `amount` is the number it parses to (null until valid).
const amountInput = ref("");
const amount = computed(() => {
  const n = Number(amountInput.value);
  return Number.isFinite(n) && n > 0 ? n : null;
});
const memo = ref("");
const showOptions = ref(false);

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
  loadReservations();
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
  amountInput.value = posDisplayAmount(parsed.amount);
  memo.value = "";
  posReview.value = null;
  openConfirm();
}

// NAV currently committed to an outstanding maker quote/order — excluded
// from what's shown/usable here so "useAll" and manual entry can't reach
// into it. Zero (the common case: no outstanding trade commitments) leaves
// this identical to the balance shown before the trade module existed.
const reservedNav = computed(() => Number(getReservedAmount(null)) / 1e8)

const availableBalance = computed(() => Math.max(0, (Number(balance.value) || 0) - reservedNav.value))

// Sending everything leaves nothing to pay the fee with, so "Max" takes the
// fee out of the amount; the review screen says so.
const useAll = () => {
  amountInput.value = toDecimalString(availableBalance.value, 8)
  subtractFeeFromAmount.value = true
}

// Only the wallet's own NAV can be sent directly; NAV held on the exchange
// has to come back first (see NavAsset.vue's "Bring back to wallet").
const insufficient = computed(() => amount.value > availableBalance.value);
const onExchange = computed(() => portfolio.nav.value.exchangeAvailable);

const canSend = computed(() => recipient.value && amount.value > 0 && !insufficient.value);

const amountFiat = computed(() =>
  settings.showFiatValue && amount.value > 0 && portfolio.navUsd.value != null
    ? formatFiatFromUsd(amount.value * portfolio.navUsd.value)
    : null
);

const reviewRows = computed(() => {
  const rows = [{
    label: t('wallet.networkFee'),
    value: subtractFeeFromAmount.value ? t('send.feeFromAmount') : t('send.feeOnTop'),
  }];
  if (memo.value) rows.push({ label: t('wallet.memoLabel'), value: memo.value });
  return rows;
});

const sendResult = computed(() => {
  if (!showResult.value) return null;
  return resultSuccess.value
    ? { success: true, title: t('wallet.transactionSuccessful'), message: t('wallet.sentNavTo', { amount: formatAmount(amount.value, 8), address: recipient.value }) }
    : { success: false, title: t('wallet.transactionFailed'), message: errorMessage.value };
});

function closeSheet() {
  if (showResult.value) closeResult();
  else showConfirm.value = false;
}

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

  // Only touch UTXO selection when a reservation actually exists — the
  // ordinary auto-selected send path (the entire wallet before the trade
  // module existed) is otherwise untouched.
  const utxosPromise = reservedNav.value > 0
    ? getSendableUtxos(null).then((utxos) => utxos.map((u) => u.outputHash))
    : Promise.resolve(undefined);

  utxosPromise
    .then((selectedUtxos) => client.sendTransaction({
      address: recipient.value,
      amount: toSatoshi(amount.value),
      memo: memo.value,
      subtractFeeFromAmount: subtractFeeFromAmount.value,
      ...(selectedUtxos ? { selectedUtxos } : {}),
    }))
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

// A failed send keeps the form, so the user can fix it and try again.
const closeResult = () => {
  showResult.value = false;
  if (!resultSuccess.value) return;
  recipient.value = "";
  amountInput.value = "";
  memo.value = "";
  showOptions.value = false;
  subtractFeeFromAmount.value = false;
};
</script>
