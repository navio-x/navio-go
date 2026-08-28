/**
 * Payment detection for an active POS request.
 *
 * Reuses the wallet's existing chain-watching: startBackgroundSync (already
 * running app-wide once the wallet is unlocked) polls the chain every ~10s
 * and refreshes the store's `utxos` ref via getAllOutputs() on every new
 * block. This module adds no new sync/polling loop of its own — it just
 * watches that existing ref for outputs belonging to the request's
 * sub-address.
 *
 * Matching is NOT done by comparing an output's raw `spendingKey` field
 * against anything derived from the request's address — BLSCT is a
 * stealth-address scheme, so every output carries its own one-time
 * `spendingKey` that is cryptographically unrelated to the destination
 * address's embedded key (they will essentially never be string-equal, even
 * for a payment that genuinely lands on that exact address). Recognising an
 * output as "paid to this sub-address" requires the same recovery the
 * wallet's own isMine()/isMineByKeys() does: combine the output's
 * blindingKey + spendingKey with the wallet's private view key into a
 * hashId, then look that hashId up against the sub-address it was
 * registered under (KeyManager.getSubAddressId, populated by
 * generateNewSubAddress — see address.js). So this needs the request's
 * {account, address} sub-address identifier, not just its bech32m string.
 */
import { watch } from "vue";
import { getUtxos, getChainTip, getNavioClient, blsctLib } from "@/stores/navio";
import { confirmationsFor } from "./confirmationPolicy.js";

/** True if `output` was paid to exactly the sub-address identified by `id` ({account, address}). */
function outputMatchesSubAddress(output, id, keyManager) {
  if (!output.blindingKey || !output.spendingKey) return false;
  let blindingKeyObj;
  let spendingKeyObj;
  try {
    blindingKeyObj = blsctLib.PublicKey.deserialize(output.blindingKey);
    spendingKeyObj = blsctLib.PublicKey.deserialize(output.spendingKey);
  } catch {
    return false;
  }
  const hashId = keyManager.getHashId(blindingKeyObj, spendingKeyObj);
  const resolved = { account: null, address: null };
  if (!keyManager.getSubAddressId(hashId, resolved)) return false;
  return resolved.account === id.account && resolved.address === id.address;
}

/** The hashId a payment to sub-address `id` gets recognised under — for display/debugging only. */
export function expectedHashIdHex(id) {
  const keyManager = getNavioClient()?.getKeyManager();
  if (!keyManager) return "";
  // generateNewSubAddress already computed and stored this hashId when the
  // address was derived (address.js); recompute it as HashId isn't returned
  // directly, but hashId lookups here are keyed by content, so a fresh
  // getSubAddress()-based round trip isn't needed — the stored map already
  // has it under `keyManager.subAddresses`. Walk it to find our id's key.
  for (const [hashIdHex, storedId] of keyManager.subAddresses ?? []) {
    if (storedId.account === id.account && storedId.address === id.address) return hashIdHex;
  }
  return "";
}

/**
 * Watch the sub-address identified by `id` ({account, address}, from
 * deriveFreshMerchantAddress) for payments. Calls `onUpdate(status)` every
 * time the set of matching outputs changes, with:
 *   { totalAmountNav, confirmations, outputs, txHashes }
 * or `onUpdate(null)` if nothing has arrived yet. `confirmations` is the
 * *minimum* across all matching outputs (conservative: a second, less-
 * confirmed output holds the whole request back from reading as confirmed).
 * Returns a stop function — always call it once the request is no longer
 * active (paid, cancelled, or superseded).
 */
export function watchAddressPayments(id, onUpdate) {
  return watch(
    getUtxos,
    (list) => {
      const keyManager = getNavioClient()?.getKeyManager();
      if (!list || !keyManager) {
        onUpdate(null);
        return;
      }
      const matches = list.filter((o) => outputMatchesSubAddress(o, id, keyManager));
      if (matches.length === 0) {
        onUpdate(null);
        return;
      }

      const chainTip = getChainTip();
      const totalAmountSat = matches.reduce((sum, o) => sum + Number(o.amount), 0);
      const confirmations = Math.min(...matches.map((o) => confirmationsFor(o, chainTip)));

      onUpdate({
        totalAmountNav: totalAmountSat / 1e8,
        confirmations,
        outputs: matches,
        txHashes: matches.map((o) => o.txHash),
      });
    },
    { immediate: true, deep: true }
  );
}
