<template>
  <div class="bg-gray-50 dark:bg-gh-900 p-5 pb-6 transition-colors duration-300 min-h-full">
    <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-5">{{ $t('payroll.exportTitle') }}</h1>

    <div class="w-full max-w-md mx-auto flex flex-col gap-4">

      <div v-if="!acknowledged" class="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-2">
        <p class="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">{{ $t('payroll.exportWarningText') }}</p>
        <button @click="acknowledge" class="text-xs font-semibold text-amber-800 dark:text-amber-200 underline">
          {{ $t('payroll.exportWarningAck') }}
        </button>
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4 space-y-3">
        <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {{ $t('payroll.exportScopeLabel') }}
        </label>
        <div class="flex gap-2">
          <button
            v-for="opt in scopeOptions"
            :key="opt.value"
            @click="scope = opt.value"
            class="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors"
            :class="scope === opt.value
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gh-700 text-gray-600 dark:text-gray-300'"
          >
            {{ opt.label }}
          </button>
        </div>

        <div v-if="scope === 'run'">
          <select v-model="runId" class="w-full px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gh-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gh-600">
            <option v-for="r in runs" :key="r.id" :value="r.id">{{ r.periodLabel }} — {{ r.date }}</option>
          </select>
        </div>

        <div v-else-if="scope === 'range'" class="flex gap-2">
          <div class="flex-1">
            <label class="block mb-1 text-[11px] text-gray-400 dark:text-gray-500">{{ $t('payroll.exportFrom') }}</label>
            <input type="date" v-model="fromDate" class="w-full px-2.5 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gh-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gh-600" />
          </div>
          <div class="flex-1">
            <label class="block mb-1 text-[11px] text-gray-400 dark:text-gray-500">{{ $t('payroll.exportTo') }}</label>
            <input type="date" v-model="toDate" class="w-full px-2.5 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gh-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gh-600" />
          </div>
        </div>

        <div v-else-if="scope === 'recipient'">
          <select v-model="recipientId" class="w-full px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gh-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gh-600">
            <option v-for="r in recipients" :key="r.id" :value="r.id">
              {{ r.label }}{{ r.archived ? ` ${$t('payroll.exportArchivedSuffix')}` : '' }}
            </option>
          </select>
        </div>

        <div class="border-t border-gray-100 dark:border-gh-700 pt-3">
          <label class="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {{ $t('payroll.exportFormatLabel') }}
          </label>
          <div class="flex gap-4">
            <label class="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" v-model="formatCsv" class="rounded accent-blue-600" />{{ $t('payroll.exportFormatCsv') }}
            </label>
            <label class="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" v-model="formatPdf" class="rounded accent-blue-600" />{{ $t('payroll.exportFormatPdf') }}
            </label>
          </div>
        </div>

        <button
          :disabled="!acknowledged || !canExport || exporting"
          @click="doExport"
          class="w-full py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40"
        >
          {{ exporting ? $t('common.pleaseWait') : $t('payroll.exportAction') }}
        </button>

        <p v-if="exportError" class="text-xs text-red-500 text-center">{{ exportError }}</p>
        <p v-if="exportResults.length" class="text-xs text-green-600 dark:text-green-400 text-center">
          {{ exportResults.join(' · ') }}
        </p>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { listRuns } from "@/lib/payroll/paymentRuns.js";
import { listRecipients } from "@/lib/payroll/recipients.js";
import { resolveRunScope, resolveDateRangeScope, resolveRecipientScope } from "@/lib/payroll/exportData.js";
import { buildCsvText } from "@/lib/payroll/exportCsv.js";
import { buildPaymentReportPdf } from "@/lib/payroll/exportPdf.js";
import { exportCsvFile, exportPdfFile } from "@/lib/payroll/exportFile.js";
import { hasAcknowledgedExportWarning, acknowledgeExportWarning } from "@/lib/payroll/exportWarning.js";
import { settings } from "@/stores/settings";

const route = useRoute();
const { t } = useI18n();

const acknowledged = ref(hasAcknowledgedExportWarning());
function acknowledge() {
  acknowledgeExportWarning();
  acknowledged.value = true;
}

const runs = ref([]);
const recipients = ref([]);
const scope = ref(route.query.runId ? "run" : route.query.recipientId ? "recipient" : "range");
const runId = ref(route.query.runId || "");
const fromDate = ref("");
const toDate = ref("");
const recipientId = ref(route.query.recipientId || "");
const formatCsv = ref(true);
const formatPdf = ref(true);
const exporting = ref(false);
const exportError = ref("");
const exportResults = ref([]);

const scopeOptions = computed(() => [
  { value: "run", label: t("payroll.exportScopeRun") },
  { value: "range", label: t("payroll.exportScopeRange") },
  { value: "recipient", label: t("payroll.exportScopeRecipient") },
]);

onMounted(async () => {
  runs.value = await listRuns();
  recipients.value = await listRecipients({ includeArchived: true });
  if (!runId.value && runs.value.length) runId.value = runs.value[0].id;
  if (!recipientId.value && recipients.value.length) recipientId.value = recipients.value[0].id;
});

const canExport = computed(() => {
  if (!formatCsv.value && !formatPdf.value) return false;
  if (scope.value === "run") return !!runId.value;
  if (scope.value === "recipient") return !!recipientId.value;
  return true;
});

watch(scope, () => {
  exportError.value = "";
  exportResults.value = [];
});

const CSV_HEADERS = () => [
  t("payroll.colDate"),
  t("payroll.colPeriod"),
  t("payroll.colRecipient"),
  t("payroll.colAddress"),
  t("payroll.colAmountNav"),
  t("payroll.colCurrency"),
  t("payroll.colFiatAmount"),
  t("payroll.colRate"),
  t("payroll.colRateTimestamp"),
  t("payroll.colTxId"),
  t("payroll.colStatus"),
];

const PDF_LABELS = () => ({
  noEmployerLabel: t("payroll.exportNoEmployerLabel"),
  generated: t("payroll.exportGeneratedAt"),
  date: t("payroll.colDate"),
  recipient: t("payroll.colRecipient"),
  amount: t("payroll.colAmountNav"),
  currency: t("payroll.colCurrency"),
  fiatAmount: t("payroll.colFiatAmount"),
  status: t("payroll.colStatus"),
  txId: t("payroll.colTxId"),
  total: t("payroll.total"),
});

async function resolveScope() {
  if (scope.value === "run") return resolveRunScope(runId.value);
  if (scope.value === "recipient") return resolveRecipientScope(recipientId.value);
  return resolveDateRangeScope({ from: fromDate.value || null, to: toDate.value || null });
}

function scopeLabelFor(meta) {
  if (meta.scope === "run") return meta.periodLabel;
  if (meta.scope === "recipient") {
    const r = recipients.value.find((x) => x.id === recipientId.value);
    return r?.label || meta.recipientId;
  }
  return `${meta.from || "…"} → ${meta.to || "…"}`;
}

function filenameFor(ext, meta) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `navio-payroll-${meta.scope}-${stamp}.${ext}`;
}

async function doExport() {
  exporting.value = true;
  exportError.value = "";
  exportResults.value = [];
  try {
    const { rows, meta } = await resolveScope();
    if (!rows.length) {
      exportError.value = t("payroll.exportNoData");
      return;
    }

    if (formatCsv.value) {
      const csvText = buildCsvText(rows, CSV_HEADERS());
      const result = await exportCsvFile(filenameFor("csv", meta), csvText);
      exportResults.value.push(
        result.platform === "native"
          ? t("payroll.exportedNativeShare", { path: result.path })
          : t("payroll.exportedWebDownload", { path: result.path })
      );
    }

    if (formatPdf.value) {
      const pdfMeta = { employerLabel: settings.employerLabel, scopeLabel: scopeLabelFor(meta), generatedAt: Date.now() };
      const pdfBuffer = buildPaymentReportPdf(rows, pdfMeta, PDF_LABELS());
      const result = await exportPdfFile(filenameFor("pdf", meta), pdfBuffer);
      exportResults.value.push(
        result.platform === "native"
          ? t("payroll.exportedNativeShare", { path: result.path })
          : t("payroll.exportedWebDownload", { path: result.path })
      );
    }
  } catch (e) {
    exportError.value = e?.message || t("payroll.exportFailed");
  } finally {
    exporting.value = false;
  }
}
</script>
