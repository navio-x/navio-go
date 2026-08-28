/**
 * Best-effort "is this device's payment detection actually live right now"
 * check for the active-request screen: the browser's own online/offline
 * signal, plus staleness of the wallet's existing background sync (reused
 * from stores/navio.js's syncHealth, not a new polling mechanism).
 */
import { getSyncHealth } from "@/stores/navio";

// Comfortably above the ~10s background sync poll interval so ordinary
// jitter between polls never reads as a false "offline".
const STALE_THRESHOLD_MS = 25_000;

export function isConnectionOffline() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const health = getSyncHealth();
  if (!health.lastSuccessAt) return false; // hasn't had a chance to sync yet — starting up, not offline
  return Date.now() - health.lastSuccessAt > STALE_THRESHOLD_MS;
}
