<!-- One operation, however many chain actions it takes underneath: what was
     asked for, a few plain stages, and — only if it stops — what happened
     and what can be done about it. -->
<template>
  <div class="rounded-2xl border border-gray-200 dark:border-gh-700 bg-white dark:bg-gh-800 p-4 space-y-3">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ title }}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 tabular-nums truncate">{{ summary }}</p>
      </div>
      <span class="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold" :class="chip.class">{{ chip.label }}</span>
    </div>

    <!-- Stages -->
    <ol v-if="op.status !== 'done'" class="space-y-2">
      <li v-for="stage in stages" :key="stage.id" class="flex items-center gap-2.5 text-sm">
        <span class="w-5 h-5 shrink-0 flex items-center justify-center">
          <Check v-if="stage.status === 'done'" class="w-4 h-4 text-green-500" />
          <Loader2 v-else-if="stage.status === 'active' && op.status === 'running'" class="w-4 h-4 animate-spin text-blue-500" />
          <AlertTriangle v-else-if="stage.status === 'failed' || (stage.status === 'active' && op.status === 'attention')" class="w-4 h-4 text-amber-500" />
          <span v-else class="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gh-600" />
        </span>
        <span :class="stage.status === 'pending' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'">
          {{ $t(`ops.stage.${stage.id}`, stageParams) }}
        </span>
      </li>
    </ol>

    <p v-if="op.status === 'running'" class="text-xs text-gray-400 dark:text-gray-500 leading-snug">{{ runningHint }}</p>

    <!-- Stopped: say why, and offer the way forward -->
    <div v-if="op.status === 'attention'" class="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 space-y-2.5">
      <p class="text-xs text-amber-800 dark:text-amber-300 leading-snug">{{ attentionText }}</p>
      <p v-if="showAttentionDetail" class="font-mono text-[11px] text-amber-700/80 dark:text-amber-400/80 break-words">{{ op.attention.detail }}</p>

      <template v-if="requote">
        <p class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ $t('ops.requote.offer', { amount: formatAmount(requote.minOut), symbol: requote.symbol }) }}
        </p>
        <div class="flex gap-2">
          <button @click="requote = null" class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-gh-800 border border-gray-200 dark:border-gh-600 text-gray-700 dark:text-gray-300">
            {{ $t('common.back') }}
          </button>
          <button @click="acceptRequote" class="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white">
            {{ $t('ops.requote.accept') }}
          </button>
        </div>
      </template>

      <div v-else class="flex flex-wrap gap-2">
        <button
          v-for="action in actions"
          :key="action.id"
          @click="action.run"
          :disabled="requoting"
          class="flex-1 min-w-[40%] py-2.5 px-2 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
          :class="action.primary
            ? 'bg-blue-600 hover:bg-blue-700 text-white font-semibold'
            : 'bg-white dark:bg-gh-800 border border-gray-200 dark:border-gh-600 text-gray-700 dark:text-gray-300'"
        >
          <Loader2 v-if="action.id === 'requote' && requoting" class="w-4 h-4 animate-spin" />
          {{ action.label }}
        </button>
      </div>
      <p v-if="requoteError" class="text-xs text-red-600 dark:text-red-400">{{ requoteError }}</p>
    </div>

    <!-- Finished -->
    <template v-if="op.status === 'done' || op.status === 'cancelled'">
      <p class="text-xs text-gray-500 dark:text-gray-400 leading-snug">{{ outcomeText }}</p>
      <button
        @click="dismissOperation(op.id)"
        class="w-full py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gh-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gh-600"
      >
        {{ $t('ops.dismiss') }}
      </button>
    </template>
    <button
      v-else-if="op.status === 'running' && cancellable"
      @click="cancelOperation(op.id)"
      class="text-xs font-medium text-gray-400 dark:text-gray-500 underline underline-offset-2"
    >
      {{ $t('ops.stop') }}
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Loader2, AlertTriangle } from 'lucide-vue-next'
import { settings } from '@/stores/settings'
import { evmAddress } from '@/stores/evm'
import { resolveOperation, cancelOperation, dismissOperation } from '@/stores/operations'
import { stagesOf } from '@/lib/intent/router'
import { quoteSell, quoteBuy } from '@/lib/intent/quote'
import { formatAmount } from '@/lib/displayFormat'

const props = defineProps({
  op: { type: Object, required: true },
})

const { t, te } = useI18n()

const stages = computed(() => stagesOf(props.op.steps))
const stageParams = computed(() => ({ from: props.op.from, to: props.op.to }))
const currentStep = computed(() => props.op.steps.find((s) => s.status !== 'done') ?? null)

const title = computed(() =>
  props.op.kind === 'swap'
    ? t('ops.title.swap', { from: props.op.from, to: props.op.to })
    : t(`ops.title.${props.op.kind}`)
)

const summary = computed(() => {
  const op = props.op
  if (op.kind !== 'swap') return `${formatAmount(op.send)} NAV`
  const got = op.status === 'done' && op.ctx.received != null
  const receive = got ? formatAmount(op.ctx.received) : `≈ ${formatAmount(op.estReceive)}`
  // A partial fill sold less than was asked for; show what actually went.
  const sent = got && op.ctx.sold != null && op.steps.filter((s) => s.type === 'order').length === 1 ? op.ctx.sold : op.send
  return `${formatAmount(sent)} ${op.from} → ${receive} ${op.to}`
})

const chip = computed(() => ({
  running: { label: t('ops.status.running'), class: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
  attention: { label: t('ops.status.attention'), class: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  done: { label: t('ops.status.done'), class: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' },
  cancelled: { label: t('ops.status.cancelled'), class: 'bg-gray-100 dark:bg-gh-700 text-gray-500 dark:text-gray-400' },
}[props.op.status]))

// The waits are the only long parts; everything else takes seconds.
const runningHint = computed(() => {
  const type = currentStep.value?.type
  if (type === 'waitCredit') return t('ops.hint.waitCredit', { minutes: props.op.meta?.minutes || 6 })
  if (type === 'waitAccount') return t('ops.hint.waitAccount')
  return t('ops.hint.working')
})

// Once NAV is on its way to the exchange there is nothing to call back;
// stopping then just skips the remaining steps.
const cancellable = computed(() => ['waitCredit', 'waitAccount', 'waitEvm'].includes(currentStep.value?.type))

const attentionCode = computed(() => props.op.attention?.code ?? '')
const attentionText = computed(() =>
  te(`ops.errors.${attentionCode.value}`) ? t(`ops.errors.${attentionCode.value}`) : t('ops.errors.unknown')
)
const showAttentionDetail = computed(() =>
  !!props.op.attention?.detail && !['price_moved', 'interrupted'].includes(attentionCode.value)
)

const outcomeText = computed(() => {
  const op = props.op
  if (op.status === 'cancelled') return t('ops.outcome.cancelled')
  if (op.kind === 'toExchange') return t('ops.outcome.toExchange')
  if (op.kind === 'toWallet') return t('ops.outcome.toWallet')
  const parts = [t('ops.outcome.swap', { amount: formatAmount(op.ctx.received), symbol: op.to })]
  if (op.ctx.partial) parts.push(t('ops.outcome.partial'))
  if (op.deliversToWallet) parts.push(t('ops.outcome.toWallet'))
  else if (op.to === 'NAV') parts.push(t('ops.outcome.keptOnExchange'))
  return parts.join(' ')
})

// --- Recovery ---
const requote = ref(null) // { limitPx, minOut, size, symbol }
const requoting = ref(false)
const requoteError = ref('')

async function fetchRequote() {
  const step = currentStep.value
  requoting.value = true
  requoteError.value = ''
  try {
    const { readBooks, readTakerFeeRate } = await import('@/lib/intent/executors')
    const [books, feeRate] = await Promise.all([readBooks([step.base]), readTakerFeeRate(evmAddress.value)])
    const book = books[step.base]
    const common = { szDecimals: book?.szDecimals, slippageBps: settings.slippageBps, feeRate }
    const quote = step.side === 'sell'
      ? quoteSell({ ...common, size: step.size, bids: book?.bids })
      : quoteBuy({ ...common, budget: step.size != null ? step.size * Number(step.limitPx) : props.op.ctx.proceeds, asks: book?.asks })
    if (quote.error) throw new Error(quote.error)
    requote.value = {
      limitPx: quote.limitPx,
      minOut: quote.minOut,
      size: step.side === 'buy' && step.size != null ? quote.size : step.size,
      symbol: step.side === 'sell' ? 'USDC' : step.base,
    }
  } catch (e) {
    requoteError.value = te(`swap.errors.${e.message}`) ? t(`swap.errors.${e.message}`) : t('ops.errors.unknown')
  } finally {
    requoting.value = false
  }
}

function acceptRequote() {
  const { limitPx, minOut, size } = requote.value
  requote.value = null
  resolveOperation(props.op.id, 'retry', { limitPx, minOut, size })
}

const actions = computed(() => {
  const id = props.op.id
  const stop = { id: 'stop', label: t('ops.stop'), run: () => cancelOperation(id) }
  if (attentionCode.value === 'price_moved') {
    return [
      { id: 'requote', label: t('ops.requote.get'), primary: true, run: fetchRequote },
      { id: 'retry', label: t('ops.requote.keepWaiting'), run: () => resolveOperation(id, 'retry') },
      stop,
    ]
  }
  if (attentionCode.value === 'interrupted') {
    return [
      { id: 'skip', label: t('ops.interrupted.wentThrough'), primary: true, run: () => resolveOperation(id, 'skip') },
      { id: 'retry', label: t('ops.interrupted.sendAgain'), run: () => resolveOperation(id, 'retry') },
      stop,
    ]
  }
  return [{ id: 'retry', label: t('ops.retry'), primary: true, run: () => resolveOperation(id, 'retry') }, stop]
})
</script>
