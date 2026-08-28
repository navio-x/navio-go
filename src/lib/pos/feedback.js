/**
 * Sound + haptic feedback for a detected payment — the cashier may not be
 * looking at the screen when it happens.
 */
import { Haptics, NotificationType } from "@capacitor/haptics";

/** Two-tone chime via Web Audio — no bundled asset, works on web/PWA too. */
function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = now + i * 0.12;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  } catch {
    // Web Audio unavailable — haptics below still fire independently.
  }
}

export async function triggerPaymentDetectedFeedback() {
  playChime();
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    // Haptics unsupported (e.g. a desktop browser) — sound already covers it.
  }
}
