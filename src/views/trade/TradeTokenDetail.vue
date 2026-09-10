<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">

    <div class="flex items-center gap-3 px-5 pt-5 pb-5">
      <button
        @click="router.back()"
        class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400"
      >
        <ChevronLeft class="w-5 h-5" />
      </button>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white truncate">{{ headerLabel }}</h1>
    </div>

    <div v-if="assetsLoading && !asset" class="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 space-y-3">
      <Loader2 class="w-8 h-8 animate-spin opacity-60" />
    </div>

    <div v-else-if="!asset" class="flex-1 flex items-center justify-center px-5 pb-6">
      <p class="text-sm text-gray-400 dark:text-gray-500 text-center">{{ $t('trade.tokenDetail.notFound') }}</p>
    </div>

    <div v-else class="px-5 pb-6 space-y-4">

      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden divide-y divide-gray-100 dark:divide-gh-700">
        <div class="px-4 py-3 flex items-center justify-between">
          <span class="text-sm text-gray-500 dark:text-gray-400">{{ $t('trade.tokenDetail.balance') }}</span>
          <span class="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{{ asset.balance.toString() }}</span>
        </div>
        <div v-if="asset.kind === 'nft'" class="px-4 py-3 flex items-center justify-between">
          <span class="text-sm text-gray-500 dark:text-gray-400">{{ $t('trade.tokenDetail.nftId') }}</span>
          <span class="text-sm font-mono text-gray-900 dark:text-white">{{ asset.nftId != null ? asset.nftId.toString() : '—' }}</span>
        </div>
        <div v-if="asset.totalSupply != null" class="px-4 py-3 flex items-center justify-between">
          <span class="text-sm text-gray-500 dark:text-gray-400">{{ $t('trade.tokenDetail.totalSupply') }}</span>
          <span class="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{{ asset.totalSupply.toString() }}</span>
        </div>
      </div>

      <!-- Both id forms the SDK exposes: the public on-chain id (what balances,
           outputs and trading calls all key on) vs. the wallet-local creation
           id (only meaningful for minting more of a collection you created). -->
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4 space-y-3">
        <div class="space-y-1">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{{ $t('trade.tokenDetail.publicId') }}</p>
          <div class="flex items-center gap-2">
            <p class="font-mono text-xs text-gray-700 dark:text-gray-300 break-all flex-1">{{ asset.tokenId }}</p>
            <button @click="copyId(asset.tokenId)" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
              <Copy class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div v-if="createdCollection" class="space-y-1 pt-2 border-t border-gray-100 dark:border-gh-700">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{{ $t('trade.tokenDetail.creationId') }}</p>
          <div class="flex items-center gap-2">
            <p class="font-mono text-xs text-gray-700 dark:text-gray-300 break-all flex-1">{{ createdCollection.collectionTokenId }}</p>
            <button @click="copyId(createdCollection.collectionTokenId)" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
              <Copy class="w-3.5 h-3.5" />
            </button>
          </div>
          <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('trade.tokenDetail.creationIdHint') }}</p>
          <p class="text-xs text-blue-600 dark:text-blue-400 font-medium">{{ $t('trade.tokenDetail.youCreated') }}</p>
        </div>
      </div>

      <!-- Collection metadata -->
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4">
        <div v-if="metadataEntries.length > 0" class="space-y-2">
          <div v-for="[key, value] in metadataEntries" :key="key" class="flex items-start justify-between gap-3">
            <span class="text-xs text-gray-400 dark:text-gray-500 shrink-0">{{ key }}</span>
            <span class="text-sm text-gray-800 dark:text-gray-200 text-right break-all">{{ value }}</span>
          </div>
        </div>
        <p v-else class="text-sm text-gray-400 dark:text-gray-500">{{ $t('trade.tokenDetail.noMetadata') }}</p>
      </div>

      <!-- Outputs: fetched on demand, not part of the balance summary above -->
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
        <button
          @click="loadOutputs"
          :disabled="outputsLoading"
          class="w-full px-4 py-3.5 text-sm font-medium text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gh-700 transition-colors flex items-center justify-between disabled:opacity-60"
        >
          <span>{{ outputs === null ? $t('trade.tokenDetail.showOutputs') : $t('trade.tokenDetail.outputs') + ` (${outputs.length})` }}</span>
          <Loader2 v-if="outputsLoading" class="w-4 h-4 animate-spin opacity-60" />
          <ChevronRight v-else-if="outputs === null" class="w-4 h-4 opacity-40" />
        </button>
        <p v-if="outputsError" class="px-4 pb-3 text-sm text-red-500 dark:text-red-400">{{ $t('trade.tokenDetail.outputsError') }}</p>
        <div v-if="outputs && outputs.length > 0" class="divide-y divide-gray-100 dark:divide-gh-700 border-t border-gray-100 dark:border-gh-700">
          <div v-for="o in outputs" :key="o.outputHash" class="px-4 py-3 space-y-1">
            <div class="flex items-center justify-between">
              <span class="font-mono text-xs text-gray-500 dark:text-gray-400">{{ truncateHash(o.outputHash) }}</span>
              <span class="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{{ o.amount.toString() }}</span>
            </div>
            <p class="text-xs text-gray-400 dark:text-gray-500">
              <template v-if="o.blockHeight > 0">#{{ o.blockHeight.toLocaleString() }}</template>
              <template v-else>{{ $t('wallet.pending') }}</template>
              <span v-if="o.memo"> · {{ o.memo }}</span>
            </p>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight, Copy, Loader2 } from 'lucide-vue-next'
import copy from 'copy-to-clipboard'
import { assetBalances, assetsLoading, refreshAssets, getTokenOutputs } from '@/stores/trade'
import { createdCollections, refreshCreatedCollections } from '@/stores/navio'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const asset = computed(() => assetBalances.value.find((a) => a.tokenId === route.params.tokenId) ?? null)

// Join on the public id: an NFT's balance row carries its collection's
// public id in `collectionTokenId` (sliced from the on-chain token id, NOT
// the collection's local creation id — see stores/trade.js Phase 2 note);
// a fungible token's own tokenId IS its collection's public id.
const collectionPublicId = computed(() => {
  if (!asset.value) return null
  return asset.value.kind === 'nft' ? asset.value.collectionTokenId : asset.value.tokenId
})
const createdCollection = computed(() =>
  collectionPublicId.value
    ? createdCollections.value.find((c) => c.publicTokenId === collectionPublicId.value) ?? null
    : null
)

const headerLabel = computed(() => {
  const { name, symbol } = asset.value?.metadata ?? {}
  if (name && symbol) return `${name} (${symbol})`
  return name || symbol || t('trade.tokenDetail.title')
})

const metadataEntries = computed(() => {
  const meta = asset.value?.kind === 'nft' ? (asset.value?.nftMetadata ?? asset.value?.metadata) : asset.value?.metadata
  return meta ? Object.entries(meta) : []
})

function copyId(id) {
  copy(id)
}

function truncateHash(hash) {
  return hash.length > 20 ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : hash
}

const outputs = ref(null)
const outputsLoading = ref(false)
const outputsError = ref(false)

async function loadOutputs() {
  if (outputs.value !== null || outputsLoading.value || !asset.value) return
  outputsLoading.value = true
  outputsError.value = false
  try {
    outputs.value = await getTokenOutputs(asset.value.tokenId)
  } catch {
    outputsError.value = true
  } finally {
    outputsLoading.value = false
  }
}

// Reset outputs if the route param changes to a different token.
watch(() => route.params.tokenId, () => {
  outputs.value = null
  outputsError.value = false
})

onMounted(async () => {
  if (assetBalances.value.length === 0) await refreshAssets()
  if (createdCollections.value.length === 0) refreshCreatedCollections()
})
</script>
