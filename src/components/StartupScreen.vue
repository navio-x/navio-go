<!-- The cold-start screens — SDK init (views/InitalizeSDK.vue), the
     auto-open loader and the unlock form (views/WalletHome.vue) — all render
     through this, so moving from one to the next reads as a single screen:
     the header sits at a fixed spot from the top (not vertically centred, so
     a form appearing below doesn't push it up), the spinner turns into the
     lock in the same circle, and only the text and the slot change. -->
<template>
  <div
    class="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto px-6 pt-[22dvh] pb-6
           bg-white text-gray-900 dark:bg-gh-900 dark:text-white"
    :role="busy ? 'status' : undefined"
  >
    <div class="w-full max-w-sm space-y-4">
      <div class="flex flex-col items-center gap-3 text-center">
        <div class="w-14 h-14 rounded-full bg-gray-100 dark:bg-gh-800 flex items-center justify-center">
          <svg v-if="busy" class="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <Lock v-else class="w-6 h-6 text-gray-500 dark:text-gray-400" />
        </div>
        <div class="space-y-1">
          <!-- Kept even when empty so the subtitle doesn't move once a name is known -->
          <h3 class="text-lg font-bold leading-7 min-h-7 break-all">{{ title }}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ subtitle }}</p>
        </div>
      </div>
      <slot />
    </div>
  </div>
</template>

<script setup>
import { Lock } from "lucide-vue-next";

defineProps({
  busy: { type: Boolean, default: false },
  title: { type: String, default: "" },
  subtitle: { type: String, default: "" },
});
</script>
