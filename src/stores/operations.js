import { ref, computed, watch } from "vue";
import { settings } from "@/stores/settings";
import { evmAddress } from "@/stores/evm";
import { balance } from "@/stores/navio";
import { createEngine } from "@/lib/intent/engine";
import { STEP_TYPES } from "@/lib/intent/steps";

/**
 * The user's in-flight and recent multi-step operations (swaps that move
 * NAV between the wallet and the exchange, explicit moves). Kept per EVM
 * account in localStorage and driven by lib/intent/engine.js; this module
 * only wires that engine to the real executors and to Vue.
 */
export const operations = ref([]);

// A payout that hasn't visibly landed is dropped from "on the way" after
// this long, so a missed detection can't inflate the balance forever.
const PAYOUT_MAX_AGE_MS = 3 * 60 * 60 * 1000;
const KEEP_FINISHED = 10;

let storageKey = null;

const storage = {
  load() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
      return [];
    }
  },
  save(ops) {
    if (!storageKey) return;
    // Everything in flight is kept; only the finished tail is trimmed.
    const active = ops.filter((o) => o.status === "running" || o.status === "attention");
    const finished = ops.filter((o) => o.status !== "running" && o.status !== "attention").slice(0, KEEP_FINISHED);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...active, ...finished]));
    } catch (e) {
      console.error("[operations] persist failed:", e);
    }
  },
};

// The chain code behind the steps (exchange SDK, bridge contract, note
// encryption) is only fetched once a step actually runs, so a wallet that
// never swaps doesn't load it with the home screen.
const executors = Object.fromEntries(
  Object.entries(STEP_TYPES).map(([type, { broadcast }]) => [
    type,
    {
      broadcast,
      run: async (...args) => (await import("@/lib/intent/executors")).executors[type].run(...args),
    },
  ])
);

const engine = createEngine({
  executors,
  storage,
  onChange: (ops) => {
    operations.value = JSON.parse(JSON.stringify(ops));
  },
});

// Gated on dexMode like every other Hyperliquid feature: with it off (or
// no wallet open) nothing is loaded and no request is made.
watch(
  () => (settings.dexMode ? evmAddress.value : ""),
  (address) => {
    if (!address) {
      storageKey = null;
      engine.stop();
      return;
    }
    storageKey = `intentOps:${address.toLowerCase()}`;
    engine.resume();
  },
  { immediate: true },
);

export const isActive = (op) => op.status === "running" || op.status === "attention";

export const activeOperations = computed(() => operations.value.filter(isActive));

const stepOf = (op, type) => op.steps.find((s) => s.type === type);
const awaitsPayout = (op) => !!op.ctx?.payout && !op.ctx.payoutSettled;

/** NAV that has left one side and not yet shown up on the other. */
export const navInTransit = computed(() => {
  let toExchange = 0;
  let toWallet = 0;
  for (const op of operations.value) {
    const deposit = stepOf(op, "deposit");
    const credit = stepOf(op, "waitCredit");
    if (deposit?.status === "done" && credit && credit.status !== "done" && op.status !== "cancelled") {
      toExchange += deposit.amount;
    }
    if (awaitsPayout(op)) toWallet += op.ctx.payout.amount;
  }
  return { toExchange, toWallet };
});

// A withdrawal counts as arrived once the wallet balance has grown by about
// the amount sent (the bridge pays out a few minutes after the burn).
function settlePayouts() {
  const wallet = Number(balance.value) || 0;
  for (const op of operations.value) {
    if (!awaitsPayout(op)) continue;
    const { amount, baseline, at } = op.ctx.payout;
    if (wallet >= baseline + amount * 0.9 || Date.now() - at > PAYOUT_MAX_AGE_MS) {
      engine.patch(op.id, (o) => { o.ctx.payoutSettled = true; });
    }
  }
}
watch([balance, operations], settlePayouts);

export function startOperation(plan, meta) {
  return engine.start(plan, meta);
}

export function resolveOperation(id, action, patch) {
  engine.resolve(id, action, patch);
}

export function cancelOperation(id) {
  engine.cancel(id);
}

export function dismissOperation(id) {
  engine.dismiss(id);
}
