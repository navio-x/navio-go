<template>
  <div class="bg-gray-50 dark:bg-gh-900 p-5 pb-6 transition-colors duration-300 min-h-full">
    <div class="flex items-center gap-3 mb-5">
      <button @click="router.back()" class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400">
        <ChevronLeft class="w-5 h-5" />
      </button>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('chat.createGroup') }}</h1>
    </div>

    <div class="w-full max-w-md mx-auto flex flex-col gap-4">
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
        <div class="px-4 pt-4 pb-3">
          <label class="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {{ $t('chat.groupName') }}
          </label>
          <input
            v-model="name"
            type="text"
            :placeholder="$t('chat.groupNamePlaceholder')"
            class="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors
                   bg-gray-50 dark:bg-gh-700 border border-gray-200 dark:border-gh-600
                   text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500
                   focus:border-blue-400 dark:focus:border-blue-500"
          />
          <p v-if="touched && !name.trim()" class="text-xs text-red-500 mt-1">{{ $t('chat.groupNameRequired') }}</p>
        </div>
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
        <div class="px-4 pt-3 pb-2">
          <label class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {{ $t('chat.inviteMembers') }}
          </label>
        </div>

        <div v-if="loading" class="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
          {{ $t('common.loading') }}
        </div>

        <div v-else-if="eligibleContacts.length === 0" class="text-center py-10 px-4">
          <p class="text-sm text-gray-400 dark:text-gray-500">{{ $t('chat.noEligibleContacts') }}</p>
        </div>

        <label
          v-for="(c, idx) in eligibleContacts"
          :key="c.id"
          class="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gh-700 transition-colors"
          :class="{ 'border-t border-gray-100 dark:border-gh-700': idx > 0 }"
        >
          <input type="checkbox" v-model="selected" :value="c.id" class="sr-only" />
          <div
            class="w-4 h-4 rounded shrink-0 border flex items-center justify-center transition-colors"
            :class="selected.includes(c.id)
              ? 'bg-blue-600 border-blue-600'
              : 'bg-gray-50 dark:bg-gh-700 border-gray-300 dark:border-gh-600'"
          >
            <Check v-if="selected.includes(c.id)" class="w-3 h-3 text-white" />
          </div>
          <div class="shrink-0 w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-semibold text-blue-600 dark:text-blue-400">
            {{ initials(c) }}
          </div>
          <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ displayName(c) }}</p>
        </label>
      </div>

      <p v-if="touched && selected.length === 0" class="text-sm text-red-500 text-center">{{ $t('chat.selectAtLeastOne') }}</p>
      <p v-if="createError" class="text-sm text-red-500 text-center">{{ createError }}</p>

      <div class="flex gap-2">
        <button
          @click="router.back()"
          class="flex-1 py-3 rounded-xl text-sm font-medium transition-colors
                 bg-gray-100 hover:bg-gray-200 text-gray-700
                 dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          :disabled="creating"
          @click="create"
          class="flex-1 py-3 rounded-xl text-sm font-semibold transition-colors
                 bg-blue-600 hover:bg-blue-700 text-white
                 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {{ creating ? $t('common.pleaseWait') : $t('chat.createGroup') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ChevronLeft, Check } from "lucide-vue-next";
import { listContacts } from "@/lib/contacts/contacts.js";
import { createGroup } from "@/lib/chat/client.js";
import { useI18n } from "vue-i18n";

const router = useRouter();
const { t } = useI18n();

const loading = ref(true);
const contacts = ref([]);
const name = ref("");
const selected = ref([]);
const touched = ref(false);
const creating = ref(false);
const createError = ref("");

const eligibleContacts = computed(() => contacts.value.filter((c) => !!c.p2pAddress));

function displayName(c) {
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || c.p2pAddress;
}
function initials(c) {
  return displayName(c).slice(0, 2).toUpperCase();
}

async function load() {
  loading.value = true;
  try {
    contacts.value = await listContacts();
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function create() {
  touched.value = true;
  createError.value = "";
  if (!name.value.trim() || selected.value.length === 0) return;

  creating.value = true;
  try {
    const memberAddresses = contacts.value
      .filter((c) => selected.value.includes(c.id))
      .map((c) => c.p2pAddress);
    const group = await createGroup(name.value.trim(), memberAddresses);
    router.replace(`/chat/group/${group.id}`);
  } catch (e) {
    createError.value = e?.message || t("common.error");
  } finally {
    creating.value = false;
  }
}
</script>
