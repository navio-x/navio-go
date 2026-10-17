<!-- How cold staking works, for anyone about to stake or wondering about a
     stake they have: the few numbers that matter first, then the flow, what
     it earns (with an estimator), what a delegation key is, what a staker
     can and can't do, and how to get out. Every figure comes from navio-core
     (see STAKING_PARAMS); nothing here is a promise of a rate. -->
<template>
  <div class="bg-gray-50 dark:bg-gh-900 min-h-full flex flex-col">
    <div class="flex items-center gap-3 px-5 pt-5 pb-4">
      <button
        @click="router.back()"
        :aria-label="$t('common.back')"
        class="p-2 -ml-2 rounded-xl transition hover:bg-gray-100 dark:hover:bg-gh-800 text-gray-600 dark:text-gray-400"
      >
        <ChevronLeft class="w-5 h-5" />
      </button>
      <h1 class="text-lg font-bold text-gray-900 dark:text-white truncate flex-1 min-w-0">{{ $t('stakingGuide.title') }}</h1>
    </div>

    <div class="w-full max-w-md mx-auto px-5 pb-8 space-y-4">
      <!-- Intro, lit like the staking card -->
      <section class="relative overflow-hidden rounded-3xl p-5 border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800">
        <div class="pointer-events-none absolute -top-24 -left-20 w-64 h-64 rounded-full bg-blue-500/15 dark:bg-blue-500/20 blur-3xl" />
        <div class="pointer-events-none absolute -bottom-24 -right-16 w-64 h-64 rounded-full bg-violet-500/15 dark:bg-violet-500/20 blur-3xl" />
        <div class="relative">
          <span class="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            <Layers class="w-4 h-4" /> {{ $t('staking.title') }}
          </span>
          <p class="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{{ $t('stakingGuide.intro') }}</p>

          <dl class="mt-4 grid grid-cols-2 gap-2">
            <div v-for="fact in facts" :key="fact.label" class="rounded-xl border border-gray-100 dark:border-gh-700 bg-white/60 dark:bg-gh-900/40 backdrop-blur px-3 py-2.5">
              <dt class="text-[11px] text-gray-400 dark:text-gray-500 leading-tight">{{ fact.label }}</dt>
              <dd class="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">{{ fact.value }}</dd>
            </div>
          </dl>
        </div>
      </section>

      <!-- The flow -->
      <section :class="card">
        <h2 :class="heading">{{ $t('stakingGuide.flow.title') }}</h2>
        <ol class="mt-4">
          <li v-for="(step, i) in flow" :key="step.id" class="relative flex gap-3 pb-5 last:pb-0">
            <span v-if="i < flow.length - 1" class="absolute left-[17px] top-9 bottom-1 w-px bg-gradient-to-b from-blue-300 to-violet-300 dark:from-blue-700 dark:to-violet-700" aria-hidden="true" />
            <span class="relative shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <component :is="step.icon" class="w-4 h-4" />
            </span>
            <div class="min-w-0 pt-1">
              <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ $t(`stakingGuide.flow.${step.id}.title`) }}</p>
              <p class="mt-0.5 text-sm leading-snug text-gray-500 dark:text-gray-400">{{ $t(`stakingGuide.flow.${step.id}.body`) }}</p>
            </div>
          </li>
        </ol>
      </section>

      <!-- Rewards -->
      <section id="rewards" class="scroll-mt-4" :class="card">
        <h2 :class="heading">{{ $t('stakingGuide.rewards.title') }}</h2>
        <p :class="body">{{ $t('stakingGuide.rewards.body', { reward: P.blockReward, perDay: fmt(networkPerDay) }) }}</p>
        <p class="mt-3 rounded-xl bg-gray-50 dark:bg-gh-900/60 border border-gray-100 dark:border-gh-700 px-3 py-2.5 text-xs font-mono leading-relaxed text-gray-700 dark:text-gray-300">
          {{ $t('stakingGuide.rewards.formula', { blocks: BLOCKS_PER_DAY, reward: P.blockReward }) }}
        </p>
        <p :class="body">{{ $t('stakingGuide.rewards.luck') }}</p>
        <p :class="body">{{ $t('stakingGuide.rewards.maturity', { blocks: P.rewardMaturity, hours: maturityHours }) }}</p>
      </section>

      <!-- Estimator -->
      <section :class="card">
        <h2 :class="heading">{{ $t('stakingGuide.estimator.title') }}</h2>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <label class="col-span-2 block">
            <span :class="fieldLabel">{{ $t('stakingGuide.estimator.totalStaked') }}</span>
            <span :class="fieldBox">
              <input v-model="totalInput" @input="totalInput = clean(totalInput)" inputmode="decimal" placeholder="0" :class="fieldInput" />
              <span class="text-xs text-gray-400">NAV</span>
            </span>
            <span class="mt-1 block text-[11px] leading-snug text-gray-400 dark:text-gray-500">{{ $t('stakingGuide.estimator.totalHint') }}</span>
          </label>
          <label class="block">
            <span :class="fieldLabel">{{ $t('stakingGuide.estimator.yourStake') }}</span>
            <span :class="fieldBox">
              <input v-model="stakeInput" @input="stakeInput = clean(stakeInput)" inputmode="decimal" placeholder="0" :class="fieldInput" />
              <span class="text-xs text-gray-400">NAV</span>
            </span>
          </label>
          <label class="block">
            <span :class="fieldLabel">{{ $t('stakingGuide.estimator.fee') }}</span>
            <span :class="fieldBox">
              <input v-model="feeInput" @input="feeInput = clean(feeInput)" inputmode="decimal" placeholder="0" :class="fieldInput" />
              <span class="text-xs text-gray-400">%</span>
            </span>
          </label>
        </div>

        <template v-if="estimate">
          <dl class="mt-4 grid grid-cols-2 gap-2">
            <div v-for="row in estimateRows" :key="row.label" class="rounded-xl bg-gray-50 dark:bg-gh-900/60 px-3 py-2.5">
              <dt class="text-[11px] text-gray-400 dark:text-gray-500">{{ row.label }}</dt>
              <dd class="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white truncate">{{ row.value }}</dd>
            </div>
          </dl>
          <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">{{ $t('stakingGuide.estimator.every', { time: waitLabel }) }}</p>
          <p class="mt-1 text-[11px] leading-snug text-gray-400 dark:text-gray-500">{{ $t('stakingGuide.estimator.note') }}</p>
        </template>
        <p v-else class="mt-3 text-xs text-gray-400 dark:text-gray-500">{{ $t('stakingGuide.estimator.enterTotal') }}</p>
      </section>

      <!-- Delegation key -->
      <section id="key" class="scroll-mt-4" :class="card">
        <h2 :class="heading">{{ $t('stakingGuide.key.title') }}</h2>
        <i18n-t keypath="stakingGuide.key.body" tag="p" :class="body" scope="global">
          <template #cmd><code :class="inlineCode">navio-staker -gendelegationkey</code></template>
        </i18n-t>
        <div class="mt-3 rounded-xl bg-gray-50 dark:bg-gh-900/60 border border-gray-100 dark:border-gh-700 px-3 py-2.5">
          <p class="text-[11px] text-gray-400 dark:text-gray-500">{{ $t('stakingGuide.key.example') }}</p>
          <p class="mt-1 flex items-start gap-2.5">
            <StakerAvatar :staker-key="EXAMPLE_KEY" :size="26" />
            <span class="min-w-0 text-[11px] font-mono leading-relaxed break-all text-gray-600 dark:text-gray-300">{{ EXAMPLE_KEY }}</span>
          </p>
        </div>
        <p :class="body">{{ $t('stakingGuide.key.payload') }}</p>
        <p class="mt-3 flex gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-xs leading-snug text-amber-800 dark:text-amber-300">
          <AlertTriangle class="w-4 h-4 shrink-0 mt-px" />
          <span>{{ $t('stakingGuide.key.network') }}</span>
        </p>
      </section>

      <!-- Trust model -->
      <section :class="card">
        <h2 :class="heading">{{ $t('stakingGuide.trust.title') }}</h2>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <div v-for="side in trust" :key="side.id" class="rounded-xl p-3" :class="side.box">
            <p class="text-xs font-semibold" :class="side.tone">{{ $t(`stakingGuide.trust.${side.id}`) }}</p>
            <ul class="mt-2 space-y-2">
              <li v-for="n in 3" :key="n" class="flex gap-1.5 text-xs leading-snug text-gray-700 dark:text-gray-200">
                <component :is="side.icon" class="w-3.5 h-3.5 shrink-0 mt-px" :class="side.tone" />
                {{ $t(`stakingGuide.trust.${side.id}${n}`) }}
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Fee and routing, unstaking, privacy, restore -->
      <section v-for="topic in topics" :key="topic" :class="card">
        <h2 :class="heading">{{ $t(`stakingGuide.${topic}.title`) }}</h2>
        <p :class="body">{{ $t(`stakingGuide.${topic}.body`) }}</p>
        <p v-if="topic === 'fee'" :class="body">{{ $t('stakingGuide.fee.advisory') }}</p>
        <p v-if="topic === 'unstake'" :class="body">{{ $t('stakingGuide.unstake.partial', { min: fmt(minStake) }) }}</p>
      </section>

      <!-- Self-operated -->
      <section :class="card">
        <h2 :class="heading">{{ $t('stakingGuide.self.title') }}</h2>
        <p :class="body">{{ $t('stakingGuide.self.body') }}</p>
        <ol class="mt-3 space-y-3">
          <li v-for="(cmd, i) in commands" :key="i">
            <p class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ i + 1 }}. {{ $t(`stakingGuide.self.step${i + 1}`) }}</p>
            <div v-if="cmd" class="mt-1.5 flex items-start gap-2 rounded-xl bg-gray-900 dark:bg-black/40 px-3 py-2.5">
              <code class="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-[11px] font-mono leading-relaxed text-gray-100">{{ cmd }}</code>
              <button
                type="button"
                @click="copy(cmd)"
                class="shrink-0 p-1 -m-1 rounded text-gray-400 hover:text-white"
                :aria-label="$t('common.copy')"
              >
                <Check v-if="copied === cmd" class="w-4 h-4 text-emerald-400" />
                <Copy v-else class="w-4 h-4" />
              </button>
            </div>
          </li>
        </ol>
      </section>

      <a
        :href="DOCS_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 px-4 py-3.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gh-700"
      >
        <span class="flex items-center gap-2"><BookOpen class="w-4 h-4 text-blue-500" /> {{ $t('stakingGuide.docs') }}</span>
        <ExternalLink class="w-4 h-4 text-gray-400" />
      </a>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  ChevronLeft, Layers, Wallet, Server, Network, Coins, Check, X, Copy, AlertTriangle, BookOpen, ExternalLink,
} from 'lucide-vue-next'
import { stakedBalance, getMinStakeNav } from '@/stores/navio'
import { formatAmount } from '@/lib/displayFormat'
import { STAKING_PARAMS as P, BLOCKS_PER_DAY, estimateRewards } from '@/lib/staking'
import StakerAvatar from '@/components/staking/StakerAvatar.vue'

const router = useRouter()
const route = useRoute()
const { t, locale } = useI18n()

const DOCS_URL = 'https://docs.nav.io/node/cold-staking/'
// The shape of a real key; not anyone's.
const EXAMPLE_KEY = '8f3a9c21' + 'b4e7d05a'.repeat(10) + '6c1e9f02'

// Shared section styles.
const card = 'rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4'
const heading = 'text-base font-bold text-gray-900 dark:text-white'
const body = 'mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300'
const inlineCode = 'whitespace-nowrap rounded-md bg-gray-100 dark:bg-gh-900/60 px-1.5 py-0.5 font-mono text-[12px] text-gray-800 dark:text-gray-200'
const fieldLabel = 'block text-[11px] text-gray-400 dark:text-gray-500'
const fieldBox = 'mt-1 flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gh-600 bg-white dark:bg-gh-900/60 px-3 py-2 focus-within:border-blue-400'
const fieldInput = 'min-w-0 flex-1 bg-transparent text-sm font-semibold tabular-nums text-gray-900 dark:text-white outline-none placeholder-gray-300 dark:placeholder-gray-600'

const fmt = (n, d) => formatAmount(n, d)
const minStake = computed(() => getMinStakeNav())
const networkPerDay = BLOCKS_PER_DAY * P.blockReward
const maturityHours = ((P.rewardMaturity * P.blockSeconds) / 3600).toLocaleString(undefined, { maximumFractionDigits: 1 })

const facts = computed(() => [
  { label: t('stakingGuide.facts.blockReward'), value: `${P.blockReward} NAV` },
  { label: t('stakingGuide.facts.blockTime'), value: t('stakingGuide.facts.minutes', { n: P.blockSeconds / 60 }) },
  { label: t('stakingGuide.facts.minStake'), value: `${fmt(minStake.value)} NAV` },
  { label: t('stakingGuide.facts.maturity'), value: t('stakingGuide.facts.blocks', { n: P.rewardMaturity }) },
])

const flow = [
  { id: 'wallet', icon: Wallet },
  { id: 'staker', icon: Server },
  { id: 'network', icon: Network },
  { id: 'reward', icon: Coins },
]

const trust = [
  { id: 'can', icon: Check, tone: 'text-emerald-600 dark:text-emerald-400', box: 'bg-emerald-50/60 dark:bg-emerald-900/15' },
  { id: 'cannot', icon: X, tone: 'text-red-500 dark:text-red-400', box: 'bg-red-50/60 dark:bg-red-900/15' },
]

const topics = ['fee', 'unstake', 'privacy', 'restore']

const commands = [
  'navio-staker -gendelegationkey',
  '',
  'navio-staker -delegated -delegationkeyfile=/etc/navio/delegation.key',
]

// --- Estimator ---
// Starts from what this wallet has staked, or the minimum.
const stakeInput = ref(String(stakedBalance.value > 0 ? Math.round(stakedBalance.value) : minStake.value))
const totalInput = ref('')
const feeInput = ref('0')

// Digits and one decimal point, a comma read as the point.
function clean(v) {
  let s = String(v).replace(',', '.').replace(/[^\d.]/g, '')
  const dot = s.indexOf('.')
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '')
  return s
}

const estimate = computed(() =>
  estimateRewards({ stake: stakeInput.value, totalStaked: totalInput.value, feePercent: feeInput.value || 0 })
)

const estimateRows = computed(() => {
  const e = estimate.value
  return [
    { label: t('stakingGuide.estimator.perDay'), value: `${fmt(e.perDay)} NAV` },
    { label: t('stakingGuide.estimator.perMonth'), value: `${fmt(e.perMonth)} NAV` },
    { label: t('stakingGuide.estimator.perYear'), value: `${fmt(e.perYear)} NAV` },
    { label: t('stakingGuide.estimator.apr'), value: `${e.apr.toLocaleString(locale.value, { maximumFractionDigits: 2 })}%` },
  ]
})

// The average wait between rewards, in the largest unit that reads well.
const waitLabel = computed(() => {
  const days = estimate.value?.daysBetweenRewards ?? Infinity
  const n = (v) => Math.max(1, Math.round(v))
  if (days >= 1) return t('stakingGuide.units.days', { n: n(days) }, n(days))
  if (days * 24 >= 1) return t('stakingGuide.units.hours', { n: n(days * 24) }, n(days * 24))
  return t('stakingGuide.units.minutes', { n: n(days * 1440) }, n(days * 1440))
})

const copied = ref('')
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = text
    setTimeout(() => { if (copied.value === text) copied.value = '' }, 1500)
  } catch (e) {
    console.warn('[staking-guide] copy failed:', e?.message)
  }
}

// ?section=key (or rewards) opens the page at that section.
onMounted(async () => {
  const id = route.query.section
  if (typeof id !== 'string') return
  await nextTick()
  document.getElementById(id)?.scrollIntoView({ block: 'start' })
})
</script>
