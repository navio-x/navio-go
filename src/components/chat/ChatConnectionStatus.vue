<template>
  <span
    class="inline-flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-full text-[10px] font-medium"
    :class="chatState.connected
      ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
      : 'bg-gray-100 text-gray-500 dark:bg-gh-700 dark:text-gray-400'"
  >
    <span
      class="w-1.5 h-1.5 rounded-full"
      :class="[
        chatState.connected ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500',
        { 'animate-pulse': !chatState.connected && pending },
      ]"
    />
    {{ chatState.connected ? $t('chat.connected') : pending ? $t('chat.connecting') : $t('chat.notConnected') }}
  </span>
</template>

<script>
import { computed, ref, watch } from "vue";
import { chatState } from "@/lib/chat/client.js";

// `ready` comes before the first relay peer is actually up (see chatState in
// client.js), so right after it the honest label is still "Connecting…", not
// "Not connected" for a second and then "Connected". Past this grace period
// with no peer, it really is not connected. Tracked here, once for every
// badge, because a badge may only mount after `ready` has already flipped.
const FIRST_PEER_GRACE_MS = 8000;
const awaitingFirstPeer = ref(false);
let graceTimer = null;
watch(() => chatState.ready, (ready) => {
  clearTimeout(graceTimer);
  awaitingFirstPeer.value = ready && !chatState.connected;
  if (awaitingFirstPeer.value) graceTimer = setTimeout(() => { awaitingFirstPeer.value = false; }, FIRST_PEER_GRACE_MS);
});
watch(() => chatState.connected, (connected) => {
  if (connected) awaitingFirstPeer.value = false;
});

const pending = computed(() => chatState.connecting || awaitingFirstPeer.value);
</script>

<script setup>
</script>
