<template>
  <div class="bg-gray-50 dark:bg-gh-900 p-5 pb-6 transition-colors duration-300 min-h-full">
    <div class="flex items-center justify-between mb-5">
      <div class="flex items-center gap-2 min-w-0">
        <h1 class="text-xl font-bold text-gray-900 dark:text-white truncate">{{ $t('chat.title') }}</h1>
        <ChatConnectionStatus v-if="chatState.ready || chatState.connecting" />
      </div>
      <button
        @click="router.push('/chat/contacts/new')"
        class="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold
               bg-blue-600 hover:bg-blue-700 text-white transition-colors"
      >
        <Plus class="w-3.5 h-3.5" />
        {{ $t('chat.addContact') }}
      </button>
    </div>

    <div class="w-full max-w-md mx-auto flex flex-col gap-3">

      <!-- My own p2p address. The card is there from the start, with a
           placeholder line until the client has the address, so nothing is
           swapped in and out while connecting. -->
      <div v-if="chatState.bundle || chatState.connecting" class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">
          {{ $t('chat.myAddress') }}
        </p>
        <div v-if="!chatState.bundle" class="h-7 flex items-center" role="status" :aria-label="$t('chat.connecting')">
          <div class="h-3 w-2/3 rounded bg-gray-100 dark:bg-gh-700 animate-pulse" />
        </div>
        <div v-else class="flex items-center gap-2">
          <p class="text-xs font-mono text-gray-600 dark:text-gray-300 truncate flex-1">{{ chatState.bundle }}</p>
          <button
            @click="showQr = true"
            class="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gh-700 transition-colors"
            :title="$t('chat.myAddressQr')"
          >
            <QrCode class="w-4 h-4" />
          </button>
          <button
            @click="copyMyAddress"
            class="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gh-700 transition-colors"
            :title="$t('common.copy')"
          >
            <Check v-if="copied" class="w-4 h-4 text-green-500" />
            <Copy v-else class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div v-if="chatState.error" class="rounded-2xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-gh-800 p-4 text-sm text-red-500 dark:text-red-400">
        {{ chatState.error }}
      </div>

      <!-- Accept/reject notices for requests we sent -->
      <div
        v-for="c in notices"
        :key="c.id"
        class="rounded-2xl border p-3 flex items-center justify-between gap-2"
        :class="c.requestStatus === 'accepted'
          ? 'border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/10'
          : 'border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800'"
      >
        <p class="text-sm text-gray-700 dark:text-gray-300">
          {{ $t(c.requestStatus === 'accepted' ? 'chat.requestAccepted' : 'chat.requestRejected', { name: displayName(c) }) }}
        </p>
        <button
          @click="dismissNotice(c)"
          class="shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gh-700 transition-colors"
          :title="$t('common.close')"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Incoming contact requests -->
      <template v-if="requests.length > 0">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mt-2">{{ $t('chat.contactRequests') }}</h2>
        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
          <div
            v-for="(r, idx) in requests"
            :key="r.identity"
            class="px-4 py-3 flex items-center gap-3"
            :class="{ 'border-t border-gray-100 dark:border-gh-700': idx > 0 }"
          >
            <div class="shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <UserPlus class="w-5 h-5" />
            </div>
            <p class="min-w-0 flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">{{ requestName(r) }}</p>
            <button
              @click="accept(r)"
              class="shrink-0 p-1.5 rounded-lg text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20 transition-colors"
              :title="$t('chat.acceptRequest')"
            >
              <Check class="w-4 h-4" />
            </button>
            <button
              @click="reject(r)"
              class="shrink-0 p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
              :title="$t('chat.rejectRequest')"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>
      </template>

      <!-- Groups -->
      <div class="flex items-center justify-between mt-2">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{{ $t('chat.groups') }}</h2>
        <button
          @click="router.push('/chat/group/new')"
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold
                 bg-blue-50 hover:bg-blue-100 text-blue-600
                 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 dark:text-blue-400 transition-colors"
        >
          <Plus class="w-3.5 h-3.5" />
          {{ $t('chat.newGroup') }}
        </button>
      </div>

      <div v-if="groups.length > 0" class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
        <div
          v-for="(g, idx) in groups"
          :key="g.id"
          class="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gh-700 transition-colors"
          :class="{ 'border-t border-gray-100 dark:border-gh-700': idx > 0 }"
          @click="router.push(`/chat/group/${g.id}`)"
        >
          <div class="shrink-0 w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Users class="w-5 h-5" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ g.name }}</p>
            <p class="text-xs text-gray-400 dark:text-gray-500 truncate">
              {{ g.id in groupPreviews ? (groupPreviews[g.id]?.text || $t('chat.noMessagesYet')) : '\u00A0' }}
            </p>
          </div>
          <span v-if="groupPreviews[g.id]" class="shrink-0 text-[10px] text-gray-400 dark:text-gray-500">
            {{ formatTime(groupPreviews[g.id].timestamp) }}
          </span>
        </div>
      </div>

      <h2 class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mt-2">{{ $t('chat.contacts') }}</h2>

      <div class="relative">
        <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          v-model="search"
          type="text"
          :placeholder="$t('chat.search')"
          class="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none transition-colors
                 bg-white dark:bg-gh-800
                 border border-gray-200 dark:border-gh-700
                 text-gray-900 dark:text-white
                 placeholder-gray-400 dark:placeholder-gray-500
                 focus:border-blue-400 dark:focus:border-blue-500"
        />
      </div>

      <!-- The contacts are a local read: nothing is shown for the moment it
           takes rather than a label that flashes by. -->
      <div v-if="loading" />

      <div v-else-if="filteredContacts.length === 0" class="text-center py-14">
        <MessageCircle class="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ $t('chat.noContacts') }}</p>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ $t('chat.noContactsDesc') }}</p>
      </div>

      <div v-else class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
        <div
          v-for="(c, idx) in filteredContacts"
          :key="c.id"
          class="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gh-700 transition-colors"
          :class="{ 'border-t border-gray-100 dark:border-gh-700': idx > 0 }"
          @click="openContact(c)"
        >
          <div class="shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-semibold text-blue-600 dark:text-blue-400">
            {{ initials(c) }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ displayName(c) }}</p>
              <span v-if="!c.p2pAddress" class="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 dark:bg-gh-700 text-gray-500 dark:text-gray-400">
                {{ $t('chat.noP2pAddress') }}
              </span>
            </div>
            <p class="text-xs text-gray-400 dark:text-gray-500 truncate">
              {{ c.p2pAddress ? (c.id in previews ? (previews[c.id]?.text || $t('chat.noMessagesYet')) : '\u00A0') : (c.phone || c.email || '') }}
            </p>
          </div>
          <span v-if="c.p2pAddress && previews[c.id]" class="shrink-0 text-[10px] text-gray-400 dark:text-gray-500">
            {{ formatTime(previews[c.id].timestamp) }}
          </span>
          <div class="shrink-0" @click.stop>
            <button
              @click="toggleMenu(c, $event)"
              class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gh-600 transition-colors"
              :title="$t('common.more')"
            >
              <MoreVertical class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

    </div>

    <!-- Contact row menu — teleported to <body> so it can escape the list's
         overflow-hidden (needed there to clip row hover backgrounds to the
         list's rounded corners), positioned from the trigger button's own
         rect instead of relying on being nested inside it. -->
    <Teleport to="body">
      <div
        v-if="activeMenuContact"
        class="fixed w-36 rounded-xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 shadow-lg z-50 overflow-hidden"
        :style="{ top: menuPos.top + 'px', left: menuPos.left + 'px' }"
        @click.stop
      >
        <button
          @click="editFromMenu(activeMenuContact)"
          class="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gh-700 transition-colors"
        >
          <Pencil class="w-3.5 h-3.5" /> {{ $t('common.edit') }}
        </button>
        <button
          @click="deleteFromMenu(activeMenuContact)"
          class="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gh-700 transition-colors border-t border-gray-100 dark:border-gh-700"
        >
          <Trash2 class="w-3.5 h-3.5" /> {{ $t('common.delete') }}
        </button>
      </div>
    </Teleport>

    <!-- Delete confirmation -->
    <div
      v-if="deleteTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
    >
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <div class="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto">
          <Trash2 class="w-6 h-6 text-red-500" />
        </div>
        <div class="text-center space-y-1">
          <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('chat.deleteContact') }}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('chat.deleteContactDesc', { name: displayName(deleteTarget) }) }}</p>
        </div>
        <div class="flex gap-2 pt-1">
          <button
            @click="deleteTarget = null"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition-colors
                   bg-gray-100 hover:bg-gray-200 text-gray-700
                   dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            @click="doDelete"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition-colors
                   bg-red-600 hover:bg-red-700 text-white"
          >
            {{ $t('common.delete') }}
          </button>
        </div>
      </div>
    </div>

    <!-- My p2p address QR -->
    <div
      v-if="showQr"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
      @click.self="showQr = false"
    >
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 dark:text-white text-center">{{ $t('chat.myAddressQr') }}</h3>
        <div class="flex justify-center">
          <div class="p-3 bg-white rounded-xl ring-1 ring-gray-100 dark:ring-gh-700">
            <QRCode :value="chatState.bundle" :size="200" />
          </div>
        </div>
        <div class="w-full bg-gray-50 dark:bg-gh-700 rounded-xl px-4 py-3">
          <p class="font-mono text-xs text-gray-700 dark:text-gray-300 break-all text-center leading-relaxed select-all">
            {{ chatState.bundle }}
          </p>
        </div>
        <div class="flex gap-2 pt-1">
          <button
            @click="showQr = false"
            class="flex-1 py-2 rounded-xl text-sm font-medium transition-colors
                   bg-gray-100 hover:bg-gray-200 text-gray-700
                   dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
          >
            {{ $t('common.close') }}
          </button>
          <button
            @click="copyMyAddress"
            class="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-colors"
            :class="copied ? 'bg-green-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'"
          >
            <Check v-if="copied" class="w-4 h-4" />
            <Copy v-else class="w-4 h-4" />
            {{ copied ? $t('common.copied') : $t('common.copy') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { Plus, MessageCircle, Copy, Check, Search, Pencil, Trash2, Users, QrCode, UserPlus, X, MoreVertical } from "lucide-vue-next";
import QRCode from "qrcode.vue";
import ChatConnectionStatus from "@/components/chat/ChatConnectionStatus.vue";
import { listContacts, deleteContact, dismissContactRequestNotice } from "@/lib/contacts/contacts.js";
import {
  chatState,
  chatActivity,
  conversationPreview,
  listMyGroups,
  groupPreview,
  listContactRequests,
  acceptContactRequest,
  rejectContactRequest,
} from "@/lib/chat/client.js";

const router = useRouter();

// True only until the contacts are first read — later refreshes update the
// list in place.
const loading = ref(true);
const contacts = ref([]);
// A key is missing until that preview has been looked up (the row's second
// line stays blank meanwhile); null once it has and there are no messages.
const previews = reactive({});
const groups = ref([]);
const groupPreviews = reactive({});
const requests = ref([]);
const copied = ref(false);
const search = ref("");
const deleteTarget = ref(null);
const showQr = ref(false);
const openMenuId = ref(null);
const menuPos = ref({ top: 0, left: 0 });
const activeMenuContact = computed(() => contacts.value.find((c) => c.id === openMenuId.value) ?? null);

const MENU_WIDTH = 144; // matches the teleported menu's w-36

function toggleMenu(c, event) {
  if (openMenuId.value === c.id) {
    openMenuId.value = null;
    return;
  }
  const rect = event.currentTarget.getBoundingClientRect();
  menuPos.value = {
    top: rect.bottom + 4,
    left: Math.max(8, rect.right - MENU_WIDTH),
  };
  openMenuId.value = c.id;
}

function closeMenu() {
  openMenuId.value = null;
}

// Take the contact as a plain argument rather than reading activeMenuContact
// after closing the menu — activeMenuContact is a computed() derived from
// openMenuId, so nulling that first and *then* reading activeMenuContact
// (as the inline handlers used to) makes it re-evaluate to null before the
// read happens, throwing on .id and silently swallowing the click.
function editFromMenu(c) {
  openMenuId.value = null;
  router.push(`/chat/contacts/${c.id}/edit`);
}

function deleteFromMenu(c) {
  openMenuId.value = null;
  confirmDelete(c);
}
onMounted(() => document.addEventListener("click", closeMenu));
onUnmounted(() => document.removeEventListener("click", closeMenu));

function displayName(c) {
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || c.p2pAddress || c.email || c.phone;
}

function initials(c) {
  const name = displayName(c);
  return name.slice(0, 2).toUpperCase();
}

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const notices = computed(() =>
  contacts.value.filter((c) => (c.requestStatus === "accepted" || c.requestStatus === "rejected") && !c.requestNoticeDismissed)
);

function requestName(r) {
  return r.displayName || `${r.identity.slice(0, 14)}…`;
}

const filteredContacts = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return contacts.value;
  return contacts.value.filter((c) =>
    displayName(c).toLowerCase().includes(q) ||
    (c.email || "").toLowerCase().includes(q) ||
    (c.phone || "").toLowerCase().includes(q) ||
    (c.p2pAddress || "").toLowerCase().includes(q)
  );
});

function openContact(c) {
  if (c.p2pAddress) router.push(`/chat/${c.id}`);
  else router.push(`/chat/contacts/${c.id}/edit`);
}

async function loadPreviews() {
  if (!chatState.ready) return;
  for (const c of contacts.value) {
    if (!c.p2pAddress) continue;
    try {
      previews[c.id] = await conversationPreview(c.p2pAddress);
    } catch {
      // contact bundle couldn't be resolved yet (e.g. malformed) — no preview
      previews[c.id] = null;
    }
  }
}

async function loadGroupPreviews() {
  if (!chatState.ready) return;
  for (const g of groups.value) {
    groupPreviews[g.id] = await groupPreview(g.id);
  }
}

async function loadGroups() {
  groups.value = await listMyGroups();
  await loadGroupPreviews();
}

async function loadRequests() {
  requests.value = await listContactRequests();
}

async function load() {
  try {
    contacts.value = await listContacts();
  } finally {
    loading.value = false;
  }
  await Promise.all([loadPreviews(), loadGroups(), loadRequests()]);
}

onMounted(load);
watch(() => chatState.ready, load);
watch(() => chatActivity.tick, async () => {
  // Re-reads contacts too: an incoming accept/reject reply patches a
  // contact's requestStatus in place (see client.js), which only this
  // re-fetch picks up.
  contacts.value = await listContacts();
  loadPreviews();
  loadGroups();
  loadRequests();
});

async function accept(r) {
  await acceptContactRequest(r.identity);
  await load();
}

async function reject(r) {
  await rejectContactRequest(r.identity);
  await load();
}

async function dismissNotice(c) {
  await dismissContactRequestNotice(c.id);
  await load();
}

function confirmDelete(c) {
  deleteTarget.value = c;
}

async function doDelete() {
  if (!deleteTarget.value) return;
  await deleteContact(deleteTarget.value.id);
  deleteTarget.value = null;
  await load();
}

async function copyMyAddress() {
  if (!chatState.bundle) return;
  await navigator.clipboard.writeText(chatState.bundle);
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}
</script>
