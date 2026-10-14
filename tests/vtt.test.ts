/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- loose fixtures against the plain JS relay module
import test from "node:test";
import assert from "node:assert/strict";
import { apply, emptyTable, opsForPlayer, permitted, viewFor } from "../server/vtt.mjs";
import { applyOps, nextUp, sortedTurn } from "../src/lib/vtt/ops";
import { rangeBand } from "../src/lib/vtt/types";

function table() {
  const t = emptyTable();
  t.scenes.s1 = { id: "s1", name: "Docks", objects: {
    a: { id: "a", kind: "token", layer: "token", owners: ["alice"], x: 0, y: 0, bars: {}, markers: [] },
    g: { id: "g", kind: "token", layer: "gm", owners: [], x: 0, y: 0, bars: {}, markers: [], img: "img1" },
    n: { id: "n", kind: "token", layer: "token", owners: [], x: 0, y: 0, bars: {}, markers: [] },
  }, notes: "ambush at midnight" };
  t.scenes.s2 = { id: "s2", name: "Secret lab", objects: {}, notes: "" };
  t.order = ["s1", "s2"];
  t.playerScene = "s1";
  t.handouts = { h1: { id: "h1", title: "Map", text: "", shared: true }, h2: { id: "h2", title: "Twist", text: "", shared: false } };
  t.assets = { img1: { id: "img1", data: "data:x", w: 1, h: 1 } };
  t.turn.entries = { e1: { id: "e1", name: "Alice", owner: "alice", score: 12 }, e2: { id: "e2", name: "Hidden", tokenId: "g", score: 20 } };
  return t;
}

test("players move only tokens they control, and only position-like fields", () => {
  const t = table();
  assert.equal(permitted(t, { k: "merge", p: ["scenes", "s1", "objects", "a"], v: { x: 70, y: 140 } }, "alice", false), true);
  assert.equal(permitted(t, { k: "merge", p: ["scenes", "s1", "objects", "n"], v: { x: 70 } }, "alice", false), false);
  assert.equal(permitted(t, { k: "merge", p: ["scenes", "s1", "objects", "a"], v: { layer: "gm" } }, "alice", false), false);
  assert.equal(permitted(t, { k: "set", p: ["playerScene"], v: "s2" }, "alice", false), false);
  assert.equal(permitted(t, { k: "set", p: ["playerScene"], v: "s2" }, "gm", true), true);
  assert.equal(permitted(t, { k: "set", p: ["__proto__", "x"], v: 1 }, "gm", true), false);
});

test("players add their own drawings and turn entries, not other people's", () => {
  const t = table();
  assert.equal(permitted(t, { k: "set", p: ["scenes", "s1", "objects", "d1"], v: { kind: "path", layer: "token", by: "alice", pts: [] } }, "alice", false), true);
  assert.equal(permitted(t, { k: "set", p: ["scenes", "s1", "objects", "d1"], v: { kind: "path", layer: "gm", by: "alice" } }, "alice", false), false);
  assert.equal(permitted(t, { k: "merge", p: ["turn", "entries", "e1"], v: { score: 15 } }, "alice", false), true);
  assert.equal(permitted(t, { k: "merge", p: ["turn", "entries", "e2"], v: { score: 1 } }, "alice", false), false);
});

test("players never see the GM layer, other scenes, notes or unshared handouts", () => {
  const v = viewFor(table(), { role: "player" });
  assert.deepEqual(Object.keys(v.scenes), ["s1"]);
  assert.equal(v.scenes.s1.objects.g, undefined);
  assert.equal(v.scenes.s1.notes, "");
  assert.deepEqual(Object.keys(v.handouts), ["h1"]);
  assert.deepEqual(Object.keys(v.turn.entries), ["e1"]);
  assert.deepEqual(Object.keys(v.assets), []);
});

test("moving a token off the GM layer reveals it to players, with its image", () => {
  const before = table();
  const after = structuredClone(before);
  const op = { k: "merge", p: ["scenes", "s1", "objects", "g"], v: { layer: "token" } };
  apply(after, op);
  const client = { role: "player", assetsSent: new Set() };
  const ops = opsForPlayer(before, after, [op], client);
  assert.equal(ops[0].p.join("/"), "assets/img1");
  assert.equal(ops[1].k, "set");
  assert.equal(ops[1].v.layer, "token");
  const back = structuredClone(after);
  const op2 = { k: "merge", p: ["scenes", "s1", "objects", "g"], v: { layer: "gm" } };
  apply(back, op2);
  assert.equal(opsForPlayer(after, back, [op2], client)[0].k, "del");
});

test("client op apply keeps untouched branches", () => {
  const t = table();
  const next = applyOps(t, [{ k: "merge", p: ["scenes", "s1", "objects", "a"], v: { x: 5 } }]);
  assert.equal(next.scenes.s2, t.scenes.s2);
  assert.equal(next.scenes.s1.objects.a.x, 5);
  assert.equal(t.scenes.s1.objects.a.x, 0);
});

test("turn order: highest first, skips acted and delayed", () => {
  const e = {
    a: { id: "a", name: "A", score: 12, acted: false, delayed: false, tie: 0, base: 0, dice: 0, minors: 0 },
    b: { id: "b", name: "B", score: 18, acted: true, delayed: false, tie: 0, base: 0, dice: 0, minors: 0 },
    c: { id: "c", name: "C", score: 15, acted: false, delayed: true, tie: 0, base: 0, dice: 0, minors: 0 },
  };
  assert.deepEqual(sortedTurn(e).map((x) => x.id), ["b", "c", "a"]);
  assert.equal(nextUp(e, null)?.id, "a");
  assert.equal(rangeBand(3), "Close");
  assert.equal(rangeBand(40), "Near");
  assert.equal(rangeBand(600), "Extreme");
});
