<template>
  <div class="bg-gray-50 dark:bg-gh-900 p-5 pb-6 transition-colors duration-300 min-h-full">
    <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-5">{{ $t('payroll.runHistory') }}</h1>

    <div class="w-full max-w-md mx-auto flex flex-col gap-3">

      <div class="flex gap-2">
        <div class="relative flex-1">
          <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input v-model="search" type="text" :placeholder="$t('payroll.search')"
            class="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none transition-colors bg-white dark:bg-gh-800 border border-gray-200 dark:border-gh-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-400 dark:focus:border-blue-500" />
        </div>
        <select v-model="statusFilter"
          class="px-2 py-2 rounded-xl text-sm bg-white dark:bg-gh-800 border border-gray-200 dark:border-gh-700 text-gray-900 dark:text-white outline-none cursor-pointer">
          <option value="">{{ $t('payroll.allStatuses') }}</option>
          <option v-for="s in STATUSES" :key="s" :value="s">{{ $t(`payroll.runStatus.${s}`) }}</option>
        </select>
      </div>

      <div v-if="loading" class="text-center py-10 text-sm text-gray-400 dark:text-gray-500">{{ $t('common.loading') }}</div>

      <div v-else-if="groups.length === 0" class="text-center py-14">
        <History class="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ $t('payroll.noRuns') }}</p>
      </div>

      <div v-else v-for="group in groups" :key="group.periodLabel" class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
        <div class="px-4 py-2.5 flex items-center justify-between bg-gray-50 dark:bg-gh-700/40">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ group.periodLabel }}</p>
          <p class="text-xs text-gray-400 dark:text-gray-500">{{ formatNav(group.totalNav) }} NAV</p>
        </div>
        <button
          v-for="r in group.runs"
          :key="r.id"
          @click="router.push(`/payroll/runs/${r.id}`)"
          class="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gh-700 transition-colors flex items-center justify-between gap-3 border-t border-gray-100 dark:border-gh-700"
        >
          <div class="min-w-0">
            <p class="text-sm text-gray-900 dark:text-white truncate">{{ r.date }}</p>
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ formatNav(r.totalNav) }} NAV</p>
          </div>
          <span class="shrink-0 text-xs font-medium" :class="statusColor(r.status)">{{ $t(`payroll.runStatus.${r.status}`) }}</span>
        </button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { Search, History } from "lucide-vue-next";
import { listRuns, getPayments, totalRunAmountSat } from "@/lib/payroll/paymentRuns.js";

const router = useRouter();
const STATUSES = ["draft", "signing", "completed", "partial", "failed"];

const loading = ref(true);
const runs = ref([]);
const search = ref("");
const statusFilter = ref("");

onMounted(async () => {
  const list = await listRuns();
  runs.value = await Promise.all(
    list.map(async (r) => {
      const payments = await getPayments(r.id);
      return { ...r, totalNav: Number(totalRunAmountSat(payments)) / 1e8 };
    })
  );
  loading.value = false;
});

function formatNav(n) {
  return (n || 0).toLocaleString(undefined, { maximumFractionDigits: 8 });
}

function statusColor(status) {
  return {
    completed: "text-green-600 dark:text-green-400",
    signing: "text-blue-500 dark:text-blue-400",
    partial: "text-amber-500 dark:text-amber-400",
    failed: "text-red-500 dark:text-red-400",
    draft: "text-gray-400 dark:text-gray-500",
  }[status] || "text-gray-400 dark:text-gray-500";
}

const filteredRuns = computed(() => {
  const q = search.value.trim().toLowerCase();
  return runs.value.filter((r) => {
    if (statusFilter.value && r.status !== statusFilter.value) return false;
    if (q && !r.periodLabel.toLowerCase().includes(q)) return false;
    return true;
  });
});

const groups = computed(() => {
  const byPeriod = new Map();
  for (const r of filteredRuns.value) {
    if (!byPeriod.has(r.periodLabel)) byPeriod.set(r.periodLabel, []);
    byPeriod.get(r.periodLabel).push(r);
  }
  return [...byPeriod.entries()]
    .map(([periodLabel, groupRuns]) => ({
      periodLabel,
      runs: groupRuns.sort((a, b) => b.createdAt - a.createdAt),
      totalNav: groupRuns.reduce((sum, r) => sum + r.totalNav, 0),
      latestCreatedAt: Math.max(...groupRuns.map((r) => r.createdAt)),
    }))
    .sort((a, b) => b.latestCreatedAt - a.latestCreatedAt);
});
</script>
