<template>
  <div class="bg-gray-50 dark:bg-gh-900 h-full flex flex-col overflow-hidden">

    <div class="flex items-center gap-3 px-5 pt-5 pb-3 shrink-0">
      <button @click="router.push('/chat')" class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400">
        <ChevronLeft class="w-5 h-5" />
      </button>
      <div class="min-w-0 flex-1">
        <h1 class="text-lg font-bold text-gray-900 dark:text-white truncate">{{ group?.name }}</h1>
        <p class="text-xs text-gray-400 dark:text-gray-500 truncate">{{ $t('chat.memberCount', { n: group?.members?.length ?? 0 }) }}</p>
      </div>
      <ChatConnectionStatus v-if="chatState.ready" />
      <button
        @click="router.push(`/chat/group/${groupId}/manage`)"
        class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-400 dark:text-gray-500"
        :title="$t('chat.manageGroup')"
      >
        <Settings class="w-4.5 h-4.5" />
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
        <Users class="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
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
          <p v-if="m.direction === 'in'" class="text-[11px] font-semibold mb-0.5 text-blue-600 dark:text-blue-400">
            {{ memberNames[m.from] || truncate(m.from) }}
          </p>
          <p class="whitespace-pre-wrap break-words">{{ m.text }}</p>
          <div class="flex items-center justify-end gap-1 mt-1">
            <span class="text-[10px] opacity-70">{{ formatTime(m.timestamp) }}</span>
            <template v-if="m.direction === 'out'">
              <Clock v-if="groupStatus(m) === 'sending'" class="w-3 h-3 opacity-70" />
              <Check v-else-if="groupStatus(m) === 'sent'" class="w-3 h-3 opacity-70" />
              <AlertCircle v-else-if="groupStatus(m) === 'failed'" class="w-3 h-3 text-red-500 dark:text-red-400" />
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
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ChevronLeft, Settings, Users, SendHorizontal, Clock, Check, AlertCircle } from "lucide-vue-next";
import ChatConnectionStatus from "@/components/chat/ChatConnectionStatus.vue";
import { chatState, chatActivity, getMyGroup, groupHistory, sendGroupMessage, memberDisplayNames } from "@/lib/chat/client.js";

const route = useRoute();
const router = useRouter();
const groupId = route.params.groupId;

const group = ref(null);
const memberNames = ref({});
const loading = ref(true);
const messages = ref([]);
const draft = ref("");
const sending = ref(false);
const scrollEl = ref(null);

function truncate(identity) {
  if (!identity) return "";
  return identity.slice(0, 14) + "…";
}

function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** All-acked -> 'sent'; any still pending -> 'sending'; else (some failed, none pending) -> 'failed'. */
function groupStatus(m) {
  if (!m.recipients || m.recipients.length === 0) return "sent";
  if (m.recipients.some((r) => r.status === "sending")) return "sending";
  if (m.recipients.every((r) => r.status === "sent")) return "sent";
  return "failed";
}

async function scrollToBottom() {
  await nextTick();
  if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
}

async function loadMessages() {
  if (!chatState.ready) return;
  messages.value = await groupHistory(groupId);
  await scrollToBottom();
}

async function loadGroup() {
  loading.value = true;
  group.value = await getMyGroup(groupId);
  if (!group.value) {
    router.replace("/chat");
    return;
  }
  if (chatState.ready) {
    memberNames.value = await memberDisplayNames(group.value.members.map((m) => m.identity));
    await loadMessages();
  }
  loading.value = false;
}

onMounted(loadGroup);
watch(() => chatState.ready, loadGroup);
// Any activity could belong to this group (message, ack, or a ctl update
// that changed the member list/name) — cheap to just reload both.
watch(() => chatActivity.tick, loadGroup);

async function send() {
  const text = draft.value.trim();
  if (!text) return;
  sending.value = true;
  try {
    await sendGroupMessage(groupId, text);
    draft.value = "";
    await loadMessages();
  } catch (err) {
    console.error("Group send failed:", err);
  } finally {
    sending.value = false;
  }
}
</script>
