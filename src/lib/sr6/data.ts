/**
 * Core Shadowrun: Sixth World creation data.
 * These are game mechanics (numbers and names) taken from the Priority Table,
 * Metatype Attributes table and Skills chapter of the core rulebook.
 * Flavour text and rules prose are NOT stored here; they come from the user's own
 * imported rulebook at runtime.
 */

export const PRIORITY_LEVELS = ["A", "B", "C", "D", "E"] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export type PriorityColumn = "metatype" | "attributes" | "skills" | "magic" | "resources";
export const PRIORITY_COLUMNS: { key: PriorityColumn; label: string; blurb: string }[] = [
  { key: "metatype", label: "Metatype", blurb: "Who you are, and Edge/Magic adjustment points" },
  { key: "attributes", label: "Attributes", blurb: "Attribute points for the eight core stats" },
  { key: "skills", label: "Skills", blurb: "Skill points for active skills and specializations" },
  { key: "magic", label: "Magic / Resonance", blurb: "Awakened or emerged abilities, or mundane" },
  { key: "resources", label: "Resources", blurb: "Starting nuyen" },
];

export type MetatypeId = "human" | "dwarf" | "elf" | "ork" | "troll";

export const ATTRIBUTES = [
  "body",
  "agility",
  "reaction",
  "strength",
  "willpower",
  "logic",
  "intuition",
  "charisma",
] as const;
export type AttrKey = (typeof ATTRIBUTES)[number];

export const ATTR_LABEL: Record<AttrKey | "edge" | "magic" | "resonance" | "essence", string> = {
  body: "Body",
  agility: "Agility",
  reaction: "Reaction",
  strength: "Strength",
  willpower: "Willpower",
  logic: "Logic",
  intuition: "Intuition",
  charisma: "Charisma",
  edge: "Edge",
  magic: "Magic",
  resonance: "Resonance",
  essence: "Essence",
};

export const ATTR_ABBR: Record<AttrKey | "edge" | "magic" | "resonance" | "essence", string> = {
  body: "BOD",
  agility: "AGI",
  reaction: "REA",
  strength: "STR",
  willpower: "WIL",
  logic: "LOG",
  intuition: "INT",
  charisma: "CHA",
  edge: "EDG",
  magic: "MAG",
  resonance: "RES",
  essence: "ESS",
};

export interface MetatypeDef {
  id: MetatypeId;
  name: string;
  /** [min, max] per attribute, from the Metatype Attributes table. */
  ranges: Record<AttrKey | "edge", [number, number]>;
  racial: string[];
  /** Flat bonuses granted by racial qualities, applied by derive(). */
  builtTough: number;
  dermalDefense: number;
}

const r = (a: number, b: number): [number, number] => [a, b];

export const METATYPES: Record<MetatypeId, MetatypeDef> = {
  human: {
    id: "human",
    name: "Human",
    ranges: {
      body: r(1, 6), agility: r(1, 6), reaction: r(1, 6), strength: r(1, 6),
      willpower: r(1, 6), logic: r(1, 6), intuition: r(1, 6), charisma: r(1, 6), edge: r(1, 7),
    },
    racial: [],
    builtTough: 0,
    dermalDefense: 0,
  },
  dwarf: {
    id: "dwarf",
    name: "Dwarf",
    ranges: {
      body: r(1, 7), agility: r(1, 6), reaction: r(1, 5), strength: r(1, 8),
      willpower: r(1, 7), logic: r(1, 6), intuition: r(1, 6), charisma: r(1, 6), edge: r(1, 6),
    },
    racial: ["Toxin Resistance", "Thermographic Vision"],
    builtTough: 0,
    dermalDefense: 0,
  },
  elf: {
    id: "elf",
    name: "Elf",
    ranges: {
      body: r(1, 6), agility: r(1, 7), reaction: r(1, 6), strength: r(1, 6),
      willpower: r(1, 6), logic: r(1, 6), intuition: r(1, 6), charisma: r(1, 8), edge: r(1, 6),
    },
    racial: ["Low-light Vision"],
    builtTough: 0,
    dermalDefense: 0,
  },
  ork: {
    id: "ork",
    name: "Ork",
    ranges: {
      body: r(1, 8), agility: r(1, 6), reaction: r(1, 6), strength: r(1, 8),
      willpower: r(1, 6), logic: r(1, 6), intuition: r(1, 6), charisma: r(1, 5), edge: r(1, 6),
    },
    racial: ["Low-light Vision", "Built Tough 1"],
    builtTough: 1,
    dermalDefense: 0,
  },
  troll: {
    id: "troll",
    name: "Troll",
    ranges: {
      body: r(1, 9), agility: r(1, 5), reaction: r(1, 6), strength: r(1, 9),
      willpower: r(1, 6), logic: r(1, 6), intuition: r(1, 6), charisma: r(1, 5), edge: r(1, 6),
    },
    racial: ["Dermal Deposits", "Thermographic Vision", "Built Tough 2"],
    builtTough: 2,
    dermalDefense: 1,
  },
};

export const METATYPE_ORDER: MetatypeId[] = ["human", "elf", "dwarf", "ork", "troll"];

export type MagicType = "mundane" | "full" | "aspected" | "mystic" | "adept" | "technomancer";

export const MAGIC_TYPE_LABEL: Record<MagicType, string> = {
  mundane: "Mundane",
  full: "Full magician",
  aspected: "Aspected magician",
  mystic: "Mystic adept",
  adept: "Adept",
  technomancer: "Technomancer",
};

export interface PriorityRow {
  level: PriorityLevel;
  metatypes: MetatypeId[];
  adjustment: number;
  attributes: number;
  skills: number;
  /** Starting Magic/Resonance rating by type; undefined = unavailable. */
  magic: Partial<Record<MagicType, number>>;
  resources: number;
}

const ALL: MetatypeId[] = ["human", "elf", "dwarf", "ork", "troll"];

export const PRIORITY_TABLE: Record<PriorityLevel, PriorityRow> = {
  A: {
    level: "A", metatypes: ["dwarf", "ork", "troll"], adjustment: 13, attributes: 24, skills: 32,
    magic: { full: 4, aspected: 5, mystic: 4, adept: 4, technomancer: 4 }, resources: 450_000,
  },
  B: {
    level: "B", metatypes: ["dwarf", "elf", "ork", "troll"], adjustment: 11, attributes: 16, skills: 24,
    magic: { full: 3, aspected: 4, mystic: 3, adept: 3, technomancer: 3 }, resources: 275_000,
  },
  C: {
    level: "C", metatypes: ALL, adjustment: 9, attributes: 12, skills: 20,
    magic: { full: 2, aspected: 3, mystic: 2, adept: 2, technomancer: 2 }, resources: 150_000,
  },
  D: {
    level: "D", metatypes: ALL, adjustment: 4, attributes: 8, skills: 16,
    magic: { full: 1, aspected: 2, mystic: 1, adept: 1, technomancer: 1 }, resources: 50_000,
  },
  E: {
    level: "E", metatypes: ALL, adjustment: 1, attributes: 2, skills: 10,
    magic: { mundane: 0 }, resources: 8_000,
  },
};

/** Special racial attributes: those whose maximum exceeds the baseline 6. */
export function specialRacialAttrs(m: MetatypeId): AttrKey[] {
  return ATTRIBUTES.filter((a) => METATYPES[m].ranges[a][1] > 6);
}

export interface SkillDef {
  id: string;
  name: string;
  attr: AttrKey | "magic" | "resonance";
  alt?: string; // secondary attribute note
  untrained: boolean;
  specs: string[];
  group: "combat" | "physical" | "social" | "tech" | "magic" | "vehicle" | "mental";
}

export const SKILLS: SkillDef[] = [
  { id: "astral", name: "Astral", attr: "intuition", alt: "Willpower for astral combat", untrained: false, group: "magic",
    specs: ["Astral Combat", "Astral Signatures", "Emotional States", "Spirit Types"] },
  { id: "athletics", name: "Athletics", attr: "agility", alt: "Strength where resistance matters", untrained: true, group: "physical",
    specs: ["Archery", "Climbing", "Flying", "Gymnastics", "Sprinting", "Swimming", "Throwing"] },
  { id: "biotech", name: "Biotech", attr: "logic", alt: "Intuition off the book", untrained: false, group: "tech",
    specs: ["Biotechnology", "Cybertechnology", "First Aid", "Medicine"] },
  { id: "close-combat", name: "Close Combat", attr: "agility", untrained: true, group: "combat",
    specs: ["Blades", "Clubs", "Unarmed Combat"] },
  { id: "con", name: "Con", attr: "charisma", untrained: true, group: "social",
    specs: ["Acting", "Disguise", "Impersonation", "Performance"] },
  { id: "conjuring", name: "Conjuring", attr: "magic", untrained: false, group: "magic",
    specs: ["Banishing", "Summoning"] },
  { id: "cracking", name: "Cracking", attr: "logic", untrained: false, group: "tech",
    specs: ["Cybercombat", "Electronic Warfare", "Hacking"] },
  { id: "electronics", name: "Electronics", attr: "logic", alt: "Intuition for kludge work", untrained: true, group: "tech",
    specs: ["Computer", "Hardware", "Software"] },
  { id: "enchanting", name: "Enchanting", attr: "magic", untrained: false, group: "magic",
    specs: ["Alchemy", "Artificing", "Disenchanting"] },
  { id: "engineering", name: "Engineering", attr: "logic", alt: "Intuition for juryrigging", untrained: true, group: "tech",
    specs: ["Aeronautics Mechanic", "Armorer", "Automotive Mechanic", "Demolitions", "Gunnery", "Industrial Mechanic", "Lockpicking", "Nautical Mechanic"] },
  { id: "exotic-weapons", name: "Exotic Weapons", attr: "agility", untrained: false, group: "combat",
    specs: [] },
  { id: "firearms", name: "Firearms", attr: "agility", untrained: true, group: "combat",
    specs: ["Tasers", "Hold-Outs", "Light Pistols", "Machine Pistols", "Heavy Pistols", "Submachine Guns", "Shotguns", "Rifles", "Machine Guns", "Assault Cannons"] },
  { id: "influence", name: "Influence", attr: "charisma", alt: "Logic for clear arguments", untrained: true, group: "social",
    specs: ["Etiquette", "Instruction", "Intimidation", "Leadership", "Negotiation"] },
  { id: "outdoors", name: "Outdoors", attr: "intuition", untrained: true, group: "physical",
    specs: ["Navigation", "Survival", "Tracking"] },
  { id: "perception", name: "Perception", attr: "intuition", alt: "Logic for pattern recognition", untrained: true, group: "mental",
    specs: ["Visual", "Aural", "Tactile"] },
  { id: "piloting", name: "Piloting", attr: "reaction", untrained: true, group: "vehicle",
    specs: ["Ground Craft", "Aircraft", "Watercraft"] },
  { id: "sorcery", name: "Sorcery", attr: "magic", untrained: false, group: "magic",
    specs: ["Counterspelling", "Ritual Spellcasting", "Spellcasting"] },
  { id: "stealth", name: "Stealth", attr: "agility", untrained: true, group: "physical",
    specs: ["Camouflage", "Palming", "Sneaking"] },
  { id: "tasking", name: "Tasking", attr: "resonance", untrained: false, group: "tech",
    specs: ["Compiling", "Decompiling", "Registering"] },
];

export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

/** Skills that need Magic / Resonance and are therefore gated by magic type. */
export function skillAvailable(skill: SkillDef, magic: MagicType): boolean {
  switch (skill.id) {
    case "sorcery":
    case "conjuring":
    case "enchanting":
      return magic === "full" || magic === "mystic" || magic === "aspected";
    case "astral":
      return magic === "full" || magic === "aspected" || magic === "mystic" || magic === "adept";
    case "tasking":
      return magic === "technomancer";
    default:
      return true;
  }
}

/** Karma costs from the Advancement Costs table. */
export const KARMA = {
  customization: 50,
  maxUnspent: 5,
  nuyenPerKarma: 2000,
  skillRank: (newRank: number) => 5 * newRank,
  attributeRank: (newRank: number) => 5 * newRank,
  specialization: 5,
  expertise: 5,
  knowledge: 3,
  spell: 5,
  complexForm: 5,
  maxQualities: 6,
  maxQualityKarma: 20,
} as const;

export const ARCHETYPES = [
  "Adept",
  "Combat Mage",
  "Covert-Ops Specialist",
  "Decker",
  "Face",
  "Rigger",
  "Street Samurai",
  "Street Shaman",
  "Technomancer",
  "Weapons Specialist",
] as const;

export const LIFESTYLES = [
  { id: "street", name: "Street", cost: 0 },
  { id: "squatter", name: "Squatter", cost: 500 },
  { id: "low", name: "Low", cost: 2000 },
  { id: "middle", name: "Middle", cost: 5000 },
  { id: "high", name: "High", cost: 10000 },
  { id: "luxury", name: "Luxury", cost: 100000 },
] as const;
