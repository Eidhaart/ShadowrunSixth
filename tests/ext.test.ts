import { test } from "node:test";
import assert from "node:assert/strict";
import { newCharacter } from "../src/lib/sr6/character";
import { derive } from "../src/lib/sr6/derive";
import {
  actionAdjust, arrange, arrangeBy, autoTmBonus, drainIsPhysical, drainValue, editExt, getExt, matrixStats, newVehicle, overwatchGain,
  programSlots, spellDamage, spiritBlock, spiritType, spriteBlock, spriteType, tmCap, vehicleBoxes, vehicleStats, findSpell, xid,
} from "../src/lib/sr6/ext";

const setup = () => {
  const c = newCharacter();
  editExt(c, (e) => {
    e.matrix.deck = { name: "Kitsune", rating: 4, a: 7, s: 6, slots: 8 };
    e.matrix.link = { kind: "cyberjack", name: "Cyberjack 4", rating: 4, d: 7, f: 6, slots: 0, dice: 2 };
  });
  return c;
};

test("arrange keeps the assignment a permutation", () => {
  let a = arrange([0, 1, 2, 3], 0, 3);
  assert.deepEqual(a, [3, 1, 2, 0]);
  assert.deepEqual([...a].sort(), [0, 1, 2, 3]);
  a = arrange(a, 2, 2);
  assert.deepEqual(a, [3, 1, 2, 0]);
});

test("presets put the best numbers where they matter", () => {
  const vals = [7, 6, 7, 6];
  const defender = arrangeBy(vals, [3, 2, 1, 0]); // firewall, DP, sleaze, attack
  assert.equal(vals[defender[3]], 7);
  assert.equal(vals[defender[0]], 6);
});

test("deck and cyberjack form the persona", () => {
  const c = setup();
  const d = derive(c);
  const m = matrixStats(c, d);
  assert.equal(m.source, "deck");
  assert.equal(m.rating, 4);
  assert.equal(m.boxes, 10); // 8 + ceil(4/2)
  assert.equal([m.attack, m.sleaze, m.dp, m.fw].join(), "7,6,7,6");
  assert.equal(m.attackRating, 13);
  assert.equal(m.defenseRating, 13);
});

test("initiative per interface mode, cyberjack adds VR dice", () => {
  const c = setup();
  const d = derive(c);
  editExt(c, (e) => { e.mode = "ar"; });
  assert.equal(matrixStats(c, d).init.rank, d.initiative.rank);
  editExt(c, (e) => { e.mode = "cold"; });
  let m = matrixStats(c, d);
  assert.equal(m.init.rank, d.attrs.intuition + m.dp);
  assert.equal(m.init.dice, 1 + 1 + 2);
  editExt(c, (e) => { e.mode = "hot"; });
  m = matrixStats(c, d);
  assert.equal(m.init.dice, 5); // capped at 5D6
});

test("programs change numbers and use slots", () => {
  const c = setup();
  editExt(c, (e) => {
    e.matrix.programs = [
      { id: "a", defId: "toolbox", name: "Toolbox", note: "", active: true },
      { id: "b", defId: "armor", name: "Armor", note: "", active: true },
      { id: "c", defId: "scrubber", name: "Signal Scrubber", note: "", active: true },
      { id: "d", defId: "vm", name: "Virtual Machine", note: "", active: true },
    ];
    e.noise = 3;
  });
  const m = matrixStats(c, derive(c));
  assert.equal(m.dp, 8); // Toolbox +1
  assert.equal(m.defenseRating, 8 + 6 + 2); // Armor +2
  assert.equal(m.noise, 1); // scrubber −2
  assert.deepEqual(programSlots(getExt(c).matrix), { cap: 10, used: 4 });
});

test("hacking actions linked to your lower of Attack and Sleaze take the difference as a penalty", () => {
  const c = setup();
  editExt(c, (e) => { e.matrix.assign = [1, 0, 2, 3]; }); // Attack 6, Sleaze 7
  const m = matrixStats(c, derive(c));
  assert.equal(actionAdjust({ linked: "attack" }, m, getExt(c)).adjust, -1);
  assert.equal(actionAdjust({ linked: "sleaze" }, m, getExt(c)).adjust, 0);
  editExt(c, (e) => { e.noise = 2; e.matrixDamage = 6; });
  const m2 = matrixStats(c, derive(c));
  assert.equal(actionAdjust({}, m2, getExt(c)).adjust, -2 - 2); // noise 2, 6 boxes = −2
});

test("technomancer living persona: mental attributes plus capped Resonance points", () => {
  const c = newCharacter();
  c.magicType = "technomancer";
  const d = derive(c);
  assert.equal(tmCap(5), 3);
  assert.equal(tmCap(9), 4);
  const bonus = autoTmBonus([5, 4, 6, 3], 6, [2, 0, 1, 3]);
  assert.equal(bonus[2], 3);
  assert.ok(bonus.reduce((a, b) => a + b, 0) <= 6);
  editExt(c, (e) => { e.tmBonus = [9, 9, 9, 9]; });
  const m = matrixStats(c, d);
  assert.equal(m.source, "persona");
  assert.equal(m.boxes, 0);
  assert.ok((m.tm?.spent ?? 0) <= d.resonance);
  assert.equal(m.init.rank, d.attrs.logic + d.attrs.intuition);
});

test("overwatch uses the defender's hits plus one for a hacking program", () => {
  assert.equal(overwatchGain(3, false), 3);
  assert.equal(overwatchGain(3, true), 4);
});

test("drain: amp up costs 2, area costs 1, physical above Magic", () => {
  assert.equal(drainValue(6, { amp: 1, area: 1 }), 9);
  assert.equal(drainValue(1, { amp: 0, area: 0 }), 1);
  assert.equal(drainIsPhysical(5, 4), true);
  assert.equal(drainIsPhysical(4, 4), false);
  assert.equal(spellDamage("indirect", 5, 2, 1), 3 + 2 + 1);
  assert.equal(spellDamage("direct", 5, 2, 1), 3);
  assert.equal(findSpell("fireball")?.dv, 6);
  assert.equal(findSpell("Increase Attribute (Body)")?.name, "Increase Attribute");
});

test("spirit and sprite stat blocks", () => {
  const air = spiritBlock(spiritType("air")!, 4);
  assert.deepEqual(air.attrs, [2, 7, 8, 1, 4, 4, 4, 4]);
  assert.equal(air.init, 12);
  assert.equal(air.defense, 2);
  assert.equal(air.boxes, 10);
  assert.equal(air.attackRating, 8);
  const data = spriteBlock(spriteType("data")!, 3);
  assert.equal(data.attack, 2);
  assert.equal(data.dp, 7);
  assert.equal(data.init, 6 + 4);
  assert.equal(data.boxes, 10);
});

test("rigging: handling, speed intervals, damage and ram", () => {
  const c = newCharacter();
  c.skills.piloting = { pts: 3, kar: 0, spec: "" } as never;
  const v = { ...newVehicle("vehicle"), body: 11, armor: 4, sensor: 2, handlingOn: 4, handlingOff: 5, speedInterval: 20, speed: 45 };
  assert.equal(vehicleBoxes(v), 14); // 11/2 up + 8
  let s = vehicleStats(c, derive(c), v);
  assert.equal(s.handling, 4);
  assert.equal(s.speedPenalty, 2);
  assert.equal(s.ramDamage, 6 + 2);
  assert.equal(s.attackRating, 3 + 2);
  assert.equal(s.defenseRating, 3 + 4);
  s = vehicleStats(c, derive(c), { ...v, damage: 7, offroad: true });
  assert.equal(s.handling, 5 + 2); // +1 per 3 boxes
  const drone = vehicleStats(c, derive(c), { ...newVehicle("drone"), pilot: 3, jumped: false });
  assert.equal(drone.pilotPool.base, 3);
  assert.equal(drone.autosofts, 2);
});

test("older saved shapes are upgraded", () => {
  const c = newCharacter();
  c.ext = { deck: { name: "Old", array: [1, 2, 3, 4] }, spirits: [{ id: "s", type: "Air", force: 3, services: 2, bound: false, note: "" }], sprites: [{ id: "x", type: "Courier", rating: 2, tasks: 2, note: "" }], vehicles: [{ id: "v", name: "Old", kind: "drone", handling: 4, speed: 3, accel: 3, body: 4, armor: 4, pilot: 3, sensor: 3, boxes: 0, damage: 0, note: "" }] } as never;
  const e = getExt(c);
  assert.equal(e.matrix.deck, null);
  assert.equal(e.spirits[0].type, "air");
  assert.equal(e.sprites[0].level, 2);
  assert.equal(e.vehicles[0].handlingOn, 4);
  assert.equal(e.vehicles[0].speed, 0);
  assert.ok(xid().length > 2);
});
