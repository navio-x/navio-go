import { walletName } from "@/stores/navio";
import { slugify } from "@/stores/wallet_management";

/**
 * CSV/PDF payroll exports are unencrypted by design (they go to an
 * accountant) — unlike everything else payroll touches. This is a one-time,
 * per-wallet acknowledgement gate the export UI shows before the very first
 * export, mirroring backup.js's localStorage-flag pattern.
 */
function warningStorageKey() {
  return `payroll-export-warning-ack-${slugify(walletName.value || "")}`;
}

export function hasAcknowledgedExportWarning() {
  return localStorage.getItem(warningStorageKey()) === "true";
}

export function acknowledgeExportWarning() {
  localStorage.setItem(warningStorageKey(), "true");
}
