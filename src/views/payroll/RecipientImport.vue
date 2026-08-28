<template>
  <div class="bg-gray-50 dark:bg-gh-900 p-5 pb-6 transition-colors duration-300 min-h-full">
    <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-5">{{ $t('payroll.importCsv') }}</h1>

    <div class="w-full max-w-md mx-auto flex flex-col gap-4">

      <!-- Step 1: input -->
      <template v-if="step === 'input'">
        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4 space-y-3">
          <label
            class="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed
                   border-gray-200 dark:border-gh-600 py-8 cursor-pointer
                   hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
          >
            <FileUp class="w-6 h-6 text-gray-400" />
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ $t('payroll.csvChooseFile') }}</span>
            <input type="file" accept=".csv,text/csv" class="hidden" @change="onFileChange" />
          </label>

          <p class="text-xs text-gray-400 dark:text-gray-500 text-center">{{ $t('payroll.csvOrPaste') }}</p>

          <textarea
            v-model="csvText"
            rows="6"
            placeholder="label,address,amount,currency,group"
            class="w-full rounded-xl px-3 py-2.5 text-xs font-mono resize-none outline-none transition-colors
                   bg-gray-50 dark:bg-gh-700
                   border border-gray-200 dark:border-gh-600
                   text-gray-900 dark:text-white
                   placeholder-gray-400 dark:placeholder-gray-500
                   focus:border-blue-400 dark:focus:border-blue-500"
          />
        </div>

        <p v-if="parseError" class="text-sm text-red-500 text-center">{{ parseError }}</p>

        <div class="flex gap-2">
          <button @click="router.back()" class="flex-1 py-3 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300 transition-colors">
            {{ $t('common.cancel') }}
          </button>
          <button @click="goToMapping" class="flex-1 py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors">
            {{ $t('common.next') }}
          </button>
        </div>
      </template>

      <!-- Step 2: column mapping -->
      <template v-else-if="step === 'mapping'">
        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
          <p class="px-4 pt-4 pb-2 text-xs text-gray-400 dark:text-gray-500">{{ $t('payroll.csvMapColumnsDesc') }}</p>
          <div v-for="f in mappableFields" :key="f.key" class="border-t border-gray-100 dark:border-gh-700 px-4 py-3 flex items-center justify-between gap-3">
            <label class="text-sm text-gray-700 dark:text-gray-300">
              {{ f.label }}<span v-if="f.required" class="text-red-500">*</span>
            </label>
            <select
              v-model="columnMap[f.key]"
              class="px-2 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gh-700 text-gray-900 dark:text-white
                     border border-gray-200 dark:border-gh-600 outline-none cursor-pointer"
            >
              <option :value="-1">{{ $t('payroll.csvNone') }}</option>
              <option v-for="(h, i) in headers" :key="i" :value="i">{{ h }}</option>
            </select>
          </div>
        </div>

        <div class="flex gap-2">
          <button @click="step = 'input'" class="flex-1 py-3 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300 transition-colors">
            {{ $t('common.back') }}
          </button>
          <button
            :disabled="columnMap.label === -1 || columnMap.address === -1"
            @click="goToPreview"
            class="flex-1 py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {{ $t('common.next') }}
          </button>
        </div>
      </template>

      <!-- Step 3: preview -->
      <template v-else-if="step === 'preview'">
        <p class="text-xs text-gray-500 dark:text-gray-400 -mt-1">
          {{ $t('payroll.csvPreviewSummary', { valid: validCount, total: previewRows.length }) }}
        </p>

        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 divide-y divide-gray-100 dark:divide-gh-700 max-h-[50vh] overflow-y-auto">
          <div v-for="row in previewRows" :key="row._key" class="px-4 py-3 flex items-start gap-3">
            <input type="checkbox" v-model="row.include" class="mt-2 rounded accent-blue-600 shrink-0" />
            <div class="min-w-0 flex-1 space-y-1.5">
              <input
                v-model="row.label"
                type="text"
                :placeholder="$t('payroll.label')"
                class="w-full text-sm px-2 py-1 rounded-lg bg-gray-50 dark:bg-gh-700 border border-gray-200 dark:border-gh-600 text-gray-900 dark:text-white outline-none"
              />
              <input
                v-model="row.address"
                type="text"
                :placeholder="$t('payroll.address')"
                class="w-full text-xs font-mono px-2 py-1 rounded-lg bg-gray-50 dark:bg-gh-700 border border-gray-200 dark:border-gh-600 text-gray-900 dark:text-white outline-none"
              />
              <p v-if="rowError(row)" class="text-[11px] text-red-500">{{ rowError(row) }}</p>
              <p v-else class="text-[11px] text-green-600 dark:text-green-400">{{ $t('payroll.csvRowValid') }}</p>
            </div>
          </div>
        </div>

        <div class="flex gap-2">
          <button @click="step = 'mapping'" class="flex-1 py-3 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300 transition-colors">
            {{ $t('common.back') }}
          </button>
          <button
            :disabled="importing || includedCount === 0"
            @click="commitImport"
            class="flex-1 py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {{ importing ? $t('common.pleaseWait') : $t('payroll.csvImportAction', { n: includedCount }) }}
          </button>
        </div>
      </template>

      <!-- Step 4: done -->
      <template v-else-if="step === 'done'">
        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-6 text-center space-y-2">
          <Check class="w-10 h-10 mx-auto text-green-500" />
          <p class="text-sm text-gray-700 dark:text-gray-300">{{ $t('payroll.csvImportedCount', { n: importedCount }) }}</p>
          <p v-if="skippedCount > 0" class="text-xs text-gray-400 dark:text-gray-500">{{ $t('payroll.csvSkippedCount', { n: skippedCount }) }}</p>
        </div>
        <button @click="router.replace('/payroll/recipients')" class="w-full py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors">
          {{ $t('payroll.csvDone') }}
        </button>
      </template>

    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { FileUp, Check } from "lucide-vue-next";
import { parseCsv } from "@/lib/payroll/csv.js";
import { saveRecipient } from "@/lib/payroll/recipients.js";
import { validateNavioAddress } from "@/lib/payroll/validation.js";

const router = useRouter();
const { t } = useI18n();

const step = ref("input");
const csvText = ref("");
const parseError = ref("");
const headers = ref([]);
const dataRows = ref([]);

const mappableFields = computed(() => [
  { key: "label", label: t("payroll.label"), required: true },
  { key: "address", label: t("payroll.address"), required: true },
  { key: "defaultAmount", label: t("payroll.defaultAmount"), required: false },
  { key: "currency", label: t("payroll.currency"), required: false },
  { key: "groupTag", label: t("payroll.groupTag"), required: false },
]);

const columnMap = ref({ label: -1, address: -1, defaultAmount: -1, currency: -1, groupTag: -1 });

function guessColumn(aliases) {
  return headers.value.findIndex((h) => aliases.includes(h.trim().toLowerCase()));
}

function onFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    csvText.value = String(reader.result || "");
  };
  reader.readAsText(file);
}

function goToMapping() {
  parseError.value = "";
  const { headers: h, rows } = parseCsv(csvText.value);
  if (h.length === 0 || rows.length === 0) {
    parseError.value = t("payroll.csvParseError");
    return;
  }
  headers.value = h;
  dataRows.value = rows;
  columnMap.value = {
    label: guessColumn(["label", "name", "recipient"]),
    address: guessColumn(["address", "navio address", "wallet", "wallet address"]),
    defaultAmount: guessColumn(["amount", "default amount", "salary"]),
    currency: guessColumn(["currency", "fiat"]),
    groupTag: guessColumn(["group", "tag", "group tag", "team"]),
  };
  step.value = "mapping";
}

const previewRows = ref([]);

function goToPreview() {
  let key = 0;
  previewRows.value = dataRows.value.map((cols) => {
    const get = (idx) => (idx >= 0 ? (cols[idx] ?? "").trim() : "");
    const label = get(columnMap.value.label);
    const address = get(columnMap.value.address);
    const amountRaw = get(columnMap.value.defaultAmount);
    return {
      _key: key++,
      label,
      address,
      defaultAmount: amountRaw === "" ? null : Number(amountRaw),
      currency: get(columnMap.value.currency) || null,
      groupTag: get(columnMap.value.groupTag) || null,
      include: !!label && validateNavioAddress(address).valid,
    };
  });
  step.value = "preview";
}

function rowError(row) {
  if (!row.label.trim()) return t("payroll.labelRequired");
  if (!validateNavioAddress(row.address).valid) return t("payroll.invalidAddress");
  return null;
}

const validCount = computed(() => previewRows.value.filter((r) => !rowError(r)).length);
const includedCount = computed(() => previewRows.value.filter((r) => r.include && !rowError(r)).length);

const importing = ref(false);
const importedCount = ref(0);
const skippedCount = ref(0);

async function commitImport() {
  importing.value = true;
  let imported = 0;
  for (const row of previewRows.value) {
    if (!row.include || rowError(row)) continue;
    try {
      await saveRecipient({
        label: row.label,
        address: row.address,
        defaultAmount: row.defaultAmount,
        currency: row.currency,
        groupTag: row.groupTag,
      });
      imported++;
    } catch {
      // left unimported; reflected in the total-vs-imported count shown next
    }
  }
  importedCount.value = imported;
  skippedCount.value = previewRows.value.length - imported;
  importing.value = false;
  step.value = "done";
}
</script>
