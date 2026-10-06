import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { STEP_TYPES } from "../steps";
import { stagesOf } from "../router";

// executors.js can't be imported here (it pulls in the wallet SDK), so its
// step list is read from the source instead.
const source = readFileSync(fileURLToPath(new URL("../executors.js", import.meta.url)), "utf8");
const implemented = [...source.slice(source.indexOf("export const executors")).matchAll(/^  (\w+): \{$/gm)].map((m) => m[1]);

describe("step types", () => {
  it("has exactly one executor per step type", () => {
    expect(implemented.sort()).toEqual(Object.keys(STEP_TYPES).sort());
  });

  it("maps every step type to a user-facing stage", () => {
    for (const type of Object.keys(STEP_TYPES)) {
      expect(["setup", "prepare", "swap", "deliver"]).toContain(stagesOf([{ type }])[0].id);
    }
  });
});
