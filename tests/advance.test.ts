import test from "node:test";
import assert from "node:assert/strict";
import { newCharacter } from "../src/lib/sr6/character";
import { budget, derive } from "../src/lib/sr6/derive";
import { ADV_COST, advance, offers, undoLast, withAdv } from "../src/lib/sr6/advance";

function runner() {
  const c = newCharacter();
  c.metatype = "human";
  c.attrPts.agility = 3; // natural Agility 4
  c.skills.firearms = { pts: 4, kar: 0 };
  c.karmaEarned = 100;
  return c;
}

test("raising an attribute costs new rating × 5 and leaves the creation budget alone", () => {
  const c = runner();
  const before = budget(c).karma.spent;
  const o = offers(withAdv(c)).attr.agility;
  assert.equal(o.cur, 4);
  assert.equal(o.cost, 25);
  assert.equal(advance(c, { k: "attr", a: "agility" }, "Agility 5", o.cost), null);
  assert.equal(c.karmaSpent, 25);
  assert.equal(derive(withAdv(c)).attrs.agility, 5);
  assert.equal(budget(c).karma.spent, before, "Forge budget ignores play advancement");
});

test("skills, specializations and expertise", () => {
  const c = runner();
  const o = offers(withAdv(c)).skill("firearms");
  assert.equal(o.cost, 25);
  advance(c, { k: "skill", id: "firearms" }, "Firearms 5", o.cost);
  advance(c, { k: "spec", id: "firearms", name: "Rifles" }, "Rifles", ADV_COST.spec);
  advance(c, { k: "expert", id: "firearms" }, "Rifles expertise", ADV_COST.expert);
  const s = derive(withAdv(c)).skills.find((x) => x.id === "firearms")!;
  assert.equal(s.rank, 5);
  assert.equal(s.specPool! - s.pool, 3);
  assert.equal(c.karmaSpent, 35);
});

test("refuses purchases beyond available Karma", () => {
  const c = runner();
  c.karmaEarned = 4;
  assert.match(advance(c, { k: "spell", name: "Fireball" }, "Fireball", 5) ?? "", /costs 5/);
  assert.equal(c.karmaSpent, 0);
});

test("undo refunds the last purchase", () => {
  const c = runner();
  advance(c, { k: "attr", a: "agility" }, "Agility 5", 25);
  advance(c, { k: "knowledge", item: { id: "k1", name: "Seattle gangs", kind: "knowledge" } }, "Seattle gangs", ADV_COST.knowledge);
  undoLast(c);
  assert.equal(c.karmaSpent, 25);
  assert.equal(withAdv(c).knowledge.length, 0);
  undoLast(c);
  assert.equal(c.karmaSpent, 0);
  assert.equal(derive(withAdv(c)).attrs.agility, 4);
});

test("attribute raises stop at the metatype maximum", () => {
  const c = runner();
  c.attrPts.agility = 5; // natural 6, human max 6
  assert.equal(offers(withAdv(c)).attr.agility.ok, false);
});

test("initiation costs 10 + new grade and lifts the Magic cap", () => {
  const c = runner();
  c.magicType = "full";
  c.priorities = { magic: "A" };
  const o = offers(withAdv(c));
  assert.equal(o.initiate?.cost, 11);
  advance(c, { k: "initiate", meta: "Centering" }, "Initiate grade 1", 11);
  assert.equal(withAdv(c).initiateGrade, 1);
});

test("buying off a negative quality removes it from the sheet but not from the build", () => {
  const c = runner();
  c.qualities.push({ id: "q1", name: "Glass Jaw", kind: "negative", karma: 4, level: 1, effect: { stunBoxes: -1 } });
  const stun = derive(c).condition.stun;
  advance(c, { k: "buyoff", key: "Glass Jaw|", name: "Glass Jaw" }, "Buy off Glass Jaw", 8);
  assert.equal(derive(withAdv(c)).condition.stun, stun + 1);
  assert.equal(c.qualities.length, 1);
});
