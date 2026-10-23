// Root detection (Android, best effort — see DeviceIntegrityPlugin.java).
// On a rooted device any app granted root can read this app's storage and
// memory, so the wallet shows a one-time warning; it does not refuse to
// run, since the user may know exactly what they are doing. Off Android,
// or when the check fails, nothing is reported.
import { Capacitor, registerPlugin } from "@capacitor/core";

const DeviceIntegrity = registerPlugin("DeviceIntegrity");
const DISMISSED_KEY = "rootWarningDismissed";

/** @returns {Promise<{rooted: boolean, reasons: string[]} | null>} */
export async function checkDeviceIntegrity() {
  if (Capacitor.getPlatform() !== "android") return null;
  try {
    const r = await DeviceIntegrity.check();
    return { rooted: !!r?.rooted, reasons: Array.isArray(r?.reasons) ? r.reasons : [] };
  } catch {
    return null;
  }
}

export function rootWarningDismissed() {
  try { return localStorage.getItem(DISMISSED_KEY) === "true"; } catch { return false; }
}

export function dismissRootWarning() {
  try { localStorage.setItem(DISMISSED_KEY, "true"); } catch {}
}
