import test from "node:test";
import assert from "node:assert/strict";
import { BUILT_IN_ITEMS, addToRunner } from "../src/lib/compendium/catalog";
import { newCharacter, type GearItem } from "../src/lib/sr6/character";
import { C6_BY_ID, c6For, c6Val, fitsIn, slotsOf } from "../src/lib/sr6/c6";
import { inSlot, loadoutIssues, putInSlot, slotRoom, slotsFor, weaponAR } from "../src/lib/sr6/loadout";
import { dropGear } from "../src/components/gear/Fittings";

const item = (name: string) => { const i = BUILT_IN_ITEMS.find((x) => x.name === name); assert.ok(i, `${name} is in the catalog`); return i!; };

test("Commlink 6 values: formulas and rating tables", () => {
  assert.equal(c6Val("$RATING*500", 3), 1500);
  assert.equal(c6Val({ tab: [1000, 4000, 6000, 10000, 16000] }, 3, [1, 2, 3, 4, 5]), 6000);
  assert.equal(c6Val("$RATING/3", 6), 2);
  assert.equal(c6Val("rm -rf", 1), null);
});

test("catalog items carry their Commlink 6 template", () => {
  assert.equal(item("Ares Predator VI").c6, "ares_predator_vi");
  assert.equal(item("Armor jacket").c6, "armor_jacket");
  assert.equal(c6For("Silencer/suppressor")?.id, "silencer");
});

test("a Predator VI arrives with its smartgun and variable ammo built in, and has top and barrel mounts", () => {
  const c = newCharacter();
  const res = addToRunner(c, item("Ares Predator VI"), { pay: false });
  assert.match(res.msg, /Comes with/);
  const gun = c.gear.find((g) => g.name === "Ares Predator VI")!;
  const kids = c.gear.filter((g) => g.inId === gun.id);
  assert.deepEqual(kids.map((k) => k.c6).sort(), ["smartgun_system", "variable_ammo"]);
  assert.ok(kids.every((k) => k.included && k.cost === 0));
  const hooks = slotsFor(gun).map((s) => s.hook);
  for (const h of ["TOP", "BARREL", "INTERNAL"]) assert.ok(hooks.includes(h), h);
  assert.ok(!hooks.includes("UNDER"), "a heavy pistol has no underbarrel mount");
  // removing the gun takes the built-in parts with it
  dropGear(c, gun.id);
  assert.equal(c.gear.length, 0);
});

test("a silencer goes on the barrel mount, and the mount then holds nothing else", () => {
  const c = newCharacter();
  addToRunner(c, item("Ares Predator VI"), { pay: false });
  const gun = c.gear.find((g) => g.name === "Ares Predator VI")!;
  const barrel = slotsFor(gun).find((s) => s.hook === "BARREL")!;
  const t = C6_BY_ID.get("silencer")!;
  const f = fitsIn(t, "BARREL")!;
  assert.equal(f.price, 500);
  const sil: GearItem = { id: "s1", name: "Silencer", category: "misc", cost: 500, qty: 1, c6: "silencer" };
  putInSlot(gun, sil, "BARREL", f.size);
  c.gear.push(sil);
  assert.equal(inSlot(c, gun, barrel).length, 1);
  assert.equal(slotRoom(c, gun, barrel, 0), false);
  assert.equal(sil.mount, "barrel");
  assert.deepEqual(loadoutIssues(c), []);
  // a laser sight fits the top mount and adds 1 to the Attack Ratings (the smartgun needs a smartlink)
  assert.ok(!fitsIn(C6_BY_ID.get("laser_sight")!, "BARREL"));
  const ls: GearItem = { id: "l1", name: "Laser sight", category: "misc", cost: 125, qty: 1, c6: "laser_sight" };
  putInSlot(gun, ls, "TOP", 0);
  c.gear.push(ls);
  assert.deepEqual(weaponAR(c, gun).ar.slice(0, 3), [11, 11, 9]);
});

test("a cybereye version costs more and takes Capacity in the eyes", () => {
  const f = fitsIn(C6_BY_ID.get("smartlink")!, "CYBEREYE_IMPLANT")!;
  assert.equal(f.price, 4000);
  assert.equal(f.size, 3);
  assert.equal(f.variant?.id, "cybereye");
  const eyes = slotsOf(C6_BY_ID.get("cybereye")!, 3);
  assert.equal(eyes[0].capacity, 8);
});

test("an armor jacket has 8 Capacity for armor modifications", () => {
  const c = newCharacter();
  addToRunner(c, item("Armor jacket"), { pay: false });
  const j = c.gear.find((g) => g.name === "Armor jacket")!;
  const s = slotsFor(j).find((x) => x.hook === "ARMOR")!;
  assert.equal(s.capacity, 8);
});
