<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">

    <div class="flex items-center gap-3 px-5 pt-5 pb-5">
      <button @click="router.back()" class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400">
        <ChevronLeft class="w-5 h-5" />
      </button>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('trade.maker.intent.title') }}</h1>
    </div>

    <TradeBridgeGate>
      <div class="px-5 pb-6 space-y-4 max-w-md">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('trade.maker.intent.intro') }}</p>

        <TradeTokenField v-model="tokenInId" :label="$t('trade.maker.intent.tokenInLabel')" />
        <TradeTokenField v-model="tokenOutId" :label="$t('trade.maker.intent.tokenOutLabel')" />

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('trade.maker.intent.minSizeLabel') }}</label>
            <input
              v-model="minSizeText"
              type="text"
              :inputmode="isTokenInNav ? 'decimal' : 'numeric'"
              class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-sm bg-white dark:bg-gh-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('trade.maker.intent.maxSizeLabel') }}</label>
            <input
              v-model="maxSizeText"
              type="text"
              :inputmode="isTokenInNav ? 'decimal' : 'numeric'"
              class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-sm bg-white dark:bg-gh-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('trade.maker.intent.priceLabel') }}</label>
          <input
            v-model="priceText"
            type="text"
            inputmode="decimal"
            class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-sm bg-white dark:bg-gh-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('trade.maker.intent.priceHint') }}</p>
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('trade.take.windowLabel') }}</label>
          <input
            v-model.number="windowMinutes"
            type="number"
            min="1"
            max="10080"
            class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-sm bg-white dark:bg-gh-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <p v-if="formError" class="text-sm text-red-500 dark:text-red-400">{{ formError }}</p>

        <button
          @click="submit"
          :disabled="submitting"
          class="w-full py-2.5 rounded-xl text-sm font-medium transition bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
        >
          {{ submitting ? $t('trade.maker.intent.creating') : $t('trade.maker.intent.submit') }}
        </button>
      </div>
    </TradeBridgeGate>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronLeft } from 'lucide-vue-next'
import TradeBridgeGate from '@/components/trade/TradeBridgeGate.vue'
import TradeTokenField from '@/components/trade/TradeTokenField.vue'
import { assetBalances, refreshAssets, createSwapIntent } from '@/stores/trade'
import { toSatoshi } from '@/lib/trade/format'

const router = useRouter()
const { t } = useI18n()

const tokenInId = ref(null)
const tokenOutId = ref(null)
const minSizeText = ref('')
const maxSizeText = ref('')
const priceText = ref('')
const windowMinutes = ref(60)
const submitting = ref(false)
const formError = ref('')

const isTokenInNav = computed(() => tokenInId.value === null)

function sameToken(a, b) {
  if (a === null && b === null) return true
  if (a === null || b === null) return false
  return a.toLowerCase() === b.toLowerCase()
}

function parseSize(text) {
  const trimmed = text.trim()
  if (isTokenInNav.value) {
    if (!/^\d+(\.\d{1,8})?$/.test(trimmed)) return null
    const nav = Number(trimmed)
    return nav > 0 ? toSatoshi(nav) : null
  }
  if (!/^\d+$/.test(trimmed)) return null
  const amount = BigInt(trimmed)
  return amount > 0n ? amount : null
}

function parsePrice(text) {
  const trimmed = text.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null
  const price = Number(trimmed)
  return price > 0 ? BigInt(Math.round(price * 1e8)) : null
}

async function submit() {
  formError.value = ''
  if (sameToken(tokenInId.value, tokenOutId.value)) {
    formError.value = t('trade.maker.intent.sameTokenError')
    return
  }
  const minSize = parseSize(minSizeText.value)
  const maxSize = parseSize(maxSizeText.value)
  if (minSize === null || maxSize === null || maxSize < minSize) {
    formError.value = t('trade.maker.intent.invalidSize')
    return
  }
  const priceMin = parsePrice(priceText.value)
  if (priceMin === null) {
    formError.value = t('trade.maker.intent.invalidPrice')
    return
  }
  if (!Number.isInteger(windowMinutes.value) || windowMinutes.value < 1) {
    formError.value = t('trade.take.invalidWindow')
    return
  }

  submitting.value = true
  try {
    const expiry = Math.floor(Date.now() / 1000) + windowMinutes.value * 60
    await createSwapIntent({
      tokenInId: tokenInId.value,
      tokenOutId: tokenOutId.value,
      minSize,
      maxSize,
      priceMin,
      expiry,
    })
    router.push('/trade/manage')
  } catch (err) {
    formError.value = err?.message ?? String(err)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  if (assetBalances.value.length === 0) refreshAssets()
})
</script>
