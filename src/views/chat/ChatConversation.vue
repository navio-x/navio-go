<template>
  <div class="bg-gray-50 dark:bg-gh-900 h-full flex flex-col overflow-hidden">

    <div class="flex items-center gap-3 px-5 pt-5 pb-3 shrink-0">
      <button @click="router.push('/chat')" class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400">
        <ChevronLeft class="w-5 h-5" />
      </button>
      <div class="min-w-0 flex-1">
        <h1 class="text-lg font-bold text-gray-900 dark:text-white truncate">{{ displayName }}</h1>
      </div>
      <ChatConnectionStatus v-if="chatState.ready" />
      <button
        @click="showClearConfirm = true"
        class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-400 dark:text-gray-500"
        :title="$t('chat.clearHistory')"
      >
        <Trash2 class="w-4.5 h-4.5" />
      </button>
    </div>

    <div v-if="chatState.error" class="mx-5 mb-3 rounded-2xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-gh-800 p-3 text-xs text-red-500 dark:text-red-400">
      {{ chatState.error }}
    </div>

    <div ref="scrollEl" class="flex-1 overflow-y-auto px-5 py-2 space-y-2">
      <div v-if="loading" class="text-center py-10 text-sm text-gray-400 dark:text-gray-500">
        {{ $t('common.loading') }}
      </div>
      <div v-else-if="messages.length === 0" class="text-center py-14">
        <MessageCircle class="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p class="text-sm text-gray-400 dark:text-gray-500">{{ $t('chat.noMessagesYet') }}</p>
      </div>
      <div
        v-for="m in messages"
        :key="m.id"
        class="flex"
        :class="m.direction === 'out' ? 'justify-end' : 'justify-start'"
      >
        <div
          class="max-w-[75%] rounded-2xl px-3.5 py-2 text-sm"
          :class="m.direction === 'out'
            ? 'bg-green-50 dark:bg-green-900/40 text-gray-900 dark:text-white rounded-br-sm'
            : 'bg-white dark:bg-gh-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gh-700 rounded-bl-sm'"
        >
          <p class="whitespace-pre-wrap break-words">{{ m.text }}</p>
          <div class="flex items-center justify-end gap-1 mt-1">
            <span class="text-[10px] opacity-70">{{ formatTime(m.timestamp) }}</span>
            <template v-if="m.direction === 'out'">
              <!-- No live relay peer yet — navio-p2pmsg has queued it locally but hasn't handed it off. -->
              <Clock v-if="m.status === 'sending' && !chatState.connected" class="w-3 h-3 opacity-70" />
              <!-- Handed off to the network; the recipient hasn't acked it yet. -->
              <Check v-else-if="m.status === 'sending'" class="w-3 h-3 opacity-70" />
              <!-- Acked by the recipient's own client — genuinely reached their device. -->
              <CheckCheck v-else-if="m.status === 'delivered'" class="w-3 h-3 opacity-70" />
              <!-- The recipient's app told us they viewed the conversation. A fixed blue (not the bubble's own
                   muted text color) so it reads as distinct from the plain gray double-check above. -->
              <CheckCheck v-else-if="m.status === 'read'" class="w-3 h-3 text-blue-500 dark:text-blue-400" />
              <AlertCircle v-else-if="m.status === 'failed'" class="w-3 h-3 text-red-500 dark:text-red-400" />
            </template>
          </div>
        </div>
      </div>
    </div>

    <div class="shrink-0 px-5 py-3 border-t border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 flex items-center gap-2">
      <input
        v-model="draft"
        type="text"
        :placeholder="$t('chat.messagePlaceholder')"
        :disabled="!chatState.ready || sending"
        @keyup.enter="send"
        class="flex-1 rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors
               bg-gray-50 dark:bg-gh-700 border border-gray-200 dark:border-gh-600
               text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500
               focus:border-blue-400 dark:focus:border-blue-500
               disabled:opacity-50"
      />
      <button
        @click="send"
        :disabled="!chatState.ready || sending || !draft.trim()"
        class="shrink-0 p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors
               disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <SendHorizontal class="w-4.5 h-4.5" />
      </button>
    </div>

    <!-- Clear history confirmation -->
    <div
      v-if="showClearConfirm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
    >
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <div class="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto">
          <Trash2 class="w-6 h-6 text-red-500" />
        </div>
        <div class="text-center space-y-1">
          <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('chat.clearHistory') }}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('chat.clearHistoryDesc') }}</p>
        </div>
        <div class="flex gap-2 pt-1">
          <button
            @click="showClearConfirm = false"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition-colors
                   bg-gray-100 hover:bg-gray-200 text-gray-700
                   dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            @click="clearHistory"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition-colors
                   bg-red-600 hover:bg-red-700 text-white"
          >
            {{ $t('common.delete') }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ChevronLeft, Trash2, SendHorizontal, MessageCircle, Clock, Check, CheckCheck, AlertCircle } from "lucide-vue-next";
import ChatConnectionStatus from "@/components/chat/ChatConnectionStatus.vue";
import { getContact } from "@/lib/contacts/contacts.js";
import {
  chatState,
  chatActivity,
  conversationHistory,
  clearConversation,
  sendMessage,
  resolveIdentity,
  markConversationRead,
} from "@/lib/chat/client.js";

const route = useRoute();
const router = useRouter();

const contact = ref(null);
const identity = ref(null);
const loading = ref(true);
const messages = ref([]);
const draft = ref("");
const sending = ref(false);
const showClearConfirm = ref(false);
const scrollEl = ref(null);

const displayName = computed(() => {
  if (!contact.value) return "";
  return [contact.value.firstName, contact.value.lastName].filter(Boolean).join(" ").trim() || contact.value.p2pAddress;
});

function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

async function scrollToBottom() {
  await nextTick();
  if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
}

async function loadMessages() {
  if (!contact.value || !chatState.ready) return;
  messages.value = await conversationHistory(contact.value.p2pAddress);
  await scrollToBottom();
  markConversationRead(contact.value.p2pAddress).catch((err) => console.warn("Read receipt not sent:", err));
}

async function loadContact() {
  loading.value = true;
  contact.value = await getContact(route.params.contactId);
  if (!contact.value) {
    router.replace("/chat");
    return;
  }
  if (chatState.ready) {
    try {
      identity.value = await resolveIdentity(contact.value.p2pAddress);
    } catch {
      // bundle couldn't be resolved (bad address) — surfaced via send() errors instead
    }
    await loadMessages();
  }
  loading.value = false;
}

onMounted(loadContact);
watch(() => chatState.ready, loadContact);
watch(() => chatActivity.tick, () => {
  // Any activity could belong to this conversation — cheap to just refresh.
  loadMessages();
});

async function send() {
  const text = draft.value.trim();
  if (!text || !contact.value) return;
  sending.value = true;
  try {
    const result = await sendMessage(contact.value.p2pAddress, text);
    console.log("sendMessage result:", result);
    draft.value = "";
    await loadMessages();
  } catch (err) {
    console.error("Send failed:", err);
  } finally {
    sending.value = false;
  }
}

async function clearHistory() {
  if (!contact.value) return;
  await clearConversation(contact.value.p2pAddress);
  showClearConfirm.value = false;
  await loadMessages();
}
</script>
