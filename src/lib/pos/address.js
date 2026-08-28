/**
 * Fresh per-request receiving address for POS payment requests.
 *
 * Reuses navio-sdk's existing HD sub-address derivation (KeyManager) — the
 * same primitive that could back the wallet's own Receive screen, just never
 * called anywhere in the app so far, which has only ever asked for the fixed
 * {account: 0, address: 0} sub-address. generateNewSubAddress() advances a
 * per-account counter and registers the address's scan hashId so incoming
 * payments to it are picked up by the existing chain-watching/sync code;
 * getSubAddressBech32m() then encodes that same id as the address string
 * that goes in the request URI.
 */
import { getNavioClient } from "@/stores/navio";

/** Sub-addresses in this account index are reserved for POS requests, kept
 *  separate from account 0 (used by the ordinary wallet Receive screen). */
export const POS_ACCOUNT_INDEX = 1;

/**
 * Returns both the encoded address (for the QR/URI) and its {account, address}
 * sub-address identifier — paymentWatch.js needs the identifier, not the
 * address string, to recognise incoming payments: BLSCT outputs carry a
 * per-output one-time spendingKey (a stealth-address style derivation), never
 * the destination address's own spendingKey, so matching has to go through
 * the same blindingKey+spendingKey+viewKey -> hashId -> sub-address recovery
 * the wallet's own isMine() uses (see paymentWatch.js).
 */
export function deriveFreshMerchantAddress(account = POS_ACCOUNT_INDEX) {
  const client = getNavioClient();
  if (!client) throw new Error("Wallet not ready");
  const keyManager = client.getKeyManager();
  if (!keyManager) throw new Error("Wallet not ready");

  const { id } = keyManager.generateNewSubAddress(account);
  const network = sessionStorage.getItem("network");
  const address = keyManager.getSubAddressBech32m(id, network);
  return { address, id };
}
