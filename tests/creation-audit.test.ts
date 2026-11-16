import test from "node:test";
import assert from "node:assert/strict";
import { BUILT_IN_ITEMS, addToRunner, findItem, withGrade } from "../src/lib/compendium/catalog";
import { newCharacter, type Character } from "../src/lib/sr6/character";
import { budget, derive, validate } from "../src/lib/sr6/derive";
import { editExt } from "../src/lib/sr6/ext";

const item = (name: string) => { const i = BUILT_IN_ITEMS.find((x) => x.name === name); assert.ok(i, `${name} is in the catalog`); return i!; };
const mage = (): Character => {
  const c = newCharacter();
  c.priorities = { metatype: "E", attributes: "B", skills: "C", magic: "A", resources: "D" };
  c.magicType = "full";
  return c;
};

test("the rest of the core gear tables are in the catalog with book prices", () => {
  assert.equal(item("Silencer/suppressor").cost, 500);
  assert.equal(item("Smartgun system, external").legal, "L");
  assert.equal(item("Fragmentation grenade").cost, 150);
  assert.equal(item("Medkit, rating 6").cost, 1500);
  assert.equal(item("Tranq patch, rating 4").cost, 160);
  assert.equal(item("Maglock passkey, rating 2").cost, 4000);
  assert.equal(item("Goggles, capacity 3").cost, 150);
  assert.equal(item("Autosoft, rating 4").avail, 4);
  assert.equal(item("Explosive package, rating 10").cost, 2500);
  assert.equal(item("Narcoject").cost, 50);
  const bow = item("Bow, rating 5");
  assert.equal(bow.dv, "3P");
  assert.deepEqual(bow.ar, [3, 5, 2, null, null]);
  assert.equal(bow.cost, 150);
});

test("special ammunition is the class price times the type's multiplier", () => {
  assert.equal(item("APDS rounds, Heavy Pistol").cost, 30);
  assert.equal(item("Gel rounds, Shotgun").cost, 22.5);
  assert.equal(item("Stick-n-Shock rounds, Light Pistol").cost, 10);
  assert.ok(!BUILT_IN_ITEMS.some((i) => /APDS rounds, (Taser|Dart|DMSO|Assault Cannon)/.test(i.name)));
});

test("every catalog item has its own id and name", () => {
  assert.equal(new Set(BUILT_IN_ITEMS.map((i) => i.id)).size, BUILT_IN_ITEMS.length);
  assert.equal(new Set(BUILT_IN_ITEMS.map((i) => i.name)).size, BUILT_IN_ITEMS.length);
});

test("implants change the sheet on their own", () => {
  const c = newCharacter();
  const base = derive(c);
  addToRunner(c, item("Wired reflexes, rating 2"), { pay: false });
  addToRunner(c, item("Muscle replacement, rating 1"), { pay: false });
  addToRunner(c, item("Dermal plating, rating 3"), { pay: false });
  const d = derive(c);
  assert.equal(d.attrs.reaction, base.attrs.reaction + 2);
  assert.equal(d.initiative.dice, 3);
  assert.equal(d.initiative.rank, base.initiative.rank + 2);
  assert.equal(d.attrs.strength, base.attrs.strength + 1);
  assert.equal(d.attrs.agility, base.attrs.agility + 1);
  assert.equal(d.defenseRating, base.defenseRating + 3);
  assert.equal(d.natural.reaction, base.natural.reaction, "the natural rating is untouched");
});

test("implants that do not combine are flagged, and so is Essence at zero", () => {
  const c = newCharacter();
  addToRunner(c, item("Wired reflexes, rating 1"), { pay: false });
  addToRunner(c, item("Reaction enhancers, rating 1"), { pay: false });
  assert.ok(validate(c).some((i) => /Wired reflexes do not work/.test(i.text)));
  addToRunner(c, item("Wired reflexes, rating 4"), { pay: false });
  addToRunner(c, item("Cyberarm, obvious"), { pay: false });
  assert.ok(validate(c).some((i) => /Essence cannot drop to 0/.test(i.text)));
});

test("implant grades follow the Implant Grades table", () => {
  const std = item("Wired reflexes, rating 1");
  const alpha = withGrade(std, "alphaware");
  assert.equal(alpha.essence, 0.8);
  assert.equal(alpha.cost, 48000);
  assert.equal(alpha.avail, 4);
  assert.equal(alpha.gear.essence, 0.8);
  assert.deepEqual(alpha.gear.effect, std.gear.effect);
  const used = withGrade(std, "used");
  assert.equal(used.essence, 1.1);
  assert.equal(used.cost, 20000);
  assert.equal(used.avail, 2);
  assert.equal(withGrade(item("Medkit, rating 1"), "alphaware").name, "Medkit, rating 1", "only implants have grades");
  assert.equal(findItem([...BUILT_IN_ITEMS], `${std.id}-deltaware`)?.essence, 0.5);
});

test("a bought focus lands on the Magic tab and bonding it costs creation Karma", () => {
  const c = mage();
  addToRunner(c, item("Power focus, Force 2"), { pay: false });
  assert.equal(c.ext?.foci.length, 1);
  assert.equal(budget(c).karma.cost.foci, 0, "unbonded foci are free");
  const before = budget(c).karma.left;
  editExt(c, (ex) => { ex.foci[0].bonded = true; });
  const b = budget(c);
  assert.equal(b.karma.cost.foci, 12);
  assert.equal(b.karma.left, before - 12);
  // a focus bonded in play was paid from earned Karma, not from the creation pool
  editExt(c, (ex) => { ex.foci[0].karma = 12; });
  assert.equal(budget(c).karma.cost.foci, 0);
});

test("bonding limits follow Magic", () => {
  const c = mage(); // Magic 4
  addToRunner(c, item("Spell focus, Force 5"), { pay: false });
  editExt(c, (ex) => { ex.foci[0].bonded = true; });
  assert.ok(validate(c).some((i) => /Force above your Magic/.test(i.text)));
  const m = newCharacter();
  addToRunner(m, item("Qi focus, Force 1"), { pay: false });
  editExt(m, (ex) => { ex.foci[0].bonded = true; });
  assert.ok(validate(m).some((i) => /Only the Awakened can bond foci/.test(i.text)));
});

test("a runner with gear and no SIN gets a warning, a fake SIN clears it", () => {
  const c = newCharacter();
  addToRunner(c, item("Ares Predator VI"), { pay: false });
  assert.ok(validate(c).some((i) => /^No SIN/.test(i.text)));
  addToRunner(c, item("Fake SIN, rating 4"), { pay: false });
  assert.ok(!validate(c).some((i) => /^No SIN/.test(i.text)));
});

test("a suprathyroid gland adds a quarter to lifestyle costs", () => {
  const c = newCharacter();
  c.lifestyle = "middle"; c.lifestyleMonths = 1;
  assert.equal(budget(c).nuyen.lifestyle, 5000);
  addToRunner(c, item("Suprathyroid gland"), { pay: false });
  assert.equal(budget(c).nuyen.lifestyle, 6250);
});

// ---- what is installed in what -------------------------------------------------------------

import { capacityUsed, essenceOf, hostOf, loadoutIssues, weaponAR } from "../src/lib/sr6/loadout";
import { gradeChoices } from "../src/lib/sr6/data";

const gearNamed = (c: Character, name: string) => { const g = c.gear.find((x) => x.name === name); assert.ok(g, `${name} is on the runner`); return g!; };

test("an implant bought for cybereyes goes into them and costs Capacity, not Essence", () => {
  const c = newCharacter();
  addToRunner(c, item("Cybereyes, rating 2"), { pay: false }); // Capacity 4
  const res = addToRunner(c, item("Smartlink"), { pay: false }); // [3]
  assert.match(res.msg, /Installed in the Cybereyes, rating 2/);
  const eyes = gearNamed(c, "Cybereyes, rating 2"), link = gearNamed(c, "Smartlink");
  assert.equal(hostOf(c, link), eyes);
  assert.equal(capacityUsed(c, eyes), 3);
  assert.equal(essenceOf(c, link), 0);
  assert.equal(derive(c).essence, 5.8, "only the eyes cost Essence");
  // a second enhancement no longer fits: it stays out and the player decides
  addToRunner(c, item("Thermographic vision"), { pay: false }); // [2]
  const thermo = gearNamed(c, "Thermographic vision");
  assert.equal(thermo.inId, undefined);
  assert.equal(derive(c).essence, 5.7, "implanted on its own it costs its Essence");
  thermo.inId = eyes.id;
  assert.ok(validate(c).some((i) => /Cybereyes, rating 2: modifications use 5 Capacity and it has 4/.test(i.text)));
});

test("cyberlimb accessories need a limb, and limb armor adds to Defense Rating", () => {
  const c = newCharacter();
  const base = derive(c);
  addToRunner(c, item("Cyberlimb armor, rating 2"), { pay: false });
  assert.ok(loadoutIssues(c).some((i) => /Cyberlimb armor, rating 2 is not installed/.test(i.text)));
  addToRunner(c, item("Cyberarm, obvious"), { pay: false }); // Capacity 15
  gearNamed(c, "Cyberlimb armor, rating 2").inId = gearNamed(c, "Cyberarm, obvious").id;
  assert.equal(loadoutIssues(c).length, 0);
  const d = derive(c);
  assert.equal(d.defenseRating, base.defenseRating + 2);
  assert.equal(d.condition.physical, base.condition.physical + 1, "each cyberlimb adds a Physical box");
});

test("armor modifications use the armor's Capacity", () => {
  const c = newCharacter();
  addToRunner(c, item("Armor jacket"), { pay: false }); // Capacity 8
  addToRunner(c, item("Fire resistance, rating 4"), { pay: false });
  addToRunner(c, item("Chemical seal"), { pay: false }); // [6]
  const jacket = gearNamed(c, "Armor jacket");
  assert.equal(gearNamed(c, "Fire resistance, rating 4").inId, jacket.id);
  assert.equal(gearNamed(c, "Chemical seal").inId, undefined, "4 + 6 is more than 8");
  assert.equal(capacityUsed(c, jacket), 4);
});

test("a smartgun read through a smartlink adds 2 to Attack Ratings; a laser sight adds 1 and does not stack", () => {
  const c = newCharacter();
  addToRunner(c, item("Colt America L36"), { pay: false });
  const gun = gearNamed(c, "Colt America L36");
  const plain = weaponAR(c, gun).ar;
  addToRunner(c, item("Laser sight"), { pay: false });
  gearNamed(c, "Laser sight").inId = gun.id;
  assert.deepEqual(weaponAR(c, gun).ar, plain.map((v) => (v == null ? null : v + 1)));
  addToRunner(c, item("Smartgun system, external"), { pay: false });
  gearNamed(c, "Smartgun system, external").inId = gun.id;
  assert.equal(weaponAR(c, gun).bonus, 1, "no smartlink yet: the laser sight still counts");
  addToRunner(c, item("Smartlink"), { pay: false });
  assert.deepEqual(weaponAR(c, gun).ar, plain.map((v) => (v == null ? null : v + 2)));
  // both want the top or underbarrel mount: that is fine, a third one is not
  assert.equal(loadoutIssues(c).filter((i) => i.level === "error").length, 0);
  addToRunner(c, item("Bipod"), { pay: false });
  gearNamed(c, "Bipod").inId = gun.id;
  assert.ok(loadoutIssues(c).some((i) => /top and underbarrel mounts hold one accessory each/.test(i.text)));
});

test("a weapon with a built-in smartgun needs only the smartlink", () => {
  const c = newCharacter();
  addToRunner(c, item("Ares Predator VI"), { pay: false });
  const gun = gearNamed(c, "Ares Predator VI");
  assert.equal(gun.smartgun, true);
  assert.equal(weaponAR(c, gun).bonus, 0);
  addToRunner(c, item("Smartlink (device)"), { pay: false });
  assert.equal(weaponAR(c, gun).bonus, 2);
});

test("restricted gear without a license is flagged", () => {
  const c = newCharacter();
  addToRunner(c, item("Ares Predator VI"), { pay: false });
  assert.equal(gearNamed(c, "Ares Predator VI").legal, "L");
  assert.ok(validate(c).some((i) => /Ares Predator VI needs a license/.test(i.text)));
  addToRunner(c, item("Fake License, rating 4"), { pay: false });
  assert.ok(!validate(c).some((i) => /needs? a license/.test(i.text)));
});

test("missiles, the MapMaster drone and grade choices come from the book", () => {
  assert.equal(item("Fragmentation missile, rating 3").cost, 3500);
  assert.equal(item("Fragmentation missile, rating 3").avail, 6);
  assert.equal(item("Horizon MapMaster drone").cost, 3500);
  assert.equal(item("Cyberlimb hydraulic jacks, rating 3").cost, 7500);
  assert.ok(gradeChoices("technomancer").includes("Overclocking"));
  assert.ok(gradeChoices("full").includes("Centering") && !gradeChoices("full").includes("Adept Centering"));
  assert.ok(gradeChoices("adept").includes("Adept Centering"));
});
