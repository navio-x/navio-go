import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { decryptRecord } from "./crypto.js";
import { getPayrollStore, getPayrollKey } from "./session.js";
import { walletName } from "@/stores/navio";
import { slugify } from "@/stores/wallet_management";

const APP_ID = "navio-go-payroll";
const BACKUP_VERSION = 1;
const RECORD_TYPES = ["recipients", "payment_runs", "payments", "receipts", "issuer_keys"];

export const BACKUP_REMINDER_DAYS = 30;

function backupStorageKey() {
  return `payroll-last-backup-${slugify(walletName.value || "")}`;
}

export function getLastBackupAt() {
  const raw = localStorage.getItem(backupStorageKey());
  return raw ? Number(raw) : null;
}

function setLastBackupAt(ts) {
  localStorage.setItem(backupStorageKey(), String(ts));
}

/** True if a backup has never been taken, or the last one is older than the reminder window. */
export function isBackupOverdue(reminderDays = BACKUP_REMINDER_DAYS) {
  const last = getLastBackupAt();
  if (!last) return true;
  const days = (Date.now() - last) / (1000 * 60 * 60 * 24);
  return days >= reminderDays;
}

/**
 * All payroll records are exported exactly as stored — still the opaque
 * {ciphertext, iv, salt, version} blob from crypto.js. No decrypt/re-encrypt
 * step: the file is only ever readable by re-deriving the same HKDF key
 * from this wallet's seed (see crypto.js), so it stays encrypted at rest
 * without needing a separate export password, and restoring the same
 * mnemonic on another device can still read it back.
 */
async function buildBackupPayload() {
  const store = getPayrollStore();
  const records = {};
  for (const type of RECORD_TYPES) {
    records[type] = await store.list(type);
  }
  return { app: APP_ID, version: BACKUP_VERSION, exportedAt: Date.now(), records };
}

function backupFilename() {
  return `navio-payroll-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

/** @returns {Promise<{platform: 'native'|'web', path: string}>} */
export async function exportBackup() {
  const payload = await buildBackupPayload();
  const json = JSON.stringify(payload, null, 2);
  const filename = backupFilename();

  if (Capacitor.isNativePlatform()) {
    // Directory.Documents needs WRITE_EXTERNAL_STORAGE (or
    // requestLegacyExternalStorage) on Android, which this app declares
    // neither of — writing there crashes under Android 10+ scoped storage.
    // Directory.Cache is app-private (no permission needed); the OS share
    // sheet is what actually lets the user save/move the file anywhere.
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    await Share.share({ url: uri, title: filename });
    setLastBackupAt(Date.now());
    return { platform: "native", path: filename };
  }

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setLastBackupAt(Date.now());
  return { platform: "web", path: filename };
}

export function parseBackupFile(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("invalid_backup_file");
  }
  if (payload?.app !== APP_ID || !payload.records) {
    throw new Error("invalid_backup_file");
  }
  return payload;
}

function isWellFormedRow(row) {
  return row && typeof row.id === "string" && row.data && typeof row.updatedAt === "number";
}

/**
 * Diff an imported payload against local storage. Conflict comparison uses
 * only plaintext updatedAt metadata (no decryption needed — see
 * storage/indexedDbStore.js). A record that doesn't exist locally is a
 * plain addition. One that does is only ever a *candidate* replacement —
 * never applied here — surfaced only when the incoming copy is newer than
 * the local one, since anything else can be safely left alone with nothing
 * lost.
 *
 * Every candidate (additions and conflict candidates alike) is also
 * decrypted with this wallet's current payroll key before being accepted:
 * a backup from a different wallet (different seed) produces blobs this
 * wallet can never read back, and storing them anyway would silently break
 * every list view the next time it tries to decrypt everything at once
 * (see recipients.js / paymentRuns.js). Those are reported separately as
 * `incompatible` rather than queued for import.
 */
export async function analyzeImport(payload) {
  const store = getPayrollStore();
  const key = await getPayrollKey();
  const toAdd = [];
  const conflicts = [];
  let skippedInvalid = 0;
  let incompatible = 0;
  let unchanged = 0;

  for (const type of RECORD_TYPES) {
    const incomingRows = payload.records?.[type] || [];
    for (const row of incomingRows) {
      if (!isWellFormedRow(row)) {
        skippedInvalid++;
        continue;
      }
      try {
        await decryptRecord(key, row.data);
      } catch {
        incompatible++;
        continue;
      }
      const existing = await store.get(type, row.id);
      if (!existing) {
        toAdd.push({ type, row });
      } else if (row.updatedAt > existing.updatedAt) {
        conflicts.push({ type, row, existingUpdatedAt: existing.updatedAt });
      } else {
        unchanged++;
      }
    }
  }

  return { toAdd, conflicts, unchanged, skippedInvalid, incompatible };
}

/**
 * Apply an import decision. `toAdd` is written unconditionally (no local
 * record to lose). `resolvedConflicts` must be explicitly chosen by the
 * caller (a subset of analyzeImport's `conflicts`, one entry per record the
 * user chose to replace) — anything not included here is left untouched.
 */
export async function commitImport({ toAdd, resolvedConflicts }) {
  const store = getPayrollStore();
  for (const { type, row } of toAdd) {
    await store.put(type, row.id, row.data);
  }
  for (const { type, row } of resolvedConflicts) {
    await store.put(type, row.id, row.data);
  }
  return { added: toAdd.length, replaced: resolvedConflicts.length };
}
