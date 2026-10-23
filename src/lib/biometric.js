// Biometric unlock (Android): keeps a wallet's password in the Android
// Keystore behind a BiometricPrompt, via @capgo/capacitor-native-biometric.
// The wallet stays encrypted with the password exactly as before — this only
// lets the user *supply* that password with a fingerprint / face instead of
// typing it. Entirely opt-in (settings.biometricUnlock, off by default), and
// the password prompt always remains as the fallback.
//
// Each wallet has its own entry (keyed by wallet name). Every read is bound
// to a fresh biometric check (authValidityDuration 0): no code path can get
// the password out of the Keystore without the prompt being passed.
//
// Off Android every function here reports "unsupported" and does nothing,
// so callers can stay platform-agnostic.
import { Capacitor } from "@capacitor/core";
import { NativeBiometric, AccessControl, BiometricAuthError } from "@capgo/capacitor-native-biometric";

const KEY_PREFIX = "wallet-password:";
const keyFor = (walletName) => KEY_PREFIX + walletName;

export function biometricSupported() {
  return Capacitor.getPlatform() === "android";
}

/**
 * @returns {Promise<{available: boolean, reason?: 'unsupported'|'not_enrolled'|'no_hardware'|'unknown'}>}
 */
export async function biometricAvailability() {
  if (!biometricSupported()) return { available: false, reason: "unsupported" };
  try {
    const r = await NativeBiometric.isAvailable({ useFallback: false });
    if (r.isAvailable) return { available: true };
    const reason =
      r.errorCode === BiometricAuthError.BIOMETRICS_NOT_ENROLLED ? "not_enrolled"
      : r.errorCode === BiometricAuthError.BIOMETRICS_UNAVAILABLE ? "no_hardware"
      : "unknown";
    return { available: false, reason };
  } catch {
    return { available: false, reason: "unknown" };
  }
}

export async function hasBiometricPassword(walletName) {
  if (!biometricSupported() || !walletName) return false;
  try {
    return (await NativeBiometric.isDataSaved({ key: keyFor(walletName) })).isSaved;
  } catch {
    return false;
  }
}

/**
 * Stores the password behind a biometric prompt (the prompt is shown now).
 * @returns {Promise<{status: 'ok'|'cancel'|'unsupported'|'error', message?: string}>}
 */
export async function storeBiometricPassword(walletName, password, { title, negativeButtonText } = {}) {
  if (!biometricSupported()) return { status: "unsupported" };
  try {
    await NativeBiometric.setData({
      key: keyFor(walletName),
      value: password,
      accessControl: AccessControl.BIOMETRY_ANY,
      authValidityDuration: 0,
      title,
      negativeButtonText,
      maxAttempts: 3,
    });
    return { status: "ok" };
  } catch (e) {
    return classifyError(e);
  }
}

/**
 * Shows the biometric prompt and, if passed, returns the stored password.
 * @returns {Promise<{status: 'ok', password: string} | {status: 'cancel'|'none'|'unsupported'|'error', message?: string}>}
 */
export async function readBiometricPassword(walletName, { title, subtitle, negativeButtonText } = {}) {
  if (!biometricSupported()) return { status: "unsupported" };
  try {
    const { value } = await NativeBiometric.getSecureData({
      key: keyFor(walletName),
      title,
      subtitle,
      negativeButtonText,
      maxAttempts: 3,
    });
    return value ? { status: "ok", password: value } : { status: "none" };
  } catch (e) {
    return classifyError(e);
  }
}

export async function forgetBiometricPassword(walletName) {
  if (!biometricSupported() || !walletName) return;
  try {
    await NativeBiometric.deleteData({ key: keyFor(walletName) });
  } catch {
    // Nothing stored, or the Keystore entry is already gone — same outcome.
  }
}

export async function forgetAllBiometricPasswords(walletNames) {
  for (const name of walletNames) await forgetBiometricPassword(name);
}

function classifyError(e) {
  const code = e?.code != null ? Number(e.code) : null;
  if (code === BiometricAuthError.USER_CANCEL || code === BiometricAuthError.SYSTEM_CANCEL
      || code === BiometricAuthError.APP_CANCEL) {
    return { status: "cancel" };
  }
  if (code === BiometricAuthError.NO_PROTECTED_CREDENTIALS_FOUND) return { status: "none" };
  if (code === BiometricAuthError.AUTHENTICATION_FAILED && /cancel/i.test(e?.message ?? "")) {
    return { status: "cancel" };
  }
  return { status: "error", code, message: e?.message ?? String(e) };
}
