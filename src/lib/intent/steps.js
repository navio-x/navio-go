/**
 * Every step type the engine can run, with its semantics:
 *
 *  - kind "send":  moves the user's funds. Consented to in Review (the exact
 *                  amount is stored on the step as `approved`), persisted as
 *                  "submitting" before the call and VERIFIED against chain
 *                  state before it is ever re-sent (see engine.js / verify()).
 *  - kind "auto":  no funds move; safe to run again (checks first).
 *  - kind "wait":  polls chain/exchange state; the app may be closed meanwhile.
 *  - kind "order": an exchange order; fills or not (IOC) — verified by its
 *                  client order id before a retry.
 *
 * The implementations live in executors.js, loaded only when a step runs.
 */
export const STEP_TYPES = {
  faucet: { kind: "send", broadcast: true },
  waitAccount: { kind: "wait", broadcast: false },
  register: { kind: "auto", broadcast: false },
  deposit: { kind: "send", broadcast: true },
  waitCredit: { kind: "wait", broadcast: false },
  order: { kind: "order", broadcast: true },
  toEvm: { kind: "auto", broadcast: true },
  waitEvm: { kind: "wait", broadcast: false },
  burn: { kind: "send", broadcast: true },
};

/** The user-facing stage each step belongs to (see router.stagesOf). */
export const STAGE_OF = {
  faucet: "setup",
  waitAccount: "setup",
  register: "setup",
  deposit: "prepare",
  waitCredit: "prepare",
  order: "swap",
  toEvm: "deliver",
  waitEvm: "deliver",
  burn: "deliver",
};

export const stepKind = (type) => STEP_TYPES[type]?.kind ?? "auto";
