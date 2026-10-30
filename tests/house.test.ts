/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- loose fixtures against the plain JS relay module
import test from "node:test";
import assert from "node:assert/strict";
import { BOOK, diffs, sanitize, setActiveRules, emptyRuleset, rules } from "../src/lib/house/rules";
import { damageBars, edgeFromRatings, outcomeOf, woundPenalty } from "../src/lib/vtt/combat";
import { ADV_COST } from "../src/lib/sr6/advance";
import { KARMA } from "../src/lib/sr6/data";
import { emptyTable, opsForPlayer, permitted, viewFor } from "../server/vtt.mjs";
import { resizeBox } from "../src/app/table/Stage";

const withRules = (mech, fn) => { const r = emptyRuleset(); r.mech = mech; setActiveRules(r); try { fn(); } finally { setActiveRules(null); } };

test("an empty ruleset plays by the book", () => {
  setActiveRules(null);
  assert.deepEqual(rules(), BOOK);
  assert.equal(outcomeOf(3, 3).outcome, "hit");
  assert.equal(ADV_COST.spec, 5);
  assert.equal(KARMA.customization, 50);
});

test("house mechanics change combat, wounds, Karma and creation", () => {
  withRules({ tie: "miss", edgeGap: 3, woundEvery: 2, stunSpill: 2, karmaCostPct: 200, startKarma: 100 }, () => {
    assert.equal(outcomeOf(3, 3).outcome, "miss");
    assert.equal(edgeFromRatings(9, 6), "attacker");
    assert.equal(woundPenalty({ b1: { cur: 6, max: 10 } }), 2);
    const r = damageBars({ b1: { cur: 10, max: 10 }, b2: { cur: 0, max: 10 } }, 5, "S");
    assert.equal(r.bars.b1.cur, 8); // 5 Stun past a full track at 2:1 is 2 Physical
    assert.equal(ADV_COST.spec, 10);
    assert.equal(KARMA.customization, 100);
    assert.equal(diffs(rules()).length, 6);
  });
});

test("imported rulesets are cleaned up", () => {
  const r = sanitize({ name: "X", mech: { edgeGap: 999, tie: "explode", armorSoaks: true, bogus: 1 }, items: [{ name: "Gun", cat: "weapons" }], notes: [{ title: "Secret", text: "t", secret: true }] });
  assert.equal(r.mech.edgeGap, 12);
  assert.equal(r.mech.tie, undefined);
  assert.equal(r.mech.armorSoaks, true);
  assert.equal("bogus" in r.mech, false);
  assert.equal(r.items.length, 1);
});

test("players get the rules without GM-only notes, and cannot change them", () => {
  const t = emptyTable();
  t.rules = { id: "r", name: "T", mech: {}, items: [], statuses: [], notes: [{ id: "a", title: "Open", text: "", tags: [] }, { id: "b", title: "Plot", text: "", tags: [], secret: true }] };
  const v = viewFor(t, { role: "player" });
  assert.deepEqual(v.rules.notes.map((n) => n.title), ["Open"]);
  const ops = opsForPlayer(t, t, [{ k: "set", p: ["rules"], v: t.rules }], { role: "player", assetsSent: new Set() });
  assert.equal(ops[0].v.notes.length, 1);
  assert.equal(permitted(t, { k: "set", p: ["rules"], v: null }, "alice", false), false);
});

test("map resizing keeps the picture's shape and snaps to the grid", () => {
  const b = { x: 0, y: 0, w: 700, h: 350 };
  const r = resizeBox(b, "se", 75, 0, { snap: true, aspect: 2 });
  assert.equal(r.w, 770);
  assert.equal(r.h, 385);
  const free = resizeBox(b, "e", 30, 0, { snap: false });
  assert.deepEqual(free, { x: 0, y: 0, w: 730, h: 350 });
  const west = resizeBox(b, "w", 140, 0, { snap: true });
  assert.deepEqual(west, { x: 140, y: 0, w: 560, h: 350 });
});
