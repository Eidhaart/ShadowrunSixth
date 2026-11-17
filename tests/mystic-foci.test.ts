/**
 * Mystic adept split, the creation spell limit, weapon foci and focus Karma, and the Ruhn Danaan import.
 * Rules: pp. 65-66 and 158 (mystic adepts), p. 68 (no new spells or forms at creation),
 * pp. 154-155 (foci and their limits), p. 295 (Magical Goods).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BUILT_IN_ITEMS, addToRunner } from "../src/lib/compendium/catalog";
import { newCharacter, normalizeCharacter, type Character } from "../src/lib/sr6/character";
import { budget, changeMagicType, derive, validate } from "../src/lib/sr6/derive";
import { getExt } from "../src/lib/sr6/ext";
import { toggleBond, weaponFocus, weaponFocusBonus } from "../src/lib/sr6/foci";
import { emptyAdv, withAdv } from "../src/lib/sr6/advance";
import { weaponsFor } from "../src/lib/vtt/runner";

const item = (name: string) => { const i = BUILT_IN_ITEMS.find((x) => x.name === name); assert.ok(i, name); return i!; };
const errors = (c: Character) => validate(c).filter((i) => i.level === "error").map((i) => i.text);
const loadRuhn = (): Character => normalizeCharacter(JSON.parse(readFileSync(new URL("./fixtures/ruhn-danaan.json", import.meta.url), "utf8")));

const mystic = (): Character => {
  const c = newCharacter();
  c.priorities = { metatype: "D", attributes: "B", skills: "C", magic: "A", resources: "E" };
  c.metatype = "elf";
  c.magicType = "mystic";
  c.adjMagic = 2;
  c.mysticPP = 1;
  return c;
};
const improvedReflexes = { name: "Improved Reflexes", cost: 1, level: 1, effect: { attr: { reaction: 1 }, initiativeDice: 1 } };

// ---- mystic adepts ---------------------------------------------------------------------------

test("mystic adept, Magic A raised to 6, one priority point to powers: 1 PP and 6 spells", () => {
  const c = mystic();
  let d = derive(c);
  assert.equal(d.magic, 6);
  assert.equal(d.slots.mysticMagic, 4, "the split uses the Priority table Magic");
  assert.equal(d.slots.powerPoints, 1);
  assert.equal(d.slots.spells, 6);
  c.adeptPowers.push({ ...improvedReflexes });
  d = derive(c);
  assert.equal(d.slots.ppSpent, 1);
  assert.equal(d.slots.ppLeft, 0);
  // points given to spellcasting cannot buy powers
  c.adeptPowers.push({ name: "Combat Sense", cost: 0.5, level: 1 });
  assert.ok(errors(c).some((t) => /cost 1.5 PP, but only 1 of your 4 priority Magic point goes to powers/.test(t)));
});

test("two priority points to powers: 2 PP and 4 spells; half-point powers make no extra points", () => {
  const c = mystic();
  c.mysticPP = 2;
  const d = derive(c);
  assert.equal(d.slots.powerPoints, 2);
  assert.equal(d.slots.spells, 4);
  c.adeptPowers.push({ name: "Half", cost: 0.5, level: 1 }, { name: "Quarter", cost: 0.25, level: 1 });
  assert.equal(derive(c).slots.ppLeft, 1.25);
  assert.equal(derive(c).slots.powerPoints, 2);
});

test("initiation Power Points are counted apart from the split", () => {
  const c = mystic();
  c.startGrade = 1;
  c.startMeta = ["Power Point"];
  const d = derive(c);
  assert.equal(d.slots.ppStart, 1);
  assert.equal(d.slots.ppExtra, 1);
  assert.equal(d.slots.powerPoints, 2);
  assert.equal(d.slots.spells, 6, "an initiation Power Point does not take spells away");
  // and one bought in play through the Advance tab
  const played = withAdv({ ...mystic(), stage: "complete", adv: { ...emptyAdv(), grade: 1, metamagic: ["Power Point"] } } as Character);
  assert.equal(derive(played).slots.ppExtra, 1);
  assert.equal(derive(played).slots.spells, 6);
});

// ---- starting spells -------------------------------------------------------------------------

test("spells over the starting allowance are an error, not bought with Karma; the list is left alone", () => {
  const c = mystic(); // 6 starting spells
  c.spells = ["A", "B", "C", "D", "E", "F", "G"];
  assert.equal(budget(c).karma.cost.magic, 0);
  assert.ok(errors(c).some((t) => /7 spells, but you start with 6/.test(t)));
  assert.equal(c.spells.length, 7);
});

test("technomancers: complex forms over the starting allowance are an error too", () => {
  const c = newCharacter();
  c.priorities = { metatype: "E", attributes: "B", skills: "C", magic: "A", resources: "D" };
  c.magicType = "technomancer";
  assert.equal(derive(c).slots.complexForms, 8);
  c.complexForms = Array.from({ length: 9 }, (_, i) => `Form ${i}`);
  assert.ok(errors(c).some((t) => /9 complex forms, but you start with 8/.test(t)));
});

test("spells learned in play are not held to the starting allowance", () => {
  const c: Character = { ...mystic(), stage: "complete", spells: ["A", "B", "C", "D", "E", "F"], adv: { ...emptyAdv(), spells: ["G", "H"] } } as Character;
  assert.ok(!errors(c).some((t) => /spells, but you start with/.test(t)), "the build itself is checked, not the learned spells");
  assert.equal(withAdv(c).spells.length, 8);
});

// ---- the Ruhn Danaan import ------------------------------------------------------------------

test("Ruhn Danaan imports with every allocation intact", () => {
  const c = loadRuhn();
  const d = derive(c);
  const b = budget(c);
  assert.equal(d.magic, 6);
  assert.equal(d.edge, 3);
  assert.equal(b.adjustment.left, 0);
  assert.equal(b.skills.left, 0);
  assert.equal(d.slots.spells, 6);
  assert.equal(c.mysticPP, 1, "the split is written down from the powers the file holds");
  assert.equal(d.slots.ppStart, 1);
  assert.equal(d.slots.ppSpent, 1);
  assert.equal(d.slots.ppLeft, 0);
  assert.ok(!errors(c).some((t) => /spells|Power|PP/.test(t)), errors(c).join(" | "));
});

test("picking the magic type a runner already has changes nothing (the Magic 4, 2/4, 5/20 bug)", () => {
  const c = loadRuhn();
  assert.deepEqual(changeMagicType(c, "mystic"), []);
  assert.equal(derive(c).magic, 6);
  assert.equal(budget(c).adjustment.left, 0);
  assert.equal(budget(c).skills.left, 0);
});

test("switching magic type keeps what still applies and reports the rest", () => {
  const c = loadRuhn();
  const lost = changeMagicType(c, "full");
  assert.deepEqual(lost, ["1 adept power"]);
  assert.equal(c.adjMagic, 2, "Magic stays Magic between awakened types");
  assert.equal(c.skills.sorcery.pts, 3);
  assert.equal(c.spells.length, 6);
  const back = loadRuhn();
  const toTech = changeMagicType(back, "technomancer");
  assert.ok(toTech.includes("2 adjustment points on Magic"));
  assert.ok(toTech.some((t) => /^Sorcery 3/.test(t)) && toTech.some((t) => /^Conjuring 2/.test(t)));
});

test("an export without the split, and older numeric strings, still load", () => {
  const raw = JSON.parse(readFileSync(new URL("./fixtures/ruhn-danaan.json", import.meta.url), "utf8"));
  raw.adjMagic = "2";
  delete raw.statuses;
  const c = normalizeCharacter(raw);
  assert.equal(c.adjMagic, 2);
  assert.deepEqual(c.statuses, []);
  assert.equal(derive(c).magic, 6);
});

// ---- weapon foci -----------------------------------------------------------------------------

const withKatanaFocus = (force = 1): Character => {
  const c = mystic();
  addToRunner(c, item("Katana"), { pay: false });
  const katana = c.gear.find((g) => g.name === "Katana")!;
  addToRunner(c, item(`Weapon focus, Force ${force}`), { pay: false, onto: katana.id });
  return c;
};

test("a Force 1 weapon focus on a katana: 7,000¥ on top of the katana, one focus record", () => {
  const c = withKatanaFocus();
  const katana = c.gear.find((g) => g.name === "Katana")!;
  const focusItem = c.gear.find((g) => g.name === "Weapon focus, Force 1")!;
  assert.equal(focusItem.inId, katana.id, "linked by id, not by name");
  assert.equal(budget(c).nuyen.gear, 350 + 7000);
  const foci = getExt(c).foci;
  assert.equal(foci.length, 1);
  assert.equal(foci[0].gearId, focusItem.id);
  assert.equal(katana.dv, "4P");
  assert.deepEqual(katana.ar, [10, null, null, null, null]);
});

test("bonding costs Force x 3 creation Karma, once", () => {
  const c = withKatanaFocus();
  const before = budget(c).karma.left;
  assert.equal(toggleBond(c, getExt(c).foci[0].id, derive(c).magic), "");
  assert.equal(budget(c).karma.cost.foci, 3);
  assert.equal(budget(c).karma.left, before - 3);
  assert.equal(c.karmaSpent, 0, "creation Karma is not earned Karma");
  const two = withKatanaFocus(2);
  toggleBond(two, getExt(two).foci[0].id, derive(two).magic);
  assert.equal(budget(two).karma.cost.foci, 6);
});

test("the bonus is exactly Force dice, only while bonded and active, only on its own weapon", () => {
  const c = withKatanaFocus();
  const katana = () => c.gear.find((g) => g.name === "Katana")!;
  const pool = () => weaponsFor(c).find((w) => w.name.startsWith("Katana"))!;
  const base = pool().pool;
  assert.equal(weaponFocusBonus(c, katana()), 0, "unbonded");
  toggleBond(c, getExt(c).foci[0].id, derive(c).magic);
  assert.equal(weaponFocusBonus(c, katana()), 0, "bonded but inactive");
  getExt(c).foci[0].active = true;
  assert.equal(weaponFocusBonus(c, katana()), 1);
  assert.equal(pool().pool, base + 1);
  assert.equal(pool().dv, 4);
  assert.deepEqual(pool().ar, [10, null, null, null, null], "Attack Rating is the katana's own");
  assert.match(weaponFocus(c, katana())!.why, /weapon focus Force 1/);
  getExt(c).foci[0].active = false;
  assert.equal(weaponFocusBonus(c, katana()), 0);
  getExt(c).foci[0].active = true;
  toggleBond(c, getExt(c).foci[0].id, derive(c).magic); // unbond
  assert.equal(weaponFocusBonus(c, katana()), 0);
  assert.equal(getExt(c).foci[0].active, false);
  // moved to another sword: the katana loses it
  toggleBond(c, getExt(c).foci[0].id, derive(c).magic);
  getExt(c).foci[0].active = true;
  addToRunner(c, item("Combat knife"), { pay: false });
  const knife = c.gear.find((g) => g.name === "Combat knife")!;
  c.gear.find((g) => g.name === "Weapon focus, Force 1")!.inId = knife.id;
  assert.equal(weaponFocusBonus(c, katana()), 0);
  assert.equal(weaponFocusBonus(c, knife), 1);
});

test("a ranged weapon cannot be a weapon focus", () => {
  const c = mystic();
  addToRunner(c, item("Ares Predator VI"), { pay: false });
  const gun = c.gear.find((g) => g.name === "Ares Predator VI")!;
  addToRunner(c, item("Weapon focus, Force 1"), { pay: false, onto: gun.id });
  assert.equal(c.gear.find((g) => g.name === "Weapon focus, Force 1")!.inId, undefined);
  assert.equal(weaponFocusBonus(c, gun), 0);
});

test("buying or bonding past the budget fails validation, with the reason", () => {
  const c = withKatanaFocus(2); // 350 + 14,000 against 8,000
  assert.ok(errors(c).some((t) => /over budget: gear 14,350¥/.test(t)));
  const high = withKatanaFocus(4); // Availability 7
  assert.ok(errors(high).some((t) => /Weapon focus, Force 4 has Availability 7; at creation nothing above 6/.test(t)));
  const k = withKatanaFocus();
  k.karmaToNuyen = budget(k).karma.left; // spend all creation Karma
  toggleBond(k, getExt(k).foci[0].id, derive(k).magic);
  assert.ok(errors(k).some((t) => /Karma over budget.*bonding foci 3/.test(t)));
});

test("in play, bonding takes earned Karma once and unbonding or deleting gives none back", () => {
  const c = { ...withKatanaFocus(), stage: "complete" as const, karmaEarned: 4, karmaSpent: 0 };
  const id = getExt(c).foci[0].id;
  assert.equal(toggleBond(c, id, derive(c).magic), "");
  assert.equal(c.karmaSpent, 3);
  assert.equal(budget(c).karma.cost.foci, 0, "not charged to creation as well");
  assert.equal(toggleBond(c, id, derive(c).magic), "");
  assert.equal(c.karmaSpent, 3, "no refund on unbonding");
  assert.match(toggleBond(c, id, derive(c).magic), /costs 3 Karma; you have 1/);
  assert.equal(getExt(c).foci[0].bonded, false);
});

test("bonding limits: count, Force and total Force against Magic", () => {
  const c = mystic(); // Magic 6
  addToRunner(c, item("Power focus, Force 6"), { pay: false });
  addToRunner(c, item("Spell focus, Force 6"), { pay: false });
  const ids = getExt(c).foci.map((f) => f.id);
  const magic = 2; // as if Magic were 2
  assert.match(toggleBond(c, ids[0], magic), /Force 6 is above your Magic \(2\)/);
  assert.equal(toggleBond(c, ids[0], 6), "");
  for (let i = 0; i < 4; i++) addToRunner(c, item("Spirit focus, Force 6"), { pay: false });
  const all = getExt(c).foci.map((f) => f.id);
  for (const id of all.slice(1, 5)) assert.equal(toggleBond(c, id, 6), "");
  assert.match(toggleBond(c, all[5], 6), /Bonded Force would be 36; the limit is Magic × 5 \(30\)/);
});

test("export and import keep the weapon focus on its weapon", () => {
  const c = withKatanaFocus();
  toggleBond(c, getExt(c).foci[0].id, derive(c).magic);
  getExt(c).foci[0].active = true;
  const back = normalizeCharacter(JSON.parse(JSON.stringify(c)));
  const katana = back.gear.find((g) => g.name === "Katana")!;
  assert.equal(weaponFocusBonus(back, katana), 1);
  assert.equal(weaponFocus(back, katana)!.item.inId, katana.id);
});

test("an old save's focus without a gear link is linked by name on load", () => {
  const c = withKatanaFocus();
  delete getExt(c).foci[0].gearId;
  const back = normalizeCharacter(JSON.parse(JSON.stringify(c)));
  assert.equal(getExt(back).foci[0].gearId, back.gear.find((g) => g.name === "Weapon focus, Force 1")!.id);
});

// ---- the other magic types ------------------------------------------------------------------

test("adepts, full and aspected magicians, technomancers and mundanes keep their pools", () => {
  const base = () => { const c = newCharacter(); c.priorities = { metatype: "E", attributes: "B", skills: "C", magic: "A", resources: "D" }; return c; };
  const adept = base(); adept.magicType = "adept"; adept.adjMagic = 0;
  assert.equal(derive(adept).slots.powerPoints, 4, "an adept's Power Points are their Magic");
  assert.equal(derive(adept).slots.spells, 0);
  const full = base(); full.magicType = "full";
  assert.equal(derive(full).slots.spells, 8);
  assert.equal(derive(full).slots.powerPoints, 0);
  const asp = base(); asp.magicType = "aspected";
  assert.equal(derive(asp).slots.spells, 10);
  const tm = base(); tm.magicType = "technomancer";
  assert.equal(derive(tm).slots.complexForms, 8);
  assert.equal(derive(tm).slots.powerPoints, 0);
  const mundane = base(); mundane.priorities.magic = "E"; mundane.magicType = "mundane";
  const d = derive(mundane);
  assert.equal(d.slots.spells + d.slots.complexForms + d.slots.powerPoints, 0);
  assert.equal(d.magic, 0);
});
