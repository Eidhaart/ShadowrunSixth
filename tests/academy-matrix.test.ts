import { test } from "node:test";
import assert from "node:assert/strict";
import { begin, commit, fixedRoll, newSim, actions, successOdds, debrief, type Roller } from "../src/lib/academy/matrix/sim";

/** Scripted dice: hits by label; unknown labels get `def`. */
const script = (m: Record<string, number>, def = 0): Roller => (pool, label) => fixedRoll(pool, Math.min(pool, m[label] ?? def), label);
const act = (s: ReturnType<typeof newSim>, id: Parameters<typeof begin>[1], r: Roller) => commit(begin(s, id, r), r);

test("successOdds is a probability and grows with pool", () => {
  assert.ok(successOdds(12, 10) > successOdds(8, 10));
  assert.ok(successOdds(5, 5) > 0 && successOdds(5, 5) < 1);
  assert.ok(successOdds(0, 3) < 1e-9);
});

test("Probe then Backdoor Entry gives clean Admin with no upkeep", () => {
  const r = script({ Probe: 5, Defender: 1, "Backdoor Entry": 4 });
  let s = newSim("ghost", "ar", r);
  s = act(s, "probe", r);
  assert.equal(s.backdoor, 4);
  s = act(s, "backdoor", r);
  assert.equal(s.access, "admin");
  assert.equal(s.illegal, false);
  const osBefore = s.os;
  s = act(s, "perceive", r);
  assert.equal(s.os, osBefore);
});

test("Brute Force alarms the host and Admin costs 3 OS per round", () => {
  const r = script({ "Brute Force to Admin": 6, Defender: 1 });
  let s = newSim("sledge", "ar", r);
  s = act(s, "bruteAdmin", r);
  assert.equal(s.alert, true);
  assert.equal(s.access, "admin");
  assert.equal(s.illegal, true);
  assert.ok(s.os >= 1 + 3, `os was ${s.os}`);
});

test("legal actions never add Overwatch Score", () => {
  const r = script({ "Matrix Perception": 3, Defender: 3 });
  let s = newSim("balanced", "cold", r);
  s = act(s, "perceive", r);
  assert.equal(s.os, 0);
});

test("full run: quiet entry, find, crack, disarm, copy, jack out wins with 3 stars", () => {
  const r = script({ Probe: 6, Defender: 0, "Backdoor Entry": 6, "Matrix Search": 5, "Crack File": 6, "Matrix Perception": 3, "Disarm Data Bomb": 5, "Edit File: copy the ledger": 6, "Jack Out": 6 });
  let s = newSim("ghost", "ar", r);
  for (const id of ["probe", "backdoor", "search", "perceive", "crack", "disarm", "copy", "jackout"] as const) {
    s = act(s, id, r);
    assert.ok(s.status === "play" || id === "jackout", `ended early at ${id}: ${s.end}`);
  }
  assert.equal(s.status, "won");
  assert.equal(debrief(s).stars >= 2, true);
});

test("Convergence at 40 ends the run", () => {
  const r = script({ "Brute Force to User": 0, Defender: 10 });
  let s = newSim("sledge", "ar", r);
  for (let i = 0; i < 5 && s.status === "play"; i++) s = act(s, "bruteUser", r);
  assert.equal(s.status, "lost");
  assert.equal(s.end, "convergence");
});

test("disabled actions cannot begin", () => {
  const r = script({});
  const s = newSim("ghost", "ar", r);
  const a = actions(s).find((x) => x.id === "copy")!;
  assert.equal(a.enabled, false);
  assert.equal(begin(s, "copy", r), s);
});
