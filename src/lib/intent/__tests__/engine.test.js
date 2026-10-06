import { describe, it, expect, vi } from "vitest";
import { createEngine } from "../engine";

function memoryStorage(initial = []) {
  let saved = JSON.parse(JSON.stringify(initial));
  return {
    load: () => JSON.parse(JSON.stringify(saved)),
    save: (ops) => {
      saved = JSON.parse(JSON.stringify(ops));
    },
    get saved() {
      return saved;
    },
  };
}

const plan = (...types) => ({ kind: "swap", from: "NAV", to: "USDC", send: 100, steps: types.map((type) => ({ type })) });
const flush = () => new Promise((r) => setTimeout(r, 0));
const instantSleep = () => Promise.resolve();

describe("engine", () => {
  it("runs the steps in order and finishes", async () => {
    const calls = [];
    const storage = memoryStorage();
    const engine = createEngine({
      storage,
      sleep: instantSleep,
      executors: {
        deposit: { broadcast: true, run: async () => { calls.push("deposit"); return { txId: "abc" }; } },
        order: { broadcast: true, run: async (_s, op) => { calls.push(`order:${op.ctx.txId}`); } },
      },
    });

    const op = engine.start(plan("deposit", "order"));
    await flush();

    expect(calls).toEqual(["deposit", "order:abc"]);
    expect(op.status).toBe("done");
    expect(storage.saved[0].steps.map((s) => s.status)).toEqual(["done", "done"]);
  });

  it("persists a fund-moving step as submitting before it runs", async () => {
    const storage = memoryStorage();
    let seen = null;
    const engine = createEngine({
      storage,
      executors: { deposit: { broadcast: true, run: async () => { seen = storage.saved[0].steps[0].status; } } },
    });
    engine.start(plan("deposit"));
    await flush();
    expect(seen).toBe("submitting");
  });

  it("stops for attention when a step fails, and retries on request", async () => {
    let attempts = 0;
    const engine = createEngine({
      storage: memoryStorage(),
      executors: {
        order: {
          broadcast: true,
          run: async (step) => {
            attempts++;
            if (step.limitPx !== "0.40") {
              const err = new Error("price_moved");
              err.detail = "no match";
              throw err;
            }
          },
        },
      },
    });

    const op = engine.start(plan("order"));
    await flush();
    expect(op.status).toBe("attention");
    expect(op.attention).toEqual({ code: "price_moved", detail: "no match" });

    engine.resolve(op.id, "retry", { limitPx: "0.40" });
    await flush();
    expect(attempts).toBe(2);
    expect(op.status).toBe("done");
  });

  it("never re-sends a step that was interrupted mid-broadcast", async () => {
    const run = vi.fn();
    const interrupted = [{
      id: "op1", kind: "swap", status: "running", ctx: {}, attention: null,
      steps: [{ type: "deposit", status: "submitting" }, { type: "order", status: "pending" }],
    }];
    const engine = createEngine({
      storage: memoryStorage(interrupted),
      executors: { deposit: { broadcast: true, run }, order: { broadcast: true, run } },
    });

    engine.resume();
    await flush();
    expect(run).not.toHaveBeenCalled();
    expect(engine.ops[0].attention.code).toBe("interrupted");

    // "It went through": carry on after it without sending again.
    engine.resolve("op1", "skip");
    await flush();
    expect(run).toHaveBeenCalledTimes(1);
    expect(engine.ops[0].status).toBe("done");
  });

  it("picks a waiting step back up after a restart", async () => {
    let credited = false;
    const executors = {
      waitCredit: {
        run: async (_step, _op, api) => {
          while (!credited) await api.sleep(1);
        },
      },
    };
    const storage = memoryStorage();
    const first = createEngine({ storage, executors });
    first.start(plan("waitCredit"));
    await flush();
    first.stop();
    await new Promise((r) => setTimeout(r, 5));
    expect(storage.saved[0].status).toBe("running");

    credited = true;
    const second = createEngine({ storage, executors });
    second.resume();
    await flush();
    expect(second.ops[0].status).toBe("done");
  });

  it("cancels where it is and leaves the remaining steps unrun", async () => {
    const order = vi.fn();
    const engine = createEngine({
      storage: memoryStorage(),
      executors: {
        waitCredit: { run: async (_s, _o, api) => { for (;;) await api.sleep(1); } },
        order: { broadcast: true, run: order },
      },
    });
    const op = engine.start(plan("waitCredit", "order"));
    await flush();
    engine.cancel(op.id);
    await new Promise((r) => setTimeout(r, 5));

    expect(op.status).toBe("cancelled");
    expect(order).not.toHaveBeenCalled();

    engine.dismiss(op.id);
    expect(engine.ops).toEqual([]);
  });

  it("won't dismiss an operation that is still in flight", async () => {
    const engine = createEngine({
      storage: memoryStorage(),
      executors: { waitCredit: { run: async (_s, _o, api) => { for (;;) await api.sleep(1); } } },
    });
    const op = engine.start(plan("waitCredit"));
    await flush();
    engine.dismiss(op.id);
    expect(engine.ops).toHaveLength(1);
    engine.stop();
  });

  it("reports changes and unknown step types", async () => {
    const onChange = vi.fn();
    const engine = createEngine({ storage: memoryStorage(), executors: {}, onChange });
    const op = engine.start(plan("mystery"));
    await flush();
    expect(op.attention).toEqual({ code: "unknown_step", detail: "mystery" });
    expect(onChange).toHaveBeenCalled();
  });
});
