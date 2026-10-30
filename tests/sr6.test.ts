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

import { atLeast, opposedOdds, bruteRun, probeRun, sampleHits } from "../src/lib/academy/stats";

test("academy odds: pools of d6 with 5+6 as hits", () => {
  const o = opposedOdds(6, 6);
  assert.ok(Math.abs(o.win + o.tie + o.lose - 1) < 1e-9);
  assert.ok(Math.abs(o.win - o.lose) < 1e-9); // symmetric pools
  assert.ok(Math.abs(o.hitsYou - 2) < 1e-9);
  assert.ok(Math.abs(atLeast(1, 1) - 1 / 3) < 1e-9);
  assert.equal(atLeast(0, 1), 0);
  assert.equal(atLeast(5, 0), 1);
});

test("academy entry sims: a seeded run is deterministic and Probe avoids illegal Admin upkeep", () => {
  let s = 12345;
  const rng = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  assert.ok(sampleHits(30, rng) > 0);
  const p = { pool: 11, attack: 3, sleaze: 5, firewall: 4, willpower: 4, stay: 10 };
  let brute = 0, probe = 0;
  for (let i = 0; i < 400; i++) { brute += bruteRun(p, rng).os; probe += probeRun(p, rng).os; }
  assert.ok(brute / 400 > probe / 400, `brute ${brute / 400} should cost more OS than probe ${probe / 400} on a 10-round job`);
});

const probe = () => {
  const c = newCharacter();
  c.name = "Probe";
  c.priorities = { metatype: "D", attributes: "A", skills: "B", magic: "C", resources: "E" };
  return c;
};

test("augmentation does not count against the natural maximum, and adds at most +4", () => {
  const c = probe();
  c.magicType = "adept";
  c.attrPts.reaction = 5;
  c.adeptPowers.push({ name: "Improved Reflexes", cost: 1.5, level: 1, effect: { attr: { reaction: 1 }, initiativeDice: 1 } });
  const d = derive(c);
  assert.equal(d.natural.reaction, 6);
  assert.equal(d.attrs.reaction, 7);
  assert.ok(!validate(c).some((i) => /reaction is above/.test(i.text)));
  c.gear.push({ id: "g", name: "Big boost", category: "cyberware", cost: 0, qty: 1, effect: { attr: { reaction: 5 } } });
  assert.equal(derive(c).attrs.reaction, 10);
});

test("bonus Initiative Dice from different sources do not stack", () => {
  const c = probe();
  c.adeptPowers.push({ name: "Improved Reflexes", cost: 1.5, level: 1, effect: { initiativeDice: 1 } });
  c.gear.push({ id: "g", name: "Wired reflexes 2", category: "cyberware", cost: 0, qty: 1, effect: { initiativeDice: 2 } });
  assert.equal(derive(c).initiative.dice, 3);
});

test("mystic adepts split the priority Magic between Power Points and spells", () => {
  const c = probe();
  c.magicType = "mystic";
  c.adjMagic = 3;
  let d = derive(c);
  assert.equal(d.slots.powerPoints, 2, "Power Points come from the priority Magic, not adjustment points");
  assert.equal(d.slots.spells, 4);
  c.adeptPowers.push({ name: "Half point", cost: 0.5, level: 1 });
  d = derive(c);
  assert.equal(d.slots.spells, 2, "a part-spent point of Magic no longer buys spells");
});

test("Exotic Weapons takes its weapon as a free, required specialization", () => {
  const c = probe();
  c.skills["exotic-weapons"] = { pts: 2, kar: 0 };
  assert.ok(validate(c).some((i) => /name the weapon/.test(i.text)));
  c.skills["exotic-weapons"].spec = "Monofilament whip";
  assert.equal(budget(c).skills.spent, 2);
  assert.ok(!validate(c).some((i) => /name the weapon/.test(i.text)));
});

test("adepts need Astral Perception for the Astral skill; aspected magicians keep to one branch", () => {
  const c = probe();
  c.magicType = "adept";
  c.skills.astral = { pts: 1, kar: 0 };
  assert.ok(validate(c).some((i) => /Astral is not available/.test(i.text)));
  c.adeptPowers.push({ name: "Astral Perception", cost: 1, level: 1 });
  assert.ok(!validate(c).some((i) => /Astral is not available/.test(i.text)));

  const a = probe();
  a.magicType = "aspected";
  a.skills.sorcery = { pts: 2, kar: 0 };
  a.skills.conjuring = { pts: 1, kar: 0 };
  assert.ok(validate(a).some((i) => /aspected magician/.test(i.text)));
});

test("contacts draw on a free pool of Charisma x 6 points", () => {
  const c = probe();
  c.attrPts.charisma = 2; // Charisma 3: 18 points
  for (const id of ["a", "b", "c"]) c.contacts.push({ id, name: id, role: "fixer", connection: 3, loyalty: 3 });
  assert.deepEqual(budget(c).contacts, { total: 18, spent: 18, left: 0 });
  assert.ok(!validate(c).some((i) => i.where === "Contacts"));
  c.contacts.push({ id: "d", name: "d", role: "fence", connection: 1, loyalty: 1 });
  assert.ok(validate(c).some((i) => /Charisma x 6/.test(i.text)));
});

test("at creation a contact's Connection and Loyalty cannot exceed Charisma", () => {
  const c = probe();
  c.attrPts.charisma = 2; // Charisma 3
  c.contacts.push({ id: "a", name: "Fixer", role: "fixer", connection: 3, loyalty: 3 });
  assert.ok(!validate(c).some((i) => i.where === "Contacts"));
  c.contacts[0].connection = 4;
  assert.ok(validate(c).some((i) => /higher than your Charisma/.test(i.text)));
});

test("mystic adept Magic for the split is the priority rating less Essence loss", () => {
  const c = probe(); // Magic priority C: Magic 2
  c.magicType = "mystic";
  c.gear.push({ id: "g", name: "Cyberear", category: "cyberware", cost: 0, qty: 1, essence: 0.5 });
  assert.equal(derive(c).slots.powerPoints, 1);
  assert.equal(derive(c).slots.spells, 2);
});

test("the quality limit is on the net bonus: negatives minus positives", () => {
  const c = probe();
  c.qualities.push({ id: "n", name: "Bad", kind: "negative", karma: 30, level: 1 });
  c.qualities.push({ id: "p", name: "Good", kind: "positive", karma: 15, level: 1 });
  assert.equal(budget(c).karma.negativeBonus, 30, "net 15 is within the limit");
  c.qualities[1].karma = 5;
  assert.equal(budget(c).karma.negativeBonus, 25, "net is held to 20");
});

test("attribute points can raise a special racial attribute to its metatype maximum", () => {
  const c = probe();
  c.metatype = "troll";
  c.attrPts.body = 7; // Body 8 of 9
  assert.ok(!validate(c).some((i) => i.where === "Attributes" && /body/.test(i.text)));
});

test("astral initiative is Logic + Intuition + 2D6", () => {
  const c = probe();
  c.attrPts.logic = 3;
  c.attrPts.intuition = 2;
  const d = derive(c);
  assert.equal(d.initiative.astralRank, 7);
  assert.equal(d.initiative.astralDice, 2);
});
