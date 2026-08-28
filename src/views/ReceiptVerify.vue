<template>
  <div class="bg-gray-50 dark:bg-gh-900 p-5 pb-6 transition-colors duration-300 min-h-full">
    <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-1">{{ $t('receiptVerify.title') }}</h1>
    <p class="text-xs text-gray-400 dark:text-gray-500 mb-5 leading-relaxed">{{ $t('receiptVerify.intro') }}</p>

    <div class="w-full max-w-md mx-auto flex flex-col gap-4">

      <template v-if="!result">
        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4 space-y-3">
          <label class="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 dark:border-gh-600 py-6 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
            <FileUp class="w-6 h-6 text-gray-400" />
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ $t('receiptVerify.chooseFile') }}</span>
            <input type="file" accept=".json,application/json" class="hidden" @change="onFileChange" />
          </label>

          <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {{ $t('receiptVerify.pasteLabel') }}
          </label>
          <textarea
            v-model="pasted"
            rows="6"
            :placeholder="$t('receiptVerify.pastePlaceholder')"
            class="w-full px-3 py-2 rounded-lg text-xs font-mono bg-gray-100 dark:bg-gh-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gh-600"
          />

          <p v-if="parseError" class="text-xs text-red-500">{{ parseError }}</p>

          <button
            :disabled="!pasted.trim() || verifying"
            @click="verifyPasted"
            class="w-full py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40"
          >
            {{ verifying ? $t('common.pleaseWait') : $t('receiptVerify.verifyAction') }}
          </button>
        </div>
      </template>

      <template v-else>
        <div
          class="rounded-2xl border p-4 flex items-start gap-3"
          :class="result.verdict.valid
            ? 'border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-900/20'
            : 'border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20'"
        >
          <component :is="result.verdict.valid ? ShieldCheck : ShieldAlert" class="w-5 h-5 shrink-0 mt-0.5"
            :class="result.verdict.valid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'" />
          <div class="min-w-0">
            <p class="text-sm font-semibold" :class="result.verdict.valid ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'">
              {{ result.verdict.valid ? $t('receiptVerify.verdictValidTitle') : $t('receiptVerify.verdictInvalidTitle') }}
            </p>
            <p class="text-xs mt-1 leading-relaxed" :class="result.verdict.valid ? 'text-green-700/80 dark:text-green-300/80' : 'text-red-700/80 dark:text-red-300/80'">
              {{ result.verdict.valid ? $t('receiptVerify.verdictValidDesc') : $t('receiptVerify.verdictInvalidDesc') }}
            </p>
          </div>
        </div>

        <div v-if="result.verdict.valid" class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4 space-y-2">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{{ $t('receiptVerify.fingerprintLabel') }}</p>
          <p class="text-sm font-mono text-gray-900 dark:text-white break-all">{{ result.fingerprint }}</p>
          <p class="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">{{ $t('receiptVerify.fingerprintNote') }}</p>

          <div v-if="trustStatus" class="mt-2 rounded-xl px-3 py-2.5"
            :class="trustStatus === 'key_changed' ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50' : 'bg-gray-50 dark:bg-gh-700/50'">
            <p class="text-xs leading-relaxed"
              :class="trustStatus === 'key_changed' ? 'text-amber-700 dark:text-amber-300' : 'text-gray-500 dark:text-gray-400'">
              <template v-if="trustStatus === 'trusted'">{{ $t('receiptVerify.trustTrusted', { label: receipt.employerLabel }) }}</template>
              <template v-else-if="trustStatus === 'key_changed'">{{ $t('receiptVerify.trustChanged', { label: receipt.employerLabel }) }}</template>
              <template v-else>{{ $t('receiptVerify.trustUnknown') }}</template>
            </p>
            <button
              v-if="trustStatus !== 'trusted'"
              @click="onTrustKey"
              :disabled="trusting"
              class="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40"
            >
              {{ trustStatus === 'key_changed' ? $t('receiptVerify.trustUpdateButton') : $t('receiptVerify.trustButton') }}
            </button>
            <p v-if="trustSaved" class="mt-1 text-xs text-green-600 dark:text-green-400">{{ $t('receiptVerify.trustSaved') }}</p>
            <p v-if="trustError" class="mt-1 text-xs text-red-500">{{ trustError }}</p>
          </div>
          <p v-else-if="trustCheckUnavailable" class="text-xs text-gray-400 dark:text-gray-500">{{ $t('receiptVerify.trustCheckUnavailable') }}</p>
        </div>

        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 divide-y divide-gray-100 dark:divide-gh-700">
          <p class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{{ $t('receiptVerify.fieldsTitle') }}</p>
          <div v-for="row in fieldRows" :key="row.key" class="px-4 py-2.5 flex items-start justify-between gap-3">
            <span class="text-xs text-gray-400 dark:text-gray-500 shrink-0">{{ row.label }}</span>
            <span class="text-xs text-gray-900 dark:text-white text-right break-all">{{ row.value }}</span>
          </div>
        </div>

        <button @click="reset" class="w-full py-3 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300 transition-colors">
          {{ $t('receiptVerify.verifyAnother') }}
        </button>
      </template>

    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { FileUp, ShieldCheck, ShieldAlert } from "lucide-vue-next";
import { verifyReceipt, publicKeyFingerprint } from "@/lib/payroll/receiptCrypto.js";
import { checkIssuer, trustIssuerKey } from "@/lib/payroll/issuerKeys.js";

const { t } = useI18n();

const pasted = ref("");
const parseError = ref("");
const verifying = ref(false);
const result = ref(null);
const receipt = ref(null);
const trustStatus = ref(null);
const trustCheckUnavailable = ref(false);
const trusting = ref(false);
const trustSaved = ref(false);
const trustError = ref("");

function onFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    pasted.value = String(reader.result || "");
    verifyPasted();
  };
  reader.readAsText(file);
}

async function verifyPasted() {
  parseError.value = "";
  let parsed;
  try {
    parsed = JSON.parse(pasted.value);
  } catch {
    parseError.value = t("receiptVerify.invalidJson");
    return;
  }

  verifying.value = true;
  try {
    receipt.value = parsed;
    const verdict = await verifyReceipt(parsed);
    let fingerprint = "";
    if (verdict.valid) {
      fingerprint = await publicKeyFingerprint(parsed.employerPublicKey);
      trustCheckUnavailable.value = false;
      try {
        const check = await checkIssuer({ employerLabel: parsed.employerLabel, employerPublicKey: parsed.employerPublicKey });
        trustStatus.value = check.status;
      } catch {
        // No wallet loaded to derive a trust-store key from — the signature
        // verdict above still stands on its own; only the "have I seen this
        // issuer before" check needs a wallet.
        trustStatus.value = null;
        trustCheckUnavailable.value = true;
      }
    }
    result.value = { verdict, fingerprint };
  } finally {
    verifying.value = false;
  }
}

async function onTrustKey() {
  trusting.value = true;
  trustError.value = "";
  try {
    await trustIssuerKey({ employerLabel: receipt.value.employerLabel, employerPublicKey: receipt.value.employerPublicKey });
    trustStatus.value = "trusted";
    trustSaved.value = true;
  } catch (e) {
    // Most likely cause: no wallet loaded/unlocked to derive the trust
    // store's key from (see issuerKeys.js/session.js) — same situation
    // verifyPasted() already handles for the initial check, just reached
    // from a different button.
    trustError.value = e?.message || t("receiptVerify.trustFailed");
  } finally {
    trusting.value = false;
  }
}

function reset() {
  pasted.value = "";
  parseError.value = "";
  result.value = null;
  receipt.value = null;
  trustStatus.value = null;
  trustCheckUnavailable.value = false;
  trustSaved.value = false;
  trustError.value = "";
}

function formatAmountNav(amountSat) {
  try {
    return (Number(BigInt(amountSat)) / 1e8).toLocaleString(undefined, { maximumFractionDigits: 8 });
  } catch {
    return String(amountSat ?? "");
  }
}

const fieldRows = computed(() => {
  const r = receipt.value || {};
  const rows = [
    ["employerLabel", t("receiptVerify.fieldEmployer"), r.employerLabel],
    ["recipientLabel", t("receiptVerify.fieldRecipient"), r.recipientLabel],
    ["recipientAddress", t("receiptVerify.fieldAddress"), r.recipientAddress],
    ["amount", t("receiptVerify.fieldAmount"), `${formatAmountNav(r.amountSat)} NAV`],
    ["fiatAmount", t("receiptVerify.fieldFiatAmount"), r.fiatAmount != null && r.currency ? `${Number(r.fiatAmount).toFixed(2)} ${r.currency}` : "—"],
    ["fiatRate", t("receiptVerify.fieldRate"), r.fiatRate != null ? Number(r.fiatRate).toFixed(8) : "—"],
    ["fiatRateTimestamp", t("receiptVerify.fieldRateTime"), r.fiatRateTimestamp ? new Date(r.fiatRateTimestamp).toLocaleString() : "—"],
    ["periodLabel", t("receiptVerify.fieldPeriod"), r.periodLabel],
    ["paymentDate", t("receiptVerify.fieldPaymentDate"), r.paymentDate],
    ["transactionId", t("receiptVerify.fieldTxId"), r.transactionId],
    ["issuedAt", t("receiptVerify.fieldIssuedAt"), r.issuedAt ? new Date(r.issuedAt).toLocaleString() : "—"],
    ["formatVersion", t("receiptVerify.fieldFormatVersion"), r.formatVersion],
  ];
  return rows.map(([key, label, value]) => ({ key, label, value: value ?? "—" }));
});
</script>
