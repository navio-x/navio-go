<template>
  <div class="bg-gray-50 dark:bg-gh-900 p-5 pb-6 transition-colors duration-300 min-h-full">
    <div v-if="loading" class="text-center py-10 text-sm text-gray-400 dark:text-gray-500">{{ $t('common.loading') }}</div>

    <template v-else-if="run">
      <div class="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-1">{{ run.periodLabel }}</h1>
          <p class="text-xs text-gray-400 dark:text-gray-500">{{ run.date }}</p>
        </div>
        <button
          @click="router.push(`/payroll/export?runId=${run.id}`)"
          class="shrink-0 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap mt-1"
        >
          {{ $t('payroll.exportTitle') }}
        </button>
      </div>

      <div class="w-full max-w-md mx-auto flex flex-col gap-4">

        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
          <div class="px-4 py-3 flex items-center justify-between">
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ $t('payroll.total') }}</span>
            <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ formatNav(totalNav) }} NAV</span>
          </div>
          <div class="border-t border-gray-100 dark:border-gh-700 px-4 py-3 flex items-center justify-between">
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ $t('payroll.status') }}</span>
            <span class="text-sm font-medium" :class="statusColor(run.status)">{{ $t(`payroll.runStatus.${run.status}`) }}</span>
          </div>
          <div v-if="run.fee" class="border-t border-gray-100 dark:border-gh-700 px-4 py-3 flex items-center justify-between">
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ $t('payroll.networkFee') }}</span>
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ formatNav(Number(run.fee) / 1e8) }} NAV</span>
          </div>
          <div v-if="run.rate" class="border-t border-gray-100 dark:border-gh-700 px-4 py-3">
            <p class="text-xs text-gray-400 dark:text-gray-500">
              {{ $t('payroll.rateLockedNote', { rate: run.rate.navPriceInCurrency.toFixed(4), currency: run.rate.currency, source: run.rate.source, time: new Date(run.rate.lockedAt).toLocaleTimeString() }) }}
            </p>
          </div>
        </div>

        <div v-if="signing" class="rounded-2xl border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
          <p class="text-sm text-blue-700 dark:text-blue-300 font-medium">
            {{ progress.phase === 'sending'
              ? $t('payroll.signingBatch', { n: progress.batchSize })
              : $t('common.pleaseWait') }}
          </p>
        </div>

        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 divide-y divide-gray-100 dark:divide-gh-700">
          <div v-for="p in payments" :key="p.id" class="px-4 py-3">
            <div class="flex items-center gap-3">
              <div class="min-w-0 flex-1">
                <button
                  @click="router.push(`/payroll/recipients/${p.recipientId}/history`)"
                  class="block w-full text-sm text-gray-900 dark:text-white truncate hover:underline text-left"
                >
                  {{ p.label }}
                </button>
                <div v-if="p.txId" class="flex items-center gap-1 min-w-0">
                  <p class="text-xs font-mono text-gray-400 dark:text-gray-500 truncate">{{ p.txId }}</p>
                  <button @click="copyTxId(p)" class="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <Check v-if="copiedId === p.id" class="w-3 h-3 text-green-500" />
                    <Copy v-else class="w-3 h-3" />
                  </button>
                </div>
                <p v-else class="text-xs font-mono text-gray-400 dark:text-gray-500 truncate">{{ p.address }}</p>
                <p v-if="p.status === 'failed' && p.error" class="text-xs text-red-500 truncate">{{ p.error }}</p>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 shrink-0">{{ formatNav(Number(p.amountSat) / 1e8) }} NAV</p>
              <component :is="statusIcon(p.status)" class="w-4 h-4 shrink-0" :class="[statusColor(p.status), p.status === 'sending' ? 'animate-spin' : '']" />
            </div>

            <div v-if="p.status === 'sent'" class="mt-2 flex items-center gap-2 pl-0">
              <button
                v-if="!latestReceipts[p.id]"
                :disabled="receiptBusyId === p.id"
                @click="onGenerateReceipt(p)"
                class="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40"
              >
                <FileSignature class="w-3 h-3 inline-block mr-1 -mt-0.5" />{{ $t('payroll.receiptGenerate') }}
              </button>
              <template v-else>
                <span class="text-xs text-gray-400 dark:text-gray-500">
                  {{ $t('payroll.receiptIssued', { date: new Date(latestReceipts[p.id].issuedAt).toLocaleDateString() }) }}
                </span>
                <button
                  :disabled="receiptBusyId === p.id"
                  @click="onShareReceipt(p)"
                  class="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40"
                >
                  <Share2 class="w-3 h-3 inline-block mr-1 -mt-0.5" />{{ $t('payroll.receiptShare') }}
                </button>
                <button
                  :disabled="receiptBusyId === p.id"
                  @click="onGenerateReceipt(p)"
                  class="text-xs font-medium text-gray-500 dark:text-gray-400 hover:underline disabled:opacity-40"
                >
                  {{ $t('payroll.receiptRegenerate') }}
                </button>
              </template>
            </div>
            <p v-if="receiptError[p.id]" class="mt-1 text-xs text-red-500">{{ receiptError[p.id] }}</p>
          </div>
        </div>

        <div v-if="signError" class="text-center space-y-1.5">
          <p class="text-sm text-red-500">{{ signError }}</p>
          <button v-if="signErrorCode === 'wallet_locked'" @click="router.push('/wallet/home')" class="text-xs font-semibold text-blue-600 dark:text-blue-400 underline">
            {{ $t('payroll.goToWallets') }}
          </button>
        </div>

        <button
          v-if="hasUnsent"
          :disabled="signing"
          @click="startSigning"
          class="w-full py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {{ signing ? $t('common.pleaseWait') : (anySent ? $t('payroll.resumeSigning') : $t('payroll.startSigning')) }}
        </button>
      </div>
    </template>

    <div v-else class="text-center py-10 text-sm text-gray-400 dark:text-gray-500">{{ $t('payroll.runNotFound') }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import copy from "copy-to-clipboard";
import { Clock, Loader2, Check, X, Copy, FileSignature, Share2 } from "lucide-vue-next";
import { getRun, getPayments } from "@/lib/payroll/paymentRuns.js";
import { signRun } from "@/lib/payroll/runSigning.js";
import { generateReceipt, latestReceiptsByPaymentId } from "@/lib/payroll/receipts.js";
import { shareReceipt } from "@/lib/payroll/receiptShare.js";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const loading = ref(true);
const run = ref(null);
const payments = ref([]);
const signing = ref(false);
const signError = ref("");
const signErrorCode = ref("");
const progress = ref({ done: 0, total: 0, phase: "idle", batchSize: 0 });
const copiedId = ref(null);
const latestReceipts = ref({});
const receiptBusyId = ref(null);
const receiptError = ref({});

function copyTxId(p) {
  copy(p.txId);
  copiedId.value = p.id;
  setTimeout(() => { copiedId.value = null; }, 2000);
}

async function load() {
  run.value = await getRun(route.params.id);
  payments.value = run.value ? await getPayments(route.params.id) : [];
  await loadReceipts();
}

async function loadReceipts() {
  const sent = payments.value.filter((p) => p.status === "sent");
  const latest = await latestReceiptsByPaymentId(sent.map((p) => p.id));
  latestReceipts.value = Object.fromEntries(latest);
}

function receiptErrorMessage(code, fallbackKey) {
  if (code === "wallet_locked") return t("payroll.walletLocked");
  if (code === "wallet_not_ready") return t("payroll.walletNotReady");
  return t(fallbackKey);
}

async function onGenerateReceipt(p) {
  receiptBusyId.value = p.id;
  receiptError.value = { ...receiptError.value, [p.id]: "" };
  try {
    const receipt = await generateReceipt(p.id);
    latestReceipts.value = { ...latestReceipts.value, [p.id]: receipt };
  } catch (e) {
    receiptError.value = { ...receiptError.value, [p.id]: receiptErrorMessage(e?.message, "payroll.receiptGenerateFailed") };
  } finally {
    receiptBusyId.value = null;
  }
}

async function onShareReceipt(p) {
  const receipt = latestReceipts.value[p.id];
  if (!receipt) return;
  receiptBusyId.value = p.id;
  receiptError.value = { ...receiptError.value, [p.id]: "" };
  try {
    await shareReceipt(receipt);
  } catch (e) {
    receiptError.value = { ...receiptError.value, [p.id]: receiptErrorMessage(e?.message, "payroll.receiptShareFailed") };
  } finally {
    receiptBusyId.value = null;
  }
}

onMounted(async () => {
  loading.value = true;
  await load();
  loading.value = false;
});

const totalNav = computed(() => payments.value.reduce((sum, p) => sum + Number(p.amountSat) / 1e8, 0));
const hasUnsent = computed(() => payments.value.some((p) => p.status !== "sent"));
const anySent = computed(() => payments.value.some((p) => p.status === "sent"));

function formatNav(n) {
  return (n || 0).toLocaleString(undefined, { maximumFractionDigits: 8 });
}

function statusIcon(status) {
  if (status === "sent") return Check;
  if (status === "sending") return Loader2;
  if (status === "failed") return X;
  return Clock;
}

function statusColor(status) {
  return {
    sent: "text-green-600 dark:text-green-400",
    completed: "text-green-600 dark:text-green-400",
    sending: "text-blue-500 dark:text-blue-400",
    signing: "text-blue-500 dark:text-blue-400",
    failed: "text-red-500 dark:text-red-400",
    partial: "text-amber-500 dark:text-amber-400",
    pending: "text-gray-400 dark:text-gray-500",
    draft: "text-gray-400 dark:text-gray-500",
  }[status] || "text-gray-400 dark:text-gray-500";
}

function signErrorMessage(code) {
  if (code === "wallet_locked") return t("payroll.walletLocked");
  if (code === "wallet_not_ready") return t("payroll.walletNotReady");
  if (code === "already_signing") return t("payroll.alreadySigning");
  return code || t("payroll.signingFailed");
}

async function startSigning() {
  signing.value = true;
  signError.value = "";
  signErrorCode.value = "";
  try {
    await signRun(route.params.id, {
      onProgress: async (p) => {
        progress.value = { done: p.done, total: p.total, phase: p.phase, batchSize: p.batchSize || 0 };
        await load();
      },
    });
  } catch (e) {
    signErrorCode.value = e?.message || "";
    signError.value = signErrorMessage(e?.message);
  } finally {
    await load();
    signing.value = false;
  }
}
</script>
