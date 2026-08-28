<template>
  <div class="bg-gray-50 dark:bg-gh-900 p-5 pb-6 transition-colors duration-300 min-h-full">
    <div v-if="loading" class="text-center py-10 text-sm text-gray-400 dark:text-gray-500">{{ $t('common.loading') }}</div>

    <div v-else-if="!recipient" class="text-center py-10 text-sm text-gray-400 dark:text-gray-500">
      {{ $t('payroll.historyRecipientNotFound') }}
    </div>

    <template v-else>
      <div class="flex items-center gap-2 mb-5">
        <h1 class="text-xl font-bold text-gray-900 dark:text-white truncate">{{ recipient.label }}</h1>
        <span v-if="recipient.archived" class="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 dark:bg-gh-700 text-gray-500 dark:text-gray-400">
          {{ $t('payroll.archived') }}
        </span>
      </div>

      <div class="w-full max-w-md mx-auto flex flex-col gap-4">

        <!-- Lifetime summary -->
        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
          <div class="px-4 py-3 flex items-center justify-between">
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ $t('payroll.historyTotalPaid') }}</span>
            <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ totalNavLifetime }} NAV</span>
          </div>
          <div v-if="allRows.length" class="border-t border-gray-100 dark:border-gh-700 px-4 py-3 flex items-center justify-between">
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ $t('payroll.historyFirstPayment') }}</span>
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ firstPaymentDate }}</span>
          </div>
          <div v-if="allRows.length" class="border-t border-gray-100 dark:border-gh-700 px-4 py-3 flex items-center justify-between">
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ $t('payroll.historyLastPayment') }}</span>
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ lastPaymentDate }}</span>
          </div>
          <p v-if="!allRows.length" class="px-4 py-4 text-sm text-gray-400 dark:text-gray-500 text-center">{{ $t('payroll.historyNoPayments') }}</p>
        </div>

        <!-- Address history -->
        <div v-if="addressHistory.length" class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
          <p class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{{ $t('payroll.historyAddressHistory') }}</p>
          <div v-for="a in addressHistory" :key="a.address" class="border-t border-gray-100 dark:border-gh-700 px-4 py-2.5">
            <div class="flex items-center gap-2">
              <p class="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">{{ a.address }}</p>
              <span v-if="a.isCurrent" class="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                {{ $t('payroll.historyCurrentAddress') }}
              </span>
            </div>
            <p class="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
              {{ $t('payroll.historyAddressRange', { count: a.count, from: a.firstDate, to: a.lastDate }) }}
            </p>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-2">
          <button
            @click="router.push(`/payroll/export?recipientId=${recipient.id}`)"
            class="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300 transition-colors"
          >
            {{ $t('payroll.historyExportButton') }}
          </button>
          <button
            :disabled="regenerating"
            @click="onRegenerateReceipts"
            class="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gh-800 dark:hover:bg-gh-700 dark:text-gray-300 transition-colors disabled:opacity-40"
          >
            {{ regenerating ? $t('common.pleaseWait') : $t('payroll.historyRegenerateButton') }}
          </button>
        </div>
        <p v-if="regenerateResult" class="text-xs text-center text-gray-500 dark:text-gray-400">{{ regenerateResult }}</p>

        <!-- Filters -->
        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4 space-y-3">
          <label class="block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{{ $t('payroll.historyFilterTitle') }}</label>
          <div class="flex gap-2">
            <div class="flex-1">
              <label class="block mb-1 text-[11px] text-gray-400 dark:text-gray-500">{{ $t('payroll.exportFrom') }}</label>
              <input type="date" v-model="fromDate" class="w-full px-2.5 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gh-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gh-600" />
            </div>
            <div class="flex-1">
              <label class="block mb-1 text-[11px] text-gray-400 dark:text-gray-500">{{ $t('payroll.exportTo') }}</label>
              <input type="date" v-model="toDate" class="w-full px-2.5 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gh-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gh-600" />
            </div>
          </div>
          <div>
            <label class="block mb-1 text-[11px] text-gray-400 dark:text-gray-500">{{ $t('payroll.historyFilterStatus') }}</label>
            <select v-model="statusFilter" class="w-full px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gh-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gh-600">
              <option value="">{{ $t('payroll.historyStatusAny') }}</option>
              <option v-for="s in ['pending', 'sending', 'sent', 'failed']" :key="s" :value="s">{{ $t(`payroll.paymentStatus.${s}`) }}</option>
            </select>
          </div>
        </div>

        <!-- Per-period breakdown (filtered) -->
        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
          <p class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{{ $t('payroll.historyPerPeriod') }}</p>
          <p v-if="!perPeriod.length" class="px-4 py-4 text-sm text-gray-400 dark:text-gray-500 text-center">{{ $t('payroll.historyNoPayments') }}</p>
          <div v-for="p in perPeriod" :key="p.periodLabel" class="border-t border-gray-100 dark:border-gh-700 px-4 py-3 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm text-gray-900 dark:text-white truncate">{{ p.periodLabel }}</p>
              <p class="text-xs text-gray-400 dark:text-gray-500">{{ p.date }}</p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-sm text-gray-700 dark:text-gray-300">{{ p.amountNav }} NAV</p>
              <p v-if="p.fiatAmount != null" class="text-xs text-gray-400 dark:text-gray-500">
                {{ p.fiatAmount.toFixed(2) }} {{ p.mixedCurrency ? $t('payroll.historyMixedCurrency') : p.currency }}
              </p>
            </div>
          </div>
        </div>

        <!-- Filtered payment list -->
        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 divide-y divide-gray-100 dark:divide-gh-700">
          <div v-for="row in filteredRows" :key="row.paymentId" class="px-4 py-3 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm text-gray-900 dark:text-white truncate">{{ row.periodLabel }}</p>
              <p class="text-xs font-mono text-gray-400 dark:text-gray-500 truncate">{{ row.transactionId || row.recipientAddress }}</p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ trimTrailingZeros(row.amountNav) }} NAV</p>
              <p class="text-[11px]" :class="statusColor(row.status)">{{ $t(`payroll.paymentStatus.${row.status}`) }}</p>
            </div>
          </div>
        </div>

      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { getRecipient } from "@/lib/payroll/recipients.js";
import { resolveRecipientScope } from "@/lib/payroll/exportData.js";
import { generateReceipt } from "@/lib/payroll/receipts.js";
import { satToNavString } from "@/lib/payroll/satAmount.js";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const loading = ref(true);
const recipient = ref(null);
const allRows = ref([]);
const filteredRows = ref([]);
const fromDate = ref("");
const toDate = ref("");
const statusFilter = ref("");
const regenerating = ref(false);
const regenerateResult = ref("");

async function loadFiltered() {
  const { rows } = await resolveRecipientScope(route.params.id, {
    from: fromDate.value || null,
    to: toDate.value || null,
    status: statusFilter.value || null,
  });
  filteredRows.value = rows;
}

onMounted(async () => {
  loading.value = true;
  recipient.value = await getRecipient(route.params.id);
  if (recipient.value) {
    const { rows } = await resolveRecipientScope(route.params.id);
    allRows.value = rows;
    await loadFiltered();
  }
  loading.value = false;
});

watch([fromDate, toDate, statusFilter], loadFiltered);

// BigInt-exact throughout, not a float sum of r.amountNav — see satAmount.js.
const totalNavLifetime = computed(() => {
  const totalSat = allRows.value.reduce((sum, r) => sum + BigInt(r.amountSat), 0n);
  return trimTrailingZeros(satToNavString(totalSat));
});
const firstPaymentDate = computed(() => allRows.value.reduce((min, r) => (min === null || r.date < min ? r.date : min), null));
const lastPaymentDate = computed(() => allRows.value.reduce((max, r) => (max === null || r.date > max ? r.date : max), null));

const addressHistory = computed(() => {
  const byAddress = new Map();
  for (const r of allRows.value) {
    if (!byAddress.has(r.recipientAddress)) {
      byAddress.set(r.recipientAddress, { address: r.recipientAddress, count: 0, firstDate: r.date, lastDate: r.date });
    }
    const entry = byAddress.get(r.recipientAddress);
    entry.count += 1;
    if (r.date < entry.firstDate) entry.firstDate = r.date;
    if (r.date > entry.lastDate) entry.lastDate = r.date;
  }
  return [...byAddress.values()]
    .map((e) => ({ ...e, isCurrent: e.address === recipient.value?.address }))
    .sort((a, b) => a.firstDate.localeCompare(b.firstDate));
});

const perPeriod = computed(() => {
  const byPeriod = new Map();
  for (const r of filteredRows.value) {
    if (!byPeriod.has(r.periodLabel)) {
      byPeriod.set(r.periodLabel, { periodLabel: r.periodLabel, date: r.date, amountSat: 0n, fiatAmount: null, currency: null, mixedCurrency: false });
    }
    const entry = byPeriod.get(r.periodLabel);
    entry.amountSat += BigInt(r.amountSat);
    if (r.fiatAmount != null) {
      if (entry.currency && entry.currency !== r.currency) entry.mixedCurrency = true;
      entry.currency = r.currency;
      entry.fiatAmount = (entry.fiatAmount || 0) + r.fiatAmount;
    }
  }
  return [...byPeriod.values()]
    .map((e) => ({ ...e, amountNav: trimTrailingZeros(satToNavString(e.amountSat)) }))
    .sort((a, b) => a.date.localeCompare(b.date));
});

// String-only trim (no float parse) so an amount that's already an exact
// BigInt-derived decimal string never round-trips through Number for
// display — see satAmount.js.
function trimTrailingZeros(navString) {
  return navString.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function statusColor(status) {
  return {
    sent: "text-green-600 dark:text-green-400",
    sending: "text-blue-500 dark:text-blue-400",
    failed: "text-red-500 dark:text-red-400",
    pending: "text-gray-400 dark:text-gray-500",
  }[status] || "text-gray-400 dark:text-gray-500";
}

async function onRegenerateReceipts() {
  regenerating.value = true;
  regenerateResult.value = "";
  try {
    const sent = filteredRows.value.filter((r) => r.status === "sent");
    if (!sent.length) {
      regenerateResult.value = t("payroll.historyRegenerateNone");
      return;
    }
    let ok = 0;
    for (const row of sent) {
      try {
        await generateReceipt(row.paymentId);
        ok++;
      } catch (e) {
        // wallet_locked/wallet_not_ready won't resolve itself mid-loop —
        // stop immediately and say so, rather than repeating the same
        // failure for every remaining payment.
        if (e?.message === "wallet_locked" || e?.message === "wallet_not_ready") {
          regenerateResult.value = e.message === "wallet_locked" ? t("payroll.walletLocked") : t("payroll.walletNotReady");
          return;
        }
        // Any other single payment's receipt failing shouldn't stop the
        // rest — the count below reflects how many actually succeeded.
      }
    }
    regenerateResult.value = t("payroll.historyRegenerateResult", { n: ok });
  } finally {
    regenerating.value = false;
  }
}
</script>
