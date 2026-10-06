/**
 * Runs multi-step operations (a swap that first has to move NAV onto the
 * exchange, a withdrawal that needs three chain actions, …) as ONE thing the
 * user started once. Every state change is persisted, so an operation
 * survives the app being closed and picks up where it stopped.
 *
 * Pure orchestration: the actual chain calls are injected `executors`
 * ({ [stepType]: { broadcast, run(step, op, api) } }), storage is injected
 * too — see stores/operations.js for the real wiring.
 *
 * A `broadcast` step moves funds and must never run twice by accident. Its
 * status is persisted as "submitting" BEFORE the call, so if the app dies
 * mid-call the engine can't tell whether it went out; on resume it stops and
 * asks instead of blindly sending again.
 */
const STOPPED = "__stopped";

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
          op.status = "done";
          op.updatedAt = now();
          save();
          break;
        }
        const executor = executors[step.type];
        if (!executor) {
          needsAttention(op, "unknown_step", step.type);
          break;
        }
        if (step.status === "submitting") {
          needsAttention(op, "interrupted");
          break;
        }

        step.status = executor.broadcast ? "submitting" : "active";
        step.startedAt ??= now();
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
          step.status = "failed";
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
      ops = storage.load() ?? [];
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
        kind: plan.kind,
        from: plan.from,
        to: plan.to,
        send: plan.send,
        estReceive: plan.estReceive ?? null,
        minReceive: plan.minReceive ?? null,
        deliversToWallet: !!plan.deliversToWallet,
        notes: plan.notes ?? [],
        steps: plan.steps.map((s) => ({ ...s, status: "pending" })),
        ctx: {},
        meta,
        status: "running",
        attention: null,
        createdAt: now(),
        updatedAt: now(),
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

    /** Stops an operation where it is. Funds stay wherever the finished steps left them. */
    cancel(id) {
      const op = find(id);
      if (!op || op.status === "done" || op.status === "cancelled") return;
      op.status = "cancelled";
      op.attention = null;
      op.updatedAt = now();
      save();
    },

    /** Removes a finished/cancelled operation from the list. */
    dismiss(id) {
      const op = find(id);
      if (!op || op.status === "running" || op.status === "attention") return;
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
}

function defaultSleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
