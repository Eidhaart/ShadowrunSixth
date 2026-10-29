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
