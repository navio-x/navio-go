// Copying a secret (seed phrase, master seed) to the clipboard, with the
// clipboard emptied again after a short while — and as soon as the seed
// screen is left (App.vue). A clipboard is readable by any app on the
// device and, on desktops, by any page the user pastes into; a seed that
// sits there for hours is a seed that leaks.
//
// Best effort by design: the clear is a write of "" and browsers only
// allow clipboard writes from a focused document, so a clear that falls
// due while the user is in another app is retried the moment this one is
// visible again. Only the most recent secret copy is cleared — if the user
// copied something else in between, that is theirs and stays.
import copyFallback from "copy-to-clipboard";

export const SECRET_CLIPBOARD_TTL_MS = 60 * 1000;

let token = 0;          // identifies the latest secret copy
let timer = null;
let clearDue = false;   // a clear fell due while we could not write

async function write(text) {
  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try { return copyFallback(text); } catch { return false; }
}

/**
 * Copies `text` and schedules the clipboard to be emptied after `ttlMs`.
 * @returns {Promise<boolean>} whether the copy succeeded
 */
export async function copySecret(text, { ttlMs = SECRET_CLIPBOARD_TTL_MS } = {}) {
  const ok = await write(text);
  if (!ok) return false;
  const mine = ++token;
  clearTimeout(timer);
  clearDue = false;
  timer = setTimeout(() => { if (mine === token) clearSecretCopy(); }, ttlMs);
  return true;
}

/** Empties the clipboard if a secret copy is pending; retried later when the write is refused. */
export async function clearSecretCopy() {
  if (!token) return;
  clearTimeout(timer);
  timer = null;
  const ok = await write("");
  if (ok) {
    token = 0;
    clearDue = false;
  } else {
    clearDue = true;
  }
}

export function secretCopyPending() {
  return token !== 0;
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && clearDue) clearSecretCopy();
  });
}
