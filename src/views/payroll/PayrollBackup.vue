<template>
  <div class="bg-gray-50 dark:bg-gh-900 p-5 pb-6 transition-colors duration-300 min-h-full">
    <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-5">{{ $t('payroll.backupTitle') }}</h1>

    <div class="w-full max-w-md mx-auto flex flex-col gap-4">

      <!-- Export -->
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4 space-y-3">
        <div class="flex items-center gap-2">
          <ShieldCheck class="w-4 h-4 text-gray-400 shrink-0" />
          <p class="text-sm text-gray-700 dark:text-gray-300">
            {{ lastBackupAt ? $t('payroll.lastBackup', { time: formattedLastBackup }) : $t('payroll.neverBackedUp') }}
          </p>
        </div>
        <p class="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">{{ $t('payroll.backupEncryptedNote') }}</p>
        <button @click="doExport" :disabled="exporting"
          class="w-full py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40">
          {{ exporting ? $t('common.pleaseWait') : $t('payroll.exportBackup') }}
        </button>
        <p v-if="exportResult" class="text-xs text-green-600 dark:text-green-400 text-center">
          {{ exportResult.platform === 'native' ? $t('payroll.exportedNative', { path: exportResult.path }) : $t('payroll.exportedWeb', { path: exportResult.path }) }}
        </p>
        <p v-if="exportError" class="text-xs text-red-500 text-center">{{ exportError }}</p>
      </div>

      <!-- Import -->
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4 space-y-3">
        <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ $t('payroll.importBackup') }}</p>

        <label v-if="!analysis" class="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 dark:border-gh-600 py-6 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
          <FileUp class="w-6 h-6 text-gray-400" />
          <span class="text-sm text-gray-500 dark:text-gray-400">{{ $t('payroll.chooseBackupFile') }}</span>
          <input type="file" accept=".json,application/json" class="hidden" @change="onFileChange" />
        </label>

        <p v-if="importError" class="text-xs text-red-500">{{ importError }}</p>

        <template v-if="analysis">
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ $t('payroll.importSummary', { add: analysis.toAdd.length, unchanged: analysis.unchanged, conflicts: analysis.conflicts.length }) }}
          </p>
          <p v-if="analysis.incompatible" class="text-xs text-amber-600 dark:text-amber-400">
            {{ $t('payroll.importIncompatible', { n: analysis.incompatible }) }}
          </p>

          <div v-if="analysis.conflicts.length" class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{{ $t('payroll.conflictsFound') }}</p>
            <div v-for="(c, i) in conflictViews" :key="i" class="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 px-3 py-2.5 flex items-start gap-2">
              <input type="checkbox" v-model="c.replace" class="mt-0.5 rounded accent-blue-600 shrink-0" />
              <div class="min-w-0">
                <p class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ c.label }}</p>
                <p class="text-[11px] text-gray-400 dark:text-gray-500">{{ $t('payroll.conflictNewer') }}</p>
              </div>
            </div>
          </div>

          <div class="flex gap-2">
            <button @click="analysis = null" class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300 transition-colors">
              {{ $t('common.cancel') }}
            </button>
            <button @click="applyImport" :disabled="importing"
              class="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40">
              {{ importing ? $t('common.pleaseWait') : $t('payroll.applyImport') }}
            </button>
          </div>
        </template>

        <p v-if="importResult" class="text-xs text-green-600 dark:text-green-400 text-center">
          {{ $t('payroll.importDone', { added: importResult.added, replaced: importResult.replaced }) }}
        </p>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { FileUp, ShieldCheck } from "lucide-vue-next";
import {
  getLastBackupAt,
  exportBackup,
  parseBackupFile,
  analyzeImport,
  commitImport,
} from "@/lib/payroll/backup.js";
import { getPayrollKey } from "@/lib/payroll/session.js";
import { decryptRecord } from "@/lib/payroll/crypto.js";

const { t } = useI18n();

const lastBackupAt = ref(null);
const formattedLastBackup = computed(() => (lastBackupAt.value ? new Date(lastBackupAt.value).toLocaleString() : ""));

onMounted(() => {
  lastBackupAt.value = getLastBackupAt();
});

const exporting = ref(false);
const exportResult = ref(null);
const exportError = ref("");

async function doExport() {
  exporting.value = true;
  exportError.value = "";
  exportResult.value = null;
  try {
    exportResult.value = await exportBackup();
    lastBackupAt.value = getLastBackupAt();
  } catch (e) {
    exportError.value = e?.message || "Export failed";
  } finally {
    exporting.value = false;
  }
}

const importError = ref("");
const analysis = ref(null);
const conflictViews = ref([]);
const importing = ref(false);
const importResult = ref(null);

async function friendlyLabel(type, row) {
  try {
    const key = await getPayrollKey();
    const record = await decryptRecord(key, row.data);
    if (type === "recipients") return `${t("payroll.recipients")}: ${record.label}`;
    if (type === "payment_runs") return `${t("payroll.title")}: ${record.periodLabel}`;
    return `${t("payroll.label")}: ${record.label}`;
  } catch {
    return `${type} (${row.id.slice(0, 8)})`;
  }
}

function onFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  importError.value = "";
  importResult.value = null;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const payload = parseBackupFile(String(reader.result || ""));
      const result = await analyzeImport(payload);
      analysis.value = result;
      conflictViews.value = await Promise.all(
        result.conflicts.map(async (c) => ({ ...c, replace: false, label: await friendlyLabel(c.type, c.row) }))
      );
    } catch (err) {
      importError.value = err?.message === "invalid_backup_file" ? t("payroll.invalidBackupFile") : (err?.message || "Import failed");
    }
  };
  reader.readAsText(file);
}

async function applyImport() {
  if (!analysis.value) return;
  importing.value = true;
  try {
    const resolvedConflicts = conflictViews.value.filter((c) => c.replace).map((c) => ({ type: c.type, row: c.row }));
    importResult.value = await commitImport({ toAdd: analysis.value.toAdd, resolvedConflicts });
    analysis.value = null;
    conflictViews.value = [];
  } catch (e) {
    importError.value = e?.message || "Import failed";
  } finally {
    importing.value = false;
  }
}
</script>
