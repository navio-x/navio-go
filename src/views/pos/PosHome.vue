<template>
  <div class="bg-gray-50 dark:bg-gh-900 p-5 pb-6 transition-colors duration-300 min-h-full">
    <div class="flex items-center justify-between mb-5">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('pos.title') }}</h1>
      <button
        type="button"
        class="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
        @click="router.push('/pos/history')"
      >
        <History class="w-3.5 h-3.5" />
        {{ $t('pos.history') }}
      </button>
    </div>

    <!-- Amount entry (numpad) -->
    <div class="w-full max-w-sm mx-auto flex flex-col gap-5">
      <div class="flex justify-center">
        <div class="inline-flex rounded-xl bg-gray-100 dark:bg-gh-800 p-1">
          <button
            type="button"
            class="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
            :class="mode === 'nav' ? 'bg-white dark:bg-gh-700 text-gray-900 dark:text-white shadow' : 'text-gray-500 dark:text-gray-400'"
            @click="setMode('nav')"
          >
            NAV
          </button>
          <button
            type="button"
            class="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
            :class="mode === 'fiat' ? 'bg-white dark:bg-gh-700 text-gray-900 dark:text-white shadow' : 'text-gray-500 dark:text-gray-400'"
            @click="setMode('fiat')"
          >
            {{ settings.currency }}
          </button>
        </div>
      </div>

      <div class="text-center">
        <p class="text-4xl font-bold text-gray-900 dark:text-white tabular-nums break-all">
          {{ rawInput || '0' }}<span class="text-xl text-gray-400 dark:text-gray-500 ml-1.5">{{ mode === 'nav' ? 'NAV' : settings.currency }}</span>
        </p>
        <p v-if="mode === 'fiat'" class="text-sm text-gray-400 dark:text-gray-500 mt-1">
          {{ $t('pos.convertedAmount', { amount: displayNavEquivalent }) }}
        </p>
        <p v-else-if="mode === 'nav' && navFiatEquivalent" class="text-sm text-gray-400 dark:text-gray-500 mt-1">
          {{ $t('pos.convertedFiatAmount', { amount: navFiatEquivalent, currency: settings.currency }) }}
        </p>
        <p v-if="previewRate" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          {{ $t('pos.rateNote', { rate: previewRate.toFixed(4), currency: settings.currency, time: formatClock(rateUpdatedAt) }) }}
        </p>
      </div>

      <NumberPad @press="onPress" />

      <button
        type="button"
        :disabled="!canRequest"
        class="w-full py-3.5 rounded-xl text-sm font-semibold transition-colors
               bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:dark:bg-gh-700
               text-white disabled:text-gray-400 dark:disabled:text-gray-500"
        @click="requestPayment"
      >
        {{ creating ? $t('common.pleaseWait') : $t('pos.requestPayment') }}
      </button>
    </div>

    <!-- Full-screen active request -->
    <div
      v-if="screen === 'active' && request"
      class="fixed inset-0 z-[300] flex flex-col items-center justify-between bg-white dark:bg-gh-900 p-6"
    >
      <div class="w-full max-w-sm">
        <p
          v-if="offline"
          class="flex items-center justify-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400
                 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2"
        >
          <WifiOff class="w-3.5 h-3.5 shrink-0" />
          {{ $t('pos.offlineWarning') }}
        </p>
      </div>

      <div class="flex-1 flex flex-col items-center justify-center gap-4 w-full">
        <p class="text-lg font-semibold text-gray-900 dark:text-white text-center break-words max-w-xs">
          {{ request.label }}
        </p>
        <p class="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
          {{ displayAmount(request.amount) }} NAV
        </p>
        <p v-if="qrFiatEquivalent" class="text-sm text-gray-400 dark:text-gray-500 -mt-2">
          ≈ {{ qrFiatEquivalent.amount }} {{ qrFiatEquivalent.currency }}
        </p>

        <!-- No payment seen yet: QR only -->
        <template v-if="!paymentStatus">
          <div class="p-3 bg-white rounded-xl ring-1 ring-gray-100 dark:ring-gh-700">
            <QRCode :value="request.uri" :size="220" />
          </div>
          <p
            class="text-sm font-medium tabular-nums"
            :class="isExpired ? 'text-amber-500' : 'text-gray-400 dark:text-gray-500'"
          >
            {{ isExpired ? $t('pos.expired') : $t('pos.expiresIn', { time: countdownLabel }) }}
          </p>
        </template>

        <!-- Something has arrived: live status, QR no longer needed -->
        <div v-else class="w-full max-w-xs rounded-2xl border p-4 text-center"
          :class="isMismatch ? 'border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10' : 'border-gray-200 dark:border-gh-700 bg-gray-50 dark:bg-gh-800'"
        >
          <template v-if="isMismatch">
            <p class="text-sm font-semibold text-amber-700 dark:text-amber-300">
              {{ paymentStatus.outcome === 'underpaid' ? $t('pos.underpaid') : $t('pos.overpaid') }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {{ $t('pos.amountReceivedVsRequested', { received: displayAmount(paymentStatus.receivedAmountNav), requested: displayAmount(paymentStatus.requestedAmountNav) }) }}
            </p>
          </template>
          <template v-else-if="paymentStatus.outcome === 'accepted_zero_conf'">
            <p class="text-sm font-semibold text-blue-600 dark:text-blue-400">{{ $t('pos.acceptedZeroConfBadge') }}</p>
          </template>
          <template v-else>
            <p class="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {{ $t('pos.seenWaiting', { confirmations: paymentStatus.confirmations, required: settings.merchantRequiredConfirmations }) }}
            </p>
          </template>
        </div>
      </div>

      <div class="w-full max-w-sm flex flex-col gap-2">
        <button
          v-if="isMismatch"
          type="button"
          class="w-full py-3.5 rounded-xl text-sm font-semibold transition-colors bg-blue-600 hover:bg-blue-700 text-white"
          @click="acceptMismatch"
        >
          {{ paymentStatus.outcome === 'underpaid' ? $t('pos.acceptPartial') : $t('pos.acceptOverpayment') }}
        </button>

        <button type="button" class="text-[11px] text-gray-400 dark:text-gray-500 underline self-center" @click="debugOpen = !debugOpen">
          {{ debugOpen ? 'Debug bilgisini gizle' : 'Debug bilgisini göster' }}
        </button>
        <div v-if="debugOpen" class="w-full rounded-xl border border-gray-200 dark:border-gh-700 bg-gray-50 dark:bg-gh-800 p-3 text-[11px] font-mono text-gray-500 dark:text-gray-400 space-y-1 break-all">
          <p><span class="text-gray-400 dark:text-gray-500">talep adresi:</span> {{ request.address || request.uri?.split('?')[0]?.replace('navio:', '') }}</p>
          <p><span class="text-gray-400 dark:text-gray-500">sub-address id:</span> account {{ request.subAddressId?.account }} / index {{ request.subAddressId?.address }}</p>
          <p><span class="text-gray-400 dark:text-gray-500">beklenen hashId:</span> {{ debugTargetHashId }}</p>
          <p><span class="text-gray-400 dark:text-gray-500">chain tip / wallet height:</span> {{ getChainTip() }} / {{ getWalletHeight() }}</p>
          <p><span class="text-gray-400 dark:text-gray-500">eşleşme:</span> {{ paymentStatus ? 'bulundu' : 'yok (ödeme bu adrese hiç düşmedi)' }}</p>
          <template v-if="paymentStatus">
            <p><span class="text-gray-400 dark:text-gray-500">outcome:</span> {{ paymentStatus.outcome }}</p>
            <p><span class="text-gray-400 dark:text-gray-500">confirmations:</span> {{ paymentStatus.confirmations }} / gerekli {{ settings.merchantRequiredConfirmations }}</p>
            <p><span class="text-gray-400 dark:text-gray-500">alınan / istenen:</span> {{ paymentStatus.receivedAmountNav }} / {{ paymentStatus.requestedAmountNav }} NAV</p>
            <p><span class="text-gray-400 dark:text-gray-500">txHash:</span> {{ paymentStatus.txHashes?.join(', ') }}</p>
          </template>
        </div>

        <button
          type="button"
          class="w-full py-3.5 rounded-xl text-sm font-semibold transition-colors
                 bg-gray-100 hover:bg-gray-200 text-gray-700
                 dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
          @click="cancelRequest"
        >
          {{ $t('common.cancel') }}
        </button>
      </div>
    </div>

    <!-- Success -->
    <div
      v-if="screen === 'success' && request"
      class="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-4 bg-white dark:bg-gh-900 p-6"
    >
      <div class="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
        <CheckCircle2 class="w-12 h-12 text-green-500" />
      </div>
      <p class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('pos.paymentReceived') }}</p>
      <p class="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">{{ displayAmount(request.receivedNav) }} NAV</p>
      <p class="text-xs text-gray-400 dark:text-gray-500">
        {{ request.acceptedVia === 'accepted_zero_conf' ? $t('pos.acceptedZeroConfSubtitle') : $t('pos.confirmedSubtitle', { confirmations: request.finalConfirmations, required: settings.merchantRequiredConfirmations }) }}
      </p>
      <button
        type="button"
        class="w-full max-w-sm py-3.5 rounded-xl text-sm font-semibold transition-colors bg-blue-600 hover:bg-blue-700 text-white mt-4"
        @click="newSale"
      >
        {{ $t('pos.newSale') }}
      </button>
    </div>

    <!-- Late payment: detected after expiry — never silently discarded -->
    <div
      v-if="screen === 'late' && request"
      class="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-4 bg-white dark:bg-gh-900 p-6"
    >
      <div class="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
        <AlertTriangle class="w-12 h-12 text-amber-500" />
      </div>
      <p class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('pos.paidLate') }}</p>
      <p class="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs">{{ $t('pos.paidLateDesc') }}</p>
      <p class="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">{{ displayAmount(request.receivedNav) }} NAV</p>
      <button
        type="button"
        class="w-full max-w-sm py-3.5 rounded-xl text-sm font-semibold transition-colors bg-blue-600 hover:bg-blue-700 text-white mt-4"
        @click="newSale"
      >
        {{ $t('pos.newSale') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import QRCode from "qrcode.vue";
import { CheckCircle2, AlertTriangle, WifiOff, History } from "lucide-vue-next";
import NumberPad from "./NumberPad.vue";
import { settings } from "@/stores/settings";
import { deriveFreshMerchantAddress } from "@/lib/pos/address.js";
import { getMerchantSigningKeypair } from "@/lib/pos/session.js";
import { buildPaymentRequestUri } from "@/lib/pos/uriScheme.js";
import { watchAddressPayments, expectedHashIdHex } from "@/lib/pos/paymentWatch.js";
import { evaluatePayment } from "@/lib/pos/confirmationPolicy.js";
import { acquireKeepAwake, releaseKeepAwake } from "@/lib/pos/keepAwake.js";
import { triggerPaymentDetectedFeedback } from "@/lib/pos/feedback.js";
import { getLiveRate } from "@/lib/pos/rates.js";
import { applyKeypadPress } from "@/lib/pos/amountEntry.js";
import { isConnectionOffline } from "@/lib/pos/connectivity.js";
import { createRequestRecord, updateRequestRecord } from "@/lib/pos/requests.js";
import { getChainTip, getWalletHeight } from "@/stores/navio";

const { t } = useI18n();
const router = useRouter();

// A request stays open long enough for a customer to scan, approve and
// broadcast, without staying valid indefinitely on an unattended screen.
const REQUEST_TTL_SECONDS = 10 * 60;

const mode = ref("nav"); // 'nav' | 'fiat'
const rawInput = ref("");
const creating = ref(false);
const previewRate = ref(null);
const rateUpdatedAt = ref(null);

const screen = ref("amount"); // 'amount' | 'active' | 'success' | 'late'
const request = ref(null);
const paymentStatus = ref(null); // live evaluatePayment() result while screen === 'active'
const nowTick = ref(Date.now());
const offline = ref(false);

const isMismatch = computed(() => paymentStatus.value?.outcome === "underpaid" || paymentStatus.value?.outcome === "overpaid");

// Diagnostic panel, shown on demand on the QR screen — surfaces exactly what
// paymentWatch.js is matching against, so a stuck request (payment landed in
// the wallet, screen never leaves the QR) can be told apart from "wrong
// address" (customer paid the fixed Receive address / an old QR instead of
// this request's) without needing devtools.
const debugOpen = ref(false);
const debugTargetHashId = computed(() => {
  if (!request.value?.subAddressId) return "";
  try {
    return expectedHashIdHex(request.value.subAddressId);
  } catch (e) {
    return `error: ${e?.message || e}`;
  }
});

let stopPaymentWatch = null;
let tickTimer = null;
let rateTimer = null;

function setMode(next) {
  if (mode.value === next) return;
  mode.value = next;
  rawInput.value = "";
  if (next === "fiat") refreshPreviewRate();
}

function onPress(key) {
  const maxDecimals = mode.value === "nav" ? 8 : 2;
  rawInput.value = applyKeypadPress(rawInput.value, key, maxDecimals);
}

const navAmount = computed(() => {
  if (mode.value === "nav") return Number(rawInput.value || 0);
  if (!previewRate.value) return 0;
  return Number(rawInput.value || 0) / previewRate.value;
});

const displayNavEquivalent = computed(() => displayAmount(navAmount.value));

// Live fiat equivalent shown under the numpad while entering directly in
// NAV — the mirror image of displayNavEquivalent (which converts a fiat
// entry back to NAV). Purely informational, at the current live rate.
const navFiatEquivalent = computed(() => {
  if (mode.value !== "nav" || !settings.showFiatValue || !previewRate.value) return null;
  const nav = Number(rawInput.value || 0);
  if (!nav) return null;
  return (nav * previewRate.value).toFixed(2);
});

const canRequest = computed(() => navAmount.value > 0 && !creating.value && (mode.value === "nav" || !!previewRate.value));

// Fiat line shown on the QR screen: the locked rate/amount the customer
// actually typed (fiat entry mode), or — for a request entered directly in
// NAV — a live, non-locked conversion at the merchant's preferred currency,
// purely informational (not stored on the request record; see requests.js).
const qrFiatEquivalent = computed(() => {
  if (!request.value) return null;
  if (request.value.fiat) return { amount: request.value.fiat.fiatAmount, currency: request.value.fiat.currency };
  if (!settings.showFiatValue || !previewRate.value) return null;
  return { amount: (Number(request.value.amount) * previewRate.value).toFixed(2), currency: settings.currency };
});

function displayAmount(nav) {
  const n = Number(nav || 0);
  return n.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
}

function formatClock(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

// Kept live regardless of entry mode (not just while mode === 'fiat') so the
// QR screen can always show a fiat equivalent under the NAV amount, even for
// a request entered directly in NAV — see qrFiatEquivalent below.
async function refreshPreviewRate() {
  if (!settings.showFiatValue) return;
  const rate = await getLiveRate(settings.currency);
  if (rate != null) {
    previewRate.value = rate;
    rateUpdatedAt.value = Date.now();
  }
}

async function requestPayment() {
  if (!canRequest.value) return;
  creating.value = true;
  try {
    const nav = navAmount.value;
    const { address, id: subAddressId } = deriveFreshMerchantAddress();
    const { privateKey, publicKeyHex } = await getMerchantSigningKeypair();
    const exp = Math.floor(Date.now() / 1000) + REQUEST_TTL_SECONDS;
    const label = settings.merchantLabel?.trim() || t("pos.unnamedMerchant");

    const built = await buildPaymentRequestUri({ address, amount: nav, label, exp, privateKey, publicKeyHex });

    request.value = {
      ...built,
      subAddressId,
      status: "active",
      receivedNav: null,
      txHash: null,
      acceptedVia: null,
      finalConfirmations: null,
      fiat:
        mode.value === "fiat" && previewRate.value
          ? {
              currency: settings.currency,
              rate: previewRate.value,
              lockedAt: Date.now(),
              fiatAmount: rawInput.value,
            }
          : null,
    };
    paymentStatus.value = null;

    try {
      await createRequestRecord({
        id: built.id,
        address,
        subAddressId,
        amountNav: built.amount,
        label: built.label,
        exp: built.exp,
        fiat: request.value.fiat,
      });
    } catch (e) {
      // Non-blocking: a storage hiccup shouldn't stop a valid, already-built
      // request from being shown to the customer as a QR.
      console.error("Failed to persist new request:", e);
    }

    stopPaymentWatch?.();
    stopPaymentWatch = watchAddressPayments(subAddressId, onPaymentUpdate);
    acquireKeepAwake();
    screen.value = "active";
  } finally {
    creating.value = false;
  }
}

function onPaymentUpdate(status) {
  if (!request.value || screen.value !== "active") return;

  if (!status) {
    paymentStatus.value = null;
    return;
  }

  const policy = {
    zeroConfThreshold: settings.merchantZeroConfThreshold,
    requiredConfirmations: settings.merchantRequiredConfirmations,
  };
  const result = evaluatePayment({
    requestedAmountNav: Number(request.value.amount),
    receivedAmountNav: status.totalAmountNav,
    confirmations: status.confirmations,
    policy,
  });

  const firstDetection = paymentStatus.value == null;
  paymentStatus.value = { ...result, txHashes: status.txHashes };
  if (firstDetection) triggerPaymentDetectedFeedback();

  if (result.outcome === "confirmed" || result.outcome === "accepted_zero_conf") {
    finalizeRequest(result);
  }
}

/** Reached either automatically (confirmed / accepted at zero-conf) or via
 *  the cashier explicitly accepting an under/overpayment mismatch. */
function finalizeRequest(result) {
  const late = Math.floor(Date.now() / 1000) > request.value.exp;
  const txHash = paymentStatus.value?.txHashes?.[0] ?? null;
  request.value = {
    ...request.value,
    status: late ? "late" : "paid",
    receivedNav: result.receivedAmountNav,
    txHash,
    acceptedVia: result.outcome,
    finalConfirmations: result.confirmations,
  };
  updateRequestRecord(request.value.id, {
    status: late ? "late" : "paid",
    receivedAmountNav: result.receivedAmountNav,
    transactionId: txHash,
    settledAt: Date.now(),
  }).catch((e) => console.error("Failed to persist request outcome:", e));

  stopPaymentWatch?.();
  stopPaymentWatch = null;
  releaseKeepAwake();
  screen.value = late ? "late" : "success";
}

function acceptMismatch() {
  if (!paymentStatus.value) return;
  finalizeRequest(paymentStatus.value);
}

function cancelRequest() {
  if (request.value) {
    request.value = { ...request.value, status: "cancelled" };
    updateRequestRecord(request.value.id, { status: "cancelled", settledAt: Date.now() }).catch((e) =>
      console.error("Failed to persist cancellation:", e)
    );
  }
  stopPaymentWatch?.();
  stopPaymentWatch = null;
  releaseKeepAwake();
  screen.value = "amount";
}

function newSale() {
  request.value = null;
  paymentStatus.value = null;
  rawInput.value = "";
  screen.value = "amount";
}

const secondsLeft = computed(() => {
  if (!request.value) return 0;
  return Math.max(0, request.value.exp - Math.floor(nowTick.value / 1000));
});
const isExpired = computed(() => request.value != null && secondsLeft.value <= 0);
const countdownLabel = computed(() => {
  const s = secondsLeft.value;
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
});

onMounted(() => {
  tickTimer = setInterval(() => {
    nowTick.value = Date.now();
    offline.value = isConnectionOffline();
  }, 1000);
  refreshPreviewRate();
  rateTimer = setInterval(refreshPreviewRate, 30_000);
});

onUnmounted(() => {
  clearInterval(tickTimer);
  clearInterval(rateTimer);
  stopPaymentWatch?.();
  releaseKeepAwake();
});
</script>
