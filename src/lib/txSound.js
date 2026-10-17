// Short chimes for new transactions, synthesised with Web Audio so the app
// ships no sound files: two rising notes for NAV received, two falling for
// NAV sent, a bright three-note arpeggio for a staking reward. Quiet by
// design, and off when settings.txSound is.

import { settings } from "@/stores/settings";

// Notes as [frequency Hz, start offset s].
const CHIMES = {
  in: [[659.25, 0], [987.77, 0.11]], // E5 → B5
  out: [[783.99, 0], [523.25, 0.11]], // G5 → C5
  reward: [[783.99, 0], [987.77, 0.08], [1318.51, 0.16]], // G5 B5 E6
};

const VOLUME = 0.12;
const NOTE_S = 0.32;

let ctx = null;

// Browsers only let audio start after the user has interacted with the
// page; the context is created, or resumed, on the first tap or key press.
function unlock() {
  try {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ctx = new Ctx();
    }
    if (ctx.state === "suspended") ctx.resume();
  } catch {
    ctx = null;
  }
}

if (typeof window !== "undefined") {
  for (const type of ["pointerdown", "keydown"]) {
    window.addEventListener(type, unlock, { passive: true });
  }
}

export function playTxSound(kind) {
  const notes = CHIMES[kind];
  if (!notes || settings.txSound === false || !ctx || ctx.state !== "running") return;
  try {
    const now = ctx.currentTime;
    for (const [freq, offset] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      // A soft attack and an exponential tail: a bell, not a beep.
      const t = now + offset;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(VOLUME, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + NOTE_S);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + NOTE_S + 0.02);
    }
  } catch (e) {
    console.warn("[txSound] could not play:", e?.message);
  }
}
