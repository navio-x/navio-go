import { getNavioClient } from "@/stores/navio";
import { getPayments, updatePayment, updateRun } from "./paymentRuns.js";

/**
 * All not-yet-sent recipients in a run are sent together in a single
 * navio-sdk sendToMany() call — one atomic confidential transaction, one
 * broadcast, one fee. That means every payment in a given attempt succeeds
 * or fails together: sendToMany can't partially apply, so there is no
 * per-recipient outcome within one call.
 *
 * Retrying/resuming still works at the batch level: signRun() only ever
 * bundles payments whose status isn't already 'sent', so a run that failed
 * (or was interrupted) can be retried and will never re-send a payment a
 * prior successful batch already confirmed. A run can still end up
 * 'partial' overall if an earlier batch succeeded and a later retry (e.g.
 * after editing/removing some rows) fails or only covers the remainder.
 *
 * Note: if the app is killed in the narrow window after sendToMany
 * broadcasts but before the resulting 'sent' status is persisted, a resume
 * could re-broadcast a second transaction to the same recipients — the
 * same fire-and-forget risk WalletSend.vue already carries for a single
 * send, just wider now since one call covers the whole batch.
 */

const signingRuns = new Set();

export async function signRun(runId, { onProgress } = {}) {
  if (signingRuns.has(runId)) {
    throw new Error("already_signing");
  }
  signingRuns.add(runId);

  try {
    const client = getNavioClient();
    if (!client) throw new Error("wallet_not_ready");

    // Checked once, up front: an encrypted wallet loaded without its
    // password stays locked and sendToMany would fail immediately anyway.
    // Failing fast here — before touching run/payment status — avoids
    // marking every row "failed" for what is really one precondition the
    // user can fix in one place (reload the wallet with its password).
    const keyManager = client.getKeyManager();
    if (keyManager.isEncrypted() && !keyManager.isUnlocked()) {
      throw new Error("wallet_locked");
    }

    const payments = await getPayments(runId);
    const toSend = payments.filter((p) => p.status !== "sent");
    const total = payments.length;
    const alreadySent = total - toSend.length;

    onProgress?.({ done: alreadySent, total, phase: "idle" });

    if (toSend.length === 0) {
      await updateRun(runId, { status: "completed" });
      return payments;
    }

    await updateRun(runId, { status: "signing" });
    await Promise.all(toSend.map((p) => updatePayment(p.id, { status: "sending", error: null })));
    onProgress?.({ done: alreadySent, total, phase: "sending", batchSize: toSend.length });

    try {
      const result = await client.sendToMany({
        recipients: toSend.map((p) => ({ address: p.address, amount: BigInt(p.amountSat) })),
      });
      await Promise.all(
        toSend.map((p) =>
          updatePayment(p.id, { status: "sent", txId: result.txId, error: null, sentAt: Date.now() })
        )
      );
      await updateRun(runId, { fee: result.fee.toString() });
    } catch (e) {
      const message = e?.message || "send_failed";
      await Promise.all(toSend.map((p) => updatePayment(p.id, { status: "failed", error: message })));
    }

    const finalPayments = await getPayments(runId);
    const allSent = finalPayments.every((p) => p.status === "sent");
    const anySent = finalPayments.some((p) => p.status === "sent");
    await updateRun(runId, { status: allSent ? "completed" : anySent ? "partial" : "failed" });

    onProgress?.({ done: finalPayments.filter((p) => p.status === "sent").length, total, phase: "done" });

    return finalPayments;
  } finally {
    signingRuns.delete(runId);
  }
}
