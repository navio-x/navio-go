<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">

    <div class="flex items-center gap-3 px-5 pt-5 pb-5">
      <button
        @click="router.back()"
        class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400"
      >
        <ChevronLeft class="w-5 h-5" />
      </button>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('trade.assets.title') }}</h1>
      <button
        @click="refreshAssets"
        :disabled="assetsLoading"
        class="ml-auto p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-500 dark:text-gray-400 disabled:opacity-40"
      >
        <RefreshCw class="w-4 h-4" :class="assetsLoading ? 'animate-spin' : ''" />
      </button>
    </div>

    <!-- Loading state -->
    <div
      v-if="assetsLoading && assetBalances.length === 0"
      class="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 space-y-3"
    >
      <Loader2 class="w-8 h-8 animate-spin opacity-60" />
      <p class="text-sm">{{ $t('trade.assets.loading') }}</p>
    </div>

    <template v-else>
      <div class="px-5 pb-6 space-y-6">

        <!-- NAV: always present, not tappable — informational balance only -->
        <div class="p-4 rounded-xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 flex items-center gap-3">
          <div class="shrink-0 w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
            <Coins class="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ $t('trade.assets.nav') }}</p>
          </div>
          <p class="font-semibold tabular-nums text-gray-900 dark:text-white text-sm">{{ navBalance.toString() }}</p>
        </div>

        <!-- Empty state for tokens/NFTs -->
        <div
          v-if="tokenAssets.length === 0 && nftAssets.length === 0"
          class="text-center text-sm text-gray-400 dark:text-gray-500 py-8"
        >
          {{ $t('trade.assets.empty') }}
        </div>

        <!-- Tokens -->
        <div v-if="tokenAssets.length > 0" class="space-y-2">
          <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 px-1">
            {{ $t('trade.assets.tokens') }} ({{ tokenAssets.length }})
          </h2>
          <button
            v-for="asset in tokenAssets"
            :key="asset.tokenId"
            @click="router.push(`/trade/assets/${asset.tokenId}`)"
            class="w-full text-left p-4 rounded-xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gh-700 transition-colors"
          >
            <div class="shrink-0 w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <Coins class="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div class="min-w-0 flex-1">
              <p v-if="assetLabel(asset)" class="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {{ assetLabel(asset) }}
              </p>
              <p class="font-mono text-xs text-gray-700 dark:text-gray-300 truncate" :class="{ 'mt-0.5': assetLabel(asset) }">{{ asset.tokenId }}</p>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {{ $t('trade.assets.outputCount', { n: asset.outputCount }) }}
              </p>
            </div>
            <div class="shrink-0 flex items-center gap-2">
              <p class="font-semibold tabular-nums text-gray-900 dark:text-white text-sm">{{ asset.balance.toString() }}</p>
              <ChevronRight class="w-4 h-4 opacity-40" />
            </div>
          </button>
        </div>

        <!-- NFTs -->
        <div v-if="nftAssets.length > 0" class="space-y-2">
          <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 px-1">
            {{ $t('trade.assets.nfts') }} ({{ nftAssets.length }})
          </h2>
          <button
            v-for="asset in nftAssets"
            :key="asset.tokenId"
            @click="router.push(`/trade/assets/${asset.tokenId}`)"
            class="w-full text-left p-4 rounded-xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gh-700 transition-colors"
          >
            <div class="shrink-0 w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
              <ImageIcon class="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div class="min-w-0 flex-1">
              <p v-if="assetLabel(asset)" class="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {{ assetLabel(asset) }}
              </p>
              <p class="font-mono text-xs text-gray-700 dark:text-gray-300 truncate" :class="{ 'mt-0.5': assetLabel(asset) }">{{ asset.tokenId }}</p>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {{ $t('trade.tokenDetail.nftId') }}: {{ asset.nftId != null ? asset.nftId.toString() : '—' }}
              </p>
            </div>
            <ChevronRight class="w-4 h-4 opacity-40 shrink-0" />
          </button>
        </div>

      </div>
    </template>

  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, ChevronRight, RefreshCw, Loader2, Coins, Image as ImageIcon } from 'lucide-vue-next'
import { assetBalances, navBalance, assetsLoading, refreshAssets } from '@/stores/trade'

const router = useRouter()

const tokenAssets = computed(() => assetBalances.value.filter((a) => a.kind === 'token'))
const nftAssets = computed(() => assetBalances.value.filter((a) => a.kind === 'nft'))

function assetLabel(asset) {
  const { name, symbol } = asset.metadata ?? {}
  if (name && symbol) return `${name} (${symbol})`
  if (name) return name
  if (symbol) return symbol
  return null
}

let pollTimer = null
onMounted(async () => {
  await refreshAssets()
  pollTimer = setInterval(refreshAssets, 15000)
})
onUnmounted(() => {
  clearInterval(pollTimer)
})
</script>
