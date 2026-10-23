import { describe, it, expect } from "vitest";
import { setWizardDraft, takeWizardDraft, clearWizardDraft } from "../walletWizard.js";

describe("walletWizard draft", () => {
  it("hands the draft over once and then forgets it", () => {
    setWizardDraft({ walletName: "w", password: "p", network: "testnet" });
    expect(takeWizardDraft()).toEqual({ walletName: "w", password: "p", network: "testnet" });
    expect(takeWizardDraft()).toBeNull();
  });

  it("can be cleared without being read", () => {
    setWizardDraft({ walletName: "w", password: "p", network: "testnet" });
    clearWizardDraft();
    expect(takeWizardDraft()).toBeNull();
  });
});
