<template>
  <div class="bg-gray-50 dark:bg-gh-900 p-5 pb-6 transition-colors duration-300 min-h-full">
    <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-5">{{ $t('posHistory.title') }}</h1>

    <div class="w-full max-w-md mx-auto flex flex-col gap-4">

      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4">
        <label class="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {{ $t('posHistory.dateLabel') }}
        </label>
        <input
          type="date"
          v-model="selectedDate"
          class="w-full px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gh-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gh-600"
        />
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4 flex items-center justify-between">
        <span class="text-sm text-gray-500 dark:text-gray-400">{{ $t('posHistory.total') }}</span>
        <span class="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{{ dayTotal }} NAV</span>
      </div>

      <div v-if="loading" class="text-center text-sm text-gray-400 dark:text-gray-500 py-8">{{ $t('common.loading') }}</div>

      <div
        v-else-if="!dayRequests.length"
        class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-6 text-center text-sm text-gray-400 dark:text-gray-500"
      >
        {{ $t('posHistory.noRequests') }}
      </div>

      <div v-else class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 divide-y divide-gray-100 dark:divide-gh-700 overflow-hidden">
        <div v-for="r in dayRequests" :key="r.id" class="px-4 py-3 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ r.label }}</p>
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ formatTime(r.createdAt) }}</p>
            <p
              v-if="r.address"
              class="text-[10px] font-mono text-gray-400 dark:text-gray-500 truncate cursor-pointer"
              :title="r.address"
              @click="copyAddress(r.address)"
            >
              {{ shortAddress(r.address) }}
            </p>
            <p
              v-if="r.subAddressId"
              class="text-[10px] font-mono text-gray-300 dark:text-gh-600 truncate cursor-pointer"
              :title="hashIdFor(r.subAddressId)"
              @click="copyHashId(r.subAddressId)"
            >
              hashId: {{ shortAddress(hashIdFor(r.subAddressId)) }}
            </p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
              {{ displayAmount(r.receivedAmountNav ?? r.amountNav) }} NAV
            </p>
            <span class="text-[10px] font-semibold uppercase tracking-wide" :class="statusClass(r.status)">
              {{ $t(`posHistory.status${capitalize(r.status)}`) }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="!acknowledged" class="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-2">
        <p class="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">{{ $t('posHistory.exportWarningText') }}</p>
        <button @click="acknowledge" class="text-xs font-semibold text-amber-800 dark:text-amber-200 underline">
          {{ $t('posHistory.exportWarningAck') }}
        </button>
      </div>

      <button
        :disabled="!acknowledged || exporting"
        @click="doExport"
        class="w-full py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40"
      >
        {{ exporting ? $t('common.pleaseWait') : $t('posHistory.exportAction') }}
      </button>
      <p v-if="exportError" class="text-xs text-red-500 text-center">{{ exportError }}</p>
      <p v-if="exportResult" class="text-xs text-green-600 dark:text-green-400 text-center">{{ exportResult }}</p>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import copy from "copy-to-clipboard";
import { listRequests } from "@/lib/pos/requests.js";
import { buildCsvText } from "@/lib/pos/exportCsv.js";
import { exportCsvFile } from "@/lib/payroll/exportFile.js";
import { hasAcknowledgedExportWarning, acknowledgeExportWarning } from "@/lib/pos/exportWarning.js";
import { expectedHashIdHex } from "@/lib/pos/paymentWatch.js";

const { t } = useI18n();

function shortAddress(address) {
  return address.length > 16 ? `${address.slice(0, 10)}…${address.slice(-6)}` : address;
}

function copyAddress(address) {
  copy(address);
}

// The hashId a payment to this request's sub-address gets recognised under
// (see paymentWatch.js) — only available for requests created after the
// subAddressId field was added; older records show nothing here.
function hashIdFor(subAddressId) {
  if (!subAddressId) return "";
  try {
    return expectedHashIdHex(subAddressId);
  } catch (e) {
    return `error: ${e?.message || e}`;
  }
}

function copyHashId(subAddressId) {
  copy(hashIdFor(subAddressId));
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function localDateOf(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const selectedDate = ref(localDateOf(Date.now()));
const allRequests = ref([]);
const loading = ref(true);

onMounted(async () => {
  try {
    allRequests.value = await listRequests();
  } finally {
    loading.value = false;
  }
});

const dayRequests = computed(() => allRequests.value.filter((r) => localDateOf(r.createdAt) === selectedDate.value));

const dayTotal = computed(() => {
  const sum = dayRequests.value
    .filter((r) => r.status === "paid" || r.status === "late")
    .reduce((acc, r) => acc + Number(r.receivedAmountNav ?? r.amountNav), 0);
  return displayAmount(sum);
});

function displayAmount(nav) {
  const n = Number(nav || 0);
  return n.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

function statusClass(status) {
  if (status === "paid") return "text-green-600 dark:text-green-400";
  if (status === "late") return "text-amber-600 dark:text-amber-400";
  if (status === "cancelled") return "text-gray-400 dark:text-gray-500";
  return "text-blue-500 dark:text-blue-400"; // active
}

// --- CSV export (reuses payroll's generic file writer; Excel-safety/warning
// gate are POS's own, mirrored from payroll's — see exportCsv.js/exportWarning.js) ---

const acknowledged = ref(hasAcknowledgedExportWarning());
const exporting = ref(false);
const exportError = ref("");
const exportResult = ref("");

function acknowledge() {
  acknowledgeExportWarning();
  acknowledged.value = true;
}

const CSV_HEADERS = () => [
  t("posHistory.colCreatedAt"),
  t("posHistory.colSettledAt"),
  t("posHistory.colId"),
  t("posHistory.colLabel"),
  t("posHistory.colAddress"),
  t("posHistory.colAmountNav"),
  t("posHistory.colReceivedAmountNav"),
  t("posHistory.colCurrency"),
  t("posHistory.colFiatAmount"),
  t("posHistory.colRate"),
  t("posHistory.colRateTimestamp"),
  t("posHistory.colStatus"),
  t("posHistory.colTxId"),
];

async function doExport() {
  exporting.value = true;
  exportError.value = "";
  exportResult.value = "";
  try {
    if (!dayRequests.value.length) {
      exportError.value = t("posHistory.exportNoData");
      return;
    }
    const csvText = buildCsvText(dayRequests.value, CSV_HEADERS());
    const filename = `navio-merchant-${selectedDate.value}.csv`;
    const result = await exportCsvFile(filename, csvText);
    exportResult.value =
      result.platform === "native"
        ? t("posHistory.exportedNativeShare", { path: result.path })
        : t("posHistory.exportedWebDownload", { path: result.path });
  } catch (e) {
    exportError.value = e?.message || t("posHistory.exportFailed");
  } finally {
    exporting.value = false;
  }
}
</script>
