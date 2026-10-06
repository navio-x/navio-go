<template>
  <div class="bg-gray-50 dark:bg-gh-900 p-5 pb-6 transition-colors duration-300 min-h-full">
    <div class="flex items-center gap-3 mb-5">
      <button @click="router.back()" class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400">
        <ChevronLeft class="w-5 h-5" />
      </button>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('chat.manageGroup') }}</h1>
    </div>

    <div v-if="loading" class="text-center py-10 text-sm text-gray-400 dark:text-gray-500">
      {{ $t('common.loading') }}
    </div>

    <div v-else class="w-full max-w-md mx-auto flex flex-col gap-4">
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
        <div class="px-4 pt-4 pb-3">
          <label class="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {{ $t('chat.groupName') }}
          </label>
          <input
            v-model="name"
            type="text"
            :disabled="!isOwner"
            class="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors
                   bg-gray-50 dark:bg-gh-700 border border-gray-200 dark:border-gh-600
                   text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500
                   focus:border-blue-400 dark:focus:border-blue-500
                   disabled:opacity-60"
          />
        </div>
      </div>

      <p v-if="!isOwner" class="text-xs text-gray-400 dark:text-gray-500 px-1">{{ $t('chat.notOwnerNotice') }}</p>

      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
        <div class="px-4 pt-3 pb-2">
          <label class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {{ $t('chat.members') }}
          </label>
        </div>

        <label
          v-for="(c, idx) in memberRows"
          :key="c.key"
          class="px-4 py-3 flex items-center gap-3"
          :class="[isOwner ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gh-700' : '', idx > 0 ? 'border-t border-gray-100 dark:border-gh-700' : '']"
        >
          <template v-if="isOwner && !c.isSelf">
            <input type="checkbox" v-model="selected" :value="c.key" class="sr-only" />
            <div
              class="w-4 h-4 rounded shrink-0 border flex items-center justify-center transition-colors"
              :class="selected.includes(c.key)
                ? 'bg-blue-600 border-blue-600'
                : 'bg-gray-50 dark:bg-gh-700 border-gray-300 dark:border-gh-600'"
            >
              <Check v-if="selected.includes(c.key)" class="w-3 h-3 text-white" />
            </div>
          </template>
          <div v-else class="w-4 shrink-0" />
          <div class="shrink-0 w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-semibold text-blue-600 dark:text-blue-400">
            {{ c.initials }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
              {{ c.name }}
              <span v-if="c.isSelf" class="text-gray-400 dark:text-gray-500 font-normal">{{ $t('chat.you') }}</span>
              <span v-if="c.isOwner" class="ml-1 shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                {{ $t('chat.owner') }}
              </span>
            </p>
          </div>
        </label>
      </div>

      <div v-if="isOwner && candidateRows.length > 0" class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
        <div class="px-4 pt-3 pb-2">
          <label class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {{ $t('chat.addMembers') }}
          </label>
        </div>
        <label
          v-for="(c, idx) in candidateRows"
          :key="c.key"
          class="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gh-700 transition-colors"
          :class="{ 'border-t border-gray-100 dark:border-gh-700': idx > 0 }"
        >
          <input type="checkbox" v-model="selected" :value="c.key" class="sr-only" />
          <div
            class="w-4 h-4 rounded shrink-0 border flex items-center justify-center transition-colors"
            :class="selected.includes(c.key)
              ? 'bg-blue-600 border-blue-600'
              : 'bg-gray-50 dark:bg-gh-700 border-gray-300 dark:border-gh-600'"
          >
            <Check v-if="selected.includes(c.key)" class="w-3 h-3 text-white" />
          </div>
          <div class="shrink-0 w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-semibold text-blue-600 dark:text-blue-400">
            {{ c.initials }}
          </div>
          <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ c.name }}</p>
        </label>
      </div>

      <p v-if="saveError" class="text-sm text-red-500 text-center">{{ saveError }}</p>

      <button
        v-if="isOwner"
        :disabled="saving"
        @click="save"
        class="w-full py-3 rounded-xl text-sm font-semibold transition-colors
               bg-blue-600 hover:bg-blue-700 text-white
               disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {{ saving ? $t('common.pleaseWait') : $t('common.save') }}
      </button>

      <button
        @click="showDeleteConfirm = true"
        class="w-full py-2.5 rounded-xl text-sm font-medium transition-colors
               bg-white hover:bg-red-50 text-red-500 border border-red-200
               dark:bg-gh-800 dark:hover:bg-red-900/20 dark:text-red-400 dark:border-red-900/50"
      >
        {{ $t('chat.deleteGroup') }}
      </button>
    </div>

    <!-- Delete confirmation -->
    <div
      v-if="showDeleteConfirm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
    >
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <div class="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mx-auto">
          <Trash2 class="w-6 h-6 text-red-500" />
        </div>
        <div class="text-center space-y-1">
          <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('chat.deleteGroup') }}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ isOwner ? $t('chat.deleteGroupOwnerDesc') : $t('chat.deleteGroupMemberDesc') }}
          </p>
        </div>
        <div class="flex gap-2 pt-1">
          <button
            @click="showDeleteConfirm = false"
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ChevronLeft, Trash2, Check } from "lucide-vue-next";
import { chatState, getMyGroup, updateGroup, deleteGroup, memberDisplayNames } from "@/lib/chat/client.js";
import { listContacts } from "@/lib/contacts/contacts.js";
import { useI18n } from "vue-i18n";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const groupId = route.params.groupId;

const loading = ref(true);
const group = ref(null);
const name = ref("");
const selected = ref([]); // identities currently checked, excluding self
const memberNames = ref({});
const contacts = ref([]);
const saving = ref(false);
const saveError = ref("");
const showDeleteConfirm = ref(false);

const isOwner = computed(() => group.value && group.value.owner === chatState.identity);

// Rows for existing members (checked by default) plus every eligible
// contact not already a member (unchecked) — so the owner can add someone
// new from the same screen, not just remove existing members.
const memberRows = computed(() => {
  if (!group.value) return [];
  return group.value.members.map((m) => ({
    key: m.identity,
    isSelf: m.identity === chatState.identity,
    isOwner: m.identity === group.value.owner,
    name: m.identity === chatState.identity ? t("chat.you") : (memberNames.value[m.identity] || m.identity.slice(0, 14) + "…"),
    initials: (memberNames.value[m.identity] || m.identity).slice(0, 2).toUpperCase(),
  }));
});

// Contacts not yet in the group, resolved to their canonical identity so
// checking one adds that identity into `selected` the same way an existing
// member row's checkbox does — filled in by resolveCandidates() on load.
const candidateRows = ref([]);

async function resolveCandidates() {
  if (!isOwner.value || !group.value) {
    candidateRows.value = [];
    return;
  }
  const { resolveIdentity } = await import("@/lib/chat/client.js");
  const memberIdentities = new Set(group.value.members.map((m) => m.identity));
  const rows = [];
  for (const c of contacts.value) {
    if (!c.p2pAddress) continue;
    try {
      const identity = await resolveIdentity(c.p2pAddress);
      if (memberIdentities.has(identity)) continue;
      rows.push({
        key: identity,
        isSelf: false,
        isOwner: false,
        name: [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || c.p2pAddress,
        initials: ([c.firstName, c.lastName].filter(Boolean).join(" ").trim() || c.p2pAddress).slice(0, 2).toUpperCase(),
      });
    } catch {
      // unresolvable address — not offerable as a candidate
    }
  }
  candidateRows.value = rows;
}

async function load() {
  loading.value = true;
  group.value = await getMyGroup(groupId);
  if (!group.value) {
    router.replace("/chat");
    return;
  }
  name.value = group.value.name;
  selected.value = group.value.members.map((m) => m.identity).filter((id) => id !== chatState.identity);
  memberNames.value = await memberDisplayNames(group.value.members.map((m) => m.identity));
  contacts.value = await listContacts();
  await resolveCandidates();
  loading.value = false;
}
onMounted(load);

async function save() {
  saveError.value = "";
  saving.value = true;
  try {
    await updateGroup(groupId, {
      name: name.value.trim() || group.value.name,
      memberIdentities: [chatState.identity, ...selected.value],
    });
    router.replace(`/chat/group/${groupId}`);
  } catch (e) {
    saveError.value = e?.message === "not_owner" ? t("chat.notOwnerNotice") : (e?.message || t("common.error"));
  } finally {
    saving.value = false;
  }
}

async function doDelete() {
  await deleteGroup(groupId);
  showDeleteConfirm.value = false;
  router.replace("/chat");
}
</script>
