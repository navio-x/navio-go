import { walletName } from "@/stores/navio";
import { slugify } from "@/stores/wallet_management";

/**
 * CSV merchant exports are unencrypted by design (end-of-shift reconciliation
 * files leave the device) — unlike everything else this feature stores.
 * Mirrors payroll's exportWarning.js exactly, with its own storage key so
 * acknowledging one export warning never silently acknowledges the other.
 */
function warningStorageKey() {
  return `merchant-export-warning-ack-${slugify(walletName.value || "")}`;
}

export function hasAcknowledgedExportWarning() {
  return localStorage.getItem(warningStorageKey()) === "true";
}

export function acknowledgeExportWarning() {
  localStorage.setItem(warningStorageKey(), "true");
}
