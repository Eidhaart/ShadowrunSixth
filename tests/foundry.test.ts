/**
 * The Foundry export for shadowrun6-eden 4.x: same shape as an actor the system itself exports, only
 * values the system defines, and numbers that come out the same once the system works out its pools.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BUILT_IN_ITEMS, addToRunner } from "../src/lib/compendium/catalog";
import { newCharacter, normalizeCharacter, type Character } from "../src/lib/sr6/character";
import { derive } from "../src/lib/sr6/derive";
import { editExt, newVehicle } from "../src/lib/sr6/ext";
import { advance, withAdv } from "../src/lib/sr6/advance";
import { EDEN_SPECS } from "../src/data/eden";
import { edenSpec, runnerToEden } from "../src/lib/foundry";

const json = (f: string) => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8"));
const EMPTY = json("fvtt-empty-player.json");
const GEAR_TYPES: Record<string, string[]> = json("eden-gear-types.json");
const ITEM_TYPES = ["complexform", "contact", "critterpower", "spritepower", "echo", "gear", "lifestyle", "martialartstyle", "martialarttech", "metamagic", "quality", "sin", "skill", "adeptpower", "spell", "ritual", "focus"];
const item = (name: string) => { const i = BUILT_IN_ITEMS.find((x) => x.name === name); assert.ok(i, name); return i!; };

function loaded(): Character {
  const c = normalizeCharacter(json("ruhn-danaan.json"));
  c.skills.firearms = { pts: 2, kar: 0, spec: "Heavy Pistols" };
  c.skills.sorcery.spec = "Spellcasting";
  c.notes = "Owes Mama Zelda a favor.";
  c.damage = { physical: 2, stun: 1, overflow: 0 };
  c.qualities.push({ id: "first-impression", name: "First Impression", kind: "positive", karma: 12, level: 1, note: "Elven heir." });
  c.knowledge.push({ id: "k1", name: "Seattle gangs", kind: "knowledge" }, { id: "k2", name: "Sperethiel", kind: "language", native: true });
  c.contacts.push({ id: "ct1", name: "Mama Zelda", role: "Fixer", connection: 4, loyalty: 3, notes: "Redmond." });
  c.lifestyle = "low"; c.lifestyleMonths = 2;
  addToRunner(c, item("Weapon focus, Force 1"), { pay: false, onto: "g_katana01" });
  addToRunner(c, item("Armor jacket"), { pay: false });
  addToRunner(c, item("Cybereyes, rating 2"), { pay: false });
  addToRunner(c, item("Smartlink"), { pay: false });
  addToRunner(c, item("Fake SIN, rating 4"), { pay: false });
  addToRunner(c, item("Ares Predator VI"), { pay: false });
  addToRunner(c, item("Heavy Pistol rounds"), { pay: false });
  addToRunner(c, item("Hermes Ikon"), { pay: false });
  editExt(c, (e) => {
    e.foci[0].bonded = true; e.foci[0].active = true;
    e.spirits.push({ id: "s1", type: "air", force: 4, services: 2, bound: true, damage: 0, note: "" });
    const v = newVehicle("drone"); v.name = "Flying Eye"; e.vehicles.push(v);
  });
  c.karmaEarned = 20;
  advance(c, { k: "spell", name: "Fireball" }, "Learned Fireball", 5);
  return c;
}

/** Every key path in `a` (objects only, not arrays). */
function paths(a: unknown, pre = ""): string[] {
  if (!a || typeof a !== "object" || Array.isArray(a)) return [];
  return Object.entries(a as Record<string, unknown>).flatMap(([k, v]) => [`${pre}${k}`, ...paths(v, `${pre}${k}.`)]);
}

test("the actor has every field the system's own export has", () => {
  const { actor } = runnerToEden(loaded());
  const ours = new Set(paths((actor as { system: unknown }).system));
  const missing = paths(EMPTY.system).filter((p) => !ours.has(p));
  assert.deepEqual(missing, []);
  assert.equal((actor as { type: string }).type, "Player");
  // a weapon carries every field the system's own gear item has
  const gear = (actor as { items: { type: string; system: unknown }[] }).items.find((i) => i.type === "gear")!;
  const gp = new Set(paths(gear.system));
  assert.deepEqual(paths(EMPTY.items[0].system).filter((p) => !gp.has(p)), []);
});

test("only item types, gear types, subtypes and specializations the system defines", () => {
  const { actor } = runnerToEden(loaded());
  const a = actor as { items: { _id: string; name: string; type: string; system: Record<string, unknown> }[]; system: { skills: Record<string, { specialization: string; expertise: string }>; mortype: string; tradition: { attribute: string } } };
  for (const i of a.items) {
    assert.ok(ITEM_TYPES.includes(i.type), `${i.name}: ${i.type}`);
    assert.match(i._id, /^[A-Za-z0-9]{16}$/);
    if (i.type !== "gear") continue;
    const t = i.system.type as string, st = i.system.subtype as string;
    assert.ok(GEAR_TYPES[t], `${i.name}: type ${t}`);
    assert.ok(st === "" || GEAR_TYPES[t].includes(st), `${i.name}: ${t}/${st}`);
  }
  for (const [id, s] of Object.entries(a.system.skills)) {
    for (const v of [s.specialization, s.expertise]) if (v) assert.ok(EDEN_SPECS[id][v], `${id}: ${v}`);
  }
  assert.ok(["mundane", "magician", "mysticadept", "technomancer", "adept", "aspectedmagician"].includes(a.system.mortype));
  assert.ok(["bod", "log", "cha", "int"].includes(a.system.tradition.attribute));
});

test("attributes, monitors and pools come out the same once the system adds them up", () => {
  const c = loaded();
  const d = derive(withAdv(c));
  const s = (runnerToEden(c).actor as { system: any }).system; // eslint-disable-line @typescript-eslint/no-explicit-any
  // the system: pool = base + min(4, mod); monitor = 8 + round(attr / 2) + mod; initiative = REA + INT + mod
  const pool = (k: string) => s.attributes[k].base + Math.min(4, s.attributes[k].mod);
  assert.equal(pool("rea"), d.attrs.reaction);
  assert.equal(pool("agi"), d.attrs.agility);
  assert.equal(s.attributes.mag.base, d.magic);
  assert.equal(s.attributes.edg.max, d.edge);
  assert.equal(s.edge.max, d.edge);
  assert.equal(8 + Math.round(pool("bod") / 2) + s.physical.mod, d.condition.physical);
  assert.equal(8 + Math.round(pool("wil") / 2) + s.stun.mod, d.condition.stun);
  assert.equal(s.physical.dmg, 2);
  assert.equal(pool("rea") + pool("int") + s.initiative.physical.mod, d.initiative.rank);
  assert.equal(s.initiative.physical.dice, d.initiative.dice);
  const worn = runnerToEden(c).actor as { items: { type: string; system: { type: string; usedForPool: boolean; defense: number } }[] };
  const armor = worn.items.filter((i) => i.type === "gear" && i.system.type === "ARMOR" && i.system.usedForPool).reduce((n, i) => n + i.system.defense, 0);
  assert.equal(pool("bod") + armor + s.defenserating.physical.mod, d.defenseRating);
  assert.equal(s.skills.close_combat.points, 5);
  assert.equal(s.skills.firearms.specialization, "pistols_heavy");
  assert.equal(s.skills.sorcery.specialization, "spellcasting");
  assert.equal(s.mortype, "mysticadept");
  assert.equal(s.metatype, "elf");
  assert.equal(s.karma, 15);
  assert.equal(s.karma_total, 20);
});

test("spells, powers, foci, qualities, contacts, SINs and gear arrive as items", () => {
  const { actor, skipped } = runnerToEden(loaded());
  const items = (actor as { items: { name: string; type: string; system: Record<string, any> }[] }).items; // eslint-disable-line @typescript-eslint/no-explicit-any
  const by = (name: string, type: string) => { const i = items.find((x) => x.name === name && x.type === type); assert.ok(i, `${type} ${name}`); return i!; };
  assert.equal(by("Manabolt", "spell").system.category, "combat");
  assert.equal(by("Manabolt", "spell").system.combatSpellType, "spells_direct");
  by("Fireball", "spell");
  assert.equal(by("Improved Reflexes", "adeptpower").system.cost, 1);
  assert.equal(by("Weapon focus, Force 1", "focus").system.rating, 1);
  assert.equal(by("First Impression", "quality").system.category, "ADVANTAGE");
  assert.equal(by("Mama Zelda", "contact").system.rating, 4);
  assert.equal(by("Fake SIN, rating 4", "sin").system.quality, "SUPERFICIALLY_PLAUSIBLE");
  assert.equal(by("Low lifestyle", "lifestyle").system.paid, 2);
  assert.equal(by("Sperethiel", "skill").system.genesisID, "language");
  assert.equal(by("Seattle gangs", "skill").system.genesisID, "knowledge");
  const katana = by("Katana", "gear").system;
  assert.deepEqual([katana.type, katana.subtype, katana.skill, katana.skillSpec, katana.dmg, katana.stun], ["WEAPON_CLOSE_COMBAT", "BLADES", "close_combat", "blades", 4, false]);
  assert.deepEqual(katana.attackRating, [10, 0, 0, 0, 0]);
  const gun = by("Ares Predator VI", "gear").system;
  assert.deepEqual([gun.type, gun.subtype, gun.skillSpec, gun.modes.SA], ["WEAPON_FIREARMS", "PISTOLS_HEAVY", "pistols_heavy", true]);
  const jacket = by("Armor jacket", "gear").system;
  assert.deepEqual([jacket.type, jacket.defense, jacket.usedForPool], ["ARMOR", 4, true]);
  assert.deepEqual([by("Cybereyes, rating 2", "gear").system.subtype, by("Smartlink", "gear").system.type], ["CYBER_EYEWARE", "CYBERWARE"]);
  assert.equal(by("Hermes Ikon", "gear").system.subtype, "COMMLINK");
  assert.equal(by("Flying Eye", "gear").system.type, "DRONES");
  assert.ok(skipped.some((s) => /spirits/.test(s)));
  assert.match((actor as { system: { notes: string } }).system.notes, /Spirits: air Force 4/);
  // the SixthDeck build comes back whole
  const back = (actor as { flags: { sixthdeck: { character: Character } } }).flags.sixthdeck.character;
  assert.equal(back.alias, "Night");
  assert.ok(back.adv?.spells.includes("Fireball"));
});

test("specialization names map to the system's ids", () => {
  assert.equal(edenSpec("firearms", "Hold-Outs"), "holdouts");
  assert.equal(edenSpec("firearms", "Tasers"), "tasers");
  assert.equal(edenSpec("close_combat", "Unarmed Combat"), "unarmed");
  assert.equal(edenSpec("astral", "Emotional States"), "emotional_stress");
  assert.equal(edenSpec("cracking", "Electronic Warfare"), "");
});

test("a mundane runner and a technomancer export cleanly", () => {
  const m = newCharacter();
  const a = runnerToEden(m).actor as { type: string; system: { mortype: string } };
  assert.equal(a.system.mortype, "mundane");
  const t = newCharacter();
  t.priorities = { metatype: "E", attributes: "B", skills: "C", magic: "A", resources: "D" };
  t.magicType = "technomancer";
  t.complexForms = ["Cleaner"];
  const ta = runnerToEden(t).actor as { system: { mortype: string; attributes: { res: { base: number } } }; items: { type: string; name: string }[] };
  assert.equal(ta.system.mortype, "technomancer");
  assert.equal(ta.system.attributes.res.base, 4);
  assert.ok(ta.items.some((i) => i.type === "complexform" && i.name === "Cleaner"));
});
