import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPostBoost, damageAfterSoak, glitchOdds, hitOdds, opposed, roll, tally, type Die } from "../src/lib/sr6/dice";
import { newCharacter } from "../src/lib/sr6/character";
import { budget, derive, validate } from "../src/lib/sr6/derive";

const die = (value: number, exploded = false): Die => ({ value, hit: value >= 5, exploded });

test("hits are 5s and 6s", () => {
  const r = tally([5, 6, 4, 3, 2, 1].map((v) => die(v)), { label: "t", pool: 6 }, 6, 0, 0);
  assert.equal(r.hits, 2);
  assert.equal(r.glitch, false);
});

test("glitch needs MORE than half ones; crit needs zero hits", () => {
  const three = tally([1, 1, 1, 6, 5, 4].map((v) => die(v)), { label: "t", pool: 6 }, 6, 0, 0);
  assert.equal(three.glitch, false, "3 of 6 is exactly half, not a glitch");
  const four = tally([1, 1, 1, 1, 6, 5].map((v) => die(v)), { label: "t", pool: 6 }, 6, 0, 0);
  assert.equal(four.glitch, true);
  assert.equal(four.critGlitch, false);
  const crit = tally([1, 1, 1, 1, 3, 4].map((v) => die(v)), { label: "t", pool: 6 }, 6, 0, 0);
  assert.equal(crit.critGlitch, true);
});

test("2s count as glitches when the opponent spent 5 Edge", () => {
  const r = tally([2, 2, 2, 5].map((v) => die(v)), { label: "t", pool: 4, glitchOn2: true }, 4, 0, 0);
  assert.equal(r.glitch, true);
});

test("1s on exploded dice do not count toward glitches", () => {
  const dice = [die(6), die(1, true), die(1, true), die(1, true), die(3), die(4)];
  const r = tally(dice, { label: "t", pool: 5, explode: true }, 5, 0, 4);
  assert.equal(r.glitchDice, 0);
});

test("exploding roll with Edge adds dice and every 6 chains", () => {
  let sawExplosion = false;
  for (let i = 0; i < 2000 && !sawExplosion; i++) {
    const r = roll({ label: "t", pool: 10, explode: true }, 4);
    assert.equal(r.baseCount, 14);
    assert.ok(r.dice.length >= 14);
    if (r.dice.some((d) => d.exploded)) {
      sawExplosion = true;
      const sixes = r.dice.filter((d) => d.value === 6).length;
      assert.equal(r.dice.length, 14 + sixes, "each 6 spawns exactly one more die");
    }
  }
  assert.ok(sawExplosion);
});

test("hit and glitch frequencies match theory", () => {
  const N = 40000;
  let hits = 0;
  let glitches = 0;
  for (let i = 0; i < N; i++) {
    const r = roll({ label: "t", pool: 6 });
    hits += r.hits;
    if (r.glitch) glitches++;
  }
  assert.ok(Math.abs(hits / (N * 6) - 1 / 3) < 0.01, `hit rate ${hits / (N * 6)}`);
  assert.ok(Math.abs(glitches / N - glitchOdds(6)) < 0.01, `glitch rate ${glitches / N} vs ${glitchOdds(6)}`);
  assert.ok(Math.abs(hitOdds(1, 1) - 1 / 3) < 1e-9);
});

test("post-roll Edge boosts", () => {
  const base = tally([1, 2, 3, 4].map((v) => die(v)), { label: "t", pool: 4 }, 4, 0, 0);
  const bumped = applyPostBoost(base, "plusOne", 3);
  assert.equal(bumped.hits, 1);
  assert.equal(bumped.edgeSpent, 2);
  assert.equal(applyPostBoost(bumped, "autoHit").totalHits, 1, "only one Edge expenditure per action");
  const auto = applyPostBoost(base, "autoHit");
  assert.equal(auto.totalHits, 1);
  assert.equal(auto.edgeSpent, 3);
  const glitchy = tally([1, 1, 1, 5].map((v) => die(v)), { label: "t", pool: 4 }, 4, 0, 0);
  assert.equal(applyPostBoost(glitchy, "rerollFailed"), glitchy, "cannot reroll failed dice after a glitch");
});

test("opposed ties go to the active party; damage soak", () => {
  const a = tally([5, 5].map((v) => die(v)), { label: "a", pool: 2 }, 2, 0, 0);
  const b = tally([6, 6].map((v) => die(v)), { label: "b", pool: 2 }, 2, 0, 0);
  assert.equal(opposed(a, b).activeWins, true);
  // book example: DV 3P + 5 net hits = 8, soak 1 hit => 7 boxes
  assert.deepEqual(damageAfterSoak(3, 5, 1), { modified: 8, taken: 7 });
});

test("derived stats match the book's Face archetype (ork)", () => {
  const c = newCharacter();
  c.metatype = "ork";
  // B3 A5 R4 S3 W4 L3 I5 C5 (augmentation brackets excluded)
  const want = { body: 3, agility: 5, reaction: 4, strength: 3, willpower: 4, logic: 3, intuition: 5, charisma: 5 } as const;
  for (const [k, v] of Object.entries(want)) c.attrPts[k as keyof typeof want] = v - 1;
  const d = derive(c);
  assert.equal(d.condition.physical, 11, "8 + ceil(3/2) + Built Tough 1");
  assert.equal(d.condition.stun, 10, "8 + ceil(4/2)");
  assert.equal(d.initiative.rank, 9, "Reaction 4 + Intuition 5");
  assert.equal(d.composure, 9);
  assert.equal(d.liftCarry, 7);
  assert.equal(d.memory, 8);
  assert.equal(d.unarmedAR, 7);
  assert.equal(d.defenseRating, 3, "Body + no armor");
  assert.equal(d.condition.overflow, 6, "Body x 2");
});

test("wound modifiers: -1 per filled row of boxes on either monitor", () => {
  const c = newCharacter();
  c.attrPts.body = 2;
  c.damage = { physical: 7, stun: 3, overflow: 0 };
  const d = derive(c);
  assert.equal(d.woundRows.physical, 2);
  assert.equal(d.woundRows.stun, 1);
  assert.equal(d.woundPenalty, 3);
});

test("priority budget: Tom's elf mage (Magic A, Attributes B, Skills C, Metatype D, Resources E)", () => {
  const c = newCharacter();
  c.metatype = "elf";
  c.magicType = "full";
  c.priorities = { magic: "A", attributes: "B", skills: "C", metatype: "D", resources: "E" };
  const b = budget(c);
  assert.equal(b.attributes.total, 16);
  assert.equal(b.skills.total, 20);
  assert.equal(b.adjustment.total, 4);
  assert.equal(b.nuyen.total, 8000);
  assert.equal(derive(c).magic, 4);
  assert.equal(derive(c).slots.spells, 8, "Magic 4 x 2");
});

test("validation catches duplicate priorities and forbidden metatype", () => {
  const c = newCharacter();
  c.metatype = "human";
  c.priorities = { metatype: "A", attributes: "A", skills: "C", magic: "D", resources: "E" };
  const texts = validate(c).map((i) => i.text).join("\n");
  assert.match(texts, /only once/);
  assert.match(texts, /Human is not available at Priority A/);
});

test("essence loss drops Magic by whole points", () => {
  const c = newCharacter();
  c.magicType = "full";
  c.priorities.magic = "A";
  assert.equal(derive(c).magic, 4);
  c.essenceLoss = 0.7;
  assert.equal(derive(c).magic, 3);
  c.essenceLoss = 1.1;
  assert.equal(derive(c).magic, 2);
});
