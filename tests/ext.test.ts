import { test } from "node:test";
import assert from "node:assert/strict";
import { newCharacter } from "../src/lib/sr6/character";
import { derive } from "../src/lib/sr6/derive";
import { arrange, editExt, evalFormula, getExt, matrixStats, newDeck, vehicleBoxes, newVehicle, drainIsPhysical } from "../src/lib/sr6/ext";
import { roll, tally } from "../src/lib/sr6/dice";

test("arrange keeps the deck array a permutation", () => {
  let d = newDeck(3);
  assert.deepEqual(d.assign, [0, 1, 2, 3]);
  d = arrange(d, 0, 3); // Attack takes the lowest value, Firewall inherits the old Attack value
  assert.deepEqual(d.assign, [3, 1, 2, 0]);
  assert.deepEqual([...d.assign].sort(), [0, 1, 2, 3]);
  d = arrange(d, 2, 2); // already there, nothing changes
  assert.deepEqual(d.assign, [3, 1, 2, 0]);
});

test("matrix stats from a deck", () => {
  const c = newCharacter();
  editExt(c, (e) => { e.deck = arrange(newDeck(4), 0, 3); e.mode = "hot"; });
  const m = matrixStats(c, derive(c));
  assert.equal(m.source, "deck");
  assert.equal(m.rating, 4);
  assert.equal(m.attack, 4); // lowest of 7/6/5/4
  assert.equal(m.fw, 7);
  assert.equal(m.condition, 10); // 8 + ceil(4/2)
  assert.equal(m.attackRating, m.attack + m.sleaze);
  assert.equal(m.defenseRating, m.dp + m.fw);
  assert.equal(m.init.dice, 3);
});

test("technomancers get a living persona from attributes", () => {
  const c = newCharacter();
  c.magicType = "technomancer";
  c.priorities = { magic: "A" };
  const d = derive(c);
  const m = matrixStats(c, d);
  assert.equal(m.source, "persona");
  assert.equal(m.attack, d.attrs.charisma);
  assert.equal(m.fw, d.attrs.willpower);
  assert.equal(m.rating, d.resonance);
});

test("no deck, no Matrix stats", () => {
  const c = newCharacter();
  assert.equal(matrixStats(c, derive(c)).source, "none");
  assert.equal(getExt(c).sustained.length, 0);
});

test("drain formulas", () => {
  assert.equal(evalFormula("F/2", 5), 3);
  assert.equal(evalFormula("F-3", 6), 3);
  assert.equal(evalFormula("(F+1)/2", 4), 3);
  assert.equal(evalFormula("F-9", 3), 1); // never below 1
  assert.equal(evalFormula("2*F", 3), 6);
  assert.equal(evalFormula("rm -rf", 3), null);
  assert.equal(evalFormula("", 3), null);
  assert.equal(evalFormula("F/", 3), null);
});

test("drain turns physical above Magic", () => {
  assert.equal(drainIsPhysical(6, 5), true);
  assert.equal(drainIsPhysical(5, 5), false);
});

test("vehicle condition boxes", () => {
  const drone = newVehicle("drone");
  assert.equal(vehicleBoxes(drone), 6 + 2);
  assert.equal(vehicleBoxes({ ...newVehicle("vehicle"), body: 9 }), 12 + 5);
  assert.equal(vehicleBoxes({ ...drone, boxes: 11 }), 11);
});

test("limit caps hits", () => {
  const dice = [5, 5, 5, 6].map((v) => ({ value: v, hit: true }));
  const r = tally(dice, { label: "x", pool: 4, limit: 2 }, 4, 0, 0);
  assert.equal(r.totalHits, 2);
  assert.equal(r.limited, 4);
  const free = roll({ label: "y", pool: 0 });
  assert.equal(free.limited, undefined);
});
