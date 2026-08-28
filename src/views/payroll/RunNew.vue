<template>
  <div class="bg-gray-50 dark:bg-gh-900 p-5 pb-6 transition-colors duration-300 min-h-full">
    <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-5">{{ $t('payroll.newRun') }}</h1>

    <div class="w-full max-w-md mx-auto flex flex-col gap-4">

      <!-- Step 1: setup -->
      <template v-if="step === 'setup'">
        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
          <div class="px-4 pt-4 pb-3">
            <label class="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {{ $t('payroll.periodLabel') }}
            </label>
            <input v-model="periodLabel" type="text" :placeholder="$t('payroll.periodLabelPlaceholder')"
              class="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors bg-gray-50 dark:bg-gh-700 border border-gray-200 dark:border-gh-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-400 dark:focus:border-blue-500" />
          </div>
          <div class="border-t border-gray-100 dark:border-gh-700 px-4 py-3">
            <label class="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {{ $t('payroll.runDate') }}
            </label>
            <input v-model="date" type="date"
              class="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors bg-gray-50 dark:bg-gh-700 border border-gray-200 dark:border-gh-600 text-gray-900 dark:text-white focus:border-blue-400 dark:focus:border-blue-500" />
          </div>
        </div>

        <div v-if="groups.length" class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 px-4 py-3">
          <label class="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {{ $t('payroll.selectByGroup') }}
          </label>
          <select @change="addGroupToSelection($event.target.value); $event.target.value = ''"
            class="w-full px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gh-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gh-600 outline-none cursor-pointer">
            <option value="">{{ $t('payroll.selectByGroupPlaceholder') }}</option>
            <option v-for="g in groups" :key="g" :value="g">{{ g }}</option>
          </select>
        </div>

        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 divide-y divide-gray-100 dark:divide-gh-700 max-h-[45vh] overflow-y-auto">
          <label v-for="r in recipients" :key="r.id" class="px-4 py-3 flex items-center gap-3 cursor-pointer">
            <input type="checkbox" :value="r.id" v-model="selectedIds" class="rounded accent-blue-600" />
            <div class="min-w-0 flex-1">
              <p class="text-sm text-gray-900 dark:text-white truncate">{{ r.label }}</p>
              <p class="text-xs font-mono text-gray-400 dark:text-gray-500 truncate">{{ r.address }}</p>
            </div>
            <span v-if="r.groupTag" class="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">{{ r.groupTag }}</span>
          </label>
          <p v-if="recipients.length === 0" class="px-4 py-6 text-sm text-center text-gray-400 dark:text-gray-500">
            {{ $t('payroll.noRecipients') }}
          </p>
        </div>

        <div class="flex gap-2">
          <button @click="router.back()" class="flex-1 py-3 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300 transition-colors">
            {{ $t('common.cancel') }}
          </button>
          <button :disabled="!periodLabel.trim() || selectedIds.length === 0" @click="goToAmounts"
            class="flex-1 py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {{ $t('common.next') }}
          </button>
        </div>
      </template>

      <!-- Step 2: amounts -->
      <template v-else-if="step === 'amounts'">
        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p class="text-sm text-gray-700 dark:text-gray-300">{{ $t('payroll.enterInFiat') }}</p>
          </div>
          <button @click="toggleFiatMode"
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
            :class="fiatMode ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gh-600'">
            <span class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform" :class="fiatMode ? 'translate-x-6' : 'translate-x-1'" />
          </button>
        </div>

        <div v-if="fiatMode" class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 px-4 py-3 space-y-2">
          <div class="flex items-center gap-2">
            <select v-model="currency" @change="onCurrencyChange"
              class="px-2 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gh-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gh-600 outline-none cursor-pointer">
              <option v-for="opt in FIAT_CURRENCIES" :key="opt.value" :value="opt.value">{{ opt.value }}</option>
            </select>
            <button @click="lockRate" :disabled="lockingRate || !previewRate"
              class="flex-1 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40">
              {{ rateLock ? $t('payroll.rateRelock') : $t('payroll.rateLock') }}
            </button>
          </div>
          <p v-if="rateLock" class="text-xs text-gray-500 dark:text-gray-400">
            {{ $t('payroll.rateLockedNote', { rate: rateLock.navPriceInCurrency.toFixed(4), currency: rateLock.currency, source: rateLock.source, time: formatTime(rateLock.lockedAt) }) }}
          </p>
          <p v-else-if="previewRate" class="text-xs text-gray-400 dark:text-gray-500">
            {{ $t('payroll.rateLiveNote', { rate: previewRate.toFixed(4), currency }) }}
          </p>
          <p v-else class="text-xs text-gray-400 dark:text-gray-500">{{ $t('payroll.rateUnavailable') }}</p>
        </div>

        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 divide-y divide-gray-100 dark:divide-gh-700">
          <div v-for="row in rows" :key="row.recipientId" class="px-4 py-3 flex items-center gap-3">
            <div class="min-w-0 flex-1">
              <p class="text-sm text-gray-900 dark:text-white truncate">{{ row.label }}</p>
            </div>
            <template v-if="fiatMode">
              <input v-model.number="row.amountFiat" type="number" min="0" step="0.01" @input="onFiatInput(row)"
                class="w-24 text-right rounded-lg px-2 py-1.5 text-sm bg-gray-50 dark:bg-gh-700 border border-gray-200 dark:border-gh-600 text-gray-900 dark:text-white outline-none" />
              <span class="text-xs text-gray-400 dark:text-gray-500 w-10">{{ currency }}</span>
              <span class="text-xs text-gray-400 dark:text-gray-500 w-20 text-right shrink-0">{{ formatNav(row.amountNav) }}</span>
            </template>
            <template v-else>
              <input v-model.number="row.amountNav" type="number" min="0" step="0.00000001"
                class="w-28 text-right rounded-lg px-2 py-1.5 text-sm bg-gray-50 dark:bg-gh-700 border border-gray-200 dark:border-gh-600 text-gray-900 dark:text-white outline-none" />
              <span class="text-xs text-gray-400 dark:text-gray-500 w-10">NAV</span>
            </template>
          </div>
        </div>

        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 px-4 py-3 flex items-center justify-between">
          <span class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ $t('payroll.total') }}</span>
          <span class="text-base font-bold text-gray-900 dark:text-white">{{ formatNav(totalNav) }} NAV</span>
        </div>

        <div class="flex gap-2">
          <button @click="step = 'setup'" class="flex-1 py-3 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300 transition-colors">
            {{ $t('common.back') }}
          </button>
          <button :disabled="!canReview" @click="goToReview"
            class="flex-1 py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {{ $t('common.next') }}
          </button>
        </div>
      </template>

      <!-- Step 3: review -->
      <template v-else-if="step === 'review'">
        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
          <div class="px-4 py-3 flex items-center justify-between">
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ $t('payroll.total') }}</span>
            <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ formatNav(totalNav) }} NAV</span>
          </div>
          <div class="border-t border-gray-100 dark:border-gh-700 px-4 py-3 flex items-center justify-between">
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ $t('payroll.estimatedFee') }}</span>
            <span class="text-sm text-gray-700 dark:text-gray-300">~{{ formatNav(estimatedFeeTotal) }} NAV</span>
          </div>
          <div class="border-t border-gray-100 dark:border-gh-700 px-4 py-3 flex items-center justify-between">
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ $t('payroll.currentBalance') }}</span>
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ formatNav(availableBalance) }} NAV</span>
          </div>
        </div>

        <div v-if="insufficientBalance" class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 px-3 py-2.5 flex items-start gap-2">
          <AlertTriangle class="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p class="text-xs text-red-600 dark:text-red-400">{{ $t('payroll.insufficientBalance') }}</p>
        </div>

        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 divide-y divide-gray-100 dark:divide-gh-700 max-h-[35vh] overflow-y-auto">
          <div v-for="row in rows" :key="row.recipientId" class="px-4 py-2.5 flex items-center justify-between gap-3">
            <p class="text-sm text-gray-700 dark:text-gray-300 truncate">{{ row.label }}</p>
            <p class="text-sm text-gray-900 dark:text-white shrink-0">{{ formatNav(row.amountNav) }} NAV</p>
          </div>
        </div>

        <p v-if="createError" class="text-sm text-red-500 text-center">{{ createError }}</p>

        <div class="flex gap-2">
          <button @click="step = 'amounts'" class="flex-1 py-3 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300 transition-colors">
            {{ $t('common.back') }}
          </button>
          <button :disabled="creating" @click="confirmCreateRun"
            class="flex-1 py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {{ creating ? $t('common.pleaseWait') : $t('payroll.createRun') }}
          </button>
        </div>
      </template>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { AlertTriangle } from "lucide-vue-next";
import { listRecipients, listRecipientGroups } from "@/lib/payroll/recipients.js";
import { createRun, lockRunRate } from "@/lib/payroll/paymentRuns.js";
import { estimateFeeForRecipients } from "@/lib/payroll/feeEstimate.js";
import { getLiveRate, RATE_SOURCE } from "@/lib/payroll/rates.js";
import { getNavioClient, balance } from "@/stores/navio";
import { FIAT_CURRENCIES } from "@/stores/navPrice";

const router = useRouter();
const { t } = useI18n();

const step = ref("setup");
const periodLabel = ref("");
const date = ref(new Date().toISOString().slice(0, 10));

const recipients = ref([]);
const groups = ref([]);
const selectedIds = ref([]);

onMounted(async () => {
  recipients.value = await listRecipients({ includeArchived: false });
  groups.value = await listRecipientGroups();
});

function addGroupToSelection(tag) {
  if (!tag) return;
  const ids = recipients.value.filter((r) => r.groupTag === tag).map((r) => r.id);
  selectedIds.value = [...new Set([...selectedIds.value, ...ids])];
}

const rows = ref([]);
const fiatMode = ref(false);
const currency = ref("USD");
const previewRate = ref(null);
const rateLock = ref(null);
const lockingRate = ref(false);

function goToAmounts() {
  const selected = recipients.value.filter((r) => selectedIds.value.includes(r.id));
  const firstCurrency = selected.find((r) => r.currency)?.currency;
  if (firstCurrency) currency.value = firstCurrency;
  rows.value = selected.map((r) => ({
    recipientId: r.id,
    label: r.label,
    address: r.address,
    amountNav: r.defaultAmount ?? null,
    amountFiat: null,
  }));
  step.value = "amounts";
}

async function toggleFiatMode() {
  fiatMode.value = !fiatMode.value;
  if (fiatMode.value) await refreshPreviewRate();
}

async function onCurrencyChange() {
  rateLock.value = null;
  await refreshPreviewRate();
}

async function refreshPreviewRate() {
  previewRate.value = await getLiveRate(currency.value);
}

function onFiatInput(row) {
  const rate = rateLock.value?.navPriceInCurrency ?? previewRate.value;
  row.amountNav = rate && row.amountFiat != null ? Number((row.amountFiat / rate).toFixed(8)) : null;
}

async function lockRate() {
  lockingRate.value = true;
  try {
    const rate = await getLiveRate(currency.value);
    previewRate.value = rate;
    if (!rate) return;
    rateLock.value = { currency: currency.value, navPriceInCurrency: rate, source: RATE_SOURCE, lockedAt: Date.now() };
    for (const row of rows.value) onFiatInput(row);
  } finally {
    lockingRate.value = false;
  }
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString();
}

function formatNav(n) {
  if (n == null || Number.isNaN(n)) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

const totalNav = computed(() => rows.value.reduce((sum, r) => sum + (Number(r.amountNav) || 0), 0));

const canReview = computed(() => {
  if (rows.value.length === 0) return false;
  if (!rows.value.every((r) => Number(r.amountNav) > 0)) return false;
  if (fiatMode.value && !rateLock.value) return false;
  return true;
});

const availableBalance = computed(() => Number(balance.value) || 0);
const estimatedFeeTotal = ref(0);
const creating = ref(false);
const createError = ref("");

async function goToReview() {
  const client = getNavioClient();
  estimatedFeeTotal.value = await estimateFeeForRecipients(client, rows.value.length);
  step.value = "review";
}

const insufficientBalance = computed(() => totalNav.value + estimatedFeeTotal.value > availableBalance.value);

const toSatoshi = (nav) => BigInt(Math.round(nav * 1e8));

async function confirmCreateRun() {
  creating.value = true;
  createError.value = "";
  try {
    const payments = rows.value.map((r) => ({
      recipientId: r.recipientId,
      label: r.label,
      address: r.address,
      amountSat: toSatoshi(r.amountNav).toString(),
      amountFiat: fiatMode.value ? r.amountFiat : null,
      currency: fiatMode.value ? currency.value : null,
    }));
    const runId = await createRun({ periodLabel: periodLabel.value, date: date.value, payments });
    if (fiatMode.value && rateLock.value) {
      await lockRunRate(runId, rateLock.value);
    }
    router.replace(`/payroll/runs/${runId}`);
  } catch (e) {
    createError.value = e?.message || t("common.error");
  } finally {
    creating.value = false;
  }
}
</script>
