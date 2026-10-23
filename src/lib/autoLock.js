// Locks the open wallet after a period without user input, or after the
// app has been in the background for that long. Pure decision logic lives
// in shouldLock() so it can be unit-tested; the wiring (timers, DOM and
// Capacitor listeners) is in startAutoLock().
//
// Only encrypted wallets can be locked (the SDK's lock() is a no-op for
// the rest), and a wallet whose password is remembered on this device
// ("Keep wallet unlocked", see lib/unlockCache.js) is left alone: the
// user chose to trust this device for that long, and locking would just
// put a password prompt in front of a password the app already knows.

const MINUTE = 60 * 1000;

// Minutes of inactivity before locking; 0 = lock the moment the app goes
// to the background (in the foreground it never locks on idle).
export const AUTO_LOCK_OPTIONS = {
  immediately: 0,
  "1m": 1 * MINUTE,
  "5m": 5 * MINUTE,
  "15m": 15 * MINUTE,
  "30m": 30 * MINUTE,
};

/**
 * @param {object} s
 * @param {number} s.now
 * @param {number} s.lastActivity  last user input, ms
 * @param {number|null} s.hiddenAt  when the app went to the background, or null if visible
 * @param {number|null} s.thresholdMs  AUTO_LOCK_OPTIONS value; null = auto-lock off
 * @param {boolean} [s.resuming]  true when evaluated as the app becomes visible again
 */
export function shouldLock({ now, lastActivity, hiddenAt, thresholdMs, resuming = false }) {
  if (thresholdMs === null || thresholdMs === undefined) return false;
  if (thresholdMs === 0) {
    // "Immediately": only the background transition counts.
    return hiddenAt !== null || resuming;
  }
  if (hiddenAt !== null && now - hiddenAt >= thresholdMs) return true;
  return now - lastActivity >= thresholdMs;
}

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "wheel"];
const TICK_MS = 15 * 1000;

/**
 * @param {object} deps
 * @param {() => number|null} deps.thresholdMs  current setting
 * @param {() => boolean} deps.canLock  an encrypted, unlocked wallet is open
 * @param {() => Promise<boolean>} deps.isRemembered  password is remembered on this device
 * @param {() => void} deps.lock
 * @param {(cb: (isActive: boolean) => void) => Promise<{remove: () => void}>} [deps.addAppStateListener]
 *   Capacitor's App.addListener('appStateChange') — Android/iOS backgrounding
 *   does not always deliver visibilitychange to the WebView. Injected so this
 *   module stays dependency-free for tests.
 * @returns {() => void} stop function
 */
export function startAutoLock({ thresholdMs, canLock, isRemembered, lock, addAppStateListener }) {
  let lastActivity = Date.now();
  let hiddenAt = null;
  let evaluating = false;

  const touch = () => { lastActivity = Date.now(); };

  async function evaluate({ resuming = false } = {}) {
    if (evaluating || !canLock()) return;
    const now = Date.now();
    if (!shouldLock({ now, lastActivity, hiddenAt, thresholdMs: thresholdMs(), resuming })) return;
    evaluating = true;
    try {
      if (await isRemembered()) {
        // Trusted device: check again only after another full threshold.
        touch();
        if (hiddenAt !== null) hiddenAt = Date.now();
        return;
      }
      if (canLock()) lock();
    } finally {
      evaluating = false;
    }
  }

  function onHidden() {
    if (hiddenAt === null) hiddenAt = Date.now();
    // "Immediately" locks before the app is even gone; for a timed option
    // the resume check (below) covers throttled or suspended timers.
    if (thresholdMs() === 0) evaluate();
  }

  function onVisible() {
    if (hiddenAt === null) return;
    evaluate({ resuming: true }).finally(() => {
      hiddenAt = null;
      touch();
    });
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") onHidden();
    else onVisible();
  };

  for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, touch, { passive: true, capture: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
  const timer = setInterval(() => evaluate(), TICK_MS);

  let capHandle = null;
  addAppStateListener?.((isActive) => (isActive ? onVisible() : onHidden()))
    .then((h) => { capHandle = h; })
    .catch(() => {});

  return () => {
    for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, touch, { capture: true });
    document.removeEventListener("visibilitychange", onVisibilityChange);
    clearInterval(timer);
    capHandle?.remove?.();
  };
}
