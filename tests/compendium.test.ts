import test from "node:test";
import assert from "node:assert/strict";
import { strToU8, zipSync } from "fflate";
import { readXlsx } from "../src/lib/compendium/xlsx";
import { normalize } from "../src/lib/compendium/normalize";
import { addToRunner } from "../src/lib/compendium/catalog";
import { newCharacter } from "../src/lib/sr6/character";
import core from "../src/data/gear-core.json";

const cell = (ref: string, v: string | number) => (typeof v === "number" ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${v}</t></is></c>`);
function workbook(rows: (string | number)[][]) {
  const cols = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const xml = rows.map((r, i) => `<row r="${i + 1}">${r.map((v, j) => cell(`${cols[j]}${i + 1}`, v)).join("")}</row>`).join("");
  return zipSync({
    "xl/workbook.xml": strToU8(`<workbook><sheets><sheet name="Melee" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(`<worksheet><sheetData>${xml}</sheetData></worksheet>`),
  });
}

test("reads a weapon table into compendium items", () => {
  const H = ["N", "Weapon", "Smartgun", "Cost", "Type", "Skill", "DV", "Damage Type", "Eletrical", "Cold", "Chemical", "Fire", "Damage String", "AR Close", "AR Near", "AR Medium", "AR Far", "AR Extreme", "Attack Rating String", "Availability", "Legality", "Avaibility String", "Book", "Page", "Wireless Bonus", "Note"];
  const row = [1, "Katana", "", 1000, "Blade", "Close Combat", 4, "(P) Physical", "", "", "", "", "4 P", 10, "", "", "", "", "10/-/-/-/-", 4, "License", "4(L)", "[Core] (SWC) Sixth World Core Rulebook", 247, "", "Sharp"];
  const items = normalize(readXlsx(workbook([["Melee"], H, row, [2, "Empty template row"]])));
  assert.equal(items.length, 1);
  const k = items[0];
  assert.equal(k.name, "Katana");
  assert.equal(k.gear.dv, "4P");
  assert.deepEqual(k.gear.ar, [10, null, null, null, null]);
  assert.equal(k.gear.skill, "close-combat");
  assert.equal(k.avail, 4);
  assert.equal(k.legal, "L");
  assert.equal(k.book, "Core");
  assert.equal(k.note, "Sharp");
});

test("bundled list carries stats but no book text", () => {
  const items = core as unknown as { name: string; wireless?: string; note?: string; cat: string }[];
  assert.ok(items.length > 150);
  assert.ok(items.every((i) => !i.wireless && !i.note));
  assert.ok(items.some((i) => i.cat === "augmentations"));
});

test("adding to a runner pays, stacks and refuses what they cannot afford", () => {
  const c = newCharacter();
  c.nuyen = 1000;
  const ammo = { id: "x", name: "Rifle rounds", cat: "ammo" as const, group: "Ammo", cost: 20, stats: [], source: "built-in" as const, gear: { name: "Rifle rounds", category: "ammo" as const, cost: 20, qty: 1 } };
  assert.equal(addToRunner(c, ammo, { pay: true, qty: 3 }).ok, true);
  addToRunner(c, ammo, { pay: true });
  assert.equal(c.gear.length, 1);
  assert.equal(c.gear[0].qty, 4);
  assert.equal(c.nuyen, 920);
  const big = { ...ammo, id: "y", name: "Jet", cost: 5000, gear: { ...ammo.gear, name: "Jet", cost: 5000 } };
  assert.equal(addToRunner(c, big, { pay: true }).ok, false);
  assert.equal(c.nuyen, 920);
});
