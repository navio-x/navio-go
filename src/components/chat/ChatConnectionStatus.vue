<template>
  <span
    class="inline-flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-full text-[10px] font-medium"
    :class="chatState.connected
      ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
      : 'bg-gray-100 text-gray-500 dark:bg-gh-700 dark:text-gray-400'"
  >
    <span
      class="w-1.5 h-1.5 rounded-full"
      :class="chatState.connected ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500'"
    />
    {{ chatState.connected ? $t('chat.connected') : $t('chat.notConnected') }}
  </span>
</template>

<script setup>
import { chatState } from "@/lib/chat/client.js";
</script>
