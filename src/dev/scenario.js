/**
 * DEV-ONLY test harness: a simulated wallet / exchange / bridge state so every
 * user journey (fresh account, half-finished setup, waiting deposit, failed
 * step, …) can be exercised without real funds. It is a no-op unless the app
 * runs under `vite` (import.meta.env.DEV) AND localStorage has a `uxScenario`
 * JSON object; production builds tree-shake the whole thing away.
 *
 * Shape (all optional):
 * {
 *   navWallet: 1,            // NAV in the private wallet
 *   navExchange: 0,          // NAV available on Hyperliquid spot
 *   navEvm: 0,               // NAV held as the ERC20 on HyperEVM
 *   usdc: 0, hype: 0,        // other exchange balances
 *   hypeEvm: 0,              // native HYPE on HyperEVM (gas), in HYPE
 *   coreExists: false, registered: false, paused: false,
 *   faucet: { amountNav: "28.88", usdc: "0.01", hype: "0.001" } | null,
 *   sim: { faucetMs, creditMs, evmMs, payoutMs, failOnce: "deposit" | …, crashOn: "deposit" | … }
 * }
 * Set it from the console:  localStorage.uxScenario = JSON.stringify({ navWallet: 1 })
 */
const KEY = "uxScenario";

export const DEFAULTS = {
  navWallet: 0,
  navExchange: 0,
  navEvm: 0,
  usdc: 0,
  hype: 0,
  hypeEvm: 0,
  coreExists: false,
  registered: false,
  paused: false,
  faucet: { amountNav: "28.88", usdc: "0.01", hype: "0.001" },
  sim: { faucetMs: 12_000, creditMs: 20_000, evmMs: 4_000, payoutMs: 10_000, failOnce: null, crashOn: null },
  // Transitions in flight, each { at, amount, ... } — resolved by `settle()`
  // from timestamps so a reload never loses them (this is the "chain").
  pending: [],
  log: [],
};

// `import.meta.env.DEV` is a compile-time constant: in a production build
// this is `false && …`, so the harness can never switch on there.
export function scenarioEnabled() {
  if (!import.meta.env.DEV) return false;
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function readScenario() {
  let raw = {};
  try {
    raw = JSON.parse(localStorage.getItem(KEY) || "{}") || {};
  } catch {}
  const s = { ...DEFAULTS, ...raw, sim: { ...DEFAULTS.sim, ...(raw.sim || {}) }, pending: raw.pending || [], log: raw.log || [] };
  return settle(s);
}

export function writeScenario(patch) {
  const next = typeof patch === "function" ? patch(readScenario()) : { ...readScenario(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("ux-scenario"));
  return next;
}

/** Applies every pending transition whose time has come. */
function settle(s) {
  const now = Date.now();
  const left = [];
  let changed = false;
  for (const p of s.pending) {
    if (p.at > now) { left.push(p); continue; }
    changed = true;
    if (p.kind === "faucet") { s.coreExists = true; s.usdc += Number(p.usdc); s.hype += Number(p.hype); }
    else if (p.kind === "credit") { s.navExchange = round(s.navExchange + p.amount); }
    else if (p.kind === "evm") { s.navEvm = round(s.navEvm + p.amount); }
    else if (p.kind === "payout") { s.navWallet = round(s.navWallet + p.amount); }
    else if (p.kind === "gas") { s.hypeEvm += p.amount; }
    s.log.push({ at: now, done: p.kind, amount: p.amount ?? null });
  }
  s.pending = left;
  if (changed) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  }
  return s;
}

const round = (n) => Math.round(Number(n) * 1e8) / 1e8;

/** Schedules a transition `ms` from now and persists it. */
export function schedule(kind, ms, extra = {}) {
  writeScenario((s) => ({ ...s, pending: [...s.pending, { kind, at: Date.now() + ms, ...extra }] }));
}

/** A fake transaction id for simulated sends. */
export const fakeTxId = (prefix) => `${prefix}-${Date.now().toString(16)}${Math.random().toString(16).slice(2, 8)}`;

/** Simulated `readAccountState()` snapshot — same shape as executors.js. */
export function scenarioAccountState() {
  const s = readScenario();
  const gasReady = s.hypeEvm > 0 || s.hype > 0;
  return {
    navWallet: s.navWallet,
    navExchange: s.navExchange,
    navEvm: s.navEvm,
    balances: { NAV: s.navExchange, USDC: s.usdc, HYPE: s.hype },
    totals: { NAV: s.navExchange, USDC: s.usdc, HYPE: s.hype },
    registered: s.registered,
    coreExists: s.coreExists,
    paused: s.paused,
    gasReady,
    hypeEvm: s.hypeEvm,
    hypeCore: s.hype,
    faucet: !s.registered && (!s.coreExists || !gasReady) ? s.faucet : null,
    bridgeUnavailable: false,
    depositAddress: s.registered ? "nav1simulateddepositaddressxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" : null,
    simulated: true,
    readAt: Date.now(),
  };
}

/** Simulated exchange balances — same shape as executors.readExchangeBalances(). */
export function scenarioExchangeBalances() {
  const s = readScenario();
  const b = { NAV: s.navExchange, USDC: s.usdc, HYPE: s.hype, BTC: 0, ETH: 0, SOL: 0, ZEC: 0, AVAX: 0 };
  return { available: { ...b }, total: { ...b } };
}

/** Rows in the shape useHyperliquidBalances() produces. */
export function scenarioBalanceRows(symbols) {
  const { available } = scenarioExchangeBalances();
  return symbols.map((symbol) => {
    const total = String(available[symbol] ?? 0);
    const priceUsd = symbol === "USDC" ? 1 : symbol === "NAV" ? 0.0415 : symbol === "HYPE" ? 78 : null;
    return { symbol, total, hold: "0", available: total, priceUsd, valueUsd: priceUsd != null ? Number(total) * priceUsd : null };
  });
}

/**
 * Throws the configured one-off failure for `stepType` (then clears it), so a
 * failed step can be reproduced exactly once and retried.
 */
export function maybeFail(stepType) {
  const s = readScenario();
  if (s.sim.failOnce === stepType) {
    writeScenario((cur) => ({ ...cur, sim: { ...cur.sim, failOnce: null } }));
    const err = new Error("send_failed");
    err.detail = `simulated failure in ${stepType}`;
    throw err;
  }
  if (s.sim.crashOn === stepType) {
    // Simulates the app dying mid-broadcast: the step stays "submitting".
    writeScenario((cur) => ({ ...cur, sim: { ...cur.sim, crashOn: null } }));
    return new Promise(() => {}); // never resolves; a reload shows the interrupted state
  }
  return null;
}
