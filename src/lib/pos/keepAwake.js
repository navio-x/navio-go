/**
 * Keep the screen on while a POS request is active — the QR needs to stay
 * visible/scannable without the device dimming or locking mid-transaction.
 * Best-effort: unsupported platforms (most desktop browsers) just no-op,
 * same tolerant pattern as the SystemBars calls in stores/settings.js.
 */
import { KeepAwake } from "@capacitor-community/keep-awake";

export function acquireKeepAwake() {
  return KeepAwake.keepAwake().catch(() => {});
}

export function releaseKeepAwake() {
  return KeepAwake.allowSleep().catch(() => {});
}
