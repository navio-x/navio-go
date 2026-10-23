import { confirmProcess } from "@/lib/spendConfirm";
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { settings } from "@/stores/settings";
import { evmAddress } from "@/stores/evm";
import { resolveOperation, approveOperation, cancelOperation, dismissOperation } from "@/stores/operations";
import { quoteSell, quoteBuy } from "@/lib/intent/quote";
import { currentStep } from "@/lib/intent/present";
import { formatAmount } from "@/lib/displayFormat";

/**
 * The actions an operation offers in its current state (approve, retry,
 * "it went through", stop, re-quote…), shared by the card and the detail
 * page so both behave the same. `op` is a ref/computed to the operation.
 */
export function useProcessActions(op) {
  const { t, te } = useI18n();
  const requote = ref(null); // { limitPx, minOut, size, symbol }
  const requoting = ref(false);
  const requoteError = ref("");
  const confirmStop = ref(false);

  const attentionCode = computed(() => op.value?.attention?.code ?? "");

  const attentionText = computed(() => {
    const code = attentionCode.value;
    if (!code) return "";
    return te(`ops.errors.${code}`) ? t(`ops.errors.${code}`) : t("ops.errors.unknown");
  });

  const approvalText = computed(() => {
    const a = op.value?.approval;
    if (!a) return "";
    if (a.code === "setup_price_changed") {
      return t("process.approval.setup_price_changed", { amount: formatAmount(a.amountNav), approved: formatAmount(a.approvedNav) });
    }
    return t("process.approval.unknown");
  });

  async function fetchRequote() {
    const step = currentStep(op.value);
    requoting.value = true;
    requoteError.value = "";
    try {
      const { readBooks, readTakerFeeRate } = await import("@/lib/intent/executors");
      const [books, feeRate] = await Promise.all([readBooks([step.base]), readTakerFeeRate(evmAddress.value)]);
      const book = books[step.base];
      const common = { szDecimals: book?.szDecimals, slippageBps: settings.slippageBps, feeRate };
      const quote = step.side === "sell"
        ? quoteSell({ ...common, size: step.size, bids: book?.bids })
        : quoteBuy({ ...common, budget: step.size != null ? step.size * Number(step.limitPx) : op.value.ctx.proceeds, asks: book?.asks });
      if (quote.error) throw new Error(quote.error);
      requote.value = {
        limitPx: quote.limitPx,
        minOut: quote.minOut,
        size: step.side === "buy" && step.size != null ? quote.size : step.size,
        symbol: step.side === "sell" ? "USDC" : step.base,
      };
    } catch (e) {
      requoteError.value = te(`swap.errors.${e.message}`) ? t(`swap.errors.${e.message}`) : t("ops.errors.unknown");
    } finally {
      requoting.value = false;
    }
  }

  function acceptRequote() {
    const { limitPx, minOut, size } = requote.value;
    requote.value = null;
    resolveOperation(op.value.id, "retry", { limitPx, minOut, size });
  }

  async function approve() {
    const a = op.value?.approval;
    const patch = a?.amountNav != null ? { amountNav: String(a.amountNav), approved: { amountNav: Number(a.amountNav) } } : null;
    if (!(await confirmProcess(op.value, a?.amountNav ?? null))) return;
    approveOperation(op.value.id, patch);
  }

  const stop = () => { confirmStop.value = true; };
  const doStop = () => { confirmStop.value = false; cancelOperation(op.value.id); };

  /** [{ id, label, primary, run }] for the current state. */
  const actions = computed(() => {
    const o = op.value;
    if (!o) return [];
    const id = o.id;
    const stopAction = { id: "stop", label: t("process.actions.stop"), run: stop };
    if (o.status === "awaiting") {
      const amount = o.approval?.amountNav;
      return [
        { id: "approve", label: amount != null ? t("process.approval.approve", { amount: formatAmount(amount) }) : t("common.confirm"), primary: true, run: approve },
        stopAction,
      ];
    }
    if (o.status === "attention") {
      if (attentionCode.value === "price_moved") {
        return [
          { id: "requote", label: t("process.actions.requote"), primary: true, run: fetchRequote },
          { id: "retry", label: t("process.actions.keepWaiting"), run: () => resolveOperation(id, "retry") },
          stopAction,
        ];
      }
      if (attentionCode.value === "interrupted") {
        return [
          { id: "skip", label: t("process.actions.wentThrough"), primary: true, run: () => resolveOperation(id, "skip") },
          { id: "retry", label: t("process.actions.sendAgain"), run: () => resolveOperation(id, "retry") },
          stopAction,
        ];
      }
      return [{ id: "retry", label: t("process.actions.retry"), primary: true, run: () => resolveOperation(id, "retry") }, stopAction];
    }
    if (o.status === "done" || o.status === "cancelled") {
      return [{ id: "dismiss", label: t("process.actions.dismiss"), run: () => dismissOperation(id) }];
    }
    // Running: stopping only makes sense while waiting (nothing to call back once sent).
    const cur = currentStep(o);
    if (cur && (cur.kind === "wait" || ["waitCredit", "waitAccount", "waitEvm"].includes(cur.type))) return [stopAction];
    return [];
  });

  return { actions, attentionText, approvalText, attentionCode, requote, requoting, requoteError, acceptRequote, confirmStop, doStop };
}
