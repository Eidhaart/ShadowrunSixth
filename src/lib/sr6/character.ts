import {
  ATTRIBUTES,
  type AttrKey,
  type MagicType,
  type MetatypeId,
  type PriorityColumn,
  type PriorityLevel,
} from "./data";
import type { SheetExt } from "./ext";

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
  /** Lifestyle costs this much more (SINner: taxes, 1.1). */
  lifestyleMult?: number;
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
  /** Specialization upgraded to expertise: +3 instead of +2. */
  expert?: boolean;
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
  /** Capacity this item offers for modifications (cybereyes, cyberlimbs, armor, goggles). */
  capacity?: number;
  /** Capacity it takes up when installed in something: the number the book prints in brackets. */
  capCost?: number;
  /** What kind of modification it can hold. Any weapon can take weapon accessories. */
  holds?: GearSlot;
  /** What it can be installed in or attached to. */
  fits?: GearSlot;
  /** The item it is installed in or attached to. */
  inId?: string;
  /** Weapon accessories: the mount they take. */
  mount?: "top" | "under" | "barrel" | "top-under";
  /** The weapon has a smartgun system built in. */
  smartgun?: boolean;
  /** "L" needs a license, "I" is illegal. */
  legal?: "L" | "I";
  /** Availability from the catalog, checked against the creation limit. */
  avail?: number;
  /** Fake SINs and licenses: the rating bought. */
  rating?: number;
  /** Licenses: the SIN (a fake SIN's gear id, or "real" for a SINner's own) it is registered to. */
  sinId?: string;
  /** Commlink 6 template id: decides the item's mounts and Capacity slots. */
  c6?: string;
  /** The mount or slot of its host it sits in (Commlink 6 hook, e.g. "TOP" or "CYBEREYE_IMPLANT"). */
  slot?: string;
  /** Came with its host (a pistol's built-in smartgun): free, and removed with the host. */
  included?: boolean;
}

/** Physical description, filled on the Name page. Free text: the book gives averages, not rules. */
export interface Bio {
  gender?: string;
  age?: string;
  height?: string;
  weight?: string;
  hair?: string;
  eyes?: string;
  skin?: string;
}

export type GearSlot = "eyes" | "ears" | "limb" | "armor" | "optical" | "audio" | "weapon" | "melee";

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
  /** Languages other than the native one: 1 speaks it, 2 Specialist, 3 Expert. Each level is one knowledge point. */
  level?: number;
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
  /** Rituals learned at creation. They share the starting allowance with spells (p. 65). */
  rituals?: string[];
  complexForms: string[];
  adeptPowers: { name: string; cost: number; level?: number; effect?: QualityEffect }[];
  gear: GearItem[];
  contacts: Contact[];
  lifestyle: string;
  lifestyleMonths: number;
  /** The SIN the lifestyle is rented under: a fake SIN's gear id, or "real". */
  lifestyleSin?: string;
  bio?: Bio;
  karmaToNuyen: number; // Karma points converted to nuyen
  // play
  damage: Damage;
  edgeCurrent: number;
  /** Karma spent after creation, layered on top of the build. See advance.ts. */
  adv?: import("./advance").Advancement;
  /** Power points bought with Karma (mystic adepts). Filled in by withAdv. */
  extraPP?: number;
  /**
   * Mystic adepts: how many points of the Priority table's Magic rating go to adept powers (1 Power Point
   * each). The rest go to spellcasting (2 starting spells each). Missing on older saves: see mysticSplit().
   */
  mysticPP?: number;
  /** Initiation or submersion bought with creation Karma: grades and the metamagic or echo taken at each. */
  startGrade?: number;
  startMeta?: string[];
  /** Initiate or submersion grade. Filled in by withAdv. */
  initiateGrade?: number;
  metamagic?: string[];
  karmaEarned: number;
  karmaSpent: number;
  nuyen: number;
  essenceLoss: number;
  /** Edge ranks permanently burned in play. */
  edgeBurned: number;
  /** Attribute added to Willpower for Drain resistance (logic, charisma, intuition...). */
  tradition: string;
  /** Aspected magicians: the one branch of magic they use. */
  aspect?: "sorcery" | "conjuring" | "enchanting";
  /** Name of a tradition from another book; empty means the core tradition that goes with the attribute. */
  traditionName?: string;
  statuses: string[];
  /** Free-form on-sheet modifier applied to every dice pool (temporary buffs). */
  poolMod: number;
  /** Deck, spirits, vehicles and other extras kept by the sheet tabs. */
  ext?: SheetExt;
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

/**
 * Bring a saved or imported runner up to the current shape without changing what was built: missing
 * fields take their defaults, numbers that came in as text are read as numbers, and a mystic adept from
 * before the stored split gets the split its powers imply. Returns the same object.
 */
export function normalizeCharacter(c: Character): Character {
  const base = newCharacter() as unknown as Record<string, unknown>;
  const x = c as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(base)) {
    if (k === "id" || k === "createdAt" || k === "updatedAt") continue;
    if (x[k] == null) x[k] = JSON.parse(JSON.stringify(v));
    else if (typeof v === "number" && typeof x[k] === "string" && x[k] !== "" && !isNaN(Number(x[k]))) x[k] = Number(x[k]);
  }
  for (const k of ["attrPts", "attrKar"] as const) c[k] = { ...zeroAttrs(), ...c[k] };
  c.damage = Object.assign({ physical: 0, stun: 0, overflow: 0 }, c.damage);
  for (const e of Object.values(c.skills)) { e.pts = Number(e.pts) || 0; e.kar = Number(e.kar) || 0; }
  // foci from before they were tied to their gear item: link by name, one item each
  const foci = (c.ext as { foci?: { name: string; gearId?: string }[] } | undefined)?.foci;
  if (Array.isArray(foci)) {
    const taken = new Set(foci.map((f) => f.gearId).filter(Boolean));
    for (const f of foci) {
      if (f.gearId) continue;
      const g = c.gear.find((x) => x.category === "magic" && x.name === f.name && !taken.has(x.id));
      if (g) { f.gearId = g.id; taken.add(g.id); }
    }
  }
  if (c.magicType === "mystic" && c.mysticPP == null) {
    const startPP = (c.startMeta ?? []).filter((m) => /^power point$/i.test(m.trim())).length;
    const spent = c.adeptPowers.reduce((s, p) => s + (Number(p.cost) || 0), 0);
    c.mysticPP = Math.max(0, Math.ceil(spent - startPP - 1e-9));
  }
  return c;
}
