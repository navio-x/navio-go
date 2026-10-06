<!-- Everything the wallet has done, in one list: Navio transactions,
     Hyperliquid trades and transfers, and swaps made on BNB Chain — each row
     carrying its network's mark. Newest first, grouped by day; a row opens
     to its details. -->
<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">
    <div class="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('wallet.transactionHistory') }}</h1>
      <Loader2
        v-if="!loading && exchangeLoading"
        class="w-4 h-4 animate-spin text-gray-400 dark:text-gray-500"
        role="status"
        :aria-label="$t('common.loading')"
      />
    </div>

    <!-- Network filter -->
    <div v-if="settings.dexMode" class="filter-strip px-5 pb-3 flex gap-2 overflow-x-auto whitespace-nowrap" role="tablist">
      <button
        v-for="f in FILTERS"
        :key="f.id"
        role="tab"
        :aria-selected="filter === f.id"
        @click="filter = f.id"
        class="shrink-0 flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
        :class="filter === f.id
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'bg-white dark:bg-gh-800 border-gray-200 dark:border-gh-700 text-gray-600 dark:text-gray-300'"
      >
        <TokenIcon v-if="f.logo" :symbol="f.id" :logo="f.logo" :size="18" />
        <span :class="{ 'pl-1': !f.logo }">{{ $t(f.label) }}</span>
      </button>
    </div>

    <!-- Loading state -->
    <div
      v-if="loading"
      class="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 space-y-3"
    >
      <Loader2 class="w-8 h-8 animate-spin opacity-60" />
      <p class="text-sm">{{ $t('wallet.loadingTransactions') }}</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="shown.length === 0" class="flex-1 flex items-center justify-center px-5 pb-6">
      <div class="flex flex-col items-center gap-4 text-center max-w-xs">
        <div class="w-16 h-16 rounded-3xl bg-gray-100 dark:bg-gh-800 flex items-center justify-center">
          <History class="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
        <div class="space-y-1.5">
          <p class="font-semibold text-gray-800 dark:text-gray-100">{{ $t('wallet.noTransactionsYet') }}</p>
          <p class="text-sm text-gray-400 dark:text-gray-500 leading-relaxed">
            {{ filter === 'bsc' ? $t('history.bscNote') : filter === 'all' || filter === 'navio' ? $t('wallet.noTransactionsDesc') : $t('history.emptyFilter') }}
          </p>
        </div>
      </div>
    </div>

    <div v-else class="px-5 pb-6 space-y-4">
      <!-- Navio totals, when looking at Navio alone -->
      <div v-if="filter === 'navio'" class="grid grid-cols-2 gap-3">
        <div class="p-3 rounded-2xl bg-white dark:bg-gh-800 border border-gray-200 dark:border-gh-700">
          <p class="text-xs text-gray-400 dark:text-gray-500 flex items-baseline justify-between">
            {{ $t('wallet.received') }}
            <span class="tabular-nums">{{ recvTxs.length }} {{ $t('wallet.txs') }}</span>
          </p>
          <p class="text-sm font-semibold text-buy mt-1 tabular-nums truncate">+{{ formatAmount(recvTotal, 8) }} NAV</p>
        </div>
        <div class="p-3 rounded-2xl bg-white dark:bg-gh-800 border border-gray-200 dark:border-gh-700">
          <p class="text-xs text-gray-400 dark:text-gray-500 flex items-baseline justify-between">
            {{ $t('wallet.sent') }}
            <span class="tabular-nums">{{ sentTxs.length }} {{ $t('wallet.txs') }}</span>
          </p>
          <p class="text-sm font-semibold text-sell mt-1 tabular-nums truncate">{{ sentTotal > 0 ? '−' : '' }}{{ formatAmount(sentTotal, 8) }} NAV</p>
        </div>
      </div>

      <section v-for="group in groups" :key="group.key">
        <h2 class="px-1 pb-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500">{{ group.label }}</h2>
        <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden divide-y divide-gray-100 dark:divide-gh-700">
          <div v-for="row in group.rows" :key="row.id">
            <button
              type="button"
              @click="openId = openId === row.id ? null : row.id"
              :aria-expanded="openId === row.id"
              class="w-full px-3.5 py-3 flex items-center gap-3 text-left"
            >
              <!-- What happened, with the network it happened on -->
              <span class="relative shrink-0">
                <span class="w-10 h-10 rounded-full flex items-center justify-center" :class="row.tone.bg">
                  <component :is="row.icon" class="w-5 h-5" :class="row.tone.fg" />
                </span>
                <span class="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-white dark:ring-gh-800">
                  <TokenIcon :symbol="row.source" :logo="NETWORKS[row.source].logo" :size="16" />
                </span>
              </span>

              <span class="flex-1 min-w-0">
                <span class="flex items-center gap-1.5">
                  <span class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ row.title }}</span>
                  <span
                    v-if="row.pending"
                    class="shrink-0 px-1.5 py-px rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
                  >
                    {{ $t('wallet.pending') }}
                  </span>
                </span>
                <span class="block text-xs text-gray-400 dark:text-gray-500 truncate">{{ row.subtitle }}</span>
              </span>

              <span class="shrink-0 text-right max-w-[45%]">
                <span class="block text-sm font-semibold tabular-nums truncate" :class="row.amountClass">{{ row.amount }}</span>
                <span v-if="row.secondary" class="block text-xs text-gray-400 dark:text-gray-500 tabular-nums truncate">{{ row.secondary }}</span>
              </span>
            </button>

            <!-- Details -->
            <dl v-if="openId === row.id" class="px-3.5 pb-3.5 pt-0.5 space-y-2 text-xs">
              <div v-for="line in row.details" :key="line.label" class="flex items-start justify-between gap-4">
                <dt class="shrink-0 text-gray-400 dark:text-gray-500">{{ line.label }}</dt>
                <dd class="text-right text-gray-700 dark:text-gray-200 break-all" :class="{ 'font-mono': line.mono }">{{ line.value }}</dd>
              </div>
              <div v-if="row.hash" class="flex items-center gap-2 pt-1">
                <button
                  @click="copyHash(row)"
                  class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-medium bg-gray-100 dark:bg-gh-700 text-gray-700 dark:text-gray-300"
                >
                  <Check v-if="copiedId === row.id" class="w-3.5 h-3.5 text-green-500" />
                  <Copy v-else class="w-3.5 h-3.5" />
                  {{ copiedId === row.id ? $t('common.copied') : $t('history.copyHash') }}
                </button>
                <a
                  v-if="row.explorerUrl"
                  :href="row.explorerUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-medium bg-gray-100 dark:bg-gh-700 text-gray-700 dark:text-gray-300"
                >
                  <ExternalLink class="w-3.5 h-3.5" />
                  {{ $t('dex.viewExplorer') }}
                </a>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <p v-if="filter === 'bsc' || (filter === 'all' && hasBsc)" class="text-center text-xs text-gray-400 dark:text-gray-500 leading-snug">
        {{ $t('history.bscNote') }}
      </p>
      <p class="text-center text-xs text-gray-400 dark:text-gray-600">
        {{ $t('wallet.txCount', { n: shown.length }) }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import copy from "copy-to-clipboard";
import {
  Loader2, History, ArrowDownLeft, ArrowUpRight, Repeat, RefreshCw, Circle, Copy, Check, ExternalLink,
} from "lucide-vue-next";
import { settings } from "@/stores/settings";
import { txHistory, refreshHistory, getNavioClient } from "@/stores/navio";
import { evmAddress } from "@/stores/evm";
import { deriveEvmAddress } from "@/composables/useEvmAccount";
import { fetchUserFills, fetchUserLedger } from "@/lib/hyperliquid/api";
import { getSpotMeta } from "@/lib/hyperliquid/meta";
import { normalizeHlActivity } from "@/lib/hyperliquid/history";
import { readSwapLog } from "@/lib/evm/swapLog";
import { getNetworkConfig } from "@/lib/evm/networkRegistry";
import { formatAmount } from "@/lib/displayFormat";
import TokenIcon from "@/components/TokenIcon.vue";

const { t, te, locale } = useI18n();

// Each network's mark is its own coin's icon.
const NETWORKS = {
  navio: { logo: "wnav-light.svg" },
  hl: { logo: "hype.jpg" },
  bsc: { logo: "wbnb.webp" },
};
const FILTERS = [
  { id: "all", label: "history.filters.all", logo: null },
  { id: "navio", label: "history.filters.navio", logo: NETWORKS.navio.logo },
  { id: "hl", label: "history.filters.hl", logo: NETWORKS.hl.logo },
  { id: "bsc", label: "history.filters.bsc", logo: NETWORKS.bsc.logo },
];
const NAVIO_POLL_MS = 10_000;
const EXCHANGE_POLL_MS = 30_000;

const TONES = {
  in: { bg: "bg-green-50 dark:bg-green-900/30", fg: "text-buy" },
  out: { bg: "bg-rose-50 dark:bg-rose-900/30", fg: "text-sell" },
  swap: { bg: "bg-blue-50 dark:bg-blue-900/30", fg: "text-blue-600 dark:text-blue-400" },
  neutral: { bg: "bg-gray-100 dark:bg-gh-700", fg: "text-gray-500 dark:text-gray-400" },
};
const POSITIVE = "text-buy";
const NEGATIVE = "text-gray-900 dark:text-white";
const NEUTRAL = "text-gray-500 dark:text-gray-400";

const loading = ref(true);
const exchangeLoading = ref(false);
const filter = ref("all");
const openId = ref(null);
const copiedId = ref(null);

const hlActivity = ref([]);
const bscSwaps = ref([]);

const shortAddress = (a) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || "");
const timeOf = (ms) =>
  ms ? new Date(ms).toLocaleTimeString(locale.value, { hour: "2-digit", minute: "2-digit" }) : "";
const joined = (...parts) => parts.filter(Boolean).join(" · ");

// --- Navio ---
const recvTxs = computed(() => txHistory.value.filter((tx) => tx.type === "recv"));
const sentTxs = computed(() => txHistory.value.filter((tx) => tx.type === "sent"));
const recvTotal = computed(() => recvTxs.value.reduce((sum, tx) => sum + Math.abs(tx.navAmount), 0));
const sentTotal = computed(() => sentTxs.value.reduce((sum, tx) => sum + Math.abs(tx.navAmount), 0));

const navioRows = computed(() =>
  txHistory.value.map((tx) => {
    const kind = tx.type === "recv" ? "in" : tx.type === "sent" ? "out" : "neutral";
    const amount = formatAmount(Math.abs(tx.navAmount), 8);
    return {
      id: `navio-${tx.txHash}`,
      source: "navio",
      time: tx.timestamp,
      icon: kind === "in" ? ArrowDownLeft : kind === "out" ? ArrowUpRight : RefreshCw,
      tone: TONES[kind],
      title: t(tx.type === "recv" ? "wallet.received" : tx.type === "sent" ? "wallet.sent" : "wallet.self"),
      subtitle: joined(timeOf(tx.timestamp), tx.memos.join(", ")),
      pending: tx.isUnconfirmed,
      amount: `${kind === "in" ? "+" : kind === "out" ? "−" : ""}${amount} NAV`,
      amountClass: kind === "in" ? POSITIVE : kind === "out" ? NEGATIVE : NEUTRAL,
      hash: tx.txHash,
      details: [
        { label: t("history.network"), value: "Navio" },
        { label: t("wallet.block"), value: tx.isUnconfirmed ? t("wallet.unconfirmed") : String(tx.blockHeight) },
        ...(tx.memos.length ? [{ label: t("wallet.memoLabel"), value: tx.memos.join(", ") }] : []),
        { label: t("history.txHash"), value: tx.txHash, mono: true },
      ],
    };
  })
);

// --- Hyperliquid ---
function hlTransferTitle(item) {
  const incoming = item.kind === "in";
  if (item.via === "bridge") return t(incoming ? "history.fromWallet" : "history.toWallet");
  if (item.via === "gas") return t("history.gasTopUp");
  if (item.via === "arbitrum") return t(incoming ? "history.arbDeposit" : "history.arbWithdraw");
  return t(incoming ? "wallet.received" : "wallet.sent");
}

const hlRows = computed(() =>
  hlActivity.value.map((item) => {
    const base = {
      id: item.id,
      source: "hl",
      time: item.time,
      hash: /^0x0+$/.test(item.hash || "") ? null : item.hash,
    };
    const network = { label: t("history.network"), value: "Hyperliquid" };
    const hashLine = base.hash ? [{ label: t("history.txHash"), value: base.hash, mono: true }] : [];

    if (item.kind === "trade") {
      const buy = item.side === "buy";
      return {
        ...base,
        icon: Repeat,
        tone: TONES.swap,
        title: t(buy ? "history.bought" : "history.sold", { symbol: item.base }),
        subtitle: joined(timeOf(item.time), `${formatAmount(item.price)} ${item.quote}`),
        amount: `${buy ? "+" : "−"}${formatAmount(item.size)} ${item.base}`,
        amountClass: buy ? POSITIVE : NEGATIVE,
        secondary: `${buy ? "−" : "+"}${formatAmount(item.value)} ${item.quote}`,
        details: [
          network,
          { label: t("history.price"), value: `${formatAmount(item.price)} ${item.quote}` },
          { label: t("wallet.total"), value: `${formatAmount(item.value)} ${item.quote}` },
          ...hashLine,
        ],
      };
    }

    if (item.kind === "in" || item.kind === "out") {
      const incoming = item.kind === "in";
      return {
        ...base,
        icon: incoming ? ArrowDownLeft : ArrowUpRight,
        tone: TONES[item.kind],
        title: hlTransferTitle(item),
        subtitle: joined(timeOf(item.time), item.via ? "" : shortAddress(item.counterparty)),
        amount: `${incoming ? "+" : "−"}${formatAmount(item.amount)} ${item.symbol}`,
        amountClass: incoming ? POSITIVE : NEGATIVE,
        details: [
          network,
          ...(item.counterparty && !item.via
            ? [{ label: t(incoming ? "history.from" : "history.to"), value: item.counterparty, mono: true }]
            : []),
          ...hashLine,
        ],
      };
    }

    return {
      ...base,
      icon: Circle,
      tone: TONES.neutral,
      title: te(`history.other.${item.label}`) ? t(`history.other.${item.label}`) : item.label,
      subtitle: timeOf(item.time),
      amount: item.amount != null ? `${formatAmount(item.amount)} ${item.symbol}` : "",
      amountClass: NEUTRAL,
      details: [network, ...hashLine],
    };
  })
);

// --- BNB Chain (swaps made in this app) ---
const bscRows = computed(() =>
  bscSwaps.value.map((swap) => {
    const network = getNetworkConfig(swap.chainId);
    return {
      id: `bsc-${swap.hash}`,
      source: "bsc",
      time: swap.time,
      icon: Repeat,
      tone: TONES.swap,
      title: t("history.swapped", { from: swap.from.symbol, to: swap.to.symbol }),
      subtitle: timeOf(swap.time),
      amount: `+${formatAmount(swap.to.amount)} ${swap.to.symbol}`,
      amountClass: POSITIVE,
      secondary: `−${formatAmount(swap.from.amount)} ${swap.from.symbol}`,
      hash: swap.hash,
      explorerUrl: network?.explorer ? `${network.explorer}/tx/${swap.hash}` : null,
      details: [
        { label: t("history.network"), value: network?.name ?? `Chain ${swap.chainId}` },
        { label: t("history.txHash"), value: swap.hash, mono: true },
      ],
    };
  })
);
const hasBsc = computed(() => bscRows.value.length > 0);

// --- One list ---
const shown = computed(() => {
  const sources = { navio: navioRows.value, hl: hlRows.value, bsc: bscRows.value };
  const rows = filter.value === "all" ? Object.values(sources).flat() : sources[filter.value];
  // Rows without a known time sink to the bottom.
  return [...rows].sort((a, b) => (b.time ?? 0) - (a.time ?? 0));
});

function dayKey(ms) {
  if (!ms) return "unknown";
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(ms) {
  if (!ms) return t("history.unknownDate");
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (dayKey(ms) === dayKey(today.getTime())) return t("history.today");
  if (dayKey(ms) === dayKey(yesterday.getTime())) return t("history.yesterday");
  const d = new Date(ms);
  return d.toLocaleDateString(locale.value, {
    day: "numeric",
    month: "long",
    ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });
}

const groups = computed(() => {
  const out = [];
  for (const row of shown.value) {
    const key = dayKey(row.time);
    let group = out[out.length - 1];
    if (!group || group.key !== key) {
      group = { key, label: dayLabel(row.time), rows: [] };
      out.push(group);
    }
    group.rows.push(row);
  }
  return out;
});

function copyHash(row) {
  copy(row.hash);
  copiedId.value = row.id;
  setTimeout(() => { if (copiedId.value === row.id) copiedId.value = null; }, 2000);
}

// --- Loading ---
let navioTimer = null;
let exchangeTimer = null;
let unmounted = false;

// Gated on dexMode like every other Hyperliquid/EVM feature: with it off
// nothing is requested and the screen is the Navio history alone.
async function loadExchange() {
  const address = settings.dexMode ? evmAddress.value : "";
  if (!address) {
    hlActivity.value = [];
    bscSwaps.value = [];
    return;
  }
  bscSwaps.value = readSwapLog(address);
  exchangeLoading.value = hlActivity.value.length === 0;
  try {
    const [fills, ledger, meta] = await Promise.all([fetchUserFills(address), fetchUserLedger(address), getSpotMeta()]);
    if (unmounted || evmAddress.value !== address) return;
    hlActivity.value = normalizeHlActivity({ fills, ledger, meta, address });
  } catch (e) {
    // The last good list stays; Navio history is unaffected.
    console.error("[history] Hyperliquid activity failed:", e?.message);
  } finally {
    exchangeLoading.value = false;
  }
}

watch(() => (settings.dexMode ? evmAddress.value : ""), loadExchange);

onMounted(async () => {
  loadExchange();
  exchangeTimer = setInterval(() => {
    if (document.visibilityState === "visible") loadExchange();
  }, EXCHANGE_POLL_MS);

  // The exchange account may not be derived yet if this is the first screen opened.
  if (settings.dexMode && !evmAddress.value && getNavioClient()) {
    deriveEvmAddress(0).catch((e) => console.error("[history] EVM derivation error:", e?.message));
  }

  await refreshHistory();
  loading.value = false;
  navioTimer = setInterval(refreshHistory, NAVIO_POLL_MS);
});

onUnmounted(() => {
  unmounted = true;
  clearInterval(navioTimer);
  clearInterval(exchangeTimer);
});
</script>

<style scoped>
.filter-strip {
  scrollbar-width: none;
}
.filter-strip::-webkit-scrollbar {
  display: none;
}
</style>
