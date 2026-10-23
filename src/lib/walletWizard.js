// In-memory hand-off between the create/import wizard screens (name,
// password) and the screen that actually creates the wallet. Lives only in
// this module's scope: nothing here ever touches sessionStorage or
// localStorage, so a password never sits in the browser profile on disk.
//
// A page reload mid-wizard loses the draft — the wizard then starts over
// (see MnemonicGenerate.vue), which is the right trade-off for a secret.

let draft = null;

export function setWizardDraft({ walletName, password, network }) {
  draft = { walletName, password, network };
}

/** Returns the draft and forgets it, so the password is held only until used. */
export function takeWizardDraft() {
  const d = draft;
  draft = null;
  return d;
}

export function clearWizardDraft() {
  draft = null;
}
