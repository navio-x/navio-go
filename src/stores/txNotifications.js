import { ref } from "vue";
import { newTxEvents } from "@/lib/txNotify";
import { playTxSound } from "@/lib/txSound";

// Toasts for transactions the wallet sees arrive: NAV received, sent, or a
// staking reward. Shown by components/TxToasts.vue; fed by navio.js each
// time it reads the wallet's outputs.

const TOAST_MS = 5000;
const MAX_TOASTS = 3;

/** [{ id, txHash, kind: 'in' | 'out' | 'reward', amount (sats), pending }] */
export const toasts = ref([]);

let seen = new Set();
// Off until the wallet has caught up with the chain once (see
// baselineTransactions): what a sync or a restore finds is history, not news.
let armed = false;
let nextId = 1;

export function dismissToast(id) {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

function showToast(event) {
  const id = nextId++;
  toasts.value = [...toasts.value, { ...event, id }].slice(-MAX_TOASTS);
  setTimeout(() => dismissToast(id), TOAST_MS);
}

/** Whether new transactions are being announced yet. */
export function isTxTrackingArmed() {
  return armed;
}

/**
 * Take the starting point: everything in `outputs` is already known, and
 * anything that turns up after this is news. Called once the wallet first
 * reaches the chain tip (navio.js, from the sync's progress), so what the
 * catch-up found is never announced, and the first new block after it is.
 */
export function baselineTransactions(outputs) {
  seen = newTxEvents(outputs, seen).seen;
  armed = true;
}

/** Look at the wallet's outputs again; announce what is new, once armed. */
export function trackTransactions(outputs) {
  const result = newTxEvents(outputs, seen);
  seen = result.seen;
  if (!armed) return;
  const events = result.events.slice(-MAX_TOASTS);
  for (const event of events) showToast(event);
  if (events.length) playTxSound(events[events.length - 1].kind);
}

/** A different wallet (or none) is open: start over. */
export function resetTxTracking() {
  seen = new Set();
  armed = false;
  toasts.value = [];
}
