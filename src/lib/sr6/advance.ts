/**
 * Character advancement: spending Karma after creation.
 *
 * Purchases are recorded in `c.adv` instead of being written into the build fields, so the Forge keeps
 * validating the original build while the sheet shows the advanced runner. `withAdv` folds the record
 * into a copy of the character for derive() and the sheet.
 *
 * Costs (Sixth World Core, Character Advancement):
 *   Attribute, Edge, Magic, Resonance: new rating × 5
 *   Active skill: new rating × 5 (a new skill at rank 1 costs 5)
 *   Specialization: 5. Expertise: 5. Knowledge skill or language: 3
 *   Spell, ritual, alchemical formula, complex form: 5
 *   Positive quality in play: listed cost × 2. Buying off a negative quality: its bonus × 2
 *   Power point for a mystic adept: 5
 *   Initiation or submersion: 10 + new grade (the book's submersion example, as errata'd, is 12 for grade 2)
 */
import { ATTRIBUTES, KARMA, METATYPES, SKILLS, SKILL_BY_ID, skillAvailable, type AttrKey } from "./data";
import type { Character, KnowledgeSkill, QualityPick } from "./character";
import { magicPriorityRating } from "./derive";

export type AdvOp =
  | { k: "award"; n: number; note?: string }
  | { k: "attr"; a: AttrKey }
  | { k: "edge" }
  | { k: "magic" }
  | { k: "skill"; id: string }
  | { k: "spec"; id: string; name: string }
  | { k: "expert"; id: string }
  | { k: "knowledge"; item: KnowledgeSkill }
  | { k: "quality"; q: QualityPick }
  | { k: "buyoff"; key: string; name: string }
  | { k: "spell"; name: string }
  | { k: "form"; name: string }
  | { k: "pp" }
  | { k: "initiate"; meta?: string };

export interface AdvLog { id: string; at: number; label: string; cost: number; op: AdvOp }

export interface Advancement {
  attr: Partial<Record<AttrKey, number>>;
  edge: number;
  magic: number;
  skills: Record<string, number>;
  specs: Record<string, string>;
  expert: Record<string, boolean>;
  knowledge: KnowledgeSkill[];
  qualities: QualityPick[];
  boughtOff: string[];
  spells: string[];
  forms: string[];
  pp: number;
  grade: number;
  metamagic: string[];
  log: AdvLog[];
}

export const ADV_COST = {
  rating: (next: number) => 5 * next,
  spec: 5,
  expert: 5,
  knowledge: 3,
  spell: 5,
  form: 5,
  pp: 5,
  qualityMult: 2,
  initiate: (grade: number) => 10 + grade,
} as const;

export function emptyAdv(): Advancement {
  return { attr: {}, edge: 0, magic: 0, skills: {}, specs: {}, expert: {}, knowledge: [], qualities: [], boughtOff: [], spells: [], forms: [], pp: 0, grade: 0, metamagic: [], log: [] };
}

export function getAdv(c: Character): Advancement {
  return { ...emptyAdv(), ...(c.adv ?? {}) };
}

export const qualityKey = (q: Pick<QualityPick, "name" | "note">) => `${q.name}|${q.note ?? ""}`;

/** A copy of the character with every advancement applied, for derive() and display. */
export function withAdv(c: Character): Character {
  if (!c.adv) return c;
  const a = getAdv(c);
  const x: Character = JSON.parse(JSON.stringify(c));
  for (const k of ATTRIBUTES) if (a.attr[k]) x.attrKar[k] = (x.attrKar[k] ?? 0) + (a.attr[k] ?? 0);
  x.karEdge += a.edge;
  x.karMagic += a.magic;
  for (const [id, n] of Object.entries(a.skills)) {
    const e = (x.skills[id] ??= { pts: 0, kar: 0 });
    e.kar += n;
  }
  for (const [id, name] of Object.entries(a.specs)) {
    const e = (x.skills[id] ??= { pts: 0, kar: 0 });
    if (!e.spec) { e.spec = name; e.specVia = "karma"; }
  }
  for (const id of Object.keys(a.expert)) if (x.skills[id]?.spec) x.skills[id].expert = true;
  x.knowledge = [...x.knowledge, ...a.knowledge];
  x.qualities = [...x.qualities.filter((q) => !a.boughtOff.includes(qualityKey(q))), ...a.qualities];
  x.spells = [...x.spells, ...a.spells.filter((s) => !x.spells.includes(s))];
  x.complexForms = [...x.complexForms, ...a.forms.filter((s) => !x.complexForms.includes(s))];
  x.extraPP = (x.extraPP ?? 0) + a.pp;
  x.initiateGrade = a.grade;
  x.metamagic = a.metamagic;
  return x;
}

// ───────────────────────── what can be bought ─────────────────────────

export interface Offer { cost: number; next: number; ok: boolean; why?: string }

function offer(cost: number, next: number, avail: number, cap: number | null, capWhy = "At maximum"): Offer {
  if (cap != null && next > cap) return { cost, next, ok: false, why: capWhy };
  if (avail < cost) return { cost, next, ok: false, why: `Needs ${cost} Karma` };
  return { cost, next, ok: true };
}

export const karmaAvailable = (c: Character) => c.karmaEarned - c.karmaSpent;

/** Natural rating (no augmentation bonuses) of an attribute on an advanced character. */
export function naturalAttr(m: Character, a: AttrKey): number {
  return 1 + (m.attrPts[a] ?? 0) + (m.attrKar[a] ?? 0) + (m.adjRacial[a] ?? 0);
}

export function attrMax(m: Character, a: AttrKey): number {
  const meta = METATYPES[m.metatype];
  const maxMod = m.qualities.reduce((s, q) => (q.note === a && q.effect?.maxMod ? s + q.effect.maxMod * q.level : s), 0);
  return Math.max(2, meta.ranges[a][1] + maxMod);
}

export function skillCap(m: Character, id: string): number {
  return m.qualities.some((q) => q.name.startsWith("Aptitude") && q.note === id) ? 10 : 9;
}

/** Offers for the simple rating raises, computed on the advanced character `m`. */
export function offers(m: Character) {
  const avail = karmaAvailable(m);
  const meta = METATYPES[m.metatype];
  const attr = Object.fromEntries(ATTRIBUTES.map((a) => {
    const cur = naturalAttr(m, a);
    return [a, { cur, ...offer(ADV_COST.rating(cur + 1), cur + 1, avail, attrMax(m, a), "At your metatype maximum") }];
  })) as Record<AttrKey, Offer & { cur: number }>;
  const edgeCur = 1 + m.adjEdge + m.karEdge - (m.edgeBurned ?? 0);
  const edge = { cur: edgeCur, ...offer(ADV_COST.rating(edgeCur + 1), edgeCur + 1, avail, meta.ranges.edge[1], "At your metatype maximum") };
  const special = m.magicType !== "mundane";
  const magicCur = special ? magicPriorityRating(m) + m.adjMagic + m.karMagic : 0;
  const grade = m.initiateGrade ?? 0;
  const magic = special ? { cur: magicCur, ...offer(ADV_COST.rating(magicCur + 1), magicCur + 1, avail, 6 + grade, grade ? `Maximum is 6 + grade ${grade}` : "Maximum is 6; initiate to raise it") } : null;
  const skill = (id: string) => {
    const e = m.skills[id];
    const cur = e ? e.pts + e.kar : 0;
    return { cur, ...offer(ADV_COST.rating(cur + 1), cur + 1, avail, skillCap(m, id), "At the skill maximum") };
  };
  const initiate = special ? offer(ADV_COST.initiate(grade + 1), grade + 1, avail, null) : null;
  return { avail, attr, edge, magic, skill, initiate, grade };
}

/** Skills the runner could learn from scratch. */
export function learnableSkills(m: Character) {
  return SKILLS.filter((s) => skillAvailable(s, m.magicType) && !((m.skills[s.id]?.pts ?? 0) + (m.skills[s.id]?.kar ?? 0)));
}

// ───────────────────────── buying and undoing ─────────────────────────

let seq = 0;
const logId = () => `adv${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Spend Karma on `raw` (the stored character). Returns an error message instead of changing anything
 *  when the purchase is not allowed. */
export function advance(raw: Character, op: AdvOp, label: string, cost: number, at = Date.now()): string | null {
  const a = getAdv(raw);
  if (op.k !== "award" && cost > karmaAvailable(raw)) return `That costs ${cost} Karma and you have ${karmaAvailable(raw)}.`;
  switch (op.k) {
    case "award": raw.karmaEarned += op.n; break;
    case "attr": a.attr[op.a] = (a.attr[op.a] ?? 0) + 1; break;
    case "edge": a.edge += 1; break;
    case "magic": a.magic += 1; break;
    case "skill": a.skills[op.id] = (a.skills[op.id] ?? 0) + 1; break;
    case "spec": a.specs[op.id] = op.name; break;
    case "expert": a.expert[op.id] = true; break;
    case "knowledge": a.knowledge.push(op.item); break;
    case "quality": a.qualities.push(op.q); break;
    case "buyoff": a.boughtOff.push(op.key); break;
    case "spell": a.spells.push(op.name); break;
    case "form": a.forms.push(op.name); break;
    case "pp": a.pp += 1; break;
    case "initiate": a.grade += 1; if (op.meta) a.metamagic.push(op.meta); break;
  }
  if (op.k !== "award") raw.karmaSpent += cost;
  a.log.push({ id: logId(), at, label, cost: op.k === "award" ? -op.n : cost, op });
  if (a.log.length > 300) a.log = a.log.slice(-300);
  raw.adv = a;
  return null;
}

/** Reverse the most recent entry and refund its Karma. */
export function undoLast(raw: Character): AdvLog | null {
  const a = getAdv(raw);
  const e = a.log.pop();
  if (!e) return null;
  const op = e.op;
  const dec = (rec: Record<string, number>, key: string) => { rec[key] = (rec[key] ?? 0) - 1; if (rec[key] <= 0) delete rec[key]; };
  switch (op.k) {
    case "award": raw.karmaEarned = Math.max(0, raw.karmaEarned - op.n); break;
    case "attr": dec(a.attr as Record<string, number>, op.a); break;
    case "edge": a.edge = Math.max(0, a.edge - 1); break;
    case "magic": a.magic = Math.max(0, a.magic - 1); break;
    case "skill": dec(a.skills, op.id); break;
    case "spec": delete a.specs[op.id]; break;
    case "expert": delete a.expert[op.id]; break;
    case "knowledge": a.knowledge = a.knowledge.filter((k) => k.id !== op.item.id); break;
    case "quality": { const i = a.qualities.lastIndexOf(a.qualities.find((q) => qualityKey(q) === qualityKey(op.q))!); if (i >= 0) a.qualities.splice(i, 1); break; }
    case "buyoff": a.boughtOff = a.boughtOff.filter((k) => k !== op.key); break;
    case "spell": a.spells = a.spells.filter((s) => s !== op.name); break;
    case "form": a.forms = a.forms.filter((s) => s !== op.name); break;
    case "pp": a.pp = Math.max(0, a.pp - 1); break;
    case "initiate": a.grade = Math.max(0, a.grade - 1); if (op.meta) a.metamagic.splice(a.metamagic.lastIndexOf(op.meta), 1); break;
  }
  if (op.k !== "award") raw.karmaSpent = Math.max(0, raw.karmaSpent - e.cost);
  raw.adv = a;
  return e;
}

/** Karma spent through advancement, for display. */
export function advSpent(c: Character): number {
  return getAdv(c).log.reduce((s, e) => s + (e.op.k === "award" ? 0 : e.cost), 0);
}

export const skillName = (id: string) => SKILL_BY_ID[id]?.name ?? id;
export { KARMA };
