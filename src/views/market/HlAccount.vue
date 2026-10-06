<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">
    <div class="flex items-center gap-3 px-5 pt-5 pb-4">
      <button
        @click="router.back()"
        class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400"
      >
        <ChevronLeft class="w-5 h-5" />
      </button>
      <h1 class="text-lg font-bold text-gray-900 dark:text-white truncate flex-1 min-w-0">{{ headerLabel }}</h1>
    </div>

    <div v-if="derivationError" class="mx-5 mb-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4">
      <p class="text-sm text-red-700 dark:text-red-300 leading-snug">{{ derivationError }}</p>
    </div>

    <div v-else-if="marketNotFound" class="flex-1 flex items-center justify-center px-5 pb-6">
      <p class="text-sm text-gray-400 dark:text-gray-500 text-center">{{ $t('market.notFound') }}</p>
    </div>

    <div v-else-if="!market" class="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 space-y-3">
      <Loader2 class="w-8 h-8 animate-spin opacity-60" />
      <p class="text-sm">{{ $t('market.resolving') }}</p>
    </div>

    <div v-else class="flex-1 px-5 pb-6 flex flex-col gap-4">
      <!-- Your balance — the base asset only; the quote (USDC) has its own page -->
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden">
        <div class="px-4 py-3 flex items-center justify-between gap-2">
          <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400">{{ $t('market.yourBalance') }}</h2>
          <div v-if="evmAddress" class="flex items-center gap-1 min-w-0">
            <p class="font-mono text-[11px] text-gray-400 dark:text-gray-500 truncate">{{ addressShort }}</p>
            <button
              @click="copyAddress"
              :aria-label="$t('common.copy')"
              class="p-1 rounded text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gh-700 shrink-0"
            >
              <Check v-if="addressCopied" class="w-3 h-3 text-green-500" />
              <Copy v-else class="w-3 h-3" />
            </button>
          </div>
        </div>
        <div class="border-t border-gray-200 dark:border-gh-700 px-4 py-2.5 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <TokenIcon :symbol="market.baseSymbol" :logo="MARKET_LOGOS[market.baseSymbol]" :size="22" />
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ market.baseSymbol }}</span>
          </div>
          <span class="text-sm font-mono text-gray-800 dark:text-gray-100">{{ balanceOf(market.baseSymbol) }}</span>
        </div>
        <div v-if="market.baseSymbol === 'NAV'" class="border-t border-gray-200 dark:border-gh-700 px-4 py-3 grid grid-cols-2 gap-2">
          <button
            @click="router.push('/bridge/deposit')"
            class="px-2 py-2 rounded-lg text-xs font-semibold leading-tight border border-gray-200 dark:border-gh-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gh-700 flex items-center justify-center gap-1.5"
          >
            <ArrowDownToLine class="w-3.5 h-3.5 shrink-0" />
            {{ $t('market.depositToBridge') }}
          </button>
          <button
            @click="router.push('/bridge/withdraw')"
            class="px-2 py-2 rounded-lg text-xs font-semibold leading-tight border border-gray-200 dark:border-gh-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gh-700 flex items-center justify-center gap-1.5"
          >
            <ArrowUpFromLine class="w-3.5 h-3.5 shrink-0" />
            {{ $t('market.withdrawFromBridge') }}
          </button>
        </div>

        <!-- Secondary: move wrapped NAV between Hyperliquid accounts (no
             bridge, no Navio network) — the generic asset page does this. -->
        <div v-if="market.baseSymbol === 'NAV'" class="border-t border-gray-200 dark:border-gh-700 px-4 py-3 space-y-2">
          <div>
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('market.hlTransfer.title') }}</p>
            <p class="text-[11px] leading-snug text-gray-400 dark:text-gray-500">{{ $t('market.hlTransfer.desc') }}</p>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button
              @click="router.push('/hl/asset/NAV?mode=deposit')"
              class="py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gh-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gh-600"
            >
              {{ $t('market.hlTransfer.receive') }}
            </button>
            <button
              @click="router.push('/hl/asset/NAV?mode=withdraw')"
              class="py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gh-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gh-600"
            >
              {{ $t('market.hlTransfer.send') }}
            </button>
          </div>
        </div>
      </div>

      <!-- What Wrapped Navio is -->
      <div v-if="market.baseSymbol === 'NAV'" class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4 space-y-2">
        <h2 class="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          <Info class="w-4 h-4 text-blue-500 shrink-0" />
          {{ $t('market.wrappedNav.title') }}
        </h2>
        <p class="text-xs leading-relaxed text-gray-500 dark:text-gray-400">{{ $t('market.wrappedNav.what') }}</p>
        <p class="text-xs leading-relaxed text-gray-500 dark:text-gray-400">{{ $t('market.wrappedNav.bridge') }}</p>
        <p class="text-xs leading-relaxed text-gray-500 dark:text-gray-400">{{ $t('market.wrappedNav.privacy') }}</p>
      </div>

      <!-- Open on Hyperliquid — pinned to the bottom of the page -->
      <a
        :href="hlOpenUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="mt-auto w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border border-gray-200 dark:border-gh-600 bg-white dark:bg-gh-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gh-700"
      >
        <ExternalLink class="w-4 h-4" />
        {{ $t('market.openOnHyperliquid') }}
      </a>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ExternalLink, Copy, Check, Loader2, Info, ArrowDownToLine, ArrowUpFromLine } from 'lucide-vue-next'
import copy from 'copy-to-clipboard'
import TokenIcon from '@/components/TokenIcon.vue'
import { evmAddress } from '@/stores/evm'
import { getNavioClient } from '@/stores/navio'
import { deriveEvmAddress } from '@/composables/useEvmAccount'
import { useHyperliquidBalances } from '@/composables/useHyperliquidBalances'
import { HL_SPOT_MARKETS } from '@/lib/hyperliquid/market'
import { HL_APP_URL } from '@/lib/hyperliquid/config'

// Same icons as MarketScreen.vue / DexView.vue's Hyperliquid card.
const MARKET_LOGOS = { NAV: 'wnav-light.svg', USDC: 'usdc.png', HYPE: 'hype.jpg', BTC: 'btc.png' }
const BASE_NAMES = { NAV: 'Wrapped Navio', BTC: 'Bitcoin' }

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const MARKET_RESOLVERS = Object.fromEntries(
  Object.entries(HL_SPOT_MARKETS).map(([pair, m]) => [pair, m.resolver])
)

const derivationError = ref('')
const marketNotFound = ref(false)
const market = ref(null)

const hl = useHyperliquidBalances(evmAddress)

const headerLabel = computed(() => {
  const base = market.value?.baseSymbol
  return base ? BASE_NAMES[base] ?? base : t('dex.hyperliquid.title')
})

function balanceOf(symbol) {
  const row = hl.balances.value.find((b) => b.symbol === symbol)
  if (!row) return '—'
  const num = Number(row.available)
  return Number.isFinite(num) ? num.toLocaleString(undefined, { maximumFractionDigits: 6 }) : row.available
}

// app.hyperliquid.xyz addresses spot markets as /trade/<base>/<quote> (e.g.
// /trade/NAV/USDC); the "@<pair index>" coin id isn't a valid path there and
// falls back to the app's default market.
const hlOpenUrl = computed(() => {
  const m = market.value
  return m ? `${HL_APP_URL}/trade/${m.baseTokenName}/${m.quoteSymbol}` : HL_APP_URL
})

const addressShort = computed(() =>
  evmAddress.value ? `${evmAddress.value.slice(0, 6)}…${evmAddress.value.slice(-4)}` : ''
)
const addressCopied = ref(false)
function copyAddress() {
  if (!evmAddress.value) return
  copy(evmAddress.value)
  addressCopied.value = true
  setTimeout(() => { addressCopied.value = false }, 2000)
}

// Derive once the Navio client exists — the page can be reached before
// loadWallet() has finished (same reasoning as WalletBalance.vue).
watch(
  () => !evmAddress.value && getNavioClient(),
  async (client) => {
    if (!client) return
    try {
      await deriveEvmAddress(0)
    } catch (e) {
      console.error('[hl-account] derivation error:', e)
      if (e.message === 'wallet_locked') derivationError.value = t('dex.errors.walletLocked')
      else derivationError.value = t('dex.errors.derivationFailed')
    }
  },
  { immediate: true },
)

onMounted(async () => {
  const resolver = MARKET_RESOLVERS[route.params.pair]
  if (!resolver) {
    marketNotFound.value = true
    return
  }
  try {
    const resolved = await resolver()
    if (!resolved) marketNotFound.value = true
    else market.value = resolved
  } catch (e) {
    console.error('[hl-account] failed to resolve market:', e)
    marketNotFound.value = true
  }
})
</script>
