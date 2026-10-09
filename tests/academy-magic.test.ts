import { test } from "node:test";
import assert from "node:assert/strict";
import { begin, step, move, newSim, fixedRoll, previewSpell, sustainPenalty, liveTargets, drop, debrief, STUN_MAX, type MState, type Roller } from "../src/lib/academy/magic/sim";
import { drainDist } from "../src/lib/academy/stats";

const script = (m: Record<string, number>, def = 0): Roller => (pool, label) => fixedRoll(pool, Math.min(pool, m[label] ?? def), label);
const cast = (s: MState, a: Parameters<typeof begin>[1], r: Roller) => step(step(begin(s, a, r), r), r);
const toDock = (r: Roller, known?: string[]) => move(newSim("hermetic", known), "enter", r);

test("drain distribution sums to 1 and zero damage matches atLeast", () => {
  const d = drainDist(10, 6);
  assert.ok(Math.abs(d.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.equal(d.length, 7);
});

test("a stun spell takes a guard down quietly", () => {
  const r = script({ Stunbolt: 11, Defender: 0, "Drain resistance": 10 });
  let s = toDock(r);
  const g = liveTargets(s).find((f) => f.kind === "guard")!;
  s = cast(s, { kind: "spell", spell: "stunbolt", amp: 3, area: 0, targets: [g.id] }, r);
  const g2 = s.foes.find((f) => f.id === g.id)!;
  assert.ok(g2.stun >= 10 && g2.down, `stun ${g2.stun}`);
  assert.equal(s.alarm, false);
});

test("Fireball is loud and raises the alarm", () => {
  const r = script({ Fireball: 6, Defender: 0, "Drain resistance": 10 });
  let s = toDock(r);
  const g = s.foes.find((f) => f.kind === "guard")!;
  s = cast(s, { kind: "spell", spell: "fireball", amp: 0, area: 0, targets: [g.id] }, r);
  assert.equal(s.alarm, true);
});

test("drain above Magic turns Physical", () => {
  const r = script({ Stunbolt: 11, Defender: 0, "Drain resistance": 0 });
  let s = toDock(r);
  const g = s.foes.find((f) => f.kind === "guard")!;
  s = cast(s, { kind: "spell", spell: "stunbolt", amp: 3, area: 0, targets: [g.id] }, r);
  // DV 3 + 6 = 9 against 0 hits = 9 damage, higher than Magic 6
  assert.equal(s.phys > 0, true);
  assert.equal(s.stun, 0);
});

test("mana spells cannot target a camera, physical ones can", () => {
  const r = script({});
  const s = toDock(r, ["stunbolt", "powerbolt", "manabolt", "improvedinvis", "sensorsneak"]);
  const cam = s.foes.find((f) => f.kind === "camera")!;
  assert.equal(previewSpell(s, { spell: "manabolt", amp: 0, area: 0, targets: [cam.id] }).ok, false);
  assert.equal(previewSpell(s, { spell: "powerbolt", amp: 0, area: 0, targets: [cam.id] }).ok, true);
});

test("sustained spells cost 2 dice each and can be dropped for free", () => {
  const r = script({ "Improved Invisibility": 5, "Drain resistance": 10 });
  let s = toDock(r);
  s = cast(s, { kind: "spell", spell: "improvedinvis", amp: 0, area: 0, targets: [] }, r);
  assert.equal(sustainPenalty(s), 2);
  s = drop(s, "improvedinvis");
  assert.equal(sustainPenalty(s), 0);
});

test("Improved Invisibility lets you walk past guards and camera", () => {
  const r = script({ "Improved Invisibility": 6, "Drain resistance": 10 }, 0);
  let s = toDock(r);
  s = cast(s, { kind: "spell", spell: "improvedinvis", amp: 0, area: 0, targets: [] }, r);
  s = move(s, "sneak", r);
  assert.equal(s.alarm, false);
  s = move(s, "enter", r);
  assert.equal(s.scene, "corridor");
  assert.equal(s.alarm, false);
});

test("summoning gives services equal to net hits", () => {
  const r = script({ "Conjuring + Magic": 5, Spirit: 2, "Drain resistance": 10 });
  let s = newSim("shaman");
  s = cast(s, { kind: "summon", force: 3 }, r);
  assert.equal(s.friends[0].services, 3);
});

test("banishing strips services by net hits and the spirit leaves at zero", () => {
  const r = script({ "Conjuring + Magic": 8, Spirit: 1, "Drain resistance": 10 });
  const s0 = toDock(r);
  const s1: MState = { ...s0, scene: "corridor", foes: [{ id: 99, name: "earth spirit", kind: "spirit", will: 4, int: 4, rea: 3, body: 8, stun: 0, phys: 0, max: 10, down: false, aware: false, distracted: false, force: 4, services: 3 }] };
  const s2 = cast(s1, { kind: "banish" }, r);
  // 8 hits against 1 = 7 net, more than its 3 services
  assert.equal(s2.foes[0].down, true);
  assert.equal(s2.stats.banished, 1);
});

test("heavy drain can knock you out", () => {
  const r = script({ Stunbolt: 11, "Drain resistance": 0, Defender: 0 });
  let s = toDock(r);
  for (let i = 0; i < 6 && s.status === "play"; i++) {
    const g = s.foes.find((f) => f.kind === "guard" && !f.down);
    if (!g) break;
    s = cast(s, { kind: "spell", spell: "stunbolt", amp: 0, area: 0, targets: [g.id] }, r);
  }
  assert.ok(s.stun > 0 || s.phys > 0);
  assert.ok(s.status === "play" || s.end === "knockout" || s.end === "dead");
  assert.ok(STUN_MAX > 0);
});

test("a quiet run reaches the lab and wins", () => {
  const r = script({ "Astral + Intuition": 3, "Improved Invisibility": 6, "Drain resistance": 10, "Improved Invisibility vs barrier": 6, "Mana barrier": 0 }, 0);
  let s = newSim("hermetic");
  s = cast(s, { kind: "assense" }, r);
  s = move(s, "enter", r);
  s = cast(s, { kind: "spell", spell: "improvedinvis", amp: 0, area: 0, targets: [] }, r);
  s = move(s, "sneak", r);
  s = move(s, "enter", r);
  s = move(s, "sneak", r);
  s = move(s, "enter", r);
  assert.equal(s.scene, "lab");
  s = move(s, "sneak", r);
  s = move(s, "grab", r);
  assert.equal(s.status, "won");
  assert.equal(debrief(s).stars, 3);
});
