<script setup>
import { useRouter } from "vue-router";

const router = useRouter();

defineProps({
  showBack: { type: Boolean, default: true },
  showNext: { type: Boolean, default: false },
  nextRoute: { type: String, default: "" },
  nextDisabled: { type: Boolean, default: false },
  nextTitle: { type: String, default: "Next →" },
});
</script>

<template>
  <div
    class="mt-8 flex items-center"
    :class="showBack && showNext
      ? 'justify-between gap-4'
      : 'justify-center'"
  >
    <!-- BACK -->
    <button
      v-if="showBack"
      @click="router.back()"
      class="
        px-4 py-2 rounded-lg transition
        bg-gray-200 text-gray-900 hover:bg-gray-300
        dark:bg-gh-800 dark:text-white dark:hover:bg-gh-700
      "
    >
      ← {{ $t('common.back') }}
    </button>

    <!-- NEXT -->
    <button
      v-if="showNext"
      :disabled="nextDisabled"
      @click="router.push(nextRoute)"
      class="
        px-6 py-2 rounded-lg transition
        disabled:cursor-not-allowed
      "
      :class="nextDisabled
        ? 'bg-gray-300 text-gray-500 dark:bg-gh-700 dark:text-gray-400'
        : 'text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800'"
    >
      {{ nextTitle }}
    </button>
  </div>
</template>
