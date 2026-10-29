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
