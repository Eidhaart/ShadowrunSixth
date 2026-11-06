import test from "node:test";
import assert from "node:assert/strict";
import { addToRunner } from "../src/lib/compendium/catalog";
import { COMMLINKS, CYBERDECKS, RCCS } from "../src/lib/sr6/rules6";
import core from "../src/data/gear-core.json";
import { newCharacter } from "../src/lib/sr6/character";

test("matrix hardware carries the core rulebook prices", () => {
  assert.equal(COMMLINKS.find((c) => c.name === "Erika Elite")?.cost, 2500);
  assert.equal(CYBERDECKS.find((c) => c.name === "Fairlight Excalibur")?.cost, 410600);
  assert.equal(RCCS.find((c) => c.name === "Ares Red Dog")?.cost, 95000);
  assert.ok([...COMMLINKS, ...CYBERDECKS, ...RCCS].every((x) => x.cost > 0 && x.avail > 0));
});

test("the raw list still has the priceless integrated parts the catalog folds away", () => {
  assert.ok((core as { cost: number | null; name: string }[]).some((i) => i.name === "Ares Alpha Grenade Launcher" && !i.cost));
});

test("buying a weapon brings its built-in parts", () => {
  const c = newCharacter();
  c.nuyen = 10000;
  const alpha = { id: "x", name: "Ares Alpha", cat: "weapons" as const, group: "Assault Rifle", cost: 3400, stats: [], source: "built-in" as const,
    gear: { name: "Ares Alpha", category: "weapon" as const, cost: 3400, qty: 1 }, parts: [{ name: "Ares Alpha: Grenade Launcher", category: "weapon" as const, cost: 0, qty: 1 }] };
  const r = addToRunner(c, alpha, { pay: true });
  assert.equal(r.ok, true);
  assert.equal(c.nuyen, 6600);
  assert.deepEqual(c.gear.map((g) => g.name), ["Ares Alpha", "Ares Alpha: Grenade Launcher"]);
});

import { ARMOR, BIOWARE, CYBERWARE, DRONES, VEHICLES } from "../src/data/core-gear";

test("core tables are complete and priced", () => {
  assert.equal(ARMOR.length, 13);
  assert.equal(VEHICLES.length, 30);
  assert.equal(DRONES.length, 21);
  assert.ok([...CYBERWARE, ...BIOWARE].every((r) => r.cost > 0 && r.avail));
  assert.ok([...VEHICLES, ...DRONES].every((v) => v[12] > 0));
});

test("buying a drone puts it on the Rigging tab", () => {
  const c = newCharacter();
  c.nuyen = 20000;
  const d = DRONES.find((x) => x[0] === "MCT-Nissan Roto-Drone")!;
  const item = { id: "drones-roto", name: d[0], cat: "drones" as const, group: d[1], cost: d[12], stats: [], source: "built-in" as const,
    gear: { name: d[0], category: "vehicle" as const, cost: d[12], qty: 1 },
    vehicle: { kind: "drone" as const, handlingOn: 3, handlingOff: 3, accel: 20, speedInterval: 30, topSpeed: 160, body: 5, armor: 6, pilot: 3, sensor: 2, seats: 0 } };
  const r = addToRunner(c, item, { pay: true });
  assert.equal(r.ok, true);
  assert.equal(c.ext?.vehicles?.[0]?.name, "MCT-Nissan Roto-Drone");
  assert.equal(c.ext?.vehicles?.[0]?.body, 5);
});

import { sectionFor } from "../src/lib/compendium/section";

test("library links go to the item's own section, not just its page", () => {
  const sec = (id: string, title: string, page: number, text = "") => ({ id, title, page, text, chapter: "Gear" });
  const sections = [sec("a", "Wheeled", 301, "the Pursuit V outruns everything"), sec("b", "Ares Venture", 299), sec("c", "Cyberlimbs", 289), sec("d", "Cyberjacks", 284), sec("e", "vehicles table", 301)];
  const it = (name: string, cat: string, group: string, page: number) => ({ name, cat, group, page }) as never;
  assert.equal(sectionFor(sections, it("Ares Venture", "vehicles", "VTOL/VSTOL", 301))?.id, "b");
  assert.equal(sectionFor(sections, it("Chrysler-Nissan Pursuit V", "drones", "Small drone", 301))?.id, "a");
  assert.equal(sectionFor(sections, it("Cyberarm, obvious", "cyberware", "Cyberlimb", 285))?.id, "c");
  assert.equal(sectionFor(sections, it("Cyberjack 3", "cyberware", "Headware", 285))?.id, "d");
});

import { BUILT_IN_ITEMS } from "../src/lib/compendium/catalog";
import { budget } from "../src/lib/sr6/derive";

test("fake SINs and licenses are bought by rating at book prices", () => {
  const sin = BUILT_IN_ITEMS.filter((i) => i.name.startsWith("Fake SIN, rating"));
  assert.deepEqual(sin.map((i) => i.cost), [2500, 5000, 7500, 10000, 12500, 15000]);
  assert.ok(sin.every((i) => i.avail === 4 && i.legal === "I"));
  const lic = BUILT_IN_ITEMS.find((i) => i.name === "Fake License, rating 4");
  assert.equal(lic?.cost, 800);
  assert.equal(BUILT_IN_ITEMS.find((i) => i.name === "Sensor Array, rating 3")?.cost, 3000);
  assert.equal(BUILT_IN_ITEMS.find((i) => i.name === "Cyberjack 4")?.legal, "L");
  assert.equal(BUILT_IN_ITEMS.find((i) => i.name === "Power focus, Force 2")?.avail, 5);
  assert.equal(BUILT_IN_ITEMS.find((i) => i.name === "Stealth Rope")?.legal, "I");
});

test("a SINner pays 10 percent more for their lifestyle", () => {
  const c = newCharacter();
  c.lifestyle = "middle";
  c.lifestyleMonths = 2;
  assert.equal(budget(c).nuyen.lifestyle, 10000);
  c.qualities.push({ id: "q", name: "SINner", kind: "negative", karma: 8, level: 1 } as never);
  assert.equal(budget(c).nuyen.lifestyle, 11000);
});

import { knowledgePoints, validate } from "../src/lib/sr6/derive";

test("language levels take knowledge points; the native language is free", () => {
  const c = newCharacter();
  c.knowledge = [
    { id: "a", name: "English", kind: "language", native: true },
    { id: "b", name: "Japanese", kind: "language", level: 3 },
    { id: "c", name: "Seattle gangs", kind: "knowledge" },
  ];
  assert.equal(knowledgePoints(c), 4);
  c.knowledge.push({ id: "d", name: "Sperethiel", kind: "language", native: true });
  assert.ok(validate(c).some((i) => /one language can be native/.test(i.text)));
});

test("spells past the free picks cost 5 Karma instead of being refused", () => {
  const c = newCharacter();
  c.priorities = { metatype: "E", attributes: "B", magic: "A", skills: "C", resources: "D" } as never;
  c.magicType = "full";
  const free = 8; // Magic 4 from Priority A, times two
  c.spells = Array.from({ length: free + 2 }, (_, i) => `Spell ${i}`);
  const b = budget(c);
  assert.equal(b.karma.cost.magic, 10);
  assert.ok(!validate(c).some((i) => /Too many spells/.test(i.text)));
});

import { withAdv } from "../src/lib/sr6/advance";
import { derive } from "../src/lib/sr6/derive";

test("initiation at creation costs 10 + grade per grade and raises the Magic ceiling", () => {
  const c = newCharacter();
  c.priorities = { metatype: "E", attributes: "B", magic: "A", skills: "C", resources: "D" } as never;
  c.magicType = "adept";
  c.startGrade = 2;
  c.startMeta = ["Power Point", "Centering"];
  const b = budget(c);
  assert.equal(b.karma.cost.initiation, 11 + 12);
  // Magic 4 from Priority A, plus one Power Point from grade 1
  assert.equal(derive(c).slots.powerPoints, 5);
  c.karMagic = 3; // Magic 7: allowed with grade 2 (6 + 2)
  assert.ok(!validate(c).some((i) => /cannot exceed/.test(i.text)));
  c.karMagic = 5; // Magic 9: over 6 + 2
  assert.ok(validate(c).some((i) => /cannot exceed 6 \+ grade 2/.test(i.text)));
  // after creation the sheet carries the grade forward
  assert.equal(withAdv(c).initiateGrade, 2);
  assert.deepEqual(withAdv(c).metamagic, ["Power Point", "Centering"]);
});

test("a mundane runner cannot initiate", () => {
  const c = newCharacter();
  c.startGrade = 1;
  assert.ok(validate(c).some((i) => /Only the Awakened/.test(i.text)));
});
