import { describe, it, expect } from "vitest";
import { passwordProblem } from "../passwordPolicy.js";

describe("passwordProblem", () => {
  it("rejects common words even with digits and symbols glued on", () => {
    expect(passwordProblem("Password123!")).toBe("common");
    expect(passwordProblem("P@ssw0rd!")).toBe(null); // 'psswrd' is not in the list — the meter still grades it
    expect(passwordProblem("qwerty1!")).toBe("common");
    expect(passwordProblem("Navio2026!")).toBe("common");
    expect(passwordProblem("Summer2025!")).toBe("common");
  });

  it("rejects digit/symbol-only patterns", () => {
    expect(passwordProblem("123456!")).toBe("common");
    expect(passwordProblem("111111!")).toBe("common");
    expect(passwordProblem("1234567890!")).toBe("common");
    expect(passwordProblem("4817!")).toBe(null);
  });

  it("rejects the wallet name as the password", () => {
    expect(passwordProblem("Savings-1!", "savings")).toBe("name");
    expect(passwordProblem("Savings-1!", "My Savings")).toBe(null);
    expect(passwordProblem("ab1!", "ab")).toBe(null); // too short a name to matter
  });

  it("accepts an ordinary strong password", () => {
    expect(passwordProblem("correct-horse-battery!7", "wallet")).toBe(null);
    expect(passwordProblem("", "wallet")).toBe(null);
  });
});
