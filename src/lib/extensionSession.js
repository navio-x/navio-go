// Bridges wallet state from the toolbar popup (where the wallet is actually
// unlocked) to approval windows (which open on their own, fresh page
// instance and never load a wallet themselves). Dependency-free so it's
// safe to import from src/stores/navio.js, which is bundled into the
// mobile/web app too — outside an extension context every export here is a
// no-op.

const SESSION_KEY = "walletSession";

function getExtBrowser() {
  if (globalThis.browser?.runtime?.id) return globalThis.browser;
  if (globalThis.chrome?.runtime?.id) return globalThis.chrome;
  return null;
}

export function isExtensionContext() {
  return getExtBrowser() !== null;
}

// `password` (only set for encrypted wallets) lets approval windows unlock
// the same wallet silently instead of prompting again — browser.storage
// .session is memory-only and cleared when the browser fully closes, so this
// is scoped to "unlocked for this browser session", the same trust boundary
// an already-unlocked wallet implies.
export async function publishWalletSession({ address, walletName, password }) {
  const ext = getExtBrowser();
  if (!ext) return;
  await ext.storage.session.set({
    [SESSION_KEY]: { address, walletName, password, updatedAt: Date.now() },
  });
}

export async function clearWalletSession() {
  const ext = getExtBrowser();
  if (!ext) return;
  await ext.storage.session.remove(SESSION_KEY);
}

export async function readWalletSession() {
  const ext = getExtBrowser();
  if (!ext) return null;
  const stored = await ext.storage.session.get(SESSION_KEY);
  return stored[SESSION_KEY] ?? null;
}
