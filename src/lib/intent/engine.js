/**
 * Runs multi-step operations (a swap that first has to set up the trading
 * account and move NAV onto the exchange, a withdrawal that needs three
 * chain actions, …) as ONE thing the user started once. Every state change
 * is persisted, so an operation survives the app being closed and picks up
 * where it stopped.
 *
 * Pure orchestration: the actual chain calls are injected `executors`
 * ({ [stepType]: { kind, broadcast, run(step, op, api), verify?(step, op, api) } }),
 * storage is injected too — see stores/operations.js for the real wiring.
 *
 * Operation status:
 *   running   — a step is being driven (or will be as soon as resume() runs)
 *   awaiting  — a fund-moving step needs a fresh OK (its cost changed since
 *               the review); nothing is sent until approve()
 *   attention — a step failed or its outcome is unknown; the user picks
 *               retry / skip / stop
 *   done | cancelled
 *
 * A `broadcast` step moves funds and must never run twice by accident. Its
 * status is persisted as "submitting" BEFORE the call, so if the app dies
 * mid-call the engine can't tell whether it went out. On resume it first
 * asks the executor to VERIFY against chain state (wallet history, exchange
 * fills, balances); only when that is inconclusive does it stop and ask.
 */
const STOPPED = "__stopped";
export const SCHEMA_VERSION = 2;

export function createEngine({ executors, storage, onChange = () => {}, now = Date.now, sleep = defaultSleep }) {
  let ops = [];
  let generation = 0;
  const running = new Set();

  function save() {
    storage.save(ops);
    onChange(ops);
  }

  function find(id) {
    return ops.find((o) => o.id === id) ?? null;
  }

  function needsAttention(op, code, detail = "") {
    op.status = "attention";
    op.attention = { code, detail };
    op.updatedAt = now();
    save();
  }

  function needsApproval(op, step, approval) {
    step.status = "pending";
    op.status = "awaiting";
    op.approval = { step: step.type, ...approval };
    op.updatedAt = now();
    save();
  }

  function finishOp(op, status) {
    op.status = status;
    op.updatedAt = now();
    op.finishedAt = now();
    save();
  }

  async function run(op) {
    if (running.has(op.id)) return;
    running.add(op.id);
    const gen = generation;
    const alive = () => gen === generation && op.status === "running";
    const api = {
      alive,
      now,
      /** Resolves after `ms`, or rejects if the operation was stopped/cancelled meanwhile. */
      async sleep(ms) {
        await sleep(ms);
        if (!alive()) throw new Error(STOPPED);
      },
      /** Persists a change made to the step/op mid-run (e.g. a tx id). */
      save,
    };

    try {
      while (alive()) {
        const step = op.steps.find((s) => s.status !== "done");
        if (!step) {
          finishOp(op, "done");
          break;
        }
        const executor = executors[step.type];
        if (!executor) {
          needsAttention(op, "unknown_step", step.type);
          break;
        }

        // Interrupted mid-broadcast: find out what happened before anything is sent again.
        if (step.status === "submitting") {
          let outcome = "unknown";
          if (executor.verify) {
            try {
              outcome = await executor.verify(step, op, api);
            } catch (e) {
              console.error("[engine] verify failed:", e?.message);
            }
            if (gen !== generation) return;
          }
          if (outcome === "done") {
            step.status = "done";
            step.doneAt = now();
            step.verified = true;
            op.updatedAt = now();
            save();
            continue;
          }
          if (outcome !== "not_sent") {
            needsAttention(op, "interrupted");
            break;
          }
          step.status = "pending";
        }

        step.status = executor.broadcast ? "submitting" : "active";
        step.startedAt ??= now();
        step.attempts = (step.attempts || 0) + 1;
        op.updatedAt = now();
        save();

        try {
          const result = await executor.run(step, op, api);
          if (gen !== generation) return; // engine stopped: leave "submitting" for the resume check
          if (result) Object.assign(op.ctx, result);
          step.status = "done";
          step.doneAt = now();
          op.updatedAt = now();
          save();
          if (op.status !== "running") break; // cancelled while the step was in flight
        } catch (e) {
          if (e?.message === STOPPED) {
            // Waiting steps are safe to start over.
            if (step.status === "active") step.status = "pending";
            if (gen === generation) save();
            return;
          }
          if (gen !== generation) return;
          if (e?.message === "needs_approval") {
            needsApproval(op, step, e.approval ?? {});
            break;
          }
          step.status = "failed";
          step.error = { code: e?.message || "unknown", detail: e?.detail ? String(e.detail) : "", at: now() };
          // Cancelled while the step was in flight: stay cancelled.
          if (op.status !== "running") save();
          else needsAttention(op, e?.message || "unknown", e?.detail ? String(e.detail) : "");
          break;
        }
      }
    } finally {
      running.delete(op.id);
    }
  }

  return {
    get ops() {
      return ops;
    },

    /** Loads persisted operations and continues every one that was mid-flight. */
    resume() {
      generation++;
      running.clear();
      ops = (storage.load() ?? []).map(migrate);
      onChange(ops);
      for (const op of ops) if (op.status === "running") run(op);
    },

    /** Stops driving operations (wallet closed). Nothing is lost; resume() continues them. */
    stop() {
      generation++;
      running.clear();
      ops = [];
      onChange(ops);
    },

    /** Starts a planned operation. `plan` is a router.js plan; `meta` is anything the UI wants back. */
    start(plan, meta = {}) {
      const op = {
        id: `${now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        version: SCHEMA_VERSION,
        kind: plan.kind,
        intent: plan.intent ?? null,
        from: plan.from,
        to: plan.to,
        send: plan.send,
        estReceive: plan.estReceive ?? null,
        minReceive: plan.minReceive ?? null,
        deliversToWallet: !!plan.deliversToWallet,
        notes: plan.notes ?? [],
        unmet: plan.unmet ?? [],
        setupCost: plan.setupCost ?? 0,
        leavesWallet: plan.leavesWallet ?? 0,
        steps: plan.steps.map((s) => {
          const kind = executors[s.type]?.kind ?? "auto";
          const step = { ...s, kind, status: "pending" };
          // What the user consented to in Review, so a changed cost can be noticed.
          if (kind === "send") step.approved = { amountNav: Number(s.amountNav ?? s.amount ?? 0) || 0 };
          return step;
        }),
        ctx: {},
        meta,
        status: "running",
        attention: null,
        approval: null,
        createdAt: now(),
        updatedAt: now(),
        finishedAt: null,
      };
      ops = [op, ...ops];
      save();
      run(op);
      return op;
    },

    /**
     * Answers an operation that stopped for attention:
     *  - "retry": run the stopped step again (optionally with `patch` merged
     *    into it, e.g. a re-quoted limit price)
     *  - "skip": the interrupted step did go through — carry on after it
     */
    resolve(id, action, patch = null) {
      const op = find(id);
      if (!op || op.status !== "attention") return;
      const step = op.steps.find((s) => s.status !== "done");
      if (step) {
        if (action === "skip") {
          step.status = "done";
          step.doneAt = now();
          step.assumedDone = true;
        } else {
          if (patch) Object.assign(step, patch);
          step.status = "pending";
        }
      }
      op.status = "running";
      op.attention = null;
      op.updatedAt = now();
      save();
      run(op);
    },

    /** Gives the fresh OK an `awaiting` operation asked for; `patch` is merged into the step (e.g. the new amount). */
    approve(id, patch = null) {
      const op = find(id);
      if (!op || op.status !== "awaiting") return;
      const step = op.steps.find((s) => s.type === op.approval?.step && s.status !== "done") ?? op.steps.find((s) => s.status !== "done");
      if (step) {
        if (patch) Object.assign(step, patch);
        step.approved = { ...(step.approved ?? {}), ...(patch?.approved ?? {}), at: now() };
        step.status = "pending";
      }
      op.status = "running";
      op.approval = null;
      op.updatedAt = now();
      save();
      run(op);
    },

    /** Stops an operation where it is. Funds stay wherever the finished steps left them. */
    cancel(id) {
      const op = find(id);
      if (!op || op.status === "done" || op.status === "cancelled") return;
      op.attention = null;
      op.approval = null;
      finishOp(op, "cancelled");
    },

    /** Removes a finished/cancelled operation from the list. */
    dismiss(id) {
      const op = find(id);
      if (!op || op.status === "running" || op.status === "attention" || op.status === "awaiting") return;
      ops = ops.filter((o) => o.id !== id);
      save();
    },

    /** Applies `fn(op)` and persists — for bookkeeping outside a step (e.g. a payout arriving). */
    patch(id, fn) {
      const op = find(id);
      if (!op) return;
      fn(op);
      save();
    },
  };

  /** Brings an operation persisted by an older build up to the current shape. */
  function migrate(op) {
    if (op.version === SCHEMA_VERSION) return op;
    return {
      version: SCHEMA_VERSION,
      intent: null,
      unmet: [],
      setupCost: 0,
      leavesWallet: 0,
      approval: null,
      finishedAt: op.status === "done" || op.status === "cancelled" ? op.updatedAt ?? null : null,
      ...op,
      steps: (op.steps ?? []).map((s) => ({ kind: executors[s.type]?.kind ?? "auto", ...s })),
    };
  }
}

function defaultSleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
