<template>
  <div class="bg-gray-50 dark:bg-gh-900 p-5 pb-6 transition-colors duration-300 min-h-full">
    <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-5">{{ $t('payroll.title') }}</h1>

    <div class="w-full max-w-md mx-auto flex flex-col gap-4">

      <div v-if="backupOverdue" class="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-3 py-2.5 flex items-start gap-2">
        <AlertTriangle class="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div class="min-w-0 flex-1">
          <p class="text-xs text-amber-700 dark:text-amber-300">{{ $t('payroll.backupReminder') }}</p>
          <button @click="router.push('/payroll/backup')" class="text-xs font-semibold text-amber-800 dark:text-amber-200 underline mt-0.5">
            {{ $t('payroll.backupNow') }}
          </button>
        </div>
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
        <button
          @click="router.push('/payroll/recipients')"
          class="w-full px-4 py-3.5 text-sm font-medium text-left
                 text-gray-700 dark:text-gray-300
                 hover:bg-gray-50 dark:hover:bg-gh-700
                 transition-colors flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <Users class="w-4 h-4 text-gray-400" />
            <span>{{ $t('payroll.recipients') }}</span>
          </div>
          <ChevronRight class="w-4 h-4 opacity-40" />
        </button>
        <div class="border-t border-gray-100 dark:border-gh-700" />
        <button
          @click="router.push('/payroll/runs/new')"
          class="w-full px-4 py-3.5 text-sm font-medium text-left
                 text-gray-700 dark:text-gray-300
                 hover:bg-gray-50 dark:hover:bg-gh-700
                 transition-colors flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <PlusCircle class="w-4 h-4 text-gray-400" />
            <span>{{ $t('payroll.newRun') }}</span>
          </div>
          <ChevronRight class="w-4 h-4 opacity-40" />
        </button>
        <div class="border-t border-gray-100 dark:border-gh-700" />
        <button
          @click="router.push('/payroll/runs')"
          class="w-full px-4 py-3.5 text-sm font-medium text-left
                 text-gray-700 dark:text-gray-300
                 hover:bg-gray-50 dark:hover:bg-gh-700
                 transition-colors flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <History class="w-4 h-4 text-gray-400" />
            <span>{{ $t('payroll.runHistory') }}</span>
          </div>
          <ChevronRight class="w-4 h-4 opacity-40" />
        </button>
        <div class="border-t border-gray-100 dark:border-gh-700" />
        <button
          @click="router.push('/payroll/export')"
          class="w-full px-4 py-3.5 text-sm font-medium text-left
                 text-gray-700 dark:text-gray-300
                 hover:bg-gray-50 dark:hover:bg-gh-700
                 transition-colors flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <FileOutput class="w-4 h-4 text-gray-400" />
            <span>{{ $t('payroll.exportTitle') }}</span>
          </div>
          <ChevronRight class="w-4 h-4 opacity-40" />
        </button>
        <div class="border-t border-gray-100 dark:border-gh-700" />
        <button
          @click="router.push('/payroll/backup')"
          class="w-full px-4 py-3.5 text-sm font-medium text-left
                 text-gray-700 dark:text-gray-300
                 hover:bg-gray-50 dark:hover:bg-gh-700
                 transition-colors flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <ShieldCheck class="w-4 h-4 text-gray-400" />
            <span>{{ $t('payroll.backupTitle') }}</span>
          </div>
          <ChevronRight class="w-4 h-4 opacity-40" />
        </button>
      </div>

      <div v-if="runs.length" class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
        <div class="px-4 pt-3 pb-1 flex items-center justify-between">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {{ $t('payroll.recentRuns') }}
          </p>
          <button @click="router.push('/payroll/runs')" class="text-xs text-blue-600 dark:text-blue-400 font-medium">
            {{ $t('payroll.viewAll') }}
          </button>
        </div>
        <button
          v-for="r in runs"
          :key="r.id"
          @click="router.push(`/payroll/runs/${r.id}`)"
          class="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gh-700 transition-colors flex items-center justify-between gap-3 border-t border-gray-100 dark:border-gh-700"
        >
          <div class="min-w-0">
            <p class="text-sm text-gray-900 dark:text-white truncate">{{ r.periodLabel }}</p>
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ r.date }}</p>
          </div>
          <span class="shrink-0 text-xs font-medium" :class="statusColor(r.status)">{{ $t(`payroll.runStatus.${r.status}`) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { Users, PlusCircle, History, ShieldCheck, ChevronRight, AlertTriangle, FileOutput } from "lucide-vue-next";
import { listRuns } from "@/lib/payroll/paymentRuns.js";
import { isBackupOverdue } from "@/lib/payroll/backup.js";

const router = useRouter();
const runs = ref([]);
const backupOverdue = ref(false);

onMounted(async () => {
  runs.value = (await listRuns()).slice(0, 3);
  backupOverdue.value = isBackupOverdue();
});

function statusColor(status) {
  return {
    completed: "text-green-600 dark:text-green-400",
    signing: "text-blue-500 dark:text-blue-400",
    partial: "text-amber-500 dark:text-amber-400",
    failed: "text-red-500 dark:text-red-400",
    draft: "text-gray-400 dark:text-gray-500",
  }[status] || "text-gray-400 dark:text-gray-500";
}
</script>
