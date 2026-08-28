/**
 * Local request id generator for POS payment requests.
 *
 * 8 random bytes (16 hex chars) — enough entropy that two concurrent
 * requests from the same merchant never collide in practice, while staying
 * short: the id travels inside a QR code with a tight character budget (see
 * uriScheme.js). It only needs to be unique within one merchant's own
 * request list, not globally.
 */
export function generateRequestId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
