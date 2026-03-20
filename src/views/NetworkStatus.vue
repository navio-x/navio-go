<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gh-900 p-5 space-y-5">

    <!-- Header -->
    <div class="flex items-center gap-3">
      <button
        @click="router.back()"
        class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400"
      >
        <ChevronLeft class="w-5 h-5" />
      </button>
      <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ $t('settings.networkStatus') }}</h2>
      <button
        @click="refresh"
        :disabled="loading"
        class="ml-auto p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-500 dark:text-gray-400 disabled:opacity-40"
      >
        <RefreshCw class="w-4 h-4" :class="loading ? 'animate-spin' : ''" />
      </button>
    </div>

    <!-- Error -->
    <div
      v-if="error"
      class="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400"
    >
      {{ $t('errors.networkError') }}
    </div>

    <!-- Network card -->
    <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-100 dark:border-gh-700">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{{ $t('settings.netNetwork') }}</p>
      </div>
      <div class="divide-y divide-gray-100 dark:divide-gh-700">

        <StatRow :label="$t('settings.netBlockHeight')">
          <template v-if="stats.height != null">#{{ stats.height.toLocaleString() }}</template>
          <Skeleton v-else />
        </StatRow>

        <StatRow :label="$t('settings.netAvgBlockTime')">
          <template v-if="stats.avgBlockTime != null">{{ stats.avgBlockTime.toFixed(1) }}s</template>
          <Skeleton v-else />
        </StatRow>

        <StatRow :label="$t('settings.netMempool')">
          <template v-if="stats.mempoolSize != null">
            {{ stats.mempoolSize }} txs
            <span v-if="stats.mempoolBytes" class="text-xs text-gray-400 dark:text-gray-500 ml-1">({{ formatBytes(stats.mempoolBytes) }})</span>
          </template>
          <Skeleton v-else />
        </StatRow>

        <StatRow :label="$t('settings.netConnections')">
          <template v-if="stats.connections != null">
            <span class="flex items-center gap-1.5">
              <span
                class="w-2 h-2 rounded-full"
                :class="stats.connections > 0 ? 'bg-green-500' : 'bg-red-500'"
              />
              {{ stats.connections }}
            </span>
          </template>
          <Skeleton v-else />
        </StatRow>

        <StatRow :label="$t('settings.netBlsct')">
          <template v-if="stats.blsctPct != null">
            <span class="text-blue-600 dark:text-blue-400 font-semibold">{{ stats.blsctPct }}%</span>
          </template>
          <Skeleton v-else />
        </StatRow>

      </div>
    </div>

    <!-- Supply card -->
    <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-100 dark:border-gh-700">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{{ $t('settings.netSupply') }}</p>
      </div>
      <div class="divide-y divide-gray-100 dark:divide-gh-700">

        <StatRow :label="$t('settings.netTotalSupply')">
          <template v-if="supply.total != null">{{ formatNav(supply.total) }} <span class="text-xs text-gray-400 font-normal">NAV</span></template>
          <Skeleton v-else />
        </StatRow>

        <StatRow :label="$t('settings.netMaxSupply')">
          <template v-if="supply.max != null">{{ formatNav(supply.max) }} <span class="text-xs text-gray-400 font-normal">NAV</span></template>
          <Skeleton v-else />
        </StatRow>

        <StatRow :label="$t('settings.netBurned')">
          <template v-if="supply.burned != null">
            <span class="text-orange-500 dark:text-orange-400 font-semibold">{{ formatNav(supply.burned) }}</span>
            <span class="text-xs text-gray-400 font-normal ml-1">NAV</span>
          </template>
          <Skeleton v-else />
        </StatRow>

        <StatRow :label="$t('settings.netBlockReward')">
          <template v-if="supply.blockReward != null">{{ formatNav(supply.blockReward) }} <span class="text-xs text-gray-400 font-normal">NAV</span></template>
          <Skeleton v-else />
        </StatRow>

      </div>
    </div>

    <!-- Last updated -->
    <p v-if="lastUpdated" class="text-center text-xs text-gray-400 dark:text-gray-600">
      {{ $t('settings.netUpdated') }} {{ lastUpdated }}
    </p>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, defineComponent, h } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, RefreshCw } from 'lucide-vue-next'

const router = useRouter()

// ── Inline helpers ──────────────────────────────────────────────────────────

const Skeleton = defineComponent({
  render: () => h('span', { class: 'inline-block w-16 h-4 rounded bg-gray-200 dark:bg-gh-700 animate-pulse' })
})

const StatRow = defineComponent({
  props: { label: String },
  setup(props, { slots }) {
    return () => h('div', { class: 'flex items-center justify-between px-4 py-3' }, [
      h('span', { class: 'text-sm text-gray-500 dark:text-gray-400' }, props.label),
      h('span', { class: 'text-sm font-medium text-gray-900 dark:text-white' }, slots.default?.()),
    ])
  }
})

// ── State ───────────────────────────────────────────────────────────────────

const loading     = ref(false)
const error       = ref(false)
const lastUpdated = ref(null)

const stats  = ref({ height: null, avgBlockTime: null, mempoolSize: null, mempoolBytes: null, connections: null, blsctPct: null })
const supply = ref({ total: null, max: null, burned: null, blockReward: null })

// ── Fetch ───────────────────────────────────────────────────────────────────

async function refresh() {
  if (loading.value) return
  loading.value = true
  error.value   = false
  try {
    const [statsRes, supplyRes] = await Promise.all([
      fetch('https://blocks.nav.io/api/stats'),
      fetch('https://blocks.nav.io/api/supply'),
    ])
    const s  = await statsRes.json()
    const su = await supplyRes.json()

    stats.value = {
      height:       s.height            ?? null,
      avgBlockTime: s.avg_block_time     ?? null,
      mempoolSize:  s.mempool_size       ?? null,
      mempoolBytes: s.mempool_bytes      ?? null,
      connections:  s.connections        ?? null,
      blsctPct:     s.blsct_percentage   ?? null,
    }
    supply.value = {
      total:       su.total_supply  != null ? su.total_supply  / 1e8 : null,
      max:         su.max_supply    != null ? su.max_supply    / 1e8 : null,
      burned:      su.total_burned  != null ? su.total_burned  / 1e8 : null,
      blockReward: su.block_reward  != null ? su.block_reward  / 1e8 : null,
    }
    lastUpdated.value = new Date().toLocaleTimeString()
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

// ── Formatters ───────────────────────────────────────────────────────────────

function formatNav(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(2) + 'K'
  return n.toFixed(4)
}

function formatBytes(b) {
  if (b >= 1024) return (b / 1024).toFixed(1) + ' KB'
  return b + ' B'
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

let _timer = null
onMounted(() => { refresh(); _timer = setInterval(refresh, 60_000) })
onUnmounted(() => { if (_timer) clearInterval(_timer) })
</script>
