export { validateNavioAddress } from "@/lib/payroll/validation.js";

/**
 * Validate a p2p chat address using navio-p2pmsg's own bundle/identity
 * codec (decodeContact — accepts navid1…, navmsg1…, or hex of either and
 * throws on anything else), the same way validateNavioAddress reuses
 * blsct's own Address.decode instead of a separate format check.
 */
export async function validateP2pAddress(address) {
  const trimmed = (address ?? "").trim();
  if (!trimmed) return { valid: false, error: "required" };
  try {
    const { decodeContact } = await import("navio-p2pmsg");
    decodeContact(trimmed);
    return { valid: true };
  } catch {
    return { valid: false, error: "invalid_format" };
  }
}
