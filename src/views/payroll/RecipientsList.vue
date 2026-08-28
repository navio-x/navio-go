<template>
  <div class="bg-gray-50 dark:bg-gh-900 p-5 pb-6 transition-colors duration-300 min-h-full">
    <div class="flex items-center justify-between mb-5">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('payroll.recipients') }}</h1>
      <div class="flex items-center gap-2">
        <button
          @click="router.push('/payroll/recipients/import')"
          class="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium
                 bg-gray-100 hover:bg-gray-200 text-gray-700
                 dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300 transition-colors"
        >
          <FileUp class="w-3.5 h-3.5" />
          {{ $t('payroll.importCsv') }}
        </button>
        <button
          @click="router.push('/payroll/recipients/new')"
          class="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold
                 bg-blue-600 hover:bg-blue-700 text-white transition-colors"
        >
          <Plus class="w-3.5 h-3.5" />
          {{ $t('payroll.addRecipient') }}
        </button>
      </div>
    </div>

    <div class="w-full max-w-md mx-auto flex flex-col gap-3">

      <div class="relative">
        <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          v-model="search"
          type="text"
          :placeholder="$t('payroll.search')"
          class="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none transition-colors
                 bg-white dark:bg-gh-800
                 border border-gray-200 dark:border-gh-700
                 text-gray-900 dark:text-white
                 placeholder-gray-400 dark:placeholder-gray-500
                 focus:border-blue-400 dark:focus:border-blue-500"
        />
      </div>

      <label class="flex items-center gap-2 px-1 text-xs text-gray-500 dark:text-gray-400 select-none cursor-pointer">
        <input type="checkbox" v-model="showArchived" class="rounded accent-blue-600" />
        {{ $t('payroll.showArchived') }}
      </label>

      <div v-if="loading" class="text-center py-10 text-sm text-gray-400 dark:text-gray-500">
        {{ $t('common.loading') }}
      </div>

      <div v-else-if="loadError" class="rounded-2xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-gh-800 p-4 text-sm text-red-500 dark:text-red-400">
        {{ loadError }}
      </div>

      <div v-else-if="filteredRecipients.length === 0" class="text-center py-14">
        <Users class="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ $t('payroll.noRecipients') }}</p>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ $t('payroll.noRecipientsDesc') }}</p>
      </div>

      <div v-else class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
        <div
          v-for="(r, idx) in filteredRecipients"
          :key="r.id"
          class="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gh-700 transition-colors"
          :class="{ 'border-t border-gray-100 dark:border-gh-700': idx > 0, 'opacity-50': r.archived }"
          @click="router.push(`/payroll/recipients/${r.id}`)"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ r.label }}</p>
              <span v-if="r.groupTag" class="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                {{ r.groupTag }}
              </span>
              <span v-if="r.archived" class="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 dark:bg-gh-700 text-gray-500 dark:text-gray-400">
                {{ $t('payroll.archived') }}
              </span>
            </div>
            <p class="text-xs font-mono text-gray-400 dark:text-gray-500 truncate">{{ r.address }}</p>
          </div>
          <p v-if="r.defaultAmount" class="text-xs text-gray-400 dark:text-gray-500 shrink-0">
            {{ r.defaultAmount }}{{ r.currency ? ' ' + r.currency : ' NAV' }}
          </p>
          <button
            @click.stop="router.push(`/payroll/recipients/${r.id}/history`)"
            class="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gh-600 transition-colors"
            :title="$t('payroll.viewHistory')"
          >
            <History class="w-4 h-4" />
          </button>
          <button
            @click.stop="toggleArchived(r)"
            class="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gh-600 transition-colors"
            :title="r.archived ? $t('payroll.restore') : $t('payroll.archive')"
          >
            <ArchiveRestore v-if="r.archived" class="w-4 h-4" />
            <Archive v-else class="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { Plus, FileUp, Search, Users, Archive, ArchiveRestore, History } from "lucide-vue-next";
import { listRecipients, setRecipientArchived } from "@/lib/payroll/recipients.js";

const router = useRouter();

const loading = ref(true);
const loadError = ref("");
const recipients = ref([]);
const search = ref("");
const showArchived = ref(false);

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    recipients.value = await listRecipients({ includeArchived: true });
  } catch (e) {
    loadError.value = e?.message || "Failed to load recipients";
  } finally {
    loading.value = false;
  }
}

onMounted(load);

const filteredRecipients = computed(() => {
  const q = search.value.trim().toLowerCase();
  return recipients.value.filter((r) => {
    if (!showArchived.value && r.archived) return false;
    if (!q) return true;
    return (
      r.label.toLowerCase().includes(q) ||
      r.address.toLowerCase().includes(q) ||
      (r.groupTag || "").toLowerCase().includes(q)
    );
  });
});

async function toggleArchived(r) {
  await setRecipientArchived(r.id, !r.archived);
  await load();
}
</script>
