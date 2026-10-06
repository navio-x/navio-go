/**
 * Every step type the engine can run, and whether it moves funds. A
 * fund-moving step is never re-run on its own after an interruption — see
 * engine.js. The implementations live in executors.js, which is loaded only
 * when a step actually has to run.
 */
export const STEP_TYPES = {
  faucet: { broadcast: true },
  waitAccount: { broadcast: false },
  // Checks whether it is already done before sending anything.
  register: { broadcast: false },
  deposit: { broadcast: true },
  waitCredit: { broadcast: false },
  order: { broadcast: true },
  toEvm: { broadcast: true },
  waitEvm: { broadcast: false },
  burn: { broadcast: true },
};
