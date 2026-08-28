import { describe, it, expect } from "vitest";
import { applyKeypadPress } from "../amountEntry.js";

describe("applyKeypadPress", () => {
  it("builds up a plain integer", () => {
    let v = "";
    for (const k of ["1", "2", "5"]) v = applyKeypadPress(v, k, 8);
    expect(v).toEqual("125");
  });

  it("drops a leading zero when a digit follows", () => {
    let v = applyKeypadPress("", "0", 8);
    expect(v).toEqual("0");
    v = applyKeypadPress(v, "5", 8);
    expect(v).toEqual("5");
  });

  it("does not accumulate multiple leading zeros", () => {
    let v = applyKeypadPress("", "0", 8);
    v = applyKeypadPress(v, "0", 8);
    expect(v).toEqual("0");
  });

  it("starts a decimal from empty input as 0.", () => {
    expect(applyKeypadPress("", ".", 8)).toEqual("0.");
  });

  it("allows only one decimal point", () => {
    let v = "12.5";
    expect(applyKeypadPress(v, ".", 8)).toEqual("12.5");
  });

  it("caps decimal places at the given maximum", () => {
    let v = "1.99";
    expect(applyKeypadPress(v, "9", 2)).toEqual("1.99");
    expect(applyKeypadPress(v, "9", 3)).toEqual("1.999");
  });

  it("enforces 8 decimals for NAV and 2 for fiat", () => {
    let nav = "1.12345678";
    expect(applyKeypadPress(nav, "9", 8)).toEqual(nav);
    let fiat = "1.12";
    expect(applyKeypadPress(fiat, "9", 2)).toEqual(fiat);
  });

  it("backspace removes the last character", () => {
    expect(applyKeypadPress("12.5", "back", 8)).toEqual("12.");
    expect(applyKeypadPress("", "back", 8)).toEqual("");
  });
});
