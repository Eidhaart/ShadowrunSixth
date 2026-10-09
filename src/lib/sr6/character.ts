import {
  ATTRIBUTES,
  type AttrKey,
  type MagicType,
  type MetatypeId,
  type PriorityColumn,
  type PriorityLevel,
} from "./data";

export type ExtraKey = "edge" | "magic" | "resonance";

export interface QualityPick {
  id: string;
  name: string;
  kind: "positive" | "negative";
  /** Karma cost (positive) or bonus (negative), per level. */
  karma: number;
  level: number;
  /** Free-text, e.g. which skill an Aptitude applies to. */
  note?: string;
  /** Effects the sheet knows how to automate. */
  effect?: QualityEffect;
}

export interface QualityEffect {
  physicalBoxes?: number; // per level
  stunBoxes?: number;
  overflowBoxes?: number;
  defense?: number;
  initiative?: number;
  initiativeDice?: number;
  edge?: number;
  attr?: Partial<Record<AttrKey, number>>;
  /** Reduce wound penalty by this much (High Pain Tolerance). */
  woundReduce?: number;
  /** Wound modifiers are doubled (Low Pain Tolerance). */
  woundDouble?: boolean;
  /** Per level, raises (+) or lowers (-) the maximum of the attribute named in the pick's note. */
  maxMod?: number;
  /** Karma-to-nuyen rate override (In Debt). */
  nuyenPerKarma?: number;
  /** Multiplies essence cost of augmentations (Sensitive System). */
  essenceMult?: number;
  /** 1s and 2s both count toward glitches (Bad Luck). */
  glitchOn2?: boolean;
}

export interface SkillEntry {
  /** ranks bought with skill points */
  pts: number;
  /** ranks bought with Karma on top of pts */
  kar: number;
  spec?: string;
  specVia?: "points" | "karma";
}

export interface GearItem {
  id: string;
  name: string;
  category: "weapon" | "armor" | "cyberware" | "bioware" | "commlink" | "vehicle" | "misc" | "ammo" | "magic";
  cost: number;
  qty: number;
  notes?: string;
  /** For armor: bonus to Defense Rating while worn. */
  armor?: number;
  worn?: boolean;
  /** For weapons: Damage Value, Attack Rating at close/near/medium/far/extreme. */
  dv?: string;
  ar?: [number | null, number | null, number | null, number | null, number | null];
  skill?: string;
  /** Essence cost for augmentations. */
  essence?: number;
  /** Rating bonuses from the item, e.g. wired reflexes. */
  effect?: QualityEffect;
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  connection: number;
  loyalty: number;
  notes?: string;
}

export interface KnowledgeSkill {
  id: string;
  name: string;
  kind: "knowledge" | "language";
  native?: boolean;
}

export interface Damage {
  physical: number;
  stun: number;
  overflow: number;
}

export interface Character {
  id: string;
  version: 1;
  createdAt: number;
  updatedAt: number;
  stage: "draft" | "complete";
  // identity
  name: string;
  alias: string;
  player: string;
  archetype?: string;
  concept: string;
  background: string;
  notes: string;
  portrait?: string;
  // build
  metatype: MetatypeId;
  magicType: MagicType;
  priorities: Partial<Record<PriorityColumn, PriorityLevel>>;
  attrPts: Record<AttrKey, number>;
  attrKar: Record<AttrKey, number>;
  /** Adjustment points spent on special racial attributes. */
  adjRacial: Partial<Record<AttrKey, number>>;
  adjEdge: number;
  adjMagic: number;
  /** Karma-bought ranks for edge / magic / resonance */
  karEdge: number;
  karMagic: number;
  skills: Record<string, SkillEntry>;
  knowledge: KnowledgeSkill[];
  qualities: QualityPick[];
  spells: string[];
  complexForms: string[];
  adeptPowers: { name: string; cost: number; level?: number; effect?: QualityEffect }[];
  gear: GearItem[];
  contacts: Contact[];
  lifestyle: string;
  lifestyleMonths: number;
  karmaToNuyen: number; // Karma points converted to nuyen
  // play
  damage: Damage;
  edgeCurrent: number;
  karmaEarned: number;
  karmaSpent: number;
  nuyen: number;
  essenceLoss: number;
  /** Edge ranks permanently burned in play. */
  edgeBurned: number;
  /** Attribute added to Willpower for Drain resistance (logic, charisma, intuition...). */
  tradition: string;
  statuses: string[];
  /** Free-form on-sheet modifier applied to every dice pool (temporary buffs). */
  poolMod: number;
}

const zeroAttrs = (): Record<AttrKey, number> =>
  Object.fromEntries(ATTRIBUTES.map((a) => [a, 0])) as Record<AttrKey, number>;

export function uid(prefix = "c"): string {
  const c: Crypto | undefined = globalThis.crypto;
  const rand = c?.randomUUID ? c.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

export function newCharacter(): Character {
  const now = Date.now();
  return {
    id: uid("run"),
    version: 1,
    createdAt: now,
    updatedAt: now,
    stage: "draft",
    name: "",
    alias: "",
    player: "",
    concept: "",
    background: "",
    notes: "",
    metatype: "human",
    magicType: "mundane",
    priorities: {},
    attrPts: zeroAttrs(),
    attrKar: zeroAttrs(),
    adjRacial: {},
    adjEdge: 0,
    adjMagic: 0,
    karEdge: 0,
    karMagic: 0,
    skills: {},
    knowledge: [],
    qualities: [],
    spells: [],
    complexForms: [],
    adeptPowers: [],
    gear: [],
    contacts: [],
    lifestyle: "street",
    lifestyleMonths: 0,
    karmaToNuyen: 0,
    damage: { physical: 0, stun: 0, overflow: 0 },
    edgeCurrent: 0,
    karmaEarned: 0,
    karmaSpent: 0,
    nuyen: 0,
    essenceLoss: 0,
    edgeBurned: 0,
    tradition: "logic",
    statuses: [],
    poolMod: 0,
  };
}
