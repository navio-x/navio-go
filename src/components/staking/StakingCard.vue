<!-- Cold staking on the NAV page. Nothing staked: what staking is, in three
     lines, and the way in. Something staked: the summary (how much, stake
     more, unstake) always in view, and below it Rewards | Positions tabs
     for quick switching. Each position opens to its full details. -->
<template>
  <section class="space-y-3" :aria-label="$t('staking.title')">
    <!-- Hero: a plain card, lit softly from its corners in blue and violet -->
    <div class="relative overflow-hidden rounded-3xl p-5 border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800">
      <div class="pointer-events-none absolute -top-24 -left-20 w-64 h-64 rounded-full bg-blue-500/15 dark:bg-blue-500/20 blur-3xl" />
      <div class="pointer-events-none absolute -bottom-24 -right-16 w-64 h-64 rounded-full bg-violet-500/15 dark:bg-violet-500/20 blur-3xl" />

      <div class="relative">
        <div class="flex items-center justify-between gap-3">
          <span class="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            <Layers class="w-4 h-4" /> {{ $t('staking.title') }}
          </span>
          <span
            v-if="hasStake"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            :class="activeCount
              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'"
          >
            <span class="relative flex w-2 h-2">
              <span v-if="activeCount" class="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
              <span class="relative w-2 h-2 rounded-full" :class="activeCount ? 'bg-emerald-500' : 'bg-amber-500'" />
            </span>
            {{ activeCount ? $t('staking.status.active') : $t('staking.status.confirming') }}
          </span>
        </div>

        <!-- Loading -->
        <div v-if="!stakingLoaded" class="mt-4 space-y-2 animate-pulse">
          <div class="h-8 w-40 rounded-lg bg-gray-100 dark:bg-gh-700" />
          <div class="h-4 w-56 rounded bg-gray-100 dark:bg-gh-700" />
        </div>

        <!-- Staked -->
        <template v-else-if="hasStake">
          <p class="mt-3 text-xs text-gray-400 dark:text-gray-500">{{ $t('staking.staked') }}</p>
          <p class="text-3xl font-bold tabular-nums truncate text-gray-900 dark:text-white">
            {{ formatAmount(stakedBalance, 8) }} <span class="text-base font-medium text-gray-500 dark:text-gray-400">NAV</span>
          </p>
          <p v-if="stakedFiat" class="text-sm text-gray-500 dark:text-gray-400">≈ {{ stakedFiat }}</p>
          <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {{ $t('staking.summary', { count: positions.length }, positions.length) }}
          </p>

          <div class="mt-4 grid grid-cols-2 gap-2">
            <button
              @click="openStake(singleStaker)"
              :disabled="!canStake"
              class="py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Plus class="w-4 h-4" /> {{ $t('staking.stakeMore') }}
            </button>
            <button
              @click="openUnstake('all')"
              :disabled="!unstakable.length"
              class="py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gh-600 bg-white/60 dark:bg-gh-800/60
                     text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gh-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Unlock class="w-4 h-4" /> {{ $t('staking.unstake') }}
            </button>
          </div>
        </template>

        <!-- Nothing staked yet -->
        <template v-else>
          <h2 class="mt-3 text-xl font-bold leading-tight text-gray-900 dark:text-white">{{ $t('staking.hero.title') }}</h2>
          <p class="mt-1.5 text-sm leading-snug text-gray-500 dark:text-gray-400">{{ $t('staking.hero.subtitle') }}</p>

          <ul class="mt-4 grid grid-cols-3 gap-2">
            <li
              v-for="perk in perks"
              :key="perk.key"
              class="rounded-xl border border-gray-100 dark:border-gh-700 bg-white/60 dark:bg-gh-900/40 backdrop-blur px-2 py-2.5 text-center"
            >
              <component :is="perk.icon" class="w-4 h-4 mx-auto mb-1 text-blue-500 dark:text-blue-400" />
              <span class="block text-[11px] font-medium leading-tight text-gray-600 dark:text-gray-300">{{ perk.label }}</span>
            </li>
          </ul>

          <button
            @click="openStake('')"
            :disabled="!canStake"
            class="mt-4 w-full py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {{ $t('staking.start') }} <ArrowRight class="w-4 h-4" />
          </button>
        </template>

        <p v-if="stakingLoaded && !canStake" class="mt-2.5 text-xs leading-snug text-gray-500 dark:text-gray-400">
          {{ $t('staking.needMin', { min: formatAmount(minStake), available: formatAmount(maxStake, 8) }) }}
        </p>

        <!-- The full explanation lives on its own page -->
        <button
          type="button"
          @click="router.push('/asset/NAV/staking')"
          class="mt-4 pt-3 w-full border-t border-gray-100 dark:border-gh-700 flex items-center justify-between gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
          <span class="flex items-center gap-2"><BookOpen class="w-4 h-4" /> {{ $t('staking.howItWorks') }}</span>
          <ChevronRight class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- With a stake: Rewards | Positions, the summary above staying in view.
         Underlined, so they don't read as the rewards' own range pills. -->
    <template v-if="stakingLoaded && hasStake">
      <div class="flex gap-6 px-1 border-b border-gray-200 dark:border-gh-700" role="tablist" :aria-label="$t('staking.title')">
        <button
          v-for="tab in SECTION_TABS"
          :key="tab"
          :id="`staking-tab-${tab}`"
          type="button"
          role="tab"
          :aria-selected="sectionTab === tab"
          :aria-controls="`staking-panel-${tab}`"
          @click="setSectionTab(tab)"
          class="relative pb-2.5 flex items-baseline gap-1.5 text-sm font-semibold transition-colors"
          :class="sectionTab === tab ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
        >
          {{ tab === 'rewards' ? $t('staking.rewards.title') : $t('staking.positions') }}
          <span class="text-xs font-medium tabular-nums text-gray-400 dark:text-gray-500">{{ tabHint[tab] }}</span>
          <span v-if="sectionTab === tab" class="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-blue-600 dark:bg-blue-400" />
        </button>
      </div>

      <StakingRewards
        v-show="sectionTab === 'rewards'"
        id="staking-panel-rewards"
        role="tabpanel"
        aria-labelledby="staking-tab-rewards"
        v-model:range="rewardsRange"
        :rewards="rewards"
        :show-title="false"
      />
    </template>

    <!-- No stake left, but rewards earned before: shown on their own -->
    <StakingRewards v-else-if="stakingLoaded && rewards.length" v-model:range="rewardsRange" :rewards="rewards" />

    <!-- Positions -->
    <div
      v-if="stakingLoaded && hasStake"
      v-show="sectionTab === 'positions'"
      id="staking-panel-positions"
      role="tabpanel"
      aria-labelledby="staking-tab-positions"
      class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 overflow-hidden"
    >
      <ul class="divide-y divide-gray-100 dark:divide-gh-700">
        <li v-for="p in positions" :key="p.outputHash">
          <button type="button" @click="selected = p" class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gh-700/50">
            <StakerAvatar :staker-key="p.delegateKey" :size="36" />
            <span class="min-w-0 flex-1">
              <span v-if="p.operator" class="block text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{{ p.operator.name }}</span>
              <span v-else class="block text-sm font-medium text-gray-800 dark:text-gray-100 truncate" :class="{ 'font-mono': p.delegateKey }">
                {{ p.delegateKey ? shortKey(p.delegateKey) : $t('staking.status.unknown') }}
              </span>
              <span class="block text-xs text-gray-400 dark:text-gray-500">
                {{ p.status === 'confirming' ? $t('staking.waitingConfirm') : $t('staking.sinceBlock', { height: p.blockHeight.toLocaleString() }) }}
              </span>
            </span>
            <span class="shrink-0 text-right">
              <span class="block text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{{ formatAmount(p.amount, 8) }}</span>
              <span class="inline-block mt-0.5 px-1.5 py-px rounded-full text-[10px] font-semibold" :class="statusChip(p.status)">
                {{ $t(`staking.status.${p.status}`) }}
              </span>
            </span>
          </button>
        </li>
      </ul>
    </div>

    <!-- One position -->
    <BottomSheet :open="!!selected" :title="$t('staking.position.title')" @close="selected = null">
      <div v-if="selected" class="space-y-4">
        <div class="flex items-center gap-3">
          <StakerAvatar :staker-key="selected.delegateKey" :size="44" />
          <div class="min-w-0">
            <p class="text-2xl font-bold tabular-nums text-gray-900 dark:text-white truncate">{{ formatAmount(selected.amount, 8) }} NAV</p>
            <p v-if="selected.operator" class="text-sm font-medium text-gray-600 dark:text-gray-300 truncate">{{ selected.operator.name }}</p>
            <span class="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold" :class="statusChip(selected.status)">
              {{ $t(`staking.status.${selected.status}`) }}
            </span>
          </div>
        </div>

        <dl class="rounded-2xl bg-gray-50 dark:bg-gh-800 p-4 space-y-3.5 text-sm">
          <div v-for="row in selectedRows" :key="row.label">
            <dt class="text-xs text-gray-400 dark:text-gray-500">{{ row.label }}</dt>
            <dd class="mt-0.5 flex items-start gap-2">
              <a
                v-if="row.link"
                :href="row.link"
                target="_blank"
                rel="noopener noreferrer"
                class="min-w-0 flex-1 font-medium text-blue-600 dark:text-blue-400 break-all"
              >{{ row.value }}</a>
              <span v-else class="min-w-0 flex-1 text-gray-800 dark:text-gray-100" :class="row.mono ? 'font-mono text-xs break-all' : 'font-medium'">{{ row.value }}</span>
              <button
                v-if="row.copy"
                type="button"
                @click="copy(row.copy)"
                class="shrink-0 p-1 -m-1 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                :aria-label="$t('common.copy')"
              >
                <Check v-if="copied === row.copy" class="w-4 h-4 text-emerald-500" />
                <Copy v-else class="w-4 h-4" />
              </button>
            </dd>
          </div>
        </dl>

        <p v-if="selected.status === 'unknown'" class="rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300 leading-snug">
          {{ $t('staking.position.unknownHint') }}
        </p>

        <div class="grid gap-2" :class="selected.status === 'active' ? 'grid-cols-2' : 'grid-cols-1'">
          <button
            v-if="selected.status === 'active'"
            @click="openStake(selected.delegateKey)"
            :disabled="!canStake"
            class="py-3 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gh-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gh-700 disabled:opacity-50"
          >
            {{ $t('staking.stakeMore') }}
          </button>
          <button
            @click="openUnstake(selected.outputHash)"
            :disabled="selected.status === 'confirming'"
            class="py-3 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            {{ selected.status === 'confirming' ? $t('staking.waitingConfirm') : $t('staking.unstake') }}
          </button>
        </div>
      </div>
    </BottomSheet>

    <StakeSheet :open="stakeOpen" :preset-key="stakePreset" @close="stakeOpen = false" />
    <UnstakeSheet :open="unstakeOpen" :positions="positions" :target="unstakeTarget" @close="unstakeOpen = false" />
  </section>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Layers, Plus, Unlock, ArrowRight, ChevronRight, BookOpen, ShieldCheck, Clock, Coins, Copy, Check } from 'lucide-vue-next'
import {
  balance, utxos, stakedBalance, stakedOutputs, stakeDelegations, stakingLoaded, refreshStaking, getMinStakeNav,
} from '@/stores/navio'
import { getReservedAmount } from '@/stores/trade'
import { navPrice } from '@/stores/navPrice'
import { settings } from '@/stores/settings'
import { navSendAllFee } from '@/lib/navioFee'
import { spendableNavUtxoAmounts } from '@/stores/navio'
import { formatAmount, formatFiatFromUsd } from '@/lib/displayFormat'
import { toPositions, toRewards, shortKey, rewardSeries, REWARD_RANGES } from '@/lib/staking'
import { operatorForKey, loadOperators } from '@/stores/stakingOperators'
import BottomSheet from '@/components/tx/BottomSheet.vue'
import StakerAvatar from './StakerAvatar.vue'
import StakeSheet from './StakeSheet.vue'
import UnstakeSheet from './UnstakeSheet.vue'
import StakingRewards from './StakingRewards.vue'

const { t } = useI18n()
const router = useRouter()
onMounted(() => {
  refreshStaking()
  loadOperators()
})

// Each position names its operator when the directory lists its key.
const positions = computed(() =>
  toPositions(stakedOutputs.value, stakeDelegations.value).map((p) => ({ ...p, operator: operatorForKey(p.delegateKey) }))
)
const hasStake = computed(() => positions.value.length > 0)
// Every reward the wallet has received, spent or not: earned is earned.
const rewards = computed(() => toRewards(utxos.value))

// --- Rewards | Positions ---
const SECTION_TABS = ['rewards', 'positions']
const TAB_KEY = 'staking.tab'
const RANGE_KEY = 'staking.rewardsRange'
// Both choices are remembered on this device.
function saved(key, allowed, fallback) {
  try {
    const value = localStorage.getItem(key)
    if (allowed.includes(value)) return value
  } catch {}
  return fallback
}
function remember(key, value) {
  try { localStorage.setItem(key, value) } catch {}
}
const sectionTab = ref(saved(TAB_KEY, SECTION_TABS, 'rewards'))
function setSectionTab(tab) {
  sectionTab.value = tab
  remember(TAB_KEY, tab)
}
const rewardsRange = ref(saved(RANGE_KEY, REWARD_RANGES.map((r) => r.key), '30D'))
watch(rewardsRange, (range) => remember(RANGE_KEY, range))

// What each tab holds, at a glance: the range's earnings, the position count.
const tabHint = computed(() => {
  const earned = rewardSeries(rewards.value, rewardsRange.value).total
  return {
    rewards: `${earned > 0 ? '+' : ''}${formatAmount(earned, 2)} · ${rewardsRange.value}`,
    positions: String(positions.value.length),
  }
})
const activeCount = computed(() => positions.value.filter((p) => p.status === 'active').length)
const unstakable = computed(() => positions.value.filter((p) => p.status !== 'confirming'))
const stakers = computed(() => [...new Set(positions.value.map((p) => p.delegateKey).filter(Boolean))])
const singleStaker = computed(() => (stakers.value.length === 1 ? stakers.value[0] : ''))

const stakedFiat = computed(() =>
  settings.showFiatValue && navPrice.usd != null && stakedBalance.value > 0
    ? formatFiatFromUsd(stakedBalance.value * navPrice.usd)
    : null
)

const minStake = computed(() => getMinStakeNav())
const maxStake = computed(() =>
  Math.max(0, (Number(balance.value) || 0) - Number(getReservedAmount(null)) / 1e8 - navSendAllFee(spendableNavUtxoAmounts.value))
)
const canStake = computed(() => maxStake.value >= minStake.value)

const perks = computed(() => [
  { key: 'keys', icon: ShieldCheck, label: t('staking.perks.keys') },
  { key: 'anytime', icon: Clock, label: t('staking.perks.anytime') },
  { key: 'min', icon: Coins, label: t('staking.perks.min', { amount: formatAmount(minStake.value) }) },
])


function statusChip(status) {
  if (status === 'active') return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
  if (status === 'confirming') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
  return 'bg-gray-100 dark:bg-gh-700 text-gray-600 dark:text-gray-300'
}

// --- One position ---
const selected = ref(null)
const selectedRows = computed(() => {
  const p = selected.value
  if (!p) return []
  const rows = []
  if (p.operator) {
    rows.push({ label: t('staking.operators.operator'), value: p.operator.name })
    rows.push({
      label: t('staking.operators.feeLabel'),
      value: p.operator.feeBps === 0
        ? t('staking.operators.noFee')
        : `${(p.operator.feeBps / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`,
    })
    if (p.operator.website) rows.push({ label: t('staking.operators.website'), value: p.operator.website, link: p.operator.website })
  }
  if (p.delegateKey) rows.push({ label: t('staking.position.stakerKey'), value: p.delegateKey, mono: true, copy: p.delegateKey })
  if (p.rewardAddress) rows.push({ label: t('staking.form.rewardsTo'), value: p.rewardAddress, mono: true, copy: p.rewardAddress })
  rows.push({
    label: t('staking.position.since'),
    value: p.blockHeight > 0 ? `#${p.blockHeight.toLocaleString()}` : t('staking.waitingConfirm'),
  })
  if (p.txHash) rows.push({ label: t('staking.position.tx'), value: p.txHash, mono: true, copy: p.txHash })
  return rows
})

const copied = ref('')
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = text
    setTimeout(() => { if (copied.value === text) copied.value = '' }, 1500)
  } catch (e) {
    console.warn('[staking] copy failed:', e?.message)
  }
}

// --- Flows ---
const stakeOpen = ref(false)
const stakePreset = ref('')
function openStake(presetKey) {
  stakePreset.value = presetKey || ''
  selected.value = null
  stakeOpen.value = true
}

const unstakeOpen = ref(false)
const unstakeTarget = ref('all')
function openUnstake(target) {
  // "Unstake" on the card with a single position goes straight to it, so a
  // partial unstake is on offer.
  unstakeTarget.value = target === 'all' && unstakable.value.length === 1 ? unstakable.value[0].outputHash : target
  selected.value = null
  unstakeOpen.value = true
}
</script>
