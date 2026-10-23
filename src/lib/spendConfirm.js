// Per-transaction confirmation: before anything that moves funds or signs
// on the user's behalf (send, stake, swap, process start, dApp request…)
// the password — or, when enrolled, the fingerprint / face — is asked for
// again, even though the wallet is already unlocked. Covers the "phone
// picked up while unlocked" case that auto-lock only closes after a delay.
//
// confirmSpend() is the single entry point; SpendConfirm.vue (mounted once
// in App.vue) renders whatever request is pending. It resolves true when
// the user passed the check, false when they cancelled — callers simply
// return on false. Nothing here signs or sends.
import { ref } from "vue";
import { settings } from "@/stores/settings";
import { getNavioClient } from "@/stores/navio";

export const SPEND_CONFIRM_MODES = ["always", "threshold", "off"];

/**
 * @param {number|null|undefined} amountNav  NAV the action spends; null when
 *   the amount is unknown or not in NAV (token, NFT, EVM, dApp call) — such
 *   actions always ask in "threshold" mode.
 */
export function spendConfirmRequired(amountNav) {
  const mode = settings.spendConfirm;
  if (mode === "off") return false;
  const km = getNavioClient()?.getKeyManager();
  // Nothing to verify against (legacy unencrypted wallet, or no wallet).
  if (!km || !km.isEncrypted()) return false;
  if (mode === "threshold") {
    if (amountNav == null || !Number.isFinite(Number(amountNav))) return true;
    return Number(amountNav) >= Number(settings.spendConfirmThresholdNav || 0);
  }
  return true;
}

/** The request SpendConfirm.vue is showing, or null. */
export const pendingSpendConfirm = ref(null);

/**
 * @param {object} opts
 * @param {number|null} [opts.amountNav]
 * @param {string} [opts.summaryKey]  i18n key of the one-line description shown in the dialog
 * @param {object} [opts.summaryParams]
 * @returns {Promise<boolean>}
 */
export function confirmSpend({ amountNav = null, summaryKey = "", summaryParams = {} } = {}) {
  if (!spendConfirmRequired(amountNav)) return Promise.resolve(true);
  // One at a time: a second request while one is open is refused rather
  // than queued, so a stray double-tap cannot line up two spends.
  if (pendingSpendConfirm.value) return Promise.resolve(false);
  return new Promise((resolve) => {
    pendingSpendConfirm.value = { amountNav, summaryKey, summaryParams, resolve };
  });
}

/** Gate for starting or re-approving a guided process (lib/intent): the NAV it takes out of the wallet decides. */
export function confirmProcess(plan, amountNav = null) {
  const amount = amountNav != null
    ? Number(amountNav)
    : (Number(plan?.leavesWallet) || 0) + (Number(plan?.setupCost) || 0);
  if (amount > 0) {
    return confirmSpend({
      amountNav: amount,
      summaryKey: "spendConfirm.summary.process",
      summaryParams: { amount: amount.toLocaleString(undefined, { maximumFractionDigits: 8 }) },
    });
  }
  return confirmSpend({ amountNav: null, summaryKey: "spendConfirm.summary.processNoAmount" });
}

/** Called by the dialog. */
export function settleSpendConfirm(ok) {
  const req = pendingSpendConfirm.value;
  pendingSpendConfirm.value = null;
  req?.resolve(!!ok);
}

/** Checks a typed password against the open wallet without changing its state. */
export async function verifyWalletPassword(password) {
  const km = getNavioClient()?.getKeyManager();
  if (!km) return false;
  return km.unlock(password);
}
