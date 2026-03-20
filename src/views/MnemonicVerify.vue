<template>
  <div class="p-6 space-y-4 bg-white text-gray-900 dark:bg-gh-900 dark:text-white min-h-screen transition-colors duration-300">
    <h2 class="font-bold text-xl">{{ $t('wizard.verifyYourSeedPhrase') }}</h2>
    <textarea
    v-model="input"
    class="w-full border border-gray-300 dark:border-gh-600 rounded p-3 h-32 bg-white dark:bg-gh-800 text-gray-900 dark:text-white transition-colors duration-300"
    :placeholder="$t('wizard.seedPhraseHint')"
    />

    <button
    class="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800"
    @click="verify"
    >
    {{ $t('common.confirm') }}
  </button>
  <button
  class="w-full text-sm text-gray-500 dark:text-gray-400 underline mt-1"
  @click="skipAnyway"
  >
  {{ $t('wizard.skipAnyway') }}
</button>
<WizardNav
:showBack="true"
:showNext="false"
/>
<div
v-if="showSkipModal"
class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
>
<div
class="bg-white dark:bg-gh-800 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4"
>
<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
  {{ $t('wizard.skipVerification') }}
</h3>

<p class="text-sm text-gray-600 dark:text-gray-300">
  {{ $t('wizard.skipWarningPart1') }} <strong>{{ $t('wizard.skipWarningBold1') }}</strong>.
  <br /><br />
  {{ $t('wizard.skipWarningPart2') }}
  <strong>{{ $t('wizard.skipWarningBold2') }}</strong>.
</p>

<div class="flex justify-end gap-3 pt-2">
  <button
  class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gh-600
  text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gh-700"
  @click="showSkipModal = false"
  >
  {{ $t('common.cancel') }}
</button>

<button
class="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
@click="next"
>
{{ $t('common.continue') }}
</button>
</div>
</div>
</div>
</div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import WizardNav from "@/components/WizardNav.vue";

const router = useRouter();
const { t } = useI18n();
const input = ref("");
const showSkipModal = ref(false);

function verify() {
  const cachedMnemonic = sessionStorage.getItem("mnemonic_words");

  if (!cachedMnemonic) {
    alert(t('wizard.mnemonicNotFound'));
    return;
  }

  const expected = JSON.parse(cachedMnemonic).join(" ");
  const normalized_input = input.value.trim().replace(/\s+/g, " ");

  if (normalized_input !== expected) {
    alert(t('wizard.mnemonicMismatch'));
    return;
  }

  next();
}

function skipAnyway() {
  showSkipModal.value = true;
}

function next() {
  router.push("/wallet/balance");
}
</script>
