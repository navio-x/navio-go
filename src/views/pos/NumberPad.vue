<template>
  <div class="grid grid-cols-3 gap-3 w-full max-w-sm mx-auto">
    <button
      v-for="key in keys"
      :key="key"
      type="button"
      class="h-16 rounded-2xl text-2xl font-semibold flex items-center justify-center
             bg-gray-100 dark:bg-gh-800 text-gray-900 dark:text-white
             active:bg-gray-200 dark:active:bg-gh-700 transition-colors"
      @click="$emit('press', key)"
    >
      <Delete v-if="key === 'back'" class="w-6 h-6" />
      <span v-else>{{ key }}</span>
    </button>
  </div>
</template>

<script setup>
import { Delete } from "lucide-vue-next";

defineEmits(["press"]);

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];
</script>
