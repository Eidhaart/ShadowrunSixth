/**
 * Everything a printed runner sheet shows, worked out once from the runner (with advancement applied).
 * The two layouts read the same data: Minimal prints it densely, Expanded adds the book's text and the
 * working behind each number. Nothing here is specific to one layout.
 */
import type { Rulebook } from "@/lib/rules/types";
import { advSpent, withAdv } from "./advance";
import { adeptPowerList, complexFormList, spellList, type BookEntry } from "./bookLists";
import type { Character, GearItem, QualityPick } from "./character";
import { ATTRIBUTES, ATTR_ABBR, ATTR_LABEL, LIFESTYLES, MAGIC_TYPE_LABEL, METATYPES, SKILL_BY_ID, traditionName, type AttrKey } from "./data";
import { derive, type Derived } from "./derive";
import { getExt, matrixStats, spiritBlock, spiritType, spriteBlock, spriteType, vehicleBoxes, vehicleStats, type MatrixStats } from "./ext";
import { weaponFocus } from "./foci";
import { hostOf, installedIn, weaponAR } from "./loadout";
import { parseQualities, type QualityDef } from "./qualities";
import { COMPLEX_FORMS, PROGRAMS, SPELL_BY_NAME, type SpellDef } from "./rules6";

export const RANGES = ["Close", "Near", "Medium", "Far", "Extreme"] as const;

export interface PrintWeapon {
  g: GearItem;
  skill: string;
  pool: number;
  /** "Close Combat 5 + Agility 4 + focus 1" */
  poolWhy: string;
  ar: (number | null)[];
  arWhy: string;
  extras: string[];
}

export interface PrintSpell { name: string; def?: SpellDef; book?: BookEntry; sustained: boolean }
export interface PrintPower { name: string; level?: number; cost: number; book?: BookEntry }
export interface PrintQuality { q: QualityPick; def?: QualityDef; target: string }

export interface PrintData {
  c: Character;
  d: Derived;
  who: string;
  subtitle: string;
  attrs: { key: AttrKey; label: string; abbr: string; value: number; natural: number; max: number }[];
  specials: { label: string; value: string; note?: string }[];
  derived: { label: string; value: string; why: string }[];
  skills: Derived["skills"];
  knowledge: { name: string; detail: string }[];
  qualities: PrintQuality[];
  weapons: PrintWeapon[];
  armor: GearItem[];
  augments: GearItem[];
  /** What is installed in a host: armor modifications, implants in cybereyes or a limb, enhancements. */
  kidsOf: (g: GearItem) => GearItem[];
  ammo: GearItem[];
  gear: { g: GearItem; host?: GearItem; kids: GearItem[] }[];
  identity: GearItem[];
  magic?: {
    type: string;
    tradition?: string;
    drain?: { pool: number; why: string };
    spells: PrintSpell[];
    powers: PrintPower[];
    pp?: { start: number; extra: number; spent: number; left: number; split?: string };
    foci: { name: string; kind: string; force: number; bonded: boolean; active: boolean; on?: string }[];
    spirits: { name: string; force: number; services: number; bound: boolean; damage: number; block?: ReturnType<typeof spiritBlock>; note: string }[];
    grade: number;
    metamagic: string[];
  };
  resonance?: {
    fade: { pool: number; why: string };
    forms: { name: string; fade?: number; dur?: string; note?: string; book?: BookEntry; sustained: boolean }[];
    sprites: { name: string; level: number; tasks: number; registered: boolean; damage: number; block?: ReturnType<typeof spriteBlock>; note: string }[];
    grade: number;
    echoes: string[];
  };
  matrix?: { m: MatrixStats; programs: { name: string; active: boolean; note: string }[]; mode: string };
  vehicles: { v: ReturnType<typeof getExt>["vehicles"][number]; s: ReturnType<typeof vehicleStats>; boxes: number }[];
  rcc?: string;
  contacts: Character["contacts"];
  money: { label: string; value: string }[];
  log: { label: string; cost: number; at: number }[];
  hasBook: boolean;
}

const sign = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`);
const byName = (list: BookEntry[], name: string) => list.find((e) => e.name.toLowerCase() === name.toLowerCase());
const isIdentity = (g: GearItem) => /\b(fake )?sin\b|licen[cs]e/i.test(g.name);

/** The short target of a quality pick: the skill or attribute it names, or a short note. */
export function qualityTarget(q: QualityPick): string {
  const n = q.note?.trim() ?? "";
  if (!n) return "";
  return SKILL_BY_ID[n]?.name ?? (ATTR_LABEL as Record<string, string>)[n] ?? (n.length <= 28 ? n : "");
}

export function printData(raw: Character, book: Rulebook | null): PrintData {
  const c = withAdv(raw);
  const d = derive(c);
  const e = getExt(c);
  const meta = METATYPES[c.metatype];
  const who = c.alias || c.name || "Runner";
  const awakened = c.magicType !== "mundane" && c.magicType !== "technomancer";
  const techno = c.magicType === "technomancer";

  const attrs = ATTRIBUTES.map((a) => ({ key: a, label: ATTR_LABEL[a], abbr: ATTR_ABBR[a], value: d.attrs[a], natural: d.natural[a], max: d.attrMax[a] }));
  const specials = [
    { label: "Edge", value: String(d.edge), note: `max ${d.edgeMax}${c.edgeBurned ? `, ${c.edgeBurned} burned` : ""}` },
    ...(awakened ? [{ label: "Magic", value: String(d.magic), note: c.magicType === "mystic" ? `${d.slots.mysticPP} of ${d.slots.mysticMagic} to powers` : undefined }] : []),
    ...(techno ? [{ label: "Resonance", value: String(d.resonance) }] : []),
    { label: "Essence", value: (+d.essence.toFixed(2)).toString(), note: d.essenceUsed ? `${+d.essenceUsed.toFixed(2)} used` : undefined },
  ];

  const m = matrixStats(c, d);
  const armorWorn = c.gear.filter((g) => g.category === "armor" && g.worn !== false && g.armor);
  const derived = [
    { label: "Initiative", value: `${d.initiative.rank} + ${d.initiative.dice}D6`, why: `Reaction ${d.attrs.reaction} + Intuition ${d.attrs.intuition}${d.initiative.rank !== d.attrs.reaction + d.attrs.intuition ? `, ${sign(d.initiative.rank - d.attrs.reaction - d.attrs.intuition)} from augmentations and qualities` : ""}` },
    ...(awakened ? [{ label: "Astral initiative", value: `${d.initiative.astralRank} + ${d.initiative.astralDice}D6`, why: `Logic ${d.attrs.logic} + Intuition ${d.attrs.intuition}` }] : []),
    ...(m.source !== "none" ? [{ label: "Matrix initiative", value: `${m.init.rank} + ${m.init.dice}D6`, why: `${e.mode === "ar" ? "AR" : e.mode === "cold" ? "cold-sim VR" : "hot-sim VR"} with ${m.name}` }] : []),
    { label: "Defense Rating", value: String(d.defenseRating), why: `Body ${d.attrs.body}${d.armor ? ` + armor ${d.armor}` : ""}${d.defenseRating - d.attrs.body - d.armor ? ` ${sign(d.defenseRating - d.attrs.body - d.armor)} other` : ""}` },
    { label: "Armor worn", value: String(d.armor), why: armorWorn.length ? armorWorn.map((g) => `${g.name} ${g.armor}`).join(", ") : "none" },
    { label: "Unarmed AR", value: String(d.unarmedAR), why: `Reaction + Strength${d.unarmedPhysical ? "; unarmed damage is Physical" : ""}` },
    { label: "Composure", value: String(d.composure), why: "Willpower + Charisma" },
    { label: "Judge Intentions", value: String(d.judgeIntentions), why: "Willpower + Intuition" },
    { label: "Memory", value: String(d.memory), why: "Logic + Intuition" },
    { label: "Lift / Carry", value: String(d.liftCarry), why: "Body + Willpower" },
    { label: "Movement", value: `${d.movement.walk} / ${d.movement.sprint} m`, why: "walk / sprint per turn" },
  ];

  const qdefs = parseQualities(book);
  const qualities = c.qualities.map((q) => ({ q, def: qdefs.find((x) => x.id === q.id), target: qualityTarget(q) }));

  const weapons: PrintWeapon[] = c.gear.filter((g) => g.category === "weapon").map((w) => {
    const sk = w.skill ?? "firearms";
    const def = SKILL_BY_ID[sk];
    const rank = c.skills[sk] ? c.skills[sk].pts + c.skills[sk].kar : 0;
    const attr = (def?.attr as AttrKey) ?? "agility";
    const wf = weaponFocus(c, w);
    const fit = weaponAR(c, w);
    const pool = Math.max(0, (def ? (rank > 0 ? rank : -1) : 0) + (d.attrs[attr] ?? 0) + (wf?.bonus ?? 0));
    const poolWhy = [def ? `${def.name} ${rank > 0 ? rank : "untrained −1"}` : "", `${ATTR_LABEL[attr] ?? attr} ${d.attrs[attr] ?? 0}`, wf?.bonus ? `focus +${wf.bonus}` : ""].filter(Boolean).join(" + ");
    const extras = [
      ...installedIn(c, w).filter((k) => k.fits !== "melee").map((k) => k.name),
      ...(w.smartgun ? ["smartgun built in"] : []),
      ...(wf ? [`weapon focus Force ${wf.force}${wf.bonus ? "" : ` (${wf.why})`}`] : []),
      ...(w.notes ? [w.notes] : []),
    ];
    return { g: w, skill: def?.name ?? sk, pool, poolWhy, ar: fit.ar, arWhy: fit.why, extras };
  });

  const armor = c.gear.filter((g) => g.category === "armor");
  const augments = c.gear.filter((g) => g.category === "cyberware" || g.category === "bioware");
  const ammo = c.gear.filter((g) => g.category === "ammo");
  const identity = c.gear.filter((g) => isIdentity(g) && !augments.includes(g));
  const placed = new Set([...weapons.map((w) => w.g.id), ...armor.map((g) => g.id), ...augments.map((g) => g.id), ...ammo.map((g) => g.id), ...identity.map((g) => g.id)]);
  // anything installed in a weapon, a piece of armor or an implant is listed with it
  const gear = c.gear
    .filter((g) => !placed.has(g.id))
    .filter((g) => !hostOf(c, g))
    .map((g) => ({ g, host: hostOf(c, g), kids: installedIn(c, g) }));

  let magic: PrintData["magic"];
  if (awakened) {
    const spellBook = spellList(book);
    const powerBook = adeptPowerList(book);
    const tradAttr = (c.tradition || "logic") as AttrKey;
    const caster = c.magicType !== "adept";
    magic = {
      type: MAGIC_TYPE_LABEL[c.magicType],
      tradition: caster ? `${traditionName(c)} (${ATTR_LABEL[tradAttr] ?? tradAttr})` : undefined,
      drain: caster ? { pool: d.attrs.willpower + (d.attrs[tradAttr] ?? 0), why: `Willpower ${d.attrs.willpower} + ${ATTR_LABEL[tradAttr] ?? tradAttr} ${d.attrs[tradAttr] ?? 0}` } : undefined,
      spells: c.spells.map((name) => ({ name, def: SPELL_BY_NAME[name.toLowerCase()], book: byName(spellBook, name), sustained: e.sustained.includes(name) })),
      powers: c.adeptPowers.map((p) => ({ name: p.name, level: p.level, cost: p.cost, book: byName(powerBook, p.name.replace(/\s*\(.*\)$/, "")) })),
      pp: c.magicType === "adept" || c.magicType === "mystic"
        ? { start: d.slots.ppStart, extra: d.slots.ppExtra, spent: d.slots.ppSpent, left: d.slots.ppLeft, split: c.magicType === "mystic" ? `${d.slots.mysticPP} of ${d.slots.mysticMagic} priority Magic to powers, ${d.slots.mysticMagic - d.slots.mysticPP} to spells` : undefined }
        : undefined,
      foci: e.foci.map((f) => {
        const item = c.gear.find((g) => g.id === f.gearId);
        const on = item?.inId ? c.gear.find((g) => g.id === item.inId)?.name : undefined;
        return { name: f.name, kind: f.kind, force: f.rating, bonded: f.bonded, active: f.active, on };
      }),
      spirits: e.spirits.map((s) => {
        const t = spiritType(s.type);
        return { name: `${t?.name ?? s.type} spirit`, force: s.force, services: s.services, bound: s.bound, damage: s.damage, block: t ? spiritBlock(t, s.force) : undefined, note: s.note };
      }),
      grade: c.initiateGrade ?? 0,
      metamagic: c.metamagic ?? [],
    };
  }

  let resonance: PrintData["resonance"];
  if (techno) {
    const formBook = complexFormList(book);
    resonance = {
      fade: { pool: d.attrs.willpower + d.attrs.logic, why: `Willpower ${d.attrs.willpower} + Logic ${d.attrs.logic}` },
      forms: c.complexForms.map((name) => {
        const f = COMPLEX_FORMS.find((x) => x.name.toLowerCase() === name.toLowerCase());
        return { name, fade: f?.fade, dur: f?.dur, note: f?.note, book: byName(formBook, name), sustained: e.sustained.includes(name) };
      }),
      sprites: e.sprites.map((s) => {
        const t = spriteType(s.type);
        return { name: `${t?.name ?? s.type} sprite`, level: s.level, tasks: s.tasks, registered: s.registered, damage: s.damage, block: t ? spriteBlock(t, s.level) : undefined, note: s.note };
      }),
      grade: c.initiateGrade ?? 0,
      echoes: c.metamagic ?? [],
    };
  }

  const matrix = m.source !== "none" || e.matrix.programs.length
    ? {
      m,
      programs: e.matrix.programs.map((p) => ({ name: p.name, active: p.active, note: p.note || PROGRAMS.find((x) => x.id === p.defId)?.note || "" })),
      mode: e.mode === "ar" ? "AR" : e.mode === "cold" ? "Cold-sim VR" : "Hot-sim VR",
    }
    : undefined;

  const vehicles = e.vehicles.map((v) => ({ v, s: vehicleStats(c, d, v), boxes: vehicleBoxes(v) }));
  const ls = LIFESTYLES.find((l) => l.id === c.lifestyle);
  const money = [
    { label: "Nuyen", value: `${c.nuyen.toLocaleString("en-US")}¥` },
    { label: "Lifestyle", value: `${ls?.name ?? c.lifestyle}${c.lifestyleMonths ? `, ${c.lifestyleMonths} ${c.lifestyleMonths === 1 ? "month" : "months"} paid` : ""}${ls?.cost ? ` (${ls.cost.toLocaleString("en-US")}¥ a month)` : ""}` },
    { label: "Karma", value: `${c.karmaEarned - c.karmaSpent} to spend`, },
    { label: "Karma earned / spent", value: `${c.karmaEarned} / ${c.karmaSpent}${advSpent(c) ? ` (${advSpent(c)} on advancement)` : ""}` },
  ];

  const subtitle = [c.alias && c.name ? c.name : "", meta.name, c.magicType !== "mundane" ? MAGIC_TYPE_LABEL[c.magicType] : "", c.archetype ?? ""].filter(Boolean).join(" · ");

  return {
    c, d, who, subtitle, attrs, specials, derived,
    skills: d.skills,
    knowledge: c.knowledge.map((k) => ({ name: k.name, detail: k.kind === "language" ? (k.native ? "native language" : `language, ${["", "basic", "specialist", "expert"][k.level ?? 1]}`) : "knowledge" })),
    qualities, weapons, armor, augments: augments.filter((g) => !hostOf(c, g)), ammo, gear, identity,
    kidsOf: (g) => installedIn(c, g),
    magic, resonance, matrix, vehicles,
    rcc: e.rcc ? `${e.rcc.name} (rating ${e.rcc.rating}, D/F ${e.rcc.d}/${e.rcc.f})` : undefined,
    contacts: c.contacts,
    money,
    log: (raw.adv?.log ?? []).map((l) => ({ label: l.label, cost: l.cost, at: l.at })),
    hasBook: !!book,
  };
}
