import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeCheck, describeCheck } from "../src/lib/checks";
import { callView, pendingFor, rollOutcome } from "../src/lib/callState";
import type { WireMsg } from "../src/lib/comms";

const call: WireMsg = { type: "call", id: "k1", from: "GM", at: 1, to: [], check: { label: "Haggle", skill: "con", attr: "charisma", threshold: 2 }, gm: true };
const roll = (from: string, hits: number, extra: object = {}): WireMsg => ({ type: "roll", id: `r-${from}`, from, at: 2, label: "Haggle", pool: 8, dice: [], hits, glitch: false, critGlitch: false, edgeSpent: 0, callId: "k1", ...extra });

test("sanitizeCheck trims, clamps and drops junk", () => {
  const c = sanitizeCheck({ label: "  ", skill: "nope", attr: "logic", attr2: "intuition", threshold: 99, opposed: { label: "", pool: 500 }, note: " hi " });
  assert.equal(c.label, "Check");
  assert.equal(c.skill, undefined);
  assert.equal(c.attr2, "intuition");
  assert.equal(c.threshold, 12);
  assert.deepEqual(c.opposed, { label: "Opposition", pool: 30 });
  assert.equal(c.note, "hi");
});

test("describeCheck reads naturally", () => {
  assert.match(describeCheck({ label: "x", skill: "con", attr: "charisma", threshold: 2 }), /threshold 2/);
  assert.match(describeCheck({ label: "x", attr: "willpower", attr2: "charisma" }), /\+/);
});

test("pending calls clear on roll, decline or withdraw", () => {
  const log: WireMsg[] = [call];
  assert.equal(pendingFor(log, "Ana", "player").length, 1);
  assert.equal(pendingFor(log, "Ana", "gm").length, 0);
  assert.equal(pendingFor([...log, roll("Ana", 3)], "Ana", "player").length, 0);
  assert.equal(pendingFor([...log, { type: "decline", id: "d", callId: "k1", from: "Ana", at: 3 }], "Ana", "player").length, 0);
  assert.equal(pendingFor([...log, { type: "withdraw", id: "w", callId: "k1", from: "GM", at: 3 }], "Ana", "player").length, 0);
});

test("targeted calls skip other players", () => {
  const targeted = { ...call, to: ["Bo"] } as WireMsg;
  assert.equal(pendingFor([targeted], "Ana", "player").length, 0);
  assert.equal(pendingFor([targeted], "Bo", "player").length, 1);
});

test("callView lists present non-GM players when the call is for everyone", () => {
  const v = callView([call, roll("Ana", 3)], call as Extract<WireMsg, { type: "call" }>, [{ handle: "GM", role: "gm" }, { handle: "Ana" }, { handle: "Bo" }]);
  assert.deepEqual(v.targets, ["Ana", "Bo"]);
  assert.ok(v.responses.Ana && !v.responses.Bo);
});

test("rollOutcome: threshold, opposed and ties", () => {
  const r = (x: object) => roll("Ana", 3, x) as Extract<WireMsg, { type: "roll" }>;
  assert.equal(rollOutcome(r({ threshold: 3 })), "success");
  assert.equal(rollOutcome(r({ threshold: 4 })), "fail");
  assert.equal(rollOutcome(r({ opposed: { label: "x", pool: 5, dice: [], hits: 3 } })), "tie");
  assert.equal(rollOutcome(r({ opposed: { label: "x", pool: 5, dice: [], hits: 2 } })), "success");
  assert.equal(rollOutcome(r({})), "none");
});
