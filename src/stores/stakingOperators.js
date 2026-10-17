import { ref, computed } from "vue";
import { walletNetwork } from "@/stores/network";
import { parseOperators, sortOperators } from "@/lib/staking";

// The public staking operator directory. Overridable for local testing with
// VITE_STAKING_OPERATORS_URL.
export const STAKING_OPERATORS_URL =
  import.meta.env.VITE_STAKING_OPERATORS_URL || "https://go.nav.io/staking/operators.json";

const CACHE_KEY = "staking.operators";
const FRESH_MS = 5 * 60_000;
const TIMEOUT_MS = 8_000;

// The last good list is kept on the device, so operator names still show
// offline or while a fresh copy loads. It is parsed again on the way in.
function readCache() {
  try {
    return parseOperators(JSON.parse(localStorage.getItem(CACHE_KEY) || "null"));
  } catch {
    return [];
  }
}

/**
 * Every listed operator, whatever its network or `enabled` flag — used to
 * name the staker of a position, which stays true after an operator is
 * taken off the list.
 */
export const operators = ref(readCache());
// 'idle' | 'loading' | 'ready' | 'error'
export const operatorsStatus = ref("idle");

/** The enabled operators on the open wallet's network — the ones to offer, default first. */
export const networkOperators = computed(() =>
  sortOperators(
    operators.value.filter((o) => o.enabled && (!walletNetwork.value || o.networks.includes(walletNetwork.value)))
  )
);

/** The directory's default operator on this network, if it names one. */
export const defaultOperator = computed(() => networkOperators.value.find((o) => o.isDefault) ?? null);

const byKey = computed(() => new Map(operators.value.map((o) => [o.delegationKey, o])));

/** The listed operator behind a delegation key, or null. */
export function operatorForKey(key) {
  return key ? byKey.value.get(String(key).toLowerCase()) ?? null : null;
}

let lastLoaded = 0;
let inFlight = null;

export function loadOperators({ force = false } = {}) {
  if (inFlight) return inFlight;
  if (!force && Date.now() - lastLoaded < FRESH_MS && operatorsStatus.value === "ready") {
    return Promise.resolve();
  }
  operatorsStatus.value = "loading";
  inFlight = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(STAKING_OPERATORS_URL, { signal: controller.signal, cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const doc = await res.json();
      operators.value = parseOperators(doc);
      lastLoaded = Date.now();
      operatorsStatus.value = "ready";
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(doc)); } catch {}
    } catch (e) {
      console.warn("[staking] operator directory unavailable:", e?.message);
      operatorsStatus.value = "error";
    } finally {
      clearTimeout(timer);
      inFlight = null;
    }
  })();
  return inFlight;
}
