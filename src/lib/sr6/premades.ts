/**
 * Archetype builds. Each one is a legal Priority-system character (tests/premades.test.ts runs the Forge's
 * own validator over every one). The same build serves two ways:
 *   - template: the numbers only (priorities, metatype, attributes, skills, magic), loaded into the Forge
 *     at the first step so the player walks through and changes anything;
 *   - premade: the full runner with name, story, gear and contacts, ready to play.
 */
import core from "@/data/gear-core.json";
import { COMMLINKS, CYBERDECKS, RCCS } from "./rules6";
import { newCharacter, uid, type Character, type Contact, type GearItem, type KnowledgeSkill, type QualityPick } from "./character";
import type { AttrKey, MagicType, MetatypeId, PriorityColumn, PriorityLevel } from "./data";
import { editExt, newVehicle } from "./ext";

type CoreGear = { id: string; gear: Omit<GearItem, "id"> };
const CORE = core as unknown as CoreGear[];

/** A gear item from the bundled gear list, optionally bought at a rating (price × rating). */
function item(id: string, opts: { qty?: number; rating?: number; name?: string } = {}): Omit<GearItem, "id"> {
  const it = CORE.find((x) => x.id === id);
  if (!it) throw new Error(`Unknown gear id ${id}`);
  const g: Omit<GearItem, "id"> = JSON.parse(JSON.stringify(it.gear));
  if (opts.rating) { g.cost *= opts.rating; g.name = `${opts.name ?? g.name} (rating ${opts.rating})`; }
  else if (opts.name) g.name = opts.name;
  g.qty = opts.qty ?? 1;
  return g;
}
/** Gear that is not in the community list yet. Prices are the usual book figures; flagged so players can check. */
const est = (name: string, category: GearItem["category"], cost: number, extra: Partial<GearItem> = {}): Omit<GearItem, "id"> =>
  ({ name, category, cost, qty: 1, notes: "Not in the gear list yet; check the price in the book.", ...extra });

export type ArchetypeId = "samurai" | "decker" | "mage" | "shaman" | "face" | "technomancer" | "rigger" | "adept" | "samurai-elf";

export interface Build {
  id: ArchetypeId;
  /** Only used by premades; not offered as a template. */
  hidden?: boolean;
  archetype: string;
  /** One line on how the build plays. */
  role: string;
  metatype: MetatypeId;
  magicType: MagicType;
  priorities: Record<PriorityColumn, PriorityLevel>;
  attr: Partial<Record<AttrKey, number>>;
  attrKar?: Partial<Record<AttrKey, number>>;
  adjRacial?: Partial<Record<AttrKey, number>>;
  adjEdge: number;
  adjMagic?: number;
  skills: Record<string, number>;
  /** Specializations bought with Karma. */
  specs?: Record<string, string>;
  knowledge: string[];
  languages?: string[];
  qualities?: Omit<QualityPick, "id">[];
  spells?: string[];
  forms?: string[];
  tradition?: string;
  karmaToNuyen?: number;
}

export interface Premade {
  build: ArchetypeId;
  name: string;
  alias: string;
  concept: string;
  background: string;
  gear: Omit<GearItem, "id">[];
  lifestyle: string;
  months: number;
  contacts: Omit<Contact, "id">[];
  deck?: number;
  link?: number;
  rcc?: number;
  /** Swap metatype for builds that work for several (no racial adjustments). */
  metatype?: MetatypeId;
  /** Picture in /public/portraits. */
  portrait?: string;
  vehicles?: { name: string; kind: "drone" | "vehicle"; note: string }[];
}

export const BUILDS: Build[] = [
  {
    id: "samurai", archetype: "Street Samurai", role: "Front-line gun and blade. Tough, fast, and hard to put down.",
    metatype: "ork", magicType: "mundane",
    priorities: { attributes: "A", skills: "B", resources: "C", metatype: "D", magic: "E" },
    attr: { body: 5, agility: 5, reaction: 4, strength: 4, willpower: 2, logic: 1, intuition: 3, charisma: 0 },
    attrKar: { willpower: 1, charisma: 1 },
    adjRacial: { body: 1 }, adjEdge: 3,
    skills: { firearms: 6, "close-combat": 5, athletics: 4, perception: 4, stealth: 3, piloting: 2 },
    specs: { firearms: "Rifles" },
    knowledge: ["Seattle street gangs", "Military small arms"],
    karmaToNuyen: 10,
  },
  {
    id: "samurai-elf", hidden: true, archetype: "Street Samurai", role: "Precise, fast, and patient behind a scope.",
    metatype: "elf", magicType: "mundane",
    priorities: { attributes: "A", skills: "B", resources: "C", metatype: "D", magic: "E" },
    attr: { body: 4, agility: 5, reaction: 4, strength: 3, willpower: 2, logic: 1, intuition: 4, charisma: 1 },
    attrKar: { strength: 1, willpower: 1 },
    adjRacial: { agility: 1 }, adjEdge: 3,
    skills: { firearms: 6, "close-combat": 4, athletics: 4, perception: 4, stealth: 4, piloting: 2 },
    specs: { firearms: "Rifles" },
    knowledge: ["Military small arms", "Seattle rooftops"],
  },
  {
    id: "decker", archetype: "Decker", role: "Breaks hosts, spikes ICE, and keeps the Overwatch Score low.",
    metatype: "human", magicType: "mundane",
    priorities: { skills: "A", attributes: "B", resources: "C", metatype: "D", magic: "E" },
    attr: { body: 2, agility: 2, reaction: 2, strength: 0, willpower: 3, logic: 5, intuition: 2, charisma: 0 },
    attrKar: { intuition: 1, body: 1 },
    adjEdge: 4,
    skills: { cracking: 6, electronics: 5, perception: 4, stealth: 3, firearms: 3, engineering: 3, piloting: 2, athletics: 2, influence: 2, biotech: 2 },
    specs: { cracking: "Hacking", electronics: "Software" },
    knowledge: ["Matrix security", "Corporate hosts", "Data havens", "Hacker forums", "Programming", "Seattle"],
  },
  {
    id: "mage", archetype: "Combat Mage", role: "Hermetic spellslinger: blasts, barriers and a bound spirit on call.",
    metatype: "elf", magicType: "full", tradition: "logic",
    priorities: { magic: "A", metatype: "B", attributes: "C", skills: "D", resources: "E" },
    attr: { body: 1, agility: 1, reaction: 1, strength: 0, willpower: 4, logic: 4, intuition: 1, charisma: 0 },
    attrKar: { willpower: 1 },
    adjRacial: { agility: 3, charisma: 4 }, adjEdge: 2, adjMagic: 2,
    skills: { sorcery: 6, conjuring: 4, astral: 3, perception: 3 },
    specs: { sorcery: "Spellcasting" },
    knowledge: ["Magical theory", "Spirits", "Arcane history", "Talismongers", "Seattle"],
    spells: ["Manabolt", "Stunball", "Lightning Bolt", "Heal", "Detect Enemies", "Invisibility", "Mana Barrier", "Armor"],
    karmaToNuyen: 10,
  },
  {
    id: "shaman", archetype: "Street Shaman", role: "Talks to spirits, heals the crew and reads the astral.",
    metatype: "human", magicType: "full", tradition: "charisma",
    priorities: { attributes: "A", magic: "B", skills: "C", metatype: "D", resources: "E" },
    attr: { body: 4, agility: 2, reaction: 2, strength: 1, willpower: 5, logic: 2, intuition: 4, charisma: 4 },
    attrKar: { agility: 1, reaction: 1 },
    adjEdge: 1, adjMagic: 3,
    skills: { conjuring: 6, sorcery: 5, astral: 3, outdoors: 3, perception: 3 },
    specs: { conjuring: "Summoning" },
    knowledge: ["Spirits of the city", "Medicinal plants", "Barrens tribes"],
    spells: ["Heal", "Stabilize", "Detect Life", "Physical Mask", "Stunbolt", "Silence"],
  },
  {
    id: "face", archetype: "Face", role: "Negotiates, lies, charms and gets the crew in the door.",
    metatype: "elf", magicType: "mundane",
    priorities: { skills: "A", metatype: "B", attributes: "C", resources: "D", magic: "E" },
    attr: { body: 1, agility: 2, reaction: 1, strength: 0, willpower: 2, logic: 2, intuition: 3, charisma: 1 },
    attrKar: { intuition: 1 },
    adjRacial: { charisma: 6, agility: 1 }, adjEdge: 4,
    skills: { influence: 6, con: 5, perception: 4, firearms: 3, stealth: 3, electronics: 3, athletics: 2, "close-combat": 2, piloting: 2, biotech: 2 },
    specs: { influence: "Negotiation", con: "Acting" },
    knowledge: ["Corporate politics", "High fashion", "Fixers of Seattle"],
    languages: ["Japanese", "Spanish"],
    karmaToNuyen: 4,
  },
  {
    id: "technomancer", archetype: "Technomancer", role: "Hacks with the mind alone, compiles sprites, and needs no deck.",
    metatype: "human", magicType: "technomancer",
    priorities: { magic: "A", attributes: "B", skills: "C", metatype: "D", resources: "E" },
    attr: { body: 2, agility: 1, reaction: 2, strength: 0, willpower: 3, logic: 4, intuition: 3, charisma: 1 },
    attrKar: { logic: 1 },
    adjEdge: 2, adjMagic: 2,
    skills: { electronics: 6, cracking: 5, tasking: 5, perception: 2, stealth: 2 },
    specs: { cracking: "Hacking", electronics: "Software" },
    knowledge: ["Matrix lore", "Data havens", "Sprites", "Seattle", "Trideo music"],
    forms: ["Cleaner", "Diffusion", "Editor", "Infusion", "Pulse Storm", "Puppeteer", "Resonance Spike", "Static Veil"],
    karmaToNuyen: 5,
  },
  {
    id: "rigger", archetype: "Rigger", role: "Drives anything, flies the drones, and gets the crew out alive.",
    metatype: "dwarf", magicType: "mundane",
    priorities: { skills: "A", attributes: "B", metatype: "C", resources: "D", magic: "E" },
    attr: { body: 3, agility: 2, reaction: 4, strength: 1, willpower: 2, logic: 3, intuition: 1, charisma: 0 },
    attrKar: { intuition: 1, charisma: 1 },
    adjRacial: { body: 2, willpower: 1, strength: 2 }, adjEdge: 4,
    skills: { piloting: 6, engineering: 5, electronics: 4, firearms: 4, perception: 4, cracking: 3, stealth: 2, athletics: 2, influence: 2 },
    specs: { piloting: "Ground Craft", engineering: "Automotive Mechanic" },
    knowledge: ["Drone models", "Smuggling routes", "Seattle streets", "Engines"],
    karmaToNuyen: 10,
  },
  {
    id: "adept", archetype: "Adept", role: "Magic turned inward: reflexes, fists and impossible agility.",
    metatype: "human", magicType: "adept",
    priorities: { attributes: "A", magic: "B", skills: "C", metatype: "D", resources: "E" },
    attr: { body: 4, agility: 5, reaction: 4, strength: 3, willpower: 3, logic: 1, intuition: 3, charisma: 1 },
    attrKar: { intuition: 1, charisma: 1 },
    adjEdge: 2, adjMagic: 2,
    skills: { "close-combat": 6, athletics: 4, stealth: 4, perception: 4, firearms: 2 },
    specs: { "close-combat": "Unarmed Combat" },
    knowledge: ["Martial arts styles", "Meditation"],
  },
];

export const PREMADES: Premade[] = [
  {
    build: "samurai", name: "Dmitri Kask", alias: "Brick", portrait: "brick",
    concept: "Ex-Lone Star tactical officer who sells the only thing the Star taught him.",
    background: "Grew up in Redmond, joined Lone Star for the steady pay and left after a raid that went wrong in all the ways the report did not mention. Bone lacing from a street clinic, a rifle he trusts more than people, and a reputation for finishing the job.",
    gear: [
      item("weapons-ares-alpha"), item("weapons-ares-predator-vi"), item("weapons-katana"),
      item("ammo-rifle-rounds", { qty: 10 }), item("ammo-heavy-pistol-rounds", { qty: 6 }),
      item("augmentations-bone-lacing-titanium"), item("augmentations-bone-density-augmentation-rating-3"),
      est("Armor jacket", "armor", 1000, { armor: 4, worn: true }),
      item("identity-fake-sin", { rating: 4, name: "Fake SIN" }), item("identity-fake-license", { rating: 4, name: "Firearms license" }),
      item("identity-docwagon-platinum-contract-1-year"),
    ],
    lifestyle: "middle", months: 11, link: 2,
    contacts: [{ name: "Sergeant Vale", role: "Lone Star desk sergeant", connection: 3, loyalty: 2 }, { name: "Tink", role: "Street doc", connection: 2, loyalty: 3 }],
  },
  {
    build: "decker", name: "Mara Voss", alias: "Cipher",
    concept: "Corporate burnout who found out what her employer was hiding and never logged off.",
    background: "Spent six years writing compliance software for a Renraku subsidiary. One audit too many showed her where the bodies were filed. She walked out with a cyberjack, a grudge and a lot of other people's passwords.",
    gear: [
      item("augmentations-cyberjack-2"), item("weapons-fichetti-security-600"), item("ammo-light-pistol-rounds", { qty: 4 }),
      est("Armor clothing", "armor", 500, { armor: 2, worn: true }),
      item("identity-fake-sin", { rating: 4, name: "Fake SIN" }), item("identity-docwagon-gold-contract-1-year"),
      item("electronics-rfid-tags-stealth", { qty: 2 }), item("tools-tool-kit", { name: "Electronics tool kit" }),
    ],
    lifestyle: "middle", months: 9, deck: 2, link: 3,
    contacts: [{ name: "Null Pointer", role: "Data haven broker", connection: 4, loyalty: 2 }, { name: "Mr. Shiro", role: "Fixer", connection: 3, loyalty: 1 }],
  },
  {
    build: "mage", name: "Ilias Rhein", alias: "Ashfall", portrait: "ashfall",
    concept: "Dropped out of the Arcane Institute when the shadows paid better than tenure.",
    background: "A scholarship student who made the faculty nervous. He learned that a Stunball is a better argument than a thesis, and that the only people who pay for that kind of knowledge do not sign their names.",
    gear: [
      item("weapons-fichetti-security-600"), item("ammo-light-pistol-rounds", { qty: 2 }),
      item("magic-magical-lodge-material", { qty: 2 }), item("magic-reagent", { qty: 20, name: "Reagents (drams)" }),
      est("Lined coat", "armor", 900, { armor: 3, worn: true }),
      item("identity-fake-sin", { rating: 3, name: "Fake SIN" }),
    ],
    lifestyle: "low", months: 7, link: 1,
    contacts: [{ name: "Professor Hask", role: "Talismonger", connection: 3, loyalty: 3 }, { name: "Juno", role: "Fixer", connection: 3, loyalty: 1 }],
  },
  {
    build: "shaman", name: "Rowan Avery", alias: "Moss", metatype: "elf", portrait: "moss",
    concept: "Raised in the Barrens by a street doc; listens to the spirits of broken places.",
    background: "Moss never had a SIN. What she had was a voice in the rubble that answered when she asked. She patches up whoever needs it and calls the spirits when patching up is not enough.",
    gear: [
      item("weapons-defiance-super-shock"), item("weapons-combat-knife"),
      item("magic-reagent", { qty: 20, name: "Reagents (drams)" }), item("magic-magical-lodge-material"),
      item("identity-fake-sin", { rating: 1, name: "Fake SIN" }),
    ],
    lifestyle: "squatter", months: 3, link: 0,
    contacts: [{ name: "Doc Ferro", role: "Barrens street doc", connection: 2, loyalty: 4 }, { name: "Kettle", role: "Squatter gang boss", connection: 2, loyalty: 2 }],
  },
  {
    build: "face", name: "Celeste Arden", alias: "Velvet",
    concept: "A former talent agent who now books jobs instead of trid stars.",
    background: "Velvet knows everyone worth knowing and remembers what they owe her. She grew tired of making other people famous and started making them disappear instead.",
    gear: [
      item("weapons-colt-america-l36"), item("ammo-light-pistol-rounds", { qty: 2 }),
      est("Armor clothing", "armor", 500, { armor: 2, worn: true }),
      item("identity-fake-sin", { rating: 4, name: "Fake SIN" }), item("identity-fake-license", { rating: 4, name: "Concealed carry license" }),
      item("identity-docwagon-gold-contract-1-year"), item("identity-credstick-gold"),
    ],
    lifestyle: "high", months: 2, link: 4,
    contacts: [{ name: "Andre Lyle", role: "Mitsuhama mid-level exec", connection: 5, loyalty: 1 }, { name: "Sasha Ko", role: "Club owner", connection: 3, loyalty: 3 }, { name: "Mr. Shiro", role: "Fixer", connection: 3, loyalty: 2 }],
  },
  {
    build: "technomancer", name: "Jonah Reyes", alias: "Static",
    concept: "Woke up after the Crash 2.0 fever and could hear the Matrix singing.",
    background: "Static hides what he is from almost everyone. He speaks to machines the way other people breathe, pays his rent in favours, and trusts his sprites more than any runner he has met.",
    gear: [
      item("weapons-colt-america-l36"), item("ammo-light-pistol-rounds", { qty: 2 }),
      est("Armor clothing", "armor", 500, { armor: 2, worn: true }),
      item("identity-fake-sin", { rating: 2, name: "Fake SIN" }), item("identity-docwagon-basic-contract-1-month"),
    ],
    lifestyle: "low", months: 4,
    contacts: [{ name: "Patch", role: "Hardware fence", connection: 2, loyalty: 3 }, { name: "Echo", role: "Otaku mentor", connection: 3, loyalty: 4 }],
  },
  {
    build: "samurai", name: "Vesna Orlova", alias: "Vex", portrait: "vex",
    concept: "Ganger turned gun-for-hire who still settles every argument up close.",
    background: "Vex ran with the Ancients until the gang ran out of uses for her. She kept the shotgun, the bone lacing and the habit of walking into rooms first. Loyal to whoever pays on time, and to nobody who doesn't.",
    gear: [
      item("weapons-mossberg-cmdt"), item("ammo-shotgun-rounds", { qty: 10 }), item("weapons-ares-predator-vi"), item("ammo-heavy-pistol-rounds", { qty: 4 }), item("weapons-combat-knife"),
      item("augmentations-bone-lacing-aluminum"), item("augmentations-bone-density-augmentation-rating-2"),
      est("Armor vest", "armor", 500, { armor: 3, worn: true }),
      item("identity-fake-sin", { rating: 4, name: "Fake SIN" }), item("identity-fake-license", { rating: 4, name: "Firearms license" }),
      item("identity-docwagon-platinum-contract-1-year"),
    ],
    lifestyle: "middle", months: 15, link: 1,
    contacts: [{ name: "Grease", role: "Ancients lieutenant", connection: 3, loyalty: 2 }, { name: "Mama Iva", role: "Fence", connection: 2, loyalty: 3 }],
  },
  {
    build: "samurai-elf", name: "Liane Varga", alias: "Nightshade", portrait: "nightshade",
    concept: "Ex-Tir Ghost washout with a cybereye and a long rifle; never misses twice.",
    background: "Nightshade washed out of Tir special forces for asking the wrong officer the wrong question. She took the training, the tattoos and a grudge to Seattle, where people pay well for someone who can wait on a rooftop for six hours.",
    gear: [
      item("weapons-ruger-101"), item("ammo-rifle-rounds", { qty: 10 }), item("weapons-ares-predator-vi"), item("ammo-heavy-pistol-rounds", { qty: 4 }),
      item("augmentations-bone-lacing-plastic"),
      est("Armor jacket", "armor", 1000, { armor: 4, worn: true }),
      item("identity-fake-sin", { rating: 4, name: "Fake SIN" }), item("identity-fake-license", { rating: 4, name: "Firearms license" }),
      item("identity-docwagon-platinum-contract-1-year"), item("tools-grapple-gun"),
    ],
    lifestyle: "middle", months: 13, link: 2,
    contacts: [{ name: "Corran", role: "Tir smuggler", connection: 3, loyalty: 2 }, { name: "Mr. Shiro", role: "Fixer", connection: 3, loyalty: 1 }],
  },
  {
    build: "samurai-elf", name: "Kai Morrow", alias: "Rook", portrait: "rook",
    concept: "Salish-Shidhe border runner who traded the forest for neon and never looked back.",
    background: "Rook grew up running contraband over the Salish border and learned to shoot before he learned to drive. The tribal ink is real, the smile is not. He works with a rifle, a katana and the quiet certainty that he is the fastest person in any room.",
    gear: [
      item("weapons-ares-alpha"), item("ammo-rifle-rounds", { qty: 10 }), item("weapons-katana"), item("weapons-colt-government-2076"), item("ammo-heavy-pistol-rounds", { qty: 4 }),
      item("augmentations-bone-lacing-aluminum"), item("augmentations-bone-density-augmentation-rating-4"),
      est("Armor jacket", "armor", 1000, { armor: 4, worn: true }),
      item("identity-fake-sin", { rating: 4, name: "Fake SIN" }), item("identity-fake-license", { rating: 4, name: "Firearms license" }),
      item("identity-docwagon-gold-contract-1-year"), item("tools-tool-kit"), item("tools-grapple-gun"),
    ],
    lifestyle: "middle", months: 13, link: 2,
    contacts: [{ name: "Aunt Winona", role: "Salish-Shidhe trader", connection: 3, loyalty: 4 }, { name: "Juno", role: "Fixer", connection: 3, loyalty: 1 }],
  },
  {
    build: "mage", name: "Dorian Vey", alias: "Cinder", portrait: "cinder",
    concept: "Street mage who burns bright, burns fast, and leaves the coat on.",
    background: "Cinder learned magic from a dog-eared grimoire and a lot of mistakes. Fire answers him easily, which he thinks is a gift and his friends think is a warning. He charges extra for jobs where things need to stop existing.",
    gear: [
      item("weapons-ruger-super-warhawk"), item("ammo-heavy-pistol-rounds", { qty: 2 }),
      est("Lined coat", "armor", 900, { armor: 3, worn: true }),
      item("magic-reagent", { qty: 30, name: "Reagents (drams)" }), item("magic-magical-lodge-material"),
      item("identity-fake-sin", { rating: 2, name: "Fake SIN" }), item("identity-docwagon-basic-contract-1-year"),
    ],
    lifestyle: "low", months: 6, link: 1,
    contacts: [{ name: "Old Saul", role: "Talismonger", connection: 2, loyalty: 3 }, { name: "Mr. Shiro", role: "Fixer", connection: 3, loyalty: 1 }],
  },
  {
    build: "shaman", name: "Teren Ashwood", alias: "Thorn", metatype: "elf", portrait: "thorn",
    concept: "Follows the old forest spirits into the concrete, where they are angriest.",
    background: "Thorn left the Salish woods because the spirits told him the city was sick. He wears his tradition on his skin, carries his fetishes on his jacket, and the spirit that walks beside him does not like anyone else very much.",
    gear: [
      item("weapons-knife"), item("weapons-yamaha-pulsar-i"),
      item("magic-reagent", { qty: 20, name: "Reagents (drams)" }), item("magic-magical-lodge-material"),
      item("identity-fake-sin", { rating: 1, name: "Fake SIN" }),
    ],
    lifestyle: "squatter", months: 3, link: 0,
    contacts: [{ name: "Grandmother Cedar", role: "Tribal elder", connection: 3, loyalty: 4 }, { name: "Kettle", role: "Squatter gang boss", connection: 2, loyalty: 2 }],
  },
  {
    build: "shaman", name: "Marcus Bell", alias: "Spark", portrait: "spark",
    concept: "Nineteen, awakened last winter, and nobody has told him to be careful yet.",
    background: "Spark woke up in a Redmond alley with blue fire in his hands and no idea why. A spirit has been teaching him since, in its own way. He is cocky, broke, and much more dangerous than he looks.",
    gear: [
      item("weapons-streetline-special"), item("ammo-holdout-rounds", { qty: 2 }), item("weapons-knife"),
      item("magic-reagent", { qty: 10, name: "Reagents (drams)" }),
      item("identity-fake-sin", { rating: 1, name: "Fake SIN" }), item("identity-docwagon-basic-contract-1-month"), item("identity-credstick-standard"),
    ],
    lifestyle: "squatter", months: 4, link: 0,
    contacts: [{ name: "Dex", role: "Gutter punk", connection: 1, loyalty: 4 }, { name: "Doc Ferro", role: "Barrens street doc", connection: 2, loyalty: 2 }],
  },
  {
    build: "rigger", name: "Bjorn Halvard", alias: "Gearbox", portrait: "gearbox",
    concept: "Grizzled dwarf wheelman who talks to engines more kindly than to people.",
    background: "Gearbox drove for the Mafia, then for the Yakuza, then for whoever paid in cash. He has a van that has outrun three Lone Star pursuits and a drone named after his ex-wife. Smokes when nervous, which is always.",
    gear: [
      item("weapons-remington-roomsweeper"), item("ammo-shotgun-rounds", { qty: 4 }),
      est("Armor jacket", "armor", 1000, { armor: 4, worn: true }),
      item("tools-tool-shop", { name: "Automotive tool shop" }), item("tools-tool-kit"),
      item("electronics-sensor-array", { rating: 4, name: "Sensor array" }), item("electronics-rfid-tags-sensor", { qty: 2 }),
      item("identity-fake-sin", { rating: 4, name: "Fake SIN" }), item("identity-fake-license", { rating: 4, name: "Driver's license" }),
      item("identity-docwagon-gold-contract-1-year"),
    ],
    lifestyle: "middle", months: 4, link: 2, rcc: 1,
    vehicles: [
      { name: "Getaway van", kind: "vehicle", note: "Not in the gear list yet: enter stats and price from the book." },
      { name: "Spotter drone \"Helga\"", kind: "drone", note: "Not in the gear list yet: enter stats and price from the book." },
    ],
    contacts: [{ name: "Sal Bertucci", role: "Mafia capo", connection: 4, loyalty: 1 }, { name: "Patch", role: "Hardware fence", connection: 2, loyalty: 3 }],
  },
];

/** Character from a build: the numbers only, ready for the Forge. */
export function fromBuild(b: Build): Character {
  const c = newCharacter();
  c.archetype = b.archetype;
  c.metatype = b.metatype;
  c.magicType = b.magicType;
  c.priorities = { ...b.priorities };
  for (const [a, v] of Object.entries(b.attr)) c.attrPts[a as AttrKey] = v ?? 0;
  for (const [a, v] of Object.entries(b.attrKar ?? {})) c.attrKar[a as AttrKey] = v ?? 0;
  c.adjRacial = { ...(b.adjRacial ?? {}) };
  c.adjEdge = b.adjEdge;
  c.adjMagic = b.adjMagic ?? 0;
  for (const [id, n] of Object.entries(b.skills)) c.skills[id] = { pts: n, kar: 0 };
  for (const [id, sp] of Object.entries(b.specs ?? {})) if (c.skills[id]) { c.skills[id].spec = sp; c.skills[id].specVia = "karma"; }
  const k = (name: string, kind: KnowledgeSkill["kind"], native = false): KnowledgeSkill => ({ id: uid("k"), name, kind, ...(native ? { native } : {}) });
  c.knowledge = [k("English", "language", true), ...b.knowledge.map((n) => k(n, "knowledge")), ...(b.languages ?? []).map((n) => k(n, "language"))];
  c.qualities = (b.qualities ?? []).map((q) => ({ ...q, id: uid("q") }));
  c.spells = [...(b.spells ?? [])];
  c.complexForms = [...(b.forms ?? [])];
  if (b.tradition) c.tradition = b.tradition;
  c.karmaToNuyen = b.karmaToNuyen ?? 0;
  return c;
}

/** A complete, named runner with gear and contacts, marked finished. */
export function fromPremade(p: Premade): Character {
  const b = BUILDS.find((x) => x.id === p.build)!;
  const c = fromBuild(b);
  if (p.metatype) c.metatype = p.metatype;
  c.name = p.name;
  c.alias = p.alias;
  c.concept = p.concept;
  c.background = p.background;
  c.gear = p.gear.map((g) => ({ ...JSON.parse(JSON.stringify(g)), id: uid("g") }));
  c.lifestyle = p.lifestyle;
  c.lifestyleMonths = p.months;
  c.contacts = p.contacts.map((x) => ({ ...x, id: uid("ct") }));
  editExt(c, (ex) => {
    if (p.deck != null) { const d = CYBERDECKS[p.deck]; ex.matrix.deck = { name: d.name, rating: d.rating, a: d.a, s: d.s, slots: d.slots }; }
    if (p.link != null) { const l = COMMLINKS[p.link]; ex.matrix.link = { kind: "commlink", name: l.name, rating: l.rating, d: l.d, f: l.f, slots: l.slots, dice: 0 }; }
    if (p.rcc != null) ex.rcc = { ...RCCS[p.rcc] };
    for (const v of p.vehicles ?? []) ex.vehicles.push({ ...newVehicle(v.kind), name: v.name, note: v.note });
  });
  if (p.deck != null) c.gear.push({ id: uid("g"), name: CYBERDECKS[p.deck].name, category: "commlink", cost: 0, qty: 1, notes: "Not priced in the gear list yet." });
  if (p.rcc != null) c.gear.push({ id: uid("g"), name: RCCS[p.rcc].name, category: "commlink", cost: 0, qty: 1, notes: "Not priced in the gear list yet." });
  if (p.link != null) c.gear.push({ id: uid("g"), name: COMMLINKS[p.link].name, category: "commlink", cost: 0, qty: 1, notes: "Not priced in the gear list yet." });
  return c;
}

export const TEMPLATES = BUILDS.filter((b) => !b.hidden);
export const portraitUrl = (p: Premade) => (p.portrait ? `/portraits/${p.portrait}.jpg` : undefined);
