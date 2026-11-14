import { describe, it, expect } from "vitest";
import { pushBackHandler, handleBack } from "../backHandlers";

describe("backHandlers", () => {
  it("lets back navigate when nothing is open", () => {
    expect(handleBack()).toBe(false);
  });

  it("closes the most recently opened overlay first, one per press", () => {
    const calls = [];
    const removeMenu = pushBackHandler(() => { calls.push("menu"); removeMenu(); });
    const removeSheet = pushBackHandler(() => { calls.push("sheet"); removeSheet(); });
    expect(handleBack()).toBe(true);
    expect(handleBack()).toBe(true);
    expect(calls).toEqual(["sheet", "menu"]);
    expect(handleBack()).toBe(false);
  });

  it("forgets an overlay that closed some other way", () => {
    let closed = 0;
    const remove = pushBackHandler(() => closed++);
    remove();
    remove();
    expect(handleBack()).toBe(false);
    expect(closed).toBe(0);
  });
});
