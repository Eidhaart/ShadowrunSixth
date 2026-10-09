import test from "node:test";
import assert from "node:assert/strict";
import { BUILDS, PREMADES, fromBuild, fromPremade } from "../src/lib/sr6/premades";
import { validate } from "../src/lib/sr6/derive";

test("every template is a legal build (only gear is left to buy)", () => {
  for (const b of BUILDS) {
    const issues = validate(fromBuild(b)).filter((i) => i.where !== "Gear" && i.where !== "Concept");
    assert.deepEqual(issues, [], `${b.id}: ${issues.map((i) => i.text).join("; ")}`);
  }
});

test("every premade passes the Forge with no errors or warnings", () => {
  for (const p of PREMADES) {
    const issues = validate(fromPremade(p));
    assert.deepEqual(issues, [], `${p.alias}: ${issues.map((i) => i.text).join("; ")}`);
  }
});
