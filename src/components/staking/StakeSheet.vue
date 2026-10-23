<!-- Stake NAV with a staker: how much, with whom, where rewards go — then
     the shared review sheet, which also shows the outcome. -->
<template>
  <BottomSheet :open="open && !showReview" :title="$t('staking.form.title')" @close="$emit('close')">
    <div class="space-y-4">
      <div class="space-y-1.5">
        <AmountField
          v-model="amountInput"
          :label="$t('tx.amount')"
          symbol="NAV"
          :logo="HL_LOGOS.NAV"
          :balance="maxStake"
          :fiat="amountFiat"
          @max="amountInput = toDecimalString(maxStake, 8)"
        />
        <p class="px-1 text-xs text-gray-400 dark:text-gray-500">
          {{ $t('staking.form.minHint', { min: formatAmount(minStake) }) }}
        </p>
      </div>

      <!-- Staker -->
      <div class="rounded-2xl bg-white dark:bg-gh-800 border p-3.5 transition-colors" :class="keyBorder">
        <div class="flex items-center justify-between gap-2">
          <label for="stake-key" class="text-xs text-gray-400 dark:text-gray-500">{{ $t('staking.form.stakerKey') }}</label>
          <div class="flex items-center gap-3">
            <button type="button" @click="showOperators = true" class="flex items-center gap-1 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <Users class="w-3.5 h-3.5" />
              {{ $t('staking.operators.choose') }}
            </button>
            <button type="button" @click="pasteKey" class="flex items-center gap-1 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <ClipboardPaste class="w-3.5 h-3.5" />
              {{ $t('staking.form.paste') }}
            </button>
            <button
              v-if="canScan"
              type="button"
              @click="scanKey"
              :disabled="scanning"
              class="flex items-center gap-1 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400 disabled:opacity-40"
            >
              <Loader2 v-if="scanning" class="w-3.5 h-3.5 animate-spin" />
              <QrCode v-else class="w-3.5 h-3.5" />
              {{ $t('staking.form.scan') }}
            </button>
          </div>
        </div>
        <div class="mt-2 flex items-start gap-3">
          <StakerAvatar v-if="keyValid" :staker-key="normalizedKey" :size="32" class="mt-0.5" />
          <textarea
            id="stake-key"
            rows="2"
            v-model.trim="keyInput"
            :placeholder="$t('staking.form.stakerKeyPlaceholder')"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            class="flex-1 min-w-0 bg-transparent text-xs font-mono leading-relaxed resize-none outline-none break-all
                   text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
        <p v-if="keyValid && selectedOperator" class="mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <BadgeCheck class="w-3.5 h-3.5 shrink-0" />
          <span class="truncate">{{ selectedOperator.name }}</span>
          <span class="shrink-0 font-normal text-gray-400 dark:text-gray-500">· {{ operatorFee(selectedOperator) }}</span>
        </p>
        <p v-else-if="keyValid" class="mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <BadgeCheck class="w-3.5 h-3.5" /> {{ $t('staking.form.keyValid') }}
        </p>
        <p v-else-if="keyInput" class="mt-1.5 text-xs text-red-500">{{ $t('staking.form.keyInvalid') }}</p>
        <p v-else class="mt-1.5 text-xs leading-snug text-gray-400 dark:text-gray-500">{{ $t('staking.form.stakerKeyHelp') }}</p>
        <button
          type="button"
          @click="openGuide('key')"
          class="mt-2 flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400"
        >
          <HelpCircle class="w-3.5 h-3.5" /> {{ $t('staking.form.whatIsKey') }}
        </button>
      </div>

      <!-- Stakers already used: one tap to stake with them again -->
      <div v-if="knownStakers.length" class="space-y-2">
        <p class="px-1 text-xs font-medium text-gray-500 dark:text-gray-400">{{ $t('staking.form.recent') }}</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="key in knownStakers"
            :key="key"
            type="button"
            @click="keyInput = key"
            class="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border text-xs transition"
            :class="normalizedKey === key
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'border-gray-200 dark:border-gh-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gh-700'"
          >
            <StakerAvatar :staker-key="key" :size="22" />
            <span v-if="operatorForKey(key)" class="font-medium">{{ operatorForKey(key).name }}</span>
            <span v-else class="font-mono">{{ shortKey(key, 6, 4) }}</span>
          </button>
        </div>
      </div>

      <!-- Rewards -->
      <div class="rounded-2xl bg-white dark:bg-gh-800 border border-gray-200 dark:border-gh-700 p-3.5 space-y-3">
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs text-gray-400 dark:text-gray-500">{{ $t('staking.form.rewardsTo') }}</span>
          <div class="flex p-0.5 rounded-lg bg-gray-100 dark:bg-gh-700 text-xs font-semibold" role="tablist">
            <button
              v-for="mode in ['wallet', 'custom']"
              :key="mode"
              type="button"
              role="tab"
              :aria-selected="rewardMode === mode"
              @click="rewardMode = mode"
              class="px-2.5 py-1 rounded-md transition"
              :class="rewardMode === mode ? 'bg-white dark:bg-gh-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'"
            >
              {{ $t(mode === 'wallet' ? 'staking.form.rewardsWallet' : 'staking.form.rewardsCustom') }}
            </button>
          </div>
        </div>
        <textarea
          v-if="rewardMode === 'custom'"
          rows="2"
          v-model.trim="rewardInput"
          :placeholder="$t('staking.form.rewardsAddress')"
          autocomplete="off"
          spellcheck="false"
          class="w-full bg-transparent text-xs font-mono resize-none outline-none break-all
                 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
        <p v-else class="text-xs font-mono text-gray-500 dark:text-gray-400 break-all">{{ receiveAddress }}</p>
      </div>

      <p v-if="problem" class="rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300 leading-snug">
        {{ problem }}
      </p>

      <button
        @click="showReview = true"
        :disabled="!canReview"
        class="w-full py-3.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
      >
        {{ amount > 0 ? $t('tx.review') : $t('tx.enterAmount') }}
      </button>
    </div>
  </BottomSheet>

  <OperatorPickerSheet
    :open="open && showOperators"
    :selected-key="keyValid ? normalizedKey : ''"
    @pick="pickOperator"
    @close="showOperators = false"
  />

  <ReviewSheet
    :open="open && showReview"
    :title="$t('staking.review.title')"
    :from="{ amount: formatAmount(amount, 8), symbol: 'NAV', logo: HL_LOGOS.NAV }"
    :destination="normalizedKey"
    :destination-label="$t('staking.staker')"
    :rows="reviewRows"
    :notices="reviewNotices"
    :details="reviewDetails"
    :details-label="$t('staking.howItWorks')"
    :confirm-label="$t('staking.review.confirm', { amount: formatAmount(amount, 8) })"
    :busy="busy"
    :busy-label="$t('staking.review.busy')"
    :result="result"
    @confirm="confirm"
    @close="closeReview"
  />
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Capacitor } from '@capacitor/core'
import { useRouter } from 'vue-router'
import { ClipboardPaste, QrCode, Loader2, BadgeCheck, HelpCircle, Users } from 'lucide-vue-next'
import { balance, receiveAddress, stakeDelegations, delegateStake, getMinStakeNav } from '@/stores/navio'
import { getReservedAmount, outputsToSpend } from '@/stores/trade'
import { navPrice } from '@/stores/navPrice'
import { settings } from '@/stores/settings'
import { HL_LOGOS } from '@/lib/hyperliquid/config'
import { navSendAllFee } from '@/lib/navioFee'
import { spendableNavUtxoAmounts } from '@/stores/navio'
import { toDecimalString } from '@/lib/intent/quote'
import { formatAmount, formatFiatFromUsd } from '@/lib/displayFormat'
import { isValidStakerKey, extractStakerKey, shortKey } from '@/lib/staking'
import BottomSheet from '@/components/tx/BottomSheet.vue'
import AmountField from '@/components/tx/AmountField.vue'
import ReviewSheet from '@/components/tx/ReviewSheet.vue'
import StakerAvatar from './StakerAvatar.vue'
import OperatorPickerSheet from './OperatorPickerSheet.vue'
import { operatorForKey, loadOperators, defaultOperator } from '@/stores/stakingOperators'

const props = defineProps({
  open: { type: Boolean, default: false },
  // Pre-filled staker, e.g. "stake more" with the one already in use.
  presetKey: { type: String, default: '' },
})
const emit = defineEmits(['close'])
const { t } = useI18n()
const router = useRouter()

function openGuide(section) {
  emit('close')
  router.push({ path: '/asset/NAV/staking', query: { section } })
}

const amountInput = ref('')
const keyInput = ref('')
const rewardMode = ref('wallet')
const rewardInput = ref('')
const showReview = ref(false)
const busy = ref(false)
const result = ref(null)
const scanning = ref(false)
const canScan = Capacitor.isNativePlatform()

watch(() => props.open, (open) => {
  if (!open) return
  amountInput.value = ''
  // "Stake more" brings its staker; otherwise the directory's default.
  keyInput.value = props.presetKey || defaultOperator.value?.delegationKey || ''
  keyTouched.value = false
  rewardMode.value = 'wallet'
  rewardInput.value = ''
  showReview.value = false
  showOperators.value = false
  result.value = null
  loadOperators()
})

const minStake = computed(() => getMinStakeNav())
const reservedNav = computed(() => Number(getReservedAmount(null)) / 1e8)
// The fee is paid on top of the stake, so Max leaves room for it.
const maxStake = computed(() => Math.max(0, (Number(balance.value) || 0) - reservedNav.value - navSendAllFee(spendableNavUtxoAmounts.value)))

const amount = computed(() => {
  const n = Number(amountInput.value)
  return Number.isFinite(n) && n > 0 ? n : 0
})
const amountFiat = computed(() =>
  settings.showFiatValue && amount.value > 0 && navPrice.usd != null ? formatFiatFromUsd(amount.value * navPrice.usd) : null
)

const normalizedKey = computed(() => extractStakerKey(keyInput.value).toLowerCase())
const keyValid = computed(() => isValidStakerKey(normalizedKey.value))
const keyBorder = computed(() => {
  if (keyValid.value) return 'border-emerald-300 dark:border-emerald-700/60'
  if (keyInput.value) return 'border-red-300 dark:border-red-800/60'
  return 'border-gray-200 dark:border-gh-700'
})

const knownStakers = computed(() => [...new Set(stakeDelegations.value.map((d) => d.delegateKey.toLowerCase()))])

const rewardAddress = computed(() => (rewardMode.value === 'custom' ? rewardInput.value : ''))

const problem = computed(() => {
  if (!(amount.value > 0)) return ''
  if (amount.value < minStake.value) return t('staking.form.belowMin', { min: formatAmount(minStake.value) })
  if (amount.value > maxStake.value) return t('staking.form.insufficient', { available: formatAmount(maxStake.value, 8) })
  return ''
})

const canReview = computed(() =>
  amount.value > 0 && !problem.value && keyValid.value && (rewardMode.value === 'wallet' || !!rewardInput.value)
)

async function pasteKey() {
  try {
    keyInput.value = extractStakerKey(await navigator.clipboard.readText())
  } catch (e) {
    console.warn('[staking] clipboard read failed:', e?.message)
    document.getElementById('stake-key')?.focus()
  }
}

async function scanKey() {
  try {
    scanning.value = true
    const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning')
    const { camera } = await BarcodeScanner.requestPermissions()
    if (camera !== 'granted' && camera !== 'limited') return
    const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] })
    const raw = barcodes[0]?.rawValue ?? barcodes[0]?.displayValue
    if (raw) keyInput.value = extractStakerKey(raw)
  } catch (e) {
    console.error('[staking] QR scan failed:', e)
  } finally {
    scanning.value = false
  }
}

// --- Operator directory ---
const showOperators = ref(false)
// Set once the user types, pastes, scans or picks: from then on the default
// never overwrites their choice.
const keyTouched = ref(false)
watch(keyInput, () => { if (props.open) keyTouched.value = true }, { flush: 'sync' })

// The directory may arrive after the sheet opened; fill the default then,
// unless the user has already chosen.
watch(defaultOperator, (op) => {
  if (props.open && op && !keyInput.value && !keyTouched.value) {
    keyInput.value = op.delegationKey
    keyTouched.value = false
  }
})
const selectedOperator = computed(() => (keyValid.value ? operatorForKey(normalizedKey.value) : null))

function operatorFee(op) {
  return op.feeBps === 0
    ? t('staking.operators.noFee')
    : t('staking.operators.fee', { fee: (op.feeBps / 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) })
}

function pickOperator(key) {
  keyInput.value = key
  showOperators.value = false
}

const reviewRows = computed(() => [
  ...(selectedOperator.value
    ? [{ label: t('staking.operators.operator'), value: `${selectedOperator.value.name} · ${operatorFee(selectedOperator.value)}` }]
    : []),
  {
    label: t('staking.form.rewardsTo'),
    value: rewardAddress.value ? shortKey(rewardAddress.value, 10, 6) : t('staking.form.rewardsWallet'),
  },
  { label: t('staking.review.fee'), value: t('staking.review.feeValue') },
  { label: t('staking.unstake'), value: t('staking.review.anyTime') },
])

const reviewNotices = computed(() => [
  { tone: 'info', text: t('staking.notice.custody') },
  { tone: 'warn', text: t('staking.notice.rewards') },
  { tone: 'info', text: t('staking.notice.locked') },
])

const reviewDetails = computed(() => [t('staking.steps.pick'), t('staking.steps.lock'), t('staking.steps.earn')])

async function confirm() {
  if (busy.value || !canReview.value) return
  busy.value = true
  const staked = amount.value
  try {
    // Coins an open trade quote depends on are never staked; a Max stake
    // spends every output so no dust is left behind.
    const selectedUtxos = await outputsToSpend(staked)
    await delegateStake({
      amountNav: staked,
      delegateKey: normalizedKey.value,
      rewardAddress: rewardAddress.value,
      selectedUtxos,
    })
    result.value = {
      success: true,
      title: t('staking.review.successTitle'),
      message: t('staking.review.successMessage', { amount: formatAmount(staked, 8) }),
    }
  } catch (e) {
    console.error('[staking] delegateStake failed:', e)
    result.value = { success: false, title: t('staking.review.failed'), message: e?.message || t('ops.errors.unknown') }
  } finally {
    busy.value = false
  }
}

// A failure goes back to the form so it can be fixed; success closes the flow.
function closeReview() {
  if (busy.value) return
  const done = result.value?.success
  result.value = null
  showReview.value = false
  if (done) emit('close')
}
</script>
