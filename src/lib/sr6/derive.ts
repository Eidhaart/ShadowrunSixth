import type { Character, QualityEffect } from "./character";
import {
  ATTRIBUTES,
  KARMA,
  LIFESTYLES,
  METATYPES,
  PRIORITY_TABLE,
  SKILL_BY_ID,
  SKILLS,
  specialRacialAttrs,
  type AttrKey,
  type MagicType,
  type MetatypeId,
} from "./data";

export interface SkillPool {
  id: string;
  name: string;
  rank: number;
  attr: string;
  attrValue: number;
  spec?: string;
  /** Base pool without situational modifiers */
  pool: number;
  /** Pool when rolling with the specialization */
  specPool?: number;
}

export interface Derived {
  attrs: Record<AttrKey, number>;
  attrMax: Record<AttrKey, number>;
  edge: number;
  edgeMax: number;
  magic: number;
  resonance: number;
  essence: number;
  essenceUsed: number;
  magicPriorityRating: number;
  initiative: { rank: number; dice: number; astralRank: number; astralDice: number };
  condition: { physical: number; stun: number; overflow: number };
  woundRows: { physical: number; stun: number };
  woundPenalty: number;
  defenseRating: number;
  armor: number;
  unarmedAR: number;
  composure: number;
  judgeIntentions: number;
  liftCarry: number;
  memory: number;
  movement: { walk: number; sprint: number };
  skills: SkillPool[];
  slots: { spells: number; complexForms: number; powerPoints: number };
  free: { knowledge: number };
  unconscious: boolean;
  dead: boolean;
  glitchOn2: boolean;
}

export interface Budget {
  attributes: { total: number; spent: number; left: number };
  adjustment: { total: number; spent: number; left: number };
  skills: { total: number; spent: number; left: number };
  nuyen: { total: number; spent: number; left: number; gear: number; lifestyle: number; fromKarma: number };
  karma: {
    base: number;
    negativeBonus: number;
    spent: number;
    cost: { attributes: number; skills: number; qualities: number; edgeMagic: number; knowledge: number; nuyen: number };
    left: number;
  };
  qualities: { count: number; net: number };
}

export interface Issue {
  level: "error" | "warn";
  where: string;
  text: string;
}

type EffectSum = Required<Pick<QualityEffect, "physicalBoxes" | "stunBoxes" | "overflowBoxes" | "defense" | "initiative" | "initiativeDice" | "edge">> & { attr: Partial<Record<AttrKey, number>> };

const sumEffects = (items: (QualityEffect | undefined)[], mult: number[] = []): EffectSum => {
  const acc = { physicalBoxes: 0, stunBoxes: 0, overflowBoxes: 0, defense: 0, initiative: 0, initiativeDice: 0, edge: 0, attr: {} as Partial<Record<AttrKey, number>> };
  items.forEach((e, i) => {
    if (!e) return;
    const m = mult[i] ?? 1;
    acc.physicalBoxes += (e.physicalBoxes ?? 0) * m;
    acc.stunBoxes += (e.stunBoxes ?? 0) * m;
    acc.overflowBoxes += (e.overflowBoxes ?? 0) * m;
    acc.defense += (e.defense ?? 0) * m;
    acc.initiative += (e.initiative ?? 0) * m;
    acc.initiativeDice += (e.initiativeDice ?? 0) * m;
    acc.edge += (e.edge ?? 0) * m;
    for (const [k, v] of Object.entries(e.attr ?? {})) {
      acc.attr[k as AttrKey] = (acc.attr[k as AttrKey] ?? 0) + (v ?? 0) * m;
    }
  });
  return acc;
};

export function magicPriorityRating(c: Character): number {
  const lvl = c.priorities.magic;
  if (!lvl || c.magicType === "mundane") return 0;
  return PRIORITY_TABLE[lvl].magic[c.magicType] ?? 0;
}

export function derive(c: Character): Derived {
  const meta = METATYPES[c.metatype];
  const worn = c.gear.filter((g) => g.effect && (g.category !== "armor" || g.worn !== false));
  const eff = sumEffects(
    [...c.qualities.map((q) => q.effect), ...worn.map((g) => g.effect), ...c.adeptPowers.map((p) => p.effect)],
    [...c.qualities.map((q) => q.level), ...worn.map((g) => g.qty || 1), ...c.adeptPowers.map((p) => p.level ?? 1)],
  );

  const attrs = {} as Record<AttrKey, number>;
  const attrMax = {} as Record<AttrKey, number>;
  for (const a of ATTRIBUTES) {
    const raw = 1 + (c.attrPts[a] ?? 0) + (c.attrKar[a] ?? 0) + (c.adjRacial[a] ?? 0) + (eff.attr[a] ?? 0);
    const maxMod = c.qualities.reduce((m, q) => (q.note === a && q.effect?.maxMod ? m + q.effect.maxMod * q.level : m), 0);
    attrMax[a] = Math.max(2, meta.ranges[a][1] + maxMod);
    attrs[a] = raw;
  }

  const essenceMult = c.qualities.reduce<number>((m, q) => Math.max(m, q.effect?.essenceMult ?? 1), 1);
  const gearEssence = c.gear.reduce((s, g) => s + (g.essence ?? 0) * (g.qty || 1), 0) * essenceMult;
  const essenceUsed = c.essenceLoss + gearEssence;
  const essence = Math.max(0, +(6 - essenceUsed).toFixed(2));
  const essenceMagicLoss = essenceUsed > 0 ? Math.ceil(essenceUsed - 1e-9) : 0;

  const mpr = magicPriorityRating(c);
  const awakened = c.magicType !== "mundane" && c.magicType !== "technomancer";
  const magicRaw = awakened ? mpr + c.adjMagic + c.karMagic : 0;
  const magic = Math.max(0, magicRaw - (awakened ? essenceMagicLoss : 0));
  const resonanceRaw = c.magicType === "technomancer" ? mpr + c.adjMagic + c.karMagic : 0;
  const resonance = Math.max(0, resonanceRaw - (c.magicType === "technomancer" ? essenceMagicLoss : 0));

  const edgeMax = Math.min(meta.ranges.edge[1] + eff.edge, 1 + c.adjEdge + c.karEdge + eff.edge);
  const edge = Math.max(0, 1 + c.adjEdge + c.karEdge + eff.edge - (c.edgeBurned ?? 0));

  const physicalBoxes = 8 + Math.ceil(attrs.body / 2) + meta.builtTough + eff.physicalBoxes;
  const stunBoxes = 8 + Math.ceil(attrs.willpower / 2) + eff.stunBoxes;
  const overflowBoxes = attrs.body * 2 + eff.overflowBoxes;

  const wearArmor = c.gear
    .filter((g) => g.category === "armor" && g.worn !== false)
    .reduce((s, g) => s + (g.armor ?? 0) * (g.qty || 1), 0);
  const defenseRating = attrs.body + wearArmor + meta.dermalDefense + eff.defense;

  const woundRows = {
    physical: Math.floor(c.damage.physical / 3),
    stun: Math.floor(c.damage.stun / 3),
  };
  const rawRows = woundRows.physical + woundRows.stun;
  const reduce = c.qualities.reduce((m, q) => m + (q.effect?.woundReduce ?? 0), 0);
  const doubled = c.qualities.some((q) => q.effect?.woundDouble);
  const woundPenalty = doubled ? rawRows * 2 : Math.max(0, rawRows - reduce);

  const skills: SkillPool[] = [];
  for (const def of SKILLS) {
    const entry = c.skills[def.id];
    if (!entry) continue;
    const rank = entry.pts + entry.kar;
    if (rank <= 0 && !entry.spec) continue;
    const attrKey = def.attr;
    const attrValue =
      attrKey === "magic" ? magic : attrKey === "resonance" ? resonance : attrs[attrKey as AttrKey];
    const base = rank + attrValue;
    skills.push({
      id: def.id,
      name: def.name,
      rank,
      attr: attrKey,
      attrValue,
      spec: entry.spec,
      pool: base,
      specPool: entry.spec ? base + 2 : undefined,
    });
  }

  const initRank = attrs.reaction + attrs.intuition + eff.initiative;
  const initDice = Math.min(5, 1 + eff.initiativeDice);

  const spells = awakened && c.magicType !== "adept"
    ? c.magicType === "mystic"
      ? Math.max(0, mpr - Math.min(mpr, c.adeptPowers.reduce((s, p) => s + p.cost, 0))) * 2
      : mpr * 2
    : 0;
  const powerPoints = c.magicType === "adept" || c.magicType === "mystic" ? magic : 0;

  const con = c.damage;
  const unconscious = con.stun >= stunBoxes || con.physical >= physicalBoxes;
  const dead = con.overflow >= overflowBoxes;

  return {
    attrs,
    attrMax,
    edge,
    edgeMax: Math.max(edge, edgeMax),
    magic,
    resonance,
    essence,
    essenceUsed,
    magicPriorityRating: mpr,
    initiative: {
      rank: initRank,
      dice: initDice,
      astralRank: attrs.intuition * 2,
      astralDice: 3,
    },
    condition: { physical: physicalBoxes, stun: stunBoxes, overflow: overflowBoxes },
    woundRows,
    woundPenalty,
    defenseRating,
    armor: wearArmor,
    unarmedAR: attrs.reaction + attrs.strength,
    composure: attrs.willpower + attrs.charisma,
    judgeIntentions: attrs.willpower + attrs.intuition,
    liftCarry: attrs.body + attrs.willpower,
    memory: attrs.logic + attrs.intuition,
    movement: { walk: 10, sprint: 15 },
    skills,
    slots: { spells, complexForms: c.magicType === "technomancer" ? mpr * 2 : 0, powerPoints },
    free: { knowledge: attrs.logic },
    unconscious,
    dead,
    glitchOn2: c.qualities.some((q) => q.effect?.glitchOn2),
  };
}

/** Karma for `kar` additional ranks on top of `pts` existing ranks. */
export function karmaForRanks(pts: number, kar: number, per: (rank: number) => number): number {
  let total = 0;
  for (let i = 1; i <= kar; i++) total += per(pts + i);
  return total;
}

export function budget(c: Character): Budget {
  const d = derive(c);
  const p = c.priorities;
  const attrTotal = p.attributes ? PRIORITY_TABLE[p.attributes].attributes : 0;
  const attrSpent = ATTRIBUTES.reduce((s, a) => s + (c.attrPts[a] ?? 0), 0);

  const adjTotal = p.metatype ? PRIORITY_TABLE[p.metatype].adjustment : 0;
  const adjSpent =
    c.adjEdge + c.adjMagic + Object.values(c.adjRacial).reduce((s, v) => s + (v ?? 0), 0);

  const skillTotal = p.skills ? PRIORITY_TABLE[p.skills].skills : 0;
  let skillSpent = 0;
  let skillKarma = 0;
  for (const e of Object.values(c.skills)) {
    skillSpent += e.pts + (e.spec && e.specVia !== "karma" ? 1 : 0);
    skillKarma += karmaForRanks(e.pts, e.kar, KARMA.skillRank);
    if (e.spec && e.specVia === "karma") skillKarma += KARMA.specialization;
  }

  let attrKarma = 0;
  for (const a of ATTRIBUTES) {
    attrKarma += karmaForRanks(1 + (c.attrPts[a] ?? 0) + (c.adjRacial[a] ?? 0), c.attrKar[a] ?? 0, KARMA.attributeRank);
  }
  // Edge / Magic / Resonance bought with Karma use the same 5 x new rank formula
  const edgeMagicKarma =
    karmaForRanks(1 + c.adjEdge, c.karEdge, KARMA.attributeRank) +
    karmaForRanks(magicPriorityRating(c) + c.adjMagic, c.karMagic, KARMA.attributeRank);

  const knowledgeExtra = Math.max(
    0,
    c.knowledge.filter((k) => !(k.kind === "language" && k.native)).length - d.free.knowledge,
  );
  const knowledgeKarma = knowledgeExtra * KARMA.knowledge;

  let positive = 0;
  let negative = 0;
  for (const q of c.qualities) {
    const v = q.karma * q.level;
    if (q.kind === "positive") positive += v;
    else negative += v;
  }
  const negativeBonus = Math.min(KARMA.maxQualityKarma, negative);

  const perKarma = c.qualities.reduce<number>((m, q) => Math.max(m, q.effect?.nuyenPerKarma ?? 0), KARMA.nuyenPerKarma);
  const nuyenFromKarma = c.karmaToNuyen * perKarma;
  const karmaSpent = attrKarma + skillKarma + positive + edgeMagicKarma + knowledgeKarma + c.karmaToNuyen;
  const karmaPool = KARMA.customization + negativeBonus;

  const resources = p.resources ? PRIORITY_TABLE[p.resources].resources : 0;
  const gear = c.gear.reduce((s, g) => s + g.cost * (g.qty || 1), 0);
  const ls = LIFESTYLES.find((l) => l.id === c.lifestyle);
  const lifestyle = (ls?.cost ?? 0) * c.lifestyleMonths;
  const nuyenTotal = resources + nuyenFromKarma;

  return {
    attributes: { total: attrTotal, spent: attrSpent, left: attrTotal - attrSpent },
    adjustment: { total: adjTotal, spent: adjSpent, left: adjTotal - adjSpent },
    skills: { total: skillTotal, spent: skillSpent, left: skillTotal - skillSpent },
    nuyen: {
      total: nuyenTotal,
      spent: gear + lifestyle,
      left: nuyenTotal - gear - lifestyle,
      gear,
      lifestyle,
      fromKarma: nuyenFromKarma,
    },
    karma: {
      base: KARMA.customization,
      negativeBonus,
      spent: karmaSpent,
      cost: {
        attributes: attrKarma,
        skills: skillKarma,
        qualities: positive,
        edgeMagic: edgeMagicKarma,
        knowledge: knowledgeKarma,
        nuyen: c.karmaToNuyen,
      },
      left: karmaPool - karmaSpent,
    },
    qualities: { count: c.qualities.length, net: negative },
  };
}

/** Validate a character against the creation rules. */
export function validate(c: Character): Issue[] {
  const issues: Issue[] = [];
  const d = derive(c);
  const b = budget(c);
  const meta = METATYPES[c.metatype];
  const p = c.priorities;

  if (!c.name.trim() && !c.alias.trim()) issues.push({ level: "warn", where: "Concept", text: "Your runner has no name or street alias yet." });

  // priorities
  const cols = ["metatype", "attributes", "skills", "magic", "resources"] as const;
  const missing = cols.filter((k) => !p[k]);
  if (missing.length) issues.push({ level: "error", where: "Priorities", text: `Assign a priority to: ${missing.join(", ")}.` });
  const used = cols.map((k) => p[k]).filter(Boolean);
  if (new Set(used).size !== used.length) issues.push({ level: "error", where: "Priorities", text: "Each priority letter (A to E) can be used only once." });
  if (p.metatype && !PRIORITY_TABLE[p.metatype].metatypes.includes(c.metatype))
    issues.push({ level: "error", where: "Metatype", text: `${meta.name} is not available at Priority ${p.metatype}.` });
  if (p.magic) {
    const row = PRIORITY_TABLE[p.magic];
    if (row.magic[c.magicType] === undefined)
      issues.push({ level: "error", where: "Magic", text: `That magic type is not available at Priority ${p.magic}.` });
  }
  if (p.magic === "E" && c.magicType !== "mundane")
    issues.push({ level: "error", where: "Magic", text: "Priority E means mundane." });

  // attribute points
  if (b.attributes.left < 0) issues.push({ level: "error", where: "Attributes", text: `${-b.attributes.left} attribute point(s) over budget.` });
  if (b.attributes.left > 0) issues.push({ level: "warn", where: "Attributes", text: `${b.attributes.left} attribute point(s) unspent.` });
  if (b.adjustment.left < 0) issues.push({ level: "error", where: "Adjustment", text: `${-b.adjustment.left} adjustment point(s) over budget.` });
  if (b.adjustment.left > 0) issues.push({ level: "warn", where: "Adjustment", text: `${b.adjustment.left} adjustment point(s) unspent.` });

  const special = specialRacialAttrs(c.metatype);
  let atMax = 0;
  for (const a of ATTRIBUTES) {
    const val = d.attrs[a];
    const baseline = 1 + (c.attrPts[a] ?? 0) + (c.attrKar[a] ?? 0);
    if (val > d.attrMax[a]) issues.push({ level: "error", where: "Attributes", text: `${a} is above its maximum of ${d.attrMax[a]}.` });
    if (1 + (c.attrPts[a] ?? 0) > Math.min(6, meta.ranges[a][1]))
      issues.push({ level: "error", where: "Attributes", text: `${a}: priority points cannot raise it past ${Math.min(6, meta.ranges[a][1])}; use adjustment points for racial range above 6.` });
    if ((c.adjRacial[a] ?? 0) > 0 && !special.includes(a))
      issues.push({ level: "error", where: "Adjustment", text: `${a} is not a special racial attribute for ${meta.name}.` });
    if (val === d.attrMax[a] && baseline >= 1) atMax++;
  }
  if (atMax > 1) issues.push({ level: "error", where: "Attributes", text: "Only one Physical or Mental attribute may be at its metatype maximum at creation." });

  // magic
  if (c.magicType !== "mundane" && d.magic + d.resonance > 6)
    issues.push({ level: "error", where: "Magic", text: "Magic or Resonance cannot exceed 6 at creation." });

  // skills
  const maxSkill = (id: string) => (c.qualities.some((q) => q.name.startsWith("Aptitude") && q.note === id) ? 7 : 6);
  let skillsAtMax = 0;
  for (const [id, e] of Object.entries(c.skills)) {
    const rank = e.pts + e.kar;
    const def = SKILL_BY_ID[id];
    if (!def) continue;
    if (rank > maxSkill(id)) issues.push({ level: "error", where: "Skills", text: `${def.name} is above the creation maximum.` });
    if (rank === maxSkill(id)) skillsAtMax++;
    if (e.spec && rank < 1) issues.push({ level: "error", where: "Skills", text: `${def.name}: specialization needs at least rank 1.` });
  }
  if (skillsAtMax > 1) issues.push({ level: "error", where: "Skills", text: "Only one skill may be at the creation maximum." });
  if (b.skills.left < 0) issues.push({ level: "error", where: "Skills", text: `${-b.skills.left} skill point(s) over budget.` });
  if (b.skills.left > 0) issues.push({ level: "warn", where: "Skills", text: `${b.skills.left} skill point(s) unspent.` });

  // qualities
  if (b.qualities.count > KARMA.maxQualities) issues.push({ level: "error", where: "Qualities", text: `At most ${KARMA.maxQualities} qualities at creation.` });
  if (b.qualities.net > KARMA.maxQualityKarma)
    issues.push({ level: "warn", where: "Qualities", text: `Negative quality bonus is capped at ${KARMA.maxQualityKarma} Karma; extra bonus is wasted.` });

  // spells and forms
  if (c.spells.length > d.slots.spells) issues.push({ level: "error", where: "Magic", text: `Too many spells or rituals (limit ${d.slots.spells} at creation).` });
  if (c.complexForms.length > d.slots.complexForms) issues.push({ level: "error", where: "Magic", text: `Too many complex forms (limit ${d.slots.complexForms}).` });
  const ppSpent = c.adeptPowers.reduce((s, x) => s + x.cost, 0);
  if (ppSpent > d.slots.powerPoints) issues.push({ level: "error", where: "Magic", text: `Adept powers cost ${ppSpent} but you only have ${d.slots.powerPoints} power points.` });

  // karma and nuyen
  if (b.karma.left < 0) issues.push({ level: "error", where: "Karma", text: `${-b.karma.left} Karma over budget.` });
  if (b.karma.left > KARMA.maxUnspent) issues.push({ level: "error", where: "Karma", text: `Begin play with at most ${KARMA.maxUnspent} unspent Karma (you have ${b.karma.left}).` });
  if (b.nuyen.left < 0) issues.push({ level: "error", where: "Gear", text: `${-b.nuyen.left}¥ over budget.` });
  if (b.nuyen.left > 5000) issues.push({ level: "warn", where: "Gear", text: "You can start play with at most 5,000¥ unspent." });

  return issues;
}

export function isMagicUser(t: MagicType): boolean {
  return t !== "mundane" && t !== "technomancer";
}

const METATYPE_PREF: MetatypeId[] = ["human", "elf", "dwarf", "ork", "troll"];

/** After a priority change, move metatype and magic type onto legal choices. */
export function reconcile(c: Character): void {
  const p = c.priorities;
  if (p.metatype) {
    const allowed = PRIORITY_TABLE[p.metatype].metatypes;
    if (!allowed.includes(c.metatype)) c.metatype = METATYPE_PREF.find((m) => allowed.includes(m)) ?? "human";
  }
  if (p.magic) {
    const row = PRIORITY_TABLE[p.magic];
    if (row.magic[c.magicType] === undefined) c.magicType = row.magic.mundane !== undefined ? "mundane" : "full";
  }
  // Racial adjustment points only apply to attributes the metatype can push past 6.
  const special = specialRacialAttrs(c.metatype);
  for (const k of Object.keys(c.adjRacial) as AttrKey[]) if (!special.includes(k)) delete c.adjRacial[k];
}
