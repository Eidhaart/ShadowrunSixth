/**
 * The printable sheet: both layouts must carry every entry the runner has. Minimal may set things
 * tighter and swap book text for page references, but nothing the player entered can go missing.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BUILT_IN_ITEMS, addToRunner } from "../src/lib/compendium/catalog";
import { newCharacter, normalizeCharacter, type Character } from "../src/lib/sr6/character";
import { editExt, newVehicle } from "../src/lib/sr6/ext";
import { advance } from "../src/lib/sr6/advance";
import { printData } from "../src/lib/sr6/printData";
import { PrintSheet, type PrintMode } from "../src/app/runners/[id]/print/PrintSheet";

const item = (name: string) => { const i = BUILT_IN_ITEMS.find((x) => x.name === name); assert.ok(i, name); return i!; };
const text = (c: Character, mode: PrintMode, marks = false) =>
  renderToStaticMarkup(createElement(PrintSheet, { p: printData(c, null), mode, marks, paper: "a4" }))
    .replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");

function loadedMage(): Character {
  const c = normalizeCharacter(JSON.parse(readFileSync(new URL("./fixtures/ruhn-danaan.json", import.meta.url), "utf8")));
  c.background = "Raised in Tir Tairngire, left after the purge.";
  c.notes = "Owes Mama Zelda a favor.";
  c.player = "Marcin";
  c.statuses = ["Wet"];
  c.damage = { physical: 2, stun: 1, overflow: 0 };
  c.qualities.push(
    { id: "first-impression", name: "First Impression", kind: "positive", karma: 12, level: 1, note: "Elven heir: gains 2 Edge on first-meeting Social tests." },
    { id: "distinctive-style", name: "Distinctive Style", kind: "negative", karma: 6, level: 1 },
  );
  c.knowledge.push({ id: "k1", name: "Seattle gangs", kind: "knowledge" }, { id: "k2", name: "Sperethiel", kind: "language", native: true });
  c.contacts.push({ id: "ct1", name: "Mama Zelda", role: "Fixer", connection: 4, loyalty: 3, notes: "Redmond barrens." });
  addToRunner(c, item("Weapon focus, Force 1"), { pay: false, onto: "g_katana01" });
  addToRunner(c, item("Armor jacket"), { pay: false });
  addToRunner(c, item("Fire resistance, rating 2"), { pay: false });
  addToRunner(c, item("Cybereyes, rating 2"), { pay: false });
  addToRunner(c, item("Smartlink"), { pay: false });
  addToRunner(c, item("Fake SIN, rating 4"), { pay: false });
  addToRunner(c, item("Medkit, rating 3"), { pay: false });
  addToRunner(c, item("Heavy Pistol rounds"), { pay: false });
  addToRunner(c, item("Ares Predator VI"), { pay: false });
  addToRunner(c, item("Laser sight"), { pay: false });
  c.gear.find((g) => g.name === "Laser sight")!.inId = c.gear.find((g) => g.name === "Ares Predator VI")!.id;
  editExt(c, (e) => {
    e.foci[0].bonded = true; e.foci[0].active = true;
    e.spirits.push({ id: "s1", type: "air", force: 4, services: 2, bound: true, damage: 0, note: "Named Whisper." });
    e.sustained.push("Levitate");
    const v = newVehicle("drone"); v.name = "Flying Eye"; v.note = "Scout"; e.vehicles.push(v);
  });
  c.karmaEarned = 20;
  assert.equal(advance(c, { k: "spell", name: "Fireball" }, "Learned Fireball", 5), null);
  return c;
}

const MUST = [
  "Night", "Ruhn Danaan", "Marcin", "Raised in Tir Tairngire", "Owes Mama Zelda a favor.", "Wet",
  "Close Combat", "Sorcery", "Conjuring", "Athletics", "Perception", "Stealth", "Con",
  "Seattle gangs", "Sperethiel", "First Impression", "Distinctive Style", "Elven heir: gains 2 Edge",
  "Manabolt", "Stunbolt", "Heal", "Detect Enemies", "Improved Invisibility", "Levitate", "Fireball", "sustained",
  "Improved Reflexes", "Katana", "weapon focus Force 1", "Ares Predator VI", "Laser sight", "Heavy Pistol rounds",
  "Armor jacket", "Fire resistance, rating 2", "Cybereyes, rating 2", "Smartlink", "Fake SIN, rating 4", "Medkit, rating 3",
  "Weapon focus, Force 1", "Air spirit", "Named Whisper.", "Flying Eye", "Scout",
  "Mama Zelda", "Fixer", "4/3", "Redmond barrens.", "Learned Fireball",
  "Initiative", "Astral initiative", "Defense Rating", "Composure", "Judge Intentions", "Memory", "Lift / Carry", "Movement",
  "Physical", "Stun", "Overflow", "Edge", "Essence", "Drain resistance", "Magic split", "Power Points", "Nuyen", "Lifestyle", "Karma",
];

for (const mode of ["expanded", "minimal"] as PrintMode[]) {
  test(`${mode} sheet carries every entry`, () => {
    const t = text(loadedMage(), mode);
    const missing = MUST.filter((s) => !t.includes(s));
    assert.deepEqual(missing, []);
  });
}

test("spells learned in play are printed with the starting ones", () => {
  const p = printData(loadedMage(), null);
  assert.ok(p.magic!.spells.some((s) => s.name === "Fireball"));
  assert.equal(p.magic!.spells.length, 7);
});

test("expanded adds the working behind numbers; minimal keeps the numbers", () => {
  const c = loadedMage();
  const ex = text(c, "expanded");
  const min = text(c, "minimal");
  assert.match(ex, /Willpower \d+ \+ Logic \d+/);
  assert.match(ex, /pool Close Combat 5 \+ Agility \d+ \+ focus \+?1/);
  assert.ok(!/pool Close Combat 5 \+/.test(min));
  const d = printData(c, null).d;
  for (const s of [String(d.defenseRating), `${d.initiative.rank} + ${d.initiative.dice}D6`]) {
    assert.ok(ex.includes(s) && min.includes(s), s);
  }
});

test("current damage is shaded only when asked", () => {
  const c = loadedMage();
  const html = (marks: boolean) => renderToStaticMarkup(createElement(PrintSheet, { p: printData(c, null), mode: "minimal", marks, paper: "a4" }));
  assert.equal((html(false).match(/ps-box on/g) ?? []).length, 0);
  assert.ok((html(true).match(/ps-box on/g) ?? []).length >= 3);
});

test("a technomancer prints forms, sprites, fading and the Matrix", () => {
  const c = newCharacter();
  c.priorities = { metatype: "E", attributes: "B", skills: "C", magic: "A", resources: "D" };
  c.magicType = "technomancer";
  c.alias = "Static";
  c.complexForms = ["Cleaner", "Diffusion"];
  editExt(c, (e) => { e.sprites.push({ id: "sp1", type: "crack", level: 3, tasks: 2, registered: true, damage: 0, note: "Pip" }); });
  for (const mode of ["expanded", "minimal"] as PrintMode[]) {
    const t = text(c, mode);
    for (const s of ["Static", "Cleaner", "Diffusion", "Crack sprite", "Pip", "Fading resistance", "Matrix"]) assert.ok(t.includes(s), `${mode}: ${s}`);
  }
});

test("a mundane runner with nothing prints without errors", () => {
  const c = newCharacter();
  for (const mode of ["expanded", "minimal"] as PrintMode[]) assert.ok(text(c, mode).includes("Runner"));
});
