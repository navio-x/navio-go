<!-- Unstake one position, or every confirmed one at once. A single position
     with a known staker can also be unstaked in part: the rest stays staked
     with the same staker, and must still reach the minimum stake. -->
<template>
  <BottomSheet :open="open && !showReview" :title="$t('staking.unstakeForm.title')" @close="$emit('close')">
    <div v-if="!targets.length" class="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
      {{ $t('staking.unstakeForm.nothing') }}
    </div>

    <div v-else class="space-y-4">
      <!-- What is being unstaked -->
      <ul class="rounded-2xl bg-gray-50 dark:bg-gh-800 border border-gray-100 dark:border-gh-700 divide-y divide-gray-100 dark:divide-gh-700">
        <li v-for="p in targets" :key="p.outputHash" class="flex items-center gap-3 px-3.5 py-3">
          <StakerAvatar :staker-key="p.delegateKey" :size="30" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
              {{ p.operator?.name || (p.delegateKey ? shortKey(p.delegateKey) : $t('staking.status.unknown')) }}
            </p>
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('staking.sinceBlock', { height: p.blockHeight.toLocaleString() }) }}</p>
          </div>
          <p class="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{{ formatAmount(p.amount, 8) }} NAV</p>
        </li>
      </ul>

      <!-- All or part -->
      <div class="space-y-2">
        <div class="grid grid-cols-2 p-1 rounded-xl bg-gray-100 dark:bg-gh-800 text-sm font-semibold" role="tablist">
          <button
            v-for="m in ['all', 'part']"
            :key="m"
            type="button"
            role="tab"
            :aria-selected="mode === m"
            :disabled="m === 'part' && !partAllowed"
            @click="mode = m"
            class="py-2 rounded-lg transition disabled:opacity-40"
            :class="mode === m ? 'bg-white dark:bg-gh-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'"
          >
            {{ $t(`staking.unstakeForm.${m}`) }}
          </button>
        </div>
        <p v-if="partHint" class="px-1 text-xs text-gray-400 dark:text-gray-500">{{ partHint }}</p>
      </div>

      <AmountField
        v-if="mode === 'part'"
        v-model="amountInput"
        :label="$t('staking.unstakeForm.amountLabel')"
        symbol="NAV"
        :logo="HL_LOGOS.NAV"
        :balance="total"
        @max="mode = 'all'"
      />

      <!-- Where it lands -->
      <dl class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-3.5 space-y-2 text-sm">
        <div class="flex items-center justify-between gap-3">
          <dt class="text-gray-500 dark:text-gray-400">{{ $t('staking.unstakeForm.toWallet') }}</dt>
          <dd class="font-semibold tabular-nums text-gray-900 dark:text-white">{{ formatAmount(unlock, 8) }} NAV</dd>
        </div>
        <div v-if="remains > 0" class="flex items-center justify-between gap-3">
          <dt class="text-gray-500 dark:text-gray-400">{{ $t('staking.unstakeForm.remains') }}</dt>
          <dd class="font-semibold tabular-nums text-gray-900 dark:text-white">{{ formatAmount(remains, 8) }} NAV</dd>
        </div>
        <p class="pt-2 border-t border-gray-100 dark:border-gh-700 text-xs text-gray-400 dark:text-gray-500">{{ $t('staking.unstakeForm.feeHint') }}</p>
      </dl>

      <p v-if="problem" class="rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300 leading-snug">
        {{ problem }}
      </p>

      <button
        @click="showReview = true"
        :disabled="!(unlock > 0) || !!problem"
        class="w-full py-3.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
      >
        {{ unlock > 0 ? $t('tx.review') : $t('tx.enterAmount') }}
      </button>
    </div>
  </BottomSheet>

  <ReviewSheet
    :open="open && showReview"
    :title="$t('staking.unstakeForm.reviewTitle')"
    :from="{ amount: formatAmount(unlock, 8), symbol: 'NAV', logo: HL_LOGOS.NAV }"
    :rows="reviewRows"
    :notices="reviewNotices"
    :confirm-label="$t('staking.unstakeForm.confirm', { amount: formatAmount(unlock, 8) })"
    :busy="busy"
    :busy-label="$t('staking.unstakeForm.busy')"
    :result="result"
    @confirm="confirm"
    @close="closeReview"
  />
</template>

<script setup>
import { confirmSpend } from '@/lib/spendConfirm'
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { unstakeNav, getMinStakeNav } from '@/stores/navio'
import { HL_LOGOS } from '@/lib/hyperliquid/config'
import { NAV_FEE_RESERVE } from '@/lib/intent/router'
import { formatAmount } from '@/lib/displayFormat'
import { shortKey } from '@/lib/staking'
import BottomSheet from '@/components/tx/BottomSheet.vue'
import AmountField from '@/components/tx/AmountField.vue'
import ReviewSheet from '@/components/tx/ReviewSheet.vue'
import StakerAvatar from './StakerAvatar.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  // Every position, from toPositions().
  positions: { type: Array, default: () => [] },
  // 'all', or the outputHash of one position.
  target: { type: String, default: 'all' },
})
const emit = defineEmits(['close'])
const { t } = useI18n()

const mode = ref('all')
const amountInput = ref('')
const showReview = ref(false)
const busy = ref(false)
const result = ref(null)

// Fixed when the sheet opens, so a sync landing mid-flow can't change what
// the user is looking at.
const targets = ref([])
watch(() => props.open, (open) => {
  if (!open) return
  const confirmed = props.positions.filter((p) => p.status !== 'confirming')
  targets.value = props.target === 'all' ? confirmed : confirmed.filter((p) => p.outputHash === props.target)
  mode.value = 'all'
  amountInput.value = ''
  showReview.value = false
  result.value = null
})

const minStake = computed(() => getMinStakeNav())
const total = computed(() => targets.value.reduce((sum, p) => sum + p.amount, 0))

// A partial unstake restakes the rest under the spent commitment's
// delegation, so it needs exactly one position whose staker is known.
const partAllowed = computed(() =>
  targets.value.length === 1 && targets.value[0].status === 'active' && total.value >= minStake.value + NAV_FEE_RESERVE
)
const partHint = computed(() => {
  if (partAllowed.value) return ''
  if (targets.value.length > 1) return t('staking.unstakeForm.partOnlySingle')
  if (targets.value[0]?.status === 'unknown') return t('staking.unstakeForm.partUnknown')
  return ''
})

const partAmount = computed(() => {
  const n = Number(amountInput.value)
  return Number.isFinite(n) && n > 0 ? n : 0
})
const unlock = computed(() => (mode.value === 'all' ? total.value : partAmount.value))
const remains = computed(() => Math.max(0, total.value - unlock.value))

const problem = computed(() => {
  if (mode.value !== 'part' || !(partAmount.value > 0)) return ''
  if (partAmount.value > total.value) return t('staking.unstakeForm.tooMuch', { max: formatAmount(total.value, 8) })
  if (partAmount.value <= NAV_FEE_RESERVE) return t('staking.unstakeForm.tooLittle')
  if (remains.value > 0 && remains.value < minStake.value) {
    return t('staking.unstakeForm.remainderTooSmall', { min: formatAmount(minStake.value) })
  }
  return ''
})

const reviewRows = computed(() => {
  const rows = [
    { label: t('staking.unstakeForm.arrives'), value: t('staking.unstakeForm.arrivesValue') },
    { label: t('staking.review.fee'), value: t('staking.unstakeForm.feeValue') },
  ]
  if (remains.value > 0) rows.push({ label: t('staking.unstakeForm.remains'), value: `${formatAmount(remains.value, 8)} NAV` })
  return rows
})

const reviewNotices = computed(() => {
  const notices = [{ tone: 'info', text: t('staking.unstakeForm.revokes') }]
  if (remains.value > 0) notices.push({ tone: 'info', text: t('staking.unstakeForm.keepsStaker') })
  return notices
})

async function confirm() {
  if (busy.value || problem.value || !(unlock.value > 0)) return
  if (!(await confirmSpend({
    amountNav: Number(unlock.value),
    summaryKey: 'spendConfirm.summary.unstake',
    summaryParams: { amount: formatAmount(unlock.value, 8) },
  }))) return
  busy.value = true
  const unlocked = unlock.value
  try {
    await unstakeNav({
      stakedOutputs: targets.value.map((p) => p.outputHash),
      amountNav: mode.value === 'part' ? unlocked : undefined,
    })
    result.value = {
      success: true,
      title: t('staking.unstakeForm.successTitle'),
      message: t('staking.unstakeForm.successMessage', { amount: formatAmount(unlocked, 8) }),
    }
  } catch (e) {
    console.error('[staking] unstake failed:', e)
    result.value = { success: false, title: t('staking.unstakeForm.failed'), message: e?.message || t('ops.errors.unknown') }
  } finally {
    busy.value = false
  }
}

function closeReview() {
  if (busy.value) return
  const done = result.value?.success
  result.value = null
  showReview.value = false
  if (done) emit('close')
}
</script>
