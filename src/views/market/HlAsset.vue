<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">
    <div class="flex items-center gap-3 px-5 pt-5 pb-4">
      <button
        @click="router.back()"
        class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400"
      >
        <ChevronLeft class="w-5 h-5" />
      </button>
      <TokenIcon v-if="asset" :symbol="symbol" :logo="asset.logo" :size="28" />
      <h1 class="text-lg font-bold text-gray-900 dark:text-white truncate flex-1 min-w-0">{{ asset ? asset.name : symbol }}</h1>
    </div>

    <div v-if="!asset" class="flex-1 flex items-center justify-center px-5 pb-6">
      <p class="text-sm text-gray-400 dark:text-gray-500 text-center">{{ $t('market.notFound') }}</p>
    </div>

    <div v-else-if="derivationError" class="mx-5 mb-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4">
      <p class="text-sm text-red-700 dark:text-red-300 leading-snug">{{ derivationError }}</p>
    </div>

    <div v-else class="px-5 pb-6 space-y-4">
      <!-- Balance -->
      <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4">
        <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('hlAsset.balanceOnHyperliquid') }}</p>
        <p class="mt-1 text-3xl font-bold tabular-nums text-gray-900 dark:text-white truncate">
          {{ formatAmount(row?.total) }} <span class="text-base font-medium text-gray-500 dark:text-gray-400">{{ symbol }}</span>
        </p>
        <p v-if="settings.showFiatValue && fiatTotal" class="text-sm text-gray-500 dark:text-gray-400">≈ {{ fiatTotal }}</p>
        <div v-if="Number(row?.hold) > 0" class="mt-3 pt-3 border-t border-gray-100 dark:border-gh-700 flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{{ $t('market.available') }}: {{ formatAmount(row.available) }}</span>
          <span>{{ $t('hlAsset.inOrders') }}: {{ formatAmount(row.hold) }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="grid gap-2 grid-cols-3">
        <button
          v-for="m in ['deposit', 'withdraw']"
          :key="m"
          @click="setMode(m)"
          class="py-2.5 rounded-xl text-sm font-semibold transition-colors"
          :class="mode === m
            ? 'bg-blue-600 text-white'
            : 'bg-white dark:bg-gh-800 border border-gray-200 dark:border-gh-700 text-gray-700 dark:text-gray-300'"
        >
          {{ $t('hlAsset.' + m) }}
        </button>
        <button
          @click="router.push(`/swap?from=${symbol}`)"
          class="py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-gh-800 border border-gray-200 dark:border-gh-700 text-gray-700 dark:text-gray-300"
        >
          {{ $t('swap.title') }}
        </button>
      </div>

      <!-- Deposit: own EVM address = Hyperliquid account -->
      <div v-if="mode === 'deposit'" class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-5 flex flex-col items-center gap-4">
        <div v-if="evmAddress" class="p-3 bg-white rounded-xl ring-1 ring-gray-100 dark:ring-gh-700">
          <QRCode :value="evmAddress" :size="160" />
        </div>
        <div v-else class="h-[184px] w-[184px] bg-gray-100 dark:bg-gh-700 rounded-xl animate-pulse" />

        <div class="w-full bg-gray-50 dark:bg-gh-700 rounded-xl px-4 py-3">
          <p class="font-mono text-xs text-gray-700 dark:text-gray-300 break-all text-center leading-relaxed select-all">
            {{ evmAddress || $t('dex.deriving') }}
          </p>
        </div>

        <button
          @click="copyAddress"
          :disabled="!evmAddress"
          class="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          :class="copied ? 'bg-green-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'"
        >
          <Check v-if="copied" class="w-4 h-4" />
          <Copy v-else class="w-4 h-4" />
          {{ copied ? $t('common.copied') : $t('common.copy') }}
        </button>

        <div class="w-full flex gap-2 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2.5">
          <AlertTriangle class="w-4 h-4 shrink-0 mt-0.5 text-yellow-600 dark:text-yellow-400" />
          <p class="text-xs text-yellow-800 dark:text-yellow-300 leading-snug">{{ $t('hlAsset.depositWarning', { symbol }) }}</p>
        </div>

        <!-- NAV from the Navio network can't be sent here — point at the NAV page -->
        <div v-if="asset.viaBridge" class="w-full rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2.5 space-y-2">
          <div class="flex gap-2">
            <AlertTriangle class="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
            <p class="text-xs text-red-800 dark:text-red-300 leading-snug">{{ $t('hlAsset.navBridgeWarning') }}</p>
          </div>
          <button
            @click="router.push('/asset/NAV')"
            class="w-full py-2 rounded-lg text-xs font-semibold border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30"
          >
            {{ $t('asset.openNav') }}
          </button>
        </div>
      </div>

      <!-- Withdraw -->
      <div v-if="mode === 'withdraw'" class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4 space-y-3">
        <div>
          <p class="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('hlAsset.network') }}</p>
          <div class="grid gap-2" :class="routes.length > 1 ? 'grid-cols-2' : 'grid-cols-1'">
            <button
              v-for="r in routes"
              :key="r"
              @click="route = r"
              class="rounded-xl border px-3 py-2 text-left transition-colors"
              :class="route === r
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gh-600'"
            >
              <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ $t('hlAsset.routes.' + r + '.name') }}</p>
              <p class="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{{ $t('hlAsset.routes.' + r + '.desc') }}</p>
            </button>
          </div>
        </div>

        <div class="rounded-xl bg-gray-50 dark:bg-gh-700 p-3">
          <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('hlAsset.recipient') }}</p>
          <input
            v-model.trim="destinationInput"
            type="text"
            autocomplete="off"
            spellcheck="false"
            placeholder="0x…"
            class="w-full bg-transparent font-mono text-sm text-gray-900 dark:text-white outline-none"
          />
        </div>
        <p v-if="destinationError" class="-mt-1 text-xs text-red-600 dark:text-red-400">{{ $t('hlAsset.errors.' + destinationError) }}</p>

        <div class="rounded-xl bg-gray-50 dark:bg-gh-700 p-3">
          <div class="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
            <span>{{ $t('market.sizeLabel') }}</span>
            <span>
              {{ $t('market.available') }}: {{ formatAmount(row?.available) }} {{ symbol }}
              <button @click="setMax" class="ml-1 font-semibold text-blue-600 dark:text-blue-400">{{ $t('market.max') }}</button>
            </span>
          </div>
          <input
            v-model="amountInput"
            type="number"
            min="0"
            step="any"
            placeholder="0.0"
            class="w-full bg-transparent text-lg font-semibold tabular-nums text-gray-900 dark:text-white outline-none"
          />
        </div>
        <p v-if="amountError" class="-mt-1 text-xs text-red-600 dark:text-red-400">{{ $t('hlAsset.errors.' + amountError, { fee: ARBITRUM_WITHDRAW_FEE_USDC }) }}</p>

        <div class="space-y-1 text-xs text-gray-500 dark:text-gray-400">
          <div class="flex justify-between">
            <span>{{ $t('hlAsset.fee') }}</span>
            <span>{{ route === 'arbitrum' ? `${ARBITRUM_WITHDRAW_FEE_USDC} USDC` : $t('hlAsset.noFee') }}</span>
          </div>
          <div class="flex justify-between font-medium text-gray-700 dark:text-gray-300">
            <span>{{ $t('hlAsset.youReceive') }}</span>
            <span>{{ receiveAmount != null ? `${formatAmount(receiveAmount)} ${symbol}` : '—' }}</span>
          </div>
        </div>

        <div
          v-if="transfer.status.value === 'error'"
          class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-3 py-2.5 text-xs text-red-700 dark:text-red-300 space-y-1"
        >
          <p>{{ $t('hlAsset.errors.' + transfer.errorCode.value) }}</p>
          <p v-if="transfer.errorDetail.value" class="font-mono text-[11px] break-words">{{ transfer.errorDetail.value }}</p>
        </div>
        <div
          v-if="transfer.status.value === 'sent'"
          class="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 px-3 py-2.5 text-xs text-green-700 dark:text-green-300"
        >
          {{ $t(route === 'arbitrum' ? 'hlAsset.sentArbitrum' : 'hlAsset.sent') }}
        </div>

        <button
          @click="showConfirm = true"
          :disabled="!canSubmit"
          class="w-full py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Loader2 v-if="transfer.status.value === 'sending'" class="w-4 h-4 animate-spin" />
          {{ $t('hlAsset.withdraw') }} {{ symbol }}
        </button>
      </div>
    </div>

    <!-- Confirm -->
    <div v-if="showConfirm" class="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div class="bg-white dark:bg-gh-900 border border-gray-100 dark:border-gh-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 dark:text-white">{{ $t('hlAsset.confirmTitle') }}</h3>
        <div class="rounded-xl bg-gray-50 dark:bg-gh-700 p-3 space-y-1.5 text-sm">
          <div class="flex justify-between gap-3">
            <span class="text-gray-400 dark:text-gray-500">{{ $t('hlAsset.network') }}</span>
            <span class="font-medium text-gray-800 dark:text-gray-100">{{ $t('hlAsset.routes.' + route + '.name') }}</span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-gray-400 dark:text-gray-500">{{ $t('hlAsset.recipient') }}</span>
            <span class="font-mono text-xs text-gray-800 dark:text-gray-100 break-all text-right">{{ destinationInput }}</span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-gray-400 dark:text-gray-500">{{ $t('market.sizeLabel') }}</span>
            <span class="font-semibold text-gray-800 dark:text-gray-100">{{ formatAmount(amountInput) }} {{ symbol }}</span>
          </div>
          <div class="flex justify-between gap-3">
            <span class="text-gray-400 dark:text-gray-500">{{ $t('hlAsset.youReceive') }}</span>
            <span class="font-medium text-gray-800 dark:text-gray-100">{{ formatAmount(receiveAmount) }} {{ symbol }}</span>
          </div>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 leading-snug">{{ $t('hlAsset.confirmWarning') }}</p>
        <div class="flex gap-2">
          <button
            @click="showConfirm = false"
            class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gh-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gh-700"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            @click="confirmSend"
            class="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            {{ $t('hlAsset.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, Copy, Check, Loader2, AlertTriangle } from 'lucide-vue-next'
import QRCode from 'qrcode.vue'
import copy from 'copy-to-clipboard'
import { isAddress } from 'viem'
import TokenIcon from '@/components/TokenIcon.vue'
import { settings } from '@/stores/settings'
import { navPrice } from '@/stores/navPrice'
import { evmAddress } from '@/stores/evm'
import { getNavioClient } from '@/stores/navio'
import { deriveEvmAddress } from '@/composables/useEvmAccount'
import { useHyperliquidBalances } from '@/composables/useHyperliquidBalances'
import { useHyperliquidTransfer, ARBITRUM_WITHDRAW_FEE_USDC } from '@/composables/useHyperliquidTransfer'
import { getSpotMeta, resolveTokens } from '@/lib/hyperliquid/meta'

// Arbitrum is only offered for USDC — it's the one token Hyperliquid's own
// bridge (withdraw3) can send there. NAV here is wrapped NAV moving between
// Hyperliquid accounts only; getting native NAV in or out goes through the
// Navio bridge on its own account page (HlAccount.vue), which links here —
// `viaBridge` adds the reminder to the deposit panel.
const ASSETS = {
  NAV: { name: 'Navio', logo: 'wnav-light.svg', routes: ['hypercore'], marketPair: 'NAV-USDC', viaBridge: true },
  USDC: { name: 'USD Coin', logo: 'usdc.png', routes: ['hypercore', 'arbitrum'], marketPair: null },
  HYPE: { name: 'Hyperliquid', logo: 'hype.jpg', routes: ['hypercore'], marketPair: 'HYPE-USDC' },
  BTC: { name: 'Bitcoin', logo: 'btc.png', routes: ['hypercore'], marketPair: 'BTC-USDC' },
  ETH: { name: 'Ethereum', logo: 'eth.png', routes: ['hypercore'], marketPair: 'ETH-USDC' },
  SOL: { name: 'Solana', logo: 'sol.png', routes: ['hypercore'], marketPair: 'SOL-USDC' },
  ZEC: { name: 'Zcash', logo: 'zec.png', routes: ['hypercore'], marketPair: 'ZEC-USDC' },
  AVAX: { name: 'Avalanche', logo: 'avax.png', routes: ['hypercore'], marketPair: 'AVAX-USDC' },
}

const routeInfo = useRoute()
const router = useRouter()
const { t } = useI18n()

const symbol = String(routeInfo.params.symbol || '').toUpperCase()
const asset = ASSETS[symbol] ?? null
const routes = asset?.routes ?? []

const derivationError = ref('')
const hl = useHyperliquidBalances(evmAddress)
const transfer = useHyperliquidTransfer()

const row = computed(() => hl.balances.value.find((b) => b.symbol === symbol) ?? null)

const fiatTotal = computed(() => {
  const r = row.value
  const rate = navPrice.rates[settings.currency ?? 'USD']
  if (!r || r.priceUsd == null || rate == null) return null
  return (Number(r.total) * r.priceUsd * rate).toLocaleString(undefined, {
    style: 'currency', currency: settings.currency ?? 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
})

// sendAsset token string + decimals, resolved from spotMeta (never hardcoded).
const tokenInfo = ref(null) // { token, weiDecimals }

// null | 'deposit' | 'withdraw' — `?mode=` lets a link open a panel directly.
const mode = ref(['deposit', 'withdraw'].includes(routeInfo.query.mode) ? routeInfo.query.mode : null)
function setMode(m) {
  mode.value = mode.value === m ? null : m
  transfer.reset()
}

// --- Deposit ---
const copied = ref(false)
function copyAddress() {
  if (!evmAddress.value) return
  copy(evmAddress.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

// --- Withdraw ---
const route = ref(routes[0] ?? 'hypercore')
const destinationInput = ref('')
const amountInput = ref('')
const showConfirm = ref(false)

const destinationError = computed(() => {
  const d = destinationInput.value
  if (!d) return ''
  if (!isAddress(d, { strict: false })) return 'invalid_address'
  if (evmAddress.value && d.toLowerCase() === evmAddress.value.toLowerCase()) return 'own_address'
  return ''
})

// Arbitrum (withdraw3) amounts are USD with at most 6 decimals (USDC's own
// decimals there); HyperCore transfers allow the token's weiDecimals.
const maxDecimals = computed(() => (route.value === 'arbitrum' ? 6 : tokenInfo.value?.weiDecimals ?? 8))

function trimDecimals(value, decimals) {
  const [int, frac = ''] = String(value).split('.')
  const f = frac.slice(0, decimals).replace(/0+$/, '')
  return f ? `${int}.${f}` : int
}

const amountStr = computed(() => {
  const n = Number(amountInput.value)
  if (!Number.isFinite(n) || n <= 0) return ''
  return trimDecimals(String(amountInput.value), maxDecimals.value)
})

const amountError = computed(() => {
  if (!amountInput.value) return ''
  const n = Number(amountStr.value)
  if (!n) return 'invalid_amount'
  if (n > Number(row.value?.available ?? 0)) return 'insufficient'
  if (route.value === 'arbitrum' && n <= ARBITRUM_WITHDRAW_FEE_USDC) return 'below_fee'
  return ''
})

const receiveAmount = computed(() => {
  const n = Number(amountStr.value)
  if (!n) return null
  return route.value === 'arbitrum' ? Math.max(0, n - ARBITRUM_WITHDRAW_FEE_USDC) : n
})

function setMax() {
  const avail = row.value?.available
  amountInput.value = avail && Number(avail) > 0 ? trimDecimals(avail, maxDecimals.value) : ''
}

const canSubmit = computed(() =>
  !!evmAddress.value &&
  !!tokenInfo.value &&
  transfer.status.value !== 'sending' &&
  !!destinationInput.value && !destinationError.value &&
  !!amountStr.value && !amountError.value
)

async function confirmSend() {
  showConfirm.value = false
  if (!canSubmit.value) return
  await transfer.send({
    route: route.value,
    token: tokenInfo.value.token,
    destination: destinationInput.value,
    amount: amountStr.value,
  })
  if (transfer.status.value === 'sent') {
    amountInput.value = ''
    hl.refresh()
  }
}

watch(route, () => transfer.reset())

// Derive once the Navio client exists (same reasoning as WalletBalance.vue).
watch(
  () => !!asset && !evmAddress.value && getNavioClient(),
  async (client) => {
    if (!client) return
    try {
      await deriveEvmAddress(0)
    } catch (e) {
      console.error('[hl-asset] derivation error:', e)
      derivationError.value = e.message === 'wallet_locked' ? t('dex.errors.walletLocked') : t('dex.errors.derivationFailed')
    }
  },
  { immediate: true },
)

onMounted(async () => {
  if (!asset) return
  try {
    const tok = resolveTokens(await getSpotMeta()).find((x) => x.symbol === symbol)
    if (tok?.token) tokenInfo.value = { token: tok.token, weiDecimals: tok.weiDecimals }
  } catch (e) {
    console.error('[hl-asset] failed to resolve token:', e)
  }
})

function formatAmount(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || !n) return '0'
  return n.toLocaleString(undefined, { maximumFractionDigits: Math.abs(n) < 1 ? 8 : 6 })
}
</script>
