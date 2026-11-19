/**
 * Rules behind the page-by-page Forge: rituals share the spell allowance, the aspect decides who gets
 * spells and which magic skill is open, and every validation issue lands on a page.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { newCharacter, type Character } from "../src/lib/sr6/character";
import { changeMagicType, derive, validate } from "../src/lib/sr6/derive";
import { issuePage } from "../src/app/forge/wizard/nav";
import { metatypeSection, ritualList } from "../src/lib/sr6/bookLists";

function magician(type: Character["magicType"] = "full"): Character {
  const c = newCharacter();
  c.priorities = { metatype: "D", attributes: "C", magic: "B", skills: "A", resources: "E" };
  c.magicType = type;
  return c;
}

test("rituals count against the starting spell allowance", () => {
  const c = magician();
  const slots = derive(c).slots.spells;
  assert.equal(slots, 6, "full magician at B: Magic 3 × 2");
  c.spells = ["Manabolt", "Heal", "Armor", "Invisibility"];
  c.rituals = ["Ward", "Watcher"];
  assert.ok(!validate(c).some((i) => /spells and 2 rituals/.test(i.text)), "six known is exactly the allowance");
  c.rituals.push("Curse");
  const over = validate(c).find((i) => /4 spells and 3 rituals, but you start with 6/.test(i.text));
  assert.ok(over, "seven known is one too many");
  assert.equal(over!.level, "error");
});

test("leaving a casting type drops rituals with the spells", () => {
  const c = magician();
  c.spells = ["Manabolt"];
  c.rituals = ["Ward"];
  const lost = changeMagicType(c, "adept");
  assert.ok(lost.some((l) => /1 ritual/.test(l)));
  assert.deepEqual(c.rituals, []);
});

test("only sorcery-aspected magicians start with spells", () => {
  const c = magician("aspected");
  assert.equal(derive(c).slots.spells, 8, "no aspect yet: the allowance still shows (Magic 4 × 2)");
  c.aspect = "conjuring";
  assert.equal(derive(c).slots.spells, 0);
  c.aspect = "sorcery";
  assert.equal(derive(c).slots.spells, 8);
});

test("the aspect closes the other two magic skills", () => {
  const c = magician("aspected");
  c.aspect = "conjuring";
  c.skills.conjuring = { pts: 4, kar: 0 };
  assert.ok(!validate(c).some((i) => /aspect is conjuring/.test(i.text)));
  c.skills.sorcery = { pts: 1, kar: 0 };
  assert.ok(validate(c).some((i) => i.level === "error" && /aspect is conjuring/.test(i.text)));
  changeMagicType(c, "full");
  assert.equal(c.aspect, undefined, "the aspect goes with the type");
});

test("issues land on the page that fixes them", () => {
  const at = (where: string, text = "") => issuePage({ level: "error", where, text });
  assert.equal(at("Adjustment"), "attributes");
  assert.equal(at("Knowledge"), "skills");
  assert.equal(at("Magic", "7 spells, but you start with 6"), "spells");
  assert.equal(at("Magic", "Adept powers cost 4 PP"), "powers");
  assert.equal(at("Magic", "3 complex forms, but you start with 2"), "forms");
  assert.equal(at("Gear", "No SIN: without the SINner quality or a fake SIN you cannot rent"), "sins");
  assert.equal(at("Gear", "No lifestyle month is paid"), "lifestyle");
  assert.equal(at("Gear", "1,850¥ over budget: gear 9,850¥ and lifestyle 2,000¥ against 10,000¥."), "gear");
  assert.equal(at("Concept"), "name");
  // every issue a fresh build raises has a home
  for (const i of validate(magician())) if (i.where !== "Karma") assert.notEqual(issuePage(i), "review", `${i.where}: ${i.text}`);
});

const BOOK = "/home/claude/work/book.json";
test("rituals and metatype write-ups come from the mounted book", { skip: !existsSync(BOOK) && "no parsed rulebook on this machine" }, () => {
  const book = JSON.parse(readFileSync(BOOK, "utf8"));
  const names = ritualList(book).map((r) => r.name);
  assert.ok(names.includes("Ward") && names.includes("Watcher") && names.length >= 8);
  for (const m of ["human", "elf", "dwarf", "ork", "troll"]) assert.ok(metatypeSection(book, m), m);
});
