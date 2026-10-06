<template>
  <div class="bg-gray-50 dark:bg-gh-900 p-5 pb-6 transition-colors duration-300 min-h-full">
    <div class="flex items-center gap-3 mb-5">
      <button @click="router.back()" class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400">
        <ChevronLeft class="w-5 h-5" />
      </button>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">
        {{ isEdit ? $t('chat.editContact') : $t('chat.addContact') }}
      </h1>
    </div>

    <div v-if="loading" class="text-center py-10 text-sm text-gray-400 dark:text-gray-500">
      {{ $t('common.loading') }}
    </div>

    <div v-else class="w-full max-w-md mx-auto flex flex-col gap-4">
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">

        <div class="px-4 pt-4 pb-3 grid grid-cols-2 gap-3">
          <div>
            <label class="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {{ $t('chat.firstName') }}
            </label>
            <input v-model="firstName" type="text" class="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors
                   bg-gray-50 dark:bg-gh-700 border border-gray-200 dark:border-gh-600
                   text-gray-900 dark:text-white focus:border-blue-400 dark:focus:border-blue-500" />
          </div>
          <div>
            <label class="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {{ $t('chat.lastName') }}
            </label>
            <input v-model="lastName" type="text" class="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors
                   bg-gray-50 dark:bg-gh-700 border border-gray-200 dark:border-gh-600
                   text-gray-900 dark:text-white focus:border-blue-400 dark:focus:border-blue-500" />
          </div>
          <p v-if="touched && !firstName.trim() && !lastName.trim()" class="col-span-2 text-xs text-red-500">
            {{ $t('chat.nameRequired') }}
          </p>
        </div>

        <div class="border-t border-gray-100 dark:border-gh-700 px-4 py-3">
          <label class="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {{ $t('chat.email') }}
          </label>
          <input v-model="email" type="email" class="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors
                 bg-gray-50 dark:bg-gh-700 border border-gray-200 dark:border-gh-600
                 text-gray-900 dark:text-white focus:border-blue-400 dark:focus:border-blue-500" />
        </div>

        <div class="border-t border-gray-100 dark:border-gh-700 px-4 py-3">
          <label class="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {{ $t('chat.phone') }}
          </label>
          <input v-model="phone" type="tel" class="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors
                 bg-gray-50 dark:bg-gh-700 border border-gray-200 dark:border-gh-600
                 text-gray-900 dark:text-white focus:border-blue-400 dark:focus:border-blue-500" />
        </div>

        <div class="border-t border-gray-100 dark:border-gh-700 px-4 py-3">
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {{ $t('chat.p2pAddress') }}
            </label>
            <button
              @click="scanQR('p2p')"
              :disabled="isScanning"
              class="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition
                     text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20
                     disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Loader2 v-if="isScanning" class="w-3.5 h-3.5 animate-spin" />
              <QrCode v-else class="w-3.5 h-3.5" />
              {{ $t('wallet.scanQR') }}
            </button>
          </div>
          <textarea
            rows="2"
            v-model="p2pAddress"
            placeholder="navid1… / navmsg1…"
            class="w-full rounded-xl px-3 py-2.5 text-sm font-mono resize-none outline-none transition-colors
                   bg-gray-50 dark:bg-gh-700 border border-gray-200 dark:border-gh-600
                   text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500
                   focus:border-blue-400 dark:focus:border-blue-500"
          />
          <p v-if="touched && p2pAddress.trim() && !p2pAddressValid" class="text-xs text-red-500 mt-1">{{ $t('chat.invalidP2pAddress') }}</p>
        </div>

        <div class="border-t border-gray-100 dark:border-gh-700 px-4 py-3">
          <div class="flex items-center justify-between mb-1.5">
            <label class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {{ $t('chat.receiveAddress') }}
            </label>
            <button
              @click="scanQR('receive')"
              :disabled="isScanning"
              class="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition
                     text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20
                     disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Loader2 v-if="isScanning" class="w-3.5 h-3.5 animate-spin" />
              <QrCode v-else class="w-3.5 h-3.5" />
              {{ $t('wallet.scanQR') }}
            </button>
          </div>
          <textarea
            rows="2"
            v-model="receiveAddress"
            placeholder="nav1…"
            class="w-full rounded-xl px-3 py-2.5 text-sm font-mono resize-none outline-none transition-colors
                   bg-gray-50 dark:bg-gh-700 border border-gray-200 dark:border-gh-600
                   text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500
                   focus:border-blue-400 dark:focus:border-blue-500"
          />
          <p v-if="touched && receiveAddress.trim() && !receiveAddressValid" class="text-xs text-red-500 mt-1">{{ $t('chat.invalidReceiveAddress') }}</p>
        </div>

        <div class="border-t border-gray-100 dark:border-gh-700 px-4 py-3">
          <label class="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {{ $t('chat.note') }}
          </label>
          <textarea
            rows="2"
            v-model="note"
            class="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none transition-colors
                   bg-gray-50 dark:bg-gh-700 border border-gray-200 dark:border-gh-600
                   text-gray-900 dark:text-white focus:border-blue-400 dark:focus:border-blue-500"
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
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import { BarcodeScanner, BarcodeFormat } from "@capacitor-mlkit/barcode-scanning";
import { QrCode, Loader2, ChevronLeft } from "lucide-vue-next";
import { getContact, saveContact } from "@/lib/contacts/contacts.js";
import { validateNavioAddress, validateP2pAddress } from "@/lib/contacts/validation.js";
import { useI18n } from "vue-i18n";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const isEdit = computed(() => !!route.params.id);
const contactId = computed(() => route.params.id || null);

const loading = ref(isEdit.value);
const firstName = ref("");
const lastName = ref("");
const email = ref("");
const phone = ref("");
const receiveAddress = ref("");
const p2pAddress = ref("");
const note = ref("");

const touched = ref(false);
const saving = ref(false);
const saveError = ref("");
const isScanning = ref(false);
const originalP2pAddress = ref("");

const receiveAddressValid = computed(() => validateNavioAddress(receiveAddress.value).valid);
const p2pAddressValid = ref(true);
watchEffect(async () => {
  p2pAddressValid.value = (await validateP2pAddress(p2pAddress.value)).valid;
});

onMounted(async () => {
  if (!isEdit.value) return;
  const record = await getContact(contactId.value);
  if (!record) {
    router.replace("/chat");
    return;
  }
  firstName.value = record.firstName || "";
  lastName.value = record.lastName || "";
  email.value = record.email || "";
  phone.value = record.phone || "";
  receiveAddress.value = record.receiveAddress || "";
  p2pAddress.value = record.p2pAddress || "";
  note.value = record.note || "";
  originalP2pAddress.value = record.p2pAddress || "";
  loading.value = false;
});

async function scanQR(target) {
  try {
    isScanning.value = true;
    const { camera } = await BarcodeScanner.requestPermissions();
    if (camera !== "granted" && camera !== "limited") return;
    const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
    if (barcodes.length > 0) {
      let raw = barcodes[0].rawValue ?? barcodes[0].displayValue ?? "";
      if (raw.toLowerCase().startsWith("nav:")) raw = raw.slice(4).split("?")[0].trim();
      if (target === "p2p") p2pAddress.value = raw;
      else receiveAddress.value = raw;
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
  if (!firstName.value.trim() && !lastName.value.trim()) return;
  if (receiveAddress.value.trim() && !receiveAddressValid.value) return;
  if (p2pAddress.value.trim() && !p2pAddressValid.value) return;

  saving.value = true;
  try {
    const saved = await saveContact({
      id: contactId.value,
      firstName: firstName.value,
      lastName: lastName.value,
      email: email.value,
      phone: phone.value,
      receiveAddress: receiveAddress.value,
      p2pAddress: p2pAddress.value,
      note: note.value,
    });
    // New or changed p2p address: let the other side know, so we show up
    // in their contact list too (see chat.myAddress's own note in client.js).
    if (saved.p2pAddress && saved.p2pAddress !== originalP2pAddress.value) {
      const { sendContactRequest } = await import("@/lib/chat/client.js");
      sendContactRequest(saved.p2pAddress).catch((err) => console.warn("Contact request not sent:", err));
    }
    router.replace("/chat");
  } catch (e) {
    const messages = {
      name_required: t("chat.nameRequired"),
      invalid_receive_address: t("chat.invalidReceiveAddress"),
      invalid_p2p_address: t("chat.invalidP2pAddress"),
    };
    saveError.value = messages[e?.message] || e?.message;
  } finally {
    saving.value = false;
  }
}
</script>
