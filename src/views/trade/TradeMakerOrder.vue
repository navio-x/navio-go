<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">

    <div class="flex items-center gap-3 px-5 pt-5 pb-5">
      <button @click="router.back()" class="p-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400">
        <ChevronLeft class="w-5 h-5" />
      </button>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ $t('trade.maker.order.title') }}</h1>
    </div>

    <TradeBridgeGate>
      <div class="px-5 pb-6 space-y-4 max-w-md">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('trade.maker.order.intro') }}</p>

        <TradeTokenField v-model="offerTokenId" :label="$t('trade.maker.order.offerLabel')" />
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('trade.maker.order.offerAmountLabel') }}</label>
          <input
            v-model="offerAmountText"
            type="text"
            :inputmode="isOfferNav ? 'decimal' : 'numeric'"
            class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-sm bg-white dark:bg-gh-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <TradeTokenField v-model="wantTokenId" :label="$t('trade.maker.order.wantLabel')" />
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('trade.maker.order.wantAmountLabel') }}</label>
          <input
            v-model="wantAmountText"
            type="text"
            :inputmode="isWantNav ? 'decimal' : 'numeric'"
            class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-sm bg-white dark:bg-gh-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('trade.maker.order.expiryLabel') }}</label>
          <input
            v-model.number="expiryDays"
            type="number"
            min="1"
            max="14"
            class="w-full border border-gray-200 dark:border-gh-700 rounded-xl p-2.5 text-sm bg-white dark:bg-gh-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <p v-if="formError" class="text-sm text-red-500 dark:text-red-400">{{ formError }}</p>

        <button
          @click="submit"
          :disabled="submitting"
          class="w-full py-2.5 rounded-xl text-sm font-medium transition bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
        >
          {{ submitting ? $t('trade.maker.order.publishing') : $t('trade.maker.order.submit') }}
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
import { assetBalances, refreshAssets, makerBroadcastOrder } from '@/stores/trade'
import { toSatoshi } from '@/lib/trade/format'

const router = useRouter()
const { t } = useI18n()

const offerTokenId = ref(null)
const offerAmountText = ref('')
const wantTokenId = ref(null)
const wantAmountText = ref('')
const expiryDays = ref(1)
const submitting = ref(false)
const formError = ref('')

const isOfferNav = computed(() => offerTokenId.value === null)
const isWantNav = computed(() => wantTokenId.value === null)

function sameToken(a, b) {
  if (a === null && b === null) return true
  if (a === null || b === null) return false
  return a.toLowerCase() === b.toLowerCase()
}

function parseAmount(text, isNav) {
  const trimmed = text.trim()
  if (isNav) {
    if (!/^\d+(\.\d{1,8})?$/.test(trimmed)) return null
    const nav = Number(trimmed)
    return nav > 0 ? toSatoshi(nav) : null
  }
  if (!/^\d+$/.test(trimmed)) return null
  const amount = BigInt(trimmed)
  return amount > 0n ? amount : null
}

async function submit() {
  formError.value = ''
  if (sameToken(offerTokenId.value, wantTokenId.value)) {
    formError.value = t('trade.maker.order.sameTokenError')
    return
  }
  const offerAmount = parseAmount(offerAmountText.value, isOfferNav.value)
  const wantAmount = parseAmount(wantAmountText.value, isWantNav.value)
  if (offerAmount === null || wantAmount === null) {
    formError.value = t('trade.maker.order.invalidAmount')
    return
  }
  if (!Number.isInteger(expiryDays.value) || expiryDays.value < 1 || expiryDays.value > 14) {
    formError.value = t('trade.maker.order.invalidExpiry')
    return
  }

  submitting.value = true
  try {
    const expiry = Math.floor(Date.now() / 1000) + expiryDays.value * 86400
    await makerBroadcastOrder({
      offerTokenId: offerTokenId.value,
      offerAmount,
      wantTokenId: wantTokenId.value,
      wantAmount,
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
