<template>
  <div class="bg-gray-50 dark:bg-gh-900 p-5 pb-6 transition-colors duration-300 min-h-full">
    <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-5">
      {{ isEdit ? $t('payroll.editRecipient') : $t('payroll.addRecipient') }}
    </h1>

    <div v-if="loading" class="text-center py-10 text-sm text-gray-400 dark:text-gray-500">
      {{ $t('common.loading') }}
    </div>

    <div v-else class="w-full max-w-md mx-auto flex flex-col gap-4">
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">

        <div class="px-4 pt-4 pb-3">
          <label class="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {{ $t('payroll.label') }}
          </label>
          <input
            v-model="label"
            type="text"
            :placeholder="$t('payroll.labelPlaceholder')"
            class="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors
                   bg-gray-50 dark:bg-gh-700
                   border border-gray-200 dark:border-gh-600
                   text-gray-900 dark:text-white
                   placeholder-gray-400 dark:placeholder-gray-500
                   focus:border-blue-400 dark:focus:border-blue-500"
          />
          <p v-if="touched && !label.trim()" class="text-xs text-red-500 mt-1">{{ $t('payroll.labelRequired') }}</p>
        </div>

        <div class="border-t border-gray-100 dark:border-gh-700 px-4 py-3">
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {{ $t('payroll.address') }}
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
            rows="3"
            v-model="address"
            :placeholder="$t('payroll.addressPlaceholder')"
            class="w-full rounded-xl px-3 py-2.5 text-sm font-mono resize-none outline-none transition-colors
                   bg-gray-50 dark:bg-gh-700
                   border border-gray-200 dark:border-gh-600
                   text-gray-900 dark:text-white
                   placeholder-gray-400 dark:placeholder-gray-500
                   focus:border-blue-400 dark:focus:border-blue-500"
          />
          <p v-if="touched && address.trim() && !addressValid" class="text-xs text-red-500 mt-1">{{ $t('payroll.invalidAddress') }}</p>
        </div>

        <div class="border-t border-gray-100 dark:border-gh-700 px-4 py-3">
          <label class="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {{ $t('payroll.defaultAmount') }}
          </label>
          <input
            v-model.number="defaultAmount"
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
          <label class="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {{ $t('payroll.currency') }}
          </label>
          <select
            v-model="currency"
            class="w-full px-3 py-2 rounded-lg text-sm
                   bg-gray-100 dark:bg-gh-700
                   text-gray-900 dark:text-white
                   border border-gray-200 dark:border-gh-600
                   hover:bg-gray-200 dark:hover:bg-gh-600
                   transition-colors outline-none cursor-pointer"
          >
            <option value="">{{ $t('payroll.none') }}</option>
            <option v-for="opt in FIAT_CURRENCIES" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>

        <div class="border-t border-gray-100 dark:border-gh-700 px-4 py-3">
          <label class="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {{ $t('payroll.groupTag') }}
          </label>
          <input
            v-model="groupTag"
            type="text"
            :placeholder="$t('payroll.groupTagPlaceholder')"
            class="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors
                   bg-gray-50 dark:bg-gh-700
                   border border-gray-200 dark:border-gh-600
                   text-gray-900 dark:text-white
                   placeholder-gray-400 dark:placeholder-gray-500
                   focus:border-blue-400 dark:focus:border-blue-500"
          />
        </div>

      </div>

      <p v-if="saveError" class="text-sm text-red-500 text-center">{{ saveError }}</p>

      <div class="flex gap-2">
        <button
          @click="router.back()"
          class="flex-1 py-3 rounded-xl text-sm font-medium transition-colors
                 bg-gray-100 hover:bg-gray-200 text-gray-700
                 dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          :disabled="saving"
          @click="save"
          class="flex-1 py-3 rounded-xl text-sm font-semibold transition-colors
                 bg-blue-600 hover:bg-blue-700 text-white
                 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {{ saving ? $t('common.pleaseWait') : $t('common.save') }}
        </button>
      </div>

      <button
        v-if="isEdit"
        @click="toggleArchived"
        class="w-full py-2.5 rounded-xl text-sm font-medium transition-colors
               bg-white hover:bg-gray-50 text-gray-600 border border-gray-200
               dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300 dark:border-gh-700"
      >
        {{ archived ? $t('payroll.restore') : $t('payroll.archive') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { BarcodeScanner, BarcodeFormat } from "@capacitor-mlkit/barcode-scanning";
import { QrCode, Loader2 } from "lucide-vue-next";
import { FIAT_CURRENCIES } from "@/stores/navPrice";
import { getRecipient, saveRecipient, setRecipientArchived } from "@/lib/payroll/recipients.js";
import { validateNavioAddress } from "@/lib/payroll/validation.js";
import { useI18n } from "vue-i18n";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const isEdit = computed(() => route.params.id && route.params.id !== "new");
const recipientId = computed(() => (isEdit.value ? route.params.id : null));

const loading = ref(isEdit.value);
const label = ref("");
const address = ref("");
const defaultAmount = ref(null);
const currency = ref("");
const groupTag = ref("");
const archived = ref(false);

const touched = ref(false);
const saving = ref(false);
const saveError = ref("");
const isScanning = ref(false);

const addressValid = computed(() => validateNavioAddress(address.value).valid);

onMounted(async () => {
  if (!isEdit.value) return;
  const record = await getRecipient(recipientId.value);
  if (!record) {
    router.replace("/payroll/recipients");
    return;
  }
  label.value = record.label;
  address.value = record.address;
  defaultAmount.value = record.defaultAmount;
  currency.value = record.currency || "";
  groupTag.value = record.groupTag || "";
  archived.value = record.archived;
  loading.value = false;
});

async function scanQR() {
  try {
    isScanning.value = true;
    const { camera } = await BarcodeScanner.requestPermissions();
    if (camera !== "granted" && camera !== "limited") return;
    const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
    if (barcodes.length > 0) {
      let raw = barcodes[0].rawValue ?? barcodes[0].displayValue ?? "";
      if (raw.toLowerCase().startsWith("nav:")) raw = raw.slice(4).split("?")[0].trim();
      address.value = raw;
      touched.value = true;
    }
  } catch (err) {
    console.error("QR scan error:", err);
  } finally {
    isScanning.value = false;
  }
}

async function save() {
  touched.value = true;
  saveError.value = "";
  if (!label.value.trim() || !addressValid.value) return;

  saving.value = true;
  try {
    await saveRecipient({
      id: recipientId.value,
      label: label.value,
      address: address.value,
      defaultAmount: defaultAmount.value,
      currency: currency.value,
      groupTag: groupTag.value,
      archived: archived.value,
    });
    router.replace("/payroll/recipients");
  } catch (e) {
    saveError.value = e?.message === "invalid_address" ? t("payroll.invalidAddress") : t("payroll.labelRequired");
  } finally {
    saving.value = false;
  }
}

async function toggleArchived() {
  if (!recipientId.value) return;
  archived.value = !archived.value;
  await setRecipientArchived(recipientId.value, archived.value);
  router.replace("/payroll/recipients");
}
</script>
