/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- loose fixtures against the plain JS relay module
import test from "node:test";
import assert from "node:assert/strict";
import { emptyTable, opsForPlayer, permitted, viewFor } from "../server/vtt.mjs";
import { damageAfter, damageBars, edgeFromRatings, outcomeOf, parseDv, woundPenalty } from "../src/lib/vtt/combat";

test("attack outcome: more hits hit, a tie grazes, fewer or none miss", () => {
  assert.deepEqual(outcomeOf(4, 2), { outcome: "hit", net: 2 });
  assert.deepEqual(outcomeOf(3, 3), { outcome: "graze", net: 0 });
  assert.deepEqual(outcomeOf(2, 3), { outcome: "miss", net: 0 });
  assert.deepEqual(outcomeOf(0, 0), { outcome: "miss", net: 0 });
});

test("AR against DR: 4 or more ahead gains Edge", () => {
  assert.equal(edgeFromRatings(10, 6), "attacker");
  assert.equal(edgeFromRatings(9, 6), null);
  assert.equal(edgeFromRatings(5, 9), "defender");
});

test("damage: DV plus net hits less soak hits, Stun spills into Physical", () => {
  assert.equal(damageAfter(3, 2, 1), 4);
  assert.equal(damageAfter(3, 0, 5), 0);
  assert.deepEqual(parseDv("4S(e)"), { dv: 4, type: "S" });
  assert.deepEqual(parseDv("3P"), { dv: 3, type: "P" });
  const bars = { b1: { cur: 10, max: 10 }, b2: { cur: 2, max: 10 } };
  const r = damageBars(bars, 5, "S");
  assert.equal(r.bars.b2.cur, 0);
  assert.equal(r.bars.b1.cur, 7);
  assert.equal(r.down, true);
  const p = damageBars({ b1: { cur: 2, max: 10 } }, 5, "P");
  assert.equal(p.bars.b1.cur, 0);
  assert.equal(p.overflow, 3);
  assert.equal(woundPenalty({ b1: { cur: 4, max: 10 }, b2: { cur: 7, max: 10 } }), 3);
});

function table() {
  const t = emptyTable();
  t.scenes.s1 = { id: "s1", objects: {
    a: { id: "a", kind: "token", layer: "token", owners: ["alice"], bars: {}, markers: [] },
    n: { id: "n", kind: "token", layer: "token", owners: [], bars: {}, markers: [] },
    h: { id: "h", kind: "token", layer: "gm", owners: [], bars: {}, markers: [] },
  } };
  t.playerScene = "s1";
  return t;
}
const rec = (o = {}) => ({ id: "x1", scene: "s1", by: "alice", attacker: { tokenId: "a", name: "A" }, target: { tokenId: "n", name: "N" }, status: "defend", ...o });

test("players attack from their own tokens at visible targets; the target's controller defends", () => {
  const t = table();
  assert.equal(permitted(t, { k: "set", p: ["combat", "x1"], v: rec() }, "alice", false), true);
  assert.equal(permitted(t, { k: "set", p: ["combat", "x1"], v: rec({ by: "bob" }) }, "bob", false), false);
  assert.equal(permitted(t, { k: "set", p: ["combat", "x1"], v: rec({ attacker: { tokenId: "n", name: "N" } }) }, "alice", false), false);
  assert.equal(permitted(t, { k: "set", p: ["combat", "x1"], v: rec({ target: { tokenId: "h", name: "H" } }) }, "alice", false), false);
  // an attack at alice's token: alice writes the defense, bob cannot
  t.combat.x2 = rec({ id: "x2", by: "gm", attacker: { tokenId: "n", name: "N" }, target: { tokenId: "a", name: "A" } });
  assert.equal(permitted(t, { k: "merge", p: ["combat", "x2"], v: { defense: {}, outcome: "hit", net: 2, status: "soak" } }, "alice", false), true);
  assert.equal(permitted(t, { k: "merge", p: ["combat", "x2"], v: { status: "done" } }, "bob", false), false);
  assert.equal(permitted(t, { k: "merge", p: ["combat", "x2"], v: { attack: { hits: 9 } } }, "alice", false), false);
});

test("attacks from hidden tokens reach players unnamed; attacks on hidden tokens not at all", () => {
  const t = table();
  t.combat = { x1: rec({ by: "gm", attacker: { tokenId: "h", name: "Sniper" }, target: { tokenId: "a", name: "A" } }), x2: rec({ id: "x2", by: "gm", target: { tokenId: "h", name: "H" } }) };
  const v = viewFor(t, { role: "player" });
  assert.equal(v.combat.x1.attacker.name, "Unseen attacker");
  assert.equal(v.combat.x1.attacker.tokenId, undefined);
  assert.equal(v.combat.x2, undefined);
  const ops = opsForPlayer(t, t, [{ k: "set", p: ["combat", "x1"], v: t.combat.x1 }], { role: "player", assetsSent: new Set() });
  assert.equal(ops[0].v.attacker.name, "Unseen attacker");
});
