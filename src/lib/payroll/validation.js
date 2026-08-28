import { blsctLib } from "@/stores/navio";

/**
 * Validate a Navio address using the same primitive the wallet itself uses
 * to decode addresses (blsct's Address.decode — throws on anything that
 * isn't a valid bech32m-encoded double public key). No separate regex/
 * bech32 implementation is maintained here.
 */
export function validateNavioAddress(address) {
  const trimmed = (address ?? "").trim();
  if (!trimmed) return { valid: false, error: "required" };
  if (!blsctLib) return { valid: false, error: "sdk_not_ready" };
  try {
    blsctLib.Address.decode(trimmed);
    return { valid: true };
  } catch {
    return { valid: false, error: "invalid_format" };
  }
}
