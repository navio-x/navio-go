import { describe, it, expect, vi, beforeEach } from "vitest";

const plugin = {
  isAvailable: vi.fn(),
  isDataSaved: vi.fn(),
  setData: vi.fn(),
  getSecureData: vi.fn(),
  deleteData: vi.fn(),
};
let platform = "android";

vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => platform } }));
vi.mock("@capgo/capacitor-native-biometric", () => ({
  NativeBiometric: plugin,
  AccessControl: { NONE: 0, BIOMETRY_CURRENT_SET: 1, BIOMETRY_ANY: 2 },
  BiometricAuthError: { BIOMETRICS_UNAVAILABLE: 1, BIOMETRICS_NOT_ENROLLED: 3, AUTHENTICATION_FAILED: 10, SYSTEM_CANCEL: 15, USER_CANCEL: 16, NO_PROTECTED_CREDENTIALS_FOUND: 21 },
}));

const lib = await import("../biometric.js");

beforeEach(() => {
  platform = "android";
  for (const f of Object.values(plugin)) f.mockReset();
});

describe("biometric wrapper", () => {
  it("is a no-op off Android", async () => {
    platform = "web";
    expect(lib.biometricSupported()).toBe(false);
    expect(await lib.biometricAvailability()).toEqual({ available: false, reason: "unsupported" });
    expect(await lib.hasBiometricPassword("w")).toBe(false);
    expect(await lib.readBiometricPassword("w")).toEqual({ status: "unsupported" });
    expect(await lib.storeBiometricPassword("w", "p")).toEqual({ status: "unsupported" });
    expect(plugin.isAvailable).not.toHaveBeenCalled();
  });

  it("maps availability error codes", async () => {
    plugin.isAvailable.mockResolvedValue({ isAvailable: false, errorCode: 3 });
    expect(await lib.biometricAvailability()).toEqual({ available: false, reason: "not_enrolled" });
    plugin.isAvailable.mockResolvedValue({ isAvailable: true });
    expect(await lib.biometricAvailability()).toEqual({ available: true });
  });

  it("stores behind a biometric-bound Keystore key, per wallet", async () => {
    plugin.setData.mockResolvedValue();
    expect(await lib.storeBiometricPassword("my wallet", "pw", { title: "T" })).toEqual({ status: "ok" });
    const opts = plugin.setData.mock.calls[0][0];
    expect(opts.key).toBe("wallet-password:my wallet");
    expect(opts.value).toBe("pw");
    expect(opts.accessControl).toBe(2);
    expect(opts.authValidityDuration).toBe(0);
  });

  it("reads the password, and reports cancel / none distinctly", async () => {
    plugin.getSecureData.mockResolvedValue({ value: "pw" });
    expect(await lib.readBiometricPassword("w")).toEqual({ status: "ok", password: "pw" });
    plugin.getSecureData.mockRejectedValue({ code: 16, message: "User cancelled" });
    expect(await lib.readBiometricPassword("w")).toEqual({ status: "cancel" });
    plugin.getSecureData.mockRejectedValue({ code: 21, message: "No protected data found" });
    expect(await lib.readBiometricPassword("w")).toEqual({ status: "none" });
    plugin.getSecureData.mockRejectedValue({ code: 2, message: "Locked out" });
    expect(await lib.readBiometricPassword("w")).toMatchObject({ status: "error", message: "Locked out" });
  });

  it("forgetting never throws", async () => {
    plugin.deleteData.mockRejectedValue(new Error("nothing there"));
    await expect(lib.forgetAllBiometricPasswords(["a", "b"])).resolves.toBeUndefined();
    expect(plugin.deleteData).toHaveBeenCalledTimes(2);
  });
});
