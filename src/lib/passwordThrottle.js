// Slows down password guessing at the app's prompts: after FREE_ATTEMPTS
// wrong tries for a wallet, each further try must wait, and the wait
// doubles (30 s, 1 min, 2 min … up to 15 min). The state is per wallet
// and kept in localStorage so a reload does not reset it.
//
// Only passwords the user typed count; a stale remembered or biometric
// password is not an attack. This is a brake on casual guessing at the
// screen — someone with the device's storage can still try offline
// against the encrypted key store, which only a strong password resists.

const PREFIX = "pwThrottle:";
export const FREE_ATTEMPTS = 5;
export const BASE_WAIT_MS = 30 * 1000;
export const MAX_WAIT_MS = 15 * 60 * 1000;

// localStorage when the environment has one (the app); an in-memory map
// otherwise (unit tests). Never both, so clearing one cannot leave a
// stale copy in the other.
const storage = (() => {
  try {
    const ls = globalThis.localStorage;
    if (ls) return { get: (k) => ls.getItem(k), set: (k, v) => ls.setItem(k, v), remove: (k) => ls.removeItem(k) };
  } catch {}
  const memory = new Map();
  return { get: (k) => memory.get(k) ?? null, set: (k, v) => memory.set(k, v), remove: (k) => memory.delete(k) };
})();
function read(name) {
  try {
    const raw = storage.get(PREFIX + name);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function write(name, state) {
  try { storage.set(PREFIX + name, JSON.stringify(state)); } catch {}
}
function clear(name) {
  try { storage.remove(PREFIX + name); } catch {}
}

/** Milliseconds the next typed attempt for `walletName` still has to wait; 0 = go ahead. */
export function passwordWaitMs(walletName, now = Date.now()) {
  const s = read(walletName);
  return s && s.until > now ? s.until - now : 0;
}

/** Counts a wrong typed password. Returns the wait (ms) now in force, 0 while still inside the free attempts. */
export function recordPasswordFailure(walletName, now = Date.now()) {
  const s = read(walletName) ?? { failures: 0, until: 0 };
  s.failures += 1;
  if (s.failures >= FREE_ATTEMPTS) {
    const step = s.failures - FREE_ATTEMPTS;
    s.until = now + Math.min(MAX_WAIT_MS, BASE_WAIT_MS * 2 ** step);
  }
  write(walletName, s);
  return passwordWaitMs(walletName, now);
}

export function recordPasswordSuccess(walletName) {
  clear(walletName);
}

/** Seconds to show in a "try again in …" message. */
export const waitSeconds = (ms) => Math.max(1, Math.ceil(ms / 1000));
