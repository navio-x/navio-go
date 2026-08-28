import { Capacitor } from "@capacitor/core";

/**
 * Requests persistent storage (best-effort — the browser may deny it) so
 * payroll data isn't evicted under storage pressure. Native Capacitor apps
 * don't have this eviction risk, so this is a no-op there.
 *
 * @returns {Promise<{ supported: boolean, persisted: boolean }>}
 */
export async function requestPersistentStorage() {
  if (Capacitor.isNativePlatform()) {
    return { supported: true, persisted: true };
  }
  if (!navigator.storage?.persist) {
    return { supported: false, persisted: false };
  }
  const persisted = await navigator.storage.persist();
  return { supported: true, persisted };
}
