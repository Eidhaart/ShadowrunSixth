export type SpellCat = "Combat" | "Detection" | "Health" | "Illusion" | "Manipulation";
export type SpellKind = "direct" | "indirect" | "utility";

export interface SpellDef {
  id: string;
  name: string;
  cat: SpellCat;
  kind: SpellKind;
  range: "Touch" | "LOS" | "LOS (A)";
  type: "M" | "P";
  duration: "I" | "S" | "L" | "P";
  dv: number;
  /** Damage type for combat spells. */
  dmg?: "S" | "P";
  area?: boolean;
  /** Fire, lightning and the like draw attention. */
  loud?: boolean;
  blurb: string;
}

const c = (id: string, name: string, kind: SpellKind, range: SpellDef["range"], type: "M" | "P", dv: number, dmg: "S" | "P", blurb: string, loud = false): SpellDef =>
  ({ id, name, cat: "Combat", kind, range, type, duration: "I", dv, dmg, area: range === "LOS (A)", loud, blurb });

/** The spells that appear in the lessons and simulation. DV, range and type come from the core rulebook. */
export const SPELLS: SpellDef[] = [
  c("stunbolt", "Stunbolt", "direct", "LOS", "M", 3, "S", "Mana bolt that only stuns. Quiet and cheap."),
  c("stunball", "Stunball", "direct", "LOS (A)", "M", 4, "S", "Stunbolt in an area."),
  c("manabolt", "Manabolt", "direct", "LOS", "M", 4, "P", "Pure mana damage. Ignores armor and soak."),
  c("manaball", "Manaball", "direct", "LOS (A)", "M", 5, "P", "Manabolt in an area."),
  c("powerbolt", "Powerbolt", "direct", "LOS", "P", 4, "P", "Direct damage that works on machines too."),
  c("powerball", "Powerball", "direct", "LOS (A)", "P", 5, "P", "Powerbolt in an area."),
  c("clout", "Clout", "indirect", "LOS", "P", 3, "S", "A shaped blow of air. Stun damage, no flames."),
  c("blast", "Blast", "indirect", "LOS (A)", "P", 4, "S", "Clout in an area."),
  c("flamestrike", "Flamestrike", "indirect", "LOS", "P", 5, "P", "Fire on one target. Sets them Burning.", true),
  c("fireball", "Fireball", "indirect", "LOS (A)", "P", 6, "P", "The classic. Fire in an area, and a very loud one.", true),
  c("lightningbolt", "Lightning Bolt", "indirect", "LOS", "P", 5, "P", "Electricity on one target.", true),
  c("lightningball", "Lightning Ball", "indirect", "LOS (A)", "P", 6, "P", "Electricity in an area.", true),
  c("icespear", "Ice Spear", "indirect", "LOS", "P", 5, "P", "Cold damage on one target."),
  c("icestorm", "Ice Storm", "indirect", "LOS (A)", "P", 6, "P", "Cold damage in an area."),
  { id: "invisibility", name: "Invisibility", cat: "Illusion", kind: "utility", range: "Touch", type: "M", duration: "S", dv: 3, blurb: "The target fades from living eyes. Hits on the cast are the threshold to see them. Cameras are not fooled." },
  { id: "improvedinvis", name: "Improved Invisibility", cat: "Illusion", kind: "utility", range: "Touch", type: "P", duration: "S", dv: 4, blurb: "As Invisibility, but it fools cameras and other technology too." },
  { id: "mask", name: "Mask", cat: "Illusion", kind: "utility", range: "Touch", type: "M", duration: "S", dv: 3, blurb: "Change how the target looks to living observers." },
  { id: "phantasm", name: "Trid Phantasm", cat: "Illusion", kind: "utility", range: "LOS (A)", type: "P", duration: "S", dv: 4, blurb: "A moving image fools living viewers and cameras alike." },
  { id: "sensorsneak", name: "Sensor Sneak", cat: "Illusion", kind: "utility", range: "Touch", type: "P", duration: "S", dv: 2, blurb: "Hides the target from cameras and sensors only. Living beings still see them." },
  { id: "analyze", name: "Analyze Device", cat: "Detection", kind: "utility", range: "Touch", type: "P", duration: "S", dv: 2, blurb: "Tells you what a strange device does. Net hits give you Edge on your first use." },
  { id: "combatsense", name: "Combat Sense", cat: "Detection", kind: "utility", range: "Touch", type: "M", duration: "S", dv: 3, blurb: "Net hits are added to the subject's Defense Rating and surprise tests while sustained." },
  { id: "cleansingheal", name: "Cleansing Heal", cat: "Health", kind: "utility", range: "Touch", type: "P", duration: "P", dv: 5, blurb: "Heals 1 box per net hit and clears the Corroded status. Cannot heal drain." },
];

export const SPELL = Object.fromEntries(SPELLS.map((s) => [s.id, s])) as Record<string, SpellDef>;

export type SpiritKey = "air" | "beasts" | "earth" | "fire" | "kin" | "water";

export interface SpiritDef {
  key: SpiritKey;
  name: string;
  /** Offsets from Force for Body, Agility, Reaction, Strength, Willpower, Logic, Intuition, Charisma. */
  off: { B: number; A: number; R: number; S: number; W: number; L: number; I: number; C: number };
  init: number;
  defense: number;
  note: string;
}

export const SPIRITS: SpiritDef[] = [
  { key: "air", name: "Air", off: { B: -2, A: 3, R: 4, S: -3, W: 0, L: 0, I: 0, C: 0 }, init: 4, defense: -2, note: "Very fast. Fragile and weak." },
  { key: "beasts", name: "Beasts", off: { B: 2, A: 1, R: 0, S: 2, W: 0, L: 0, I: 0, C: 0 }, init: 0, defense: 0, note: "Strong with sharp senses." },
  { key: "earth", name: "Earth", off: { B: 4, A: -2, R: -1, S: 4, W: 0, L: -1, I: 0, C: 0 }, init: -1, defense: 4, note: "Slow and very tough." },
  { key: "fire", name: "Fire", off: { B: 1, A: 2, R: 3, S: -2, W: 0, L: 0, I: 1, C: 0 }, init: 4, defense: 1, note: "Quick and hits hard with fire." },
  { key: "kin", name: "Kin", off: { B: 1, A: 0, R: 2, S: -2, W: 0, L: 0, I: 1, C: 0 }, init: 3, defense: 1, note: "The most person-like. Can carry one of your spells." },
  { key: "water", name: "Water", off: { B: 0, A: 1, R: 2, S: 0, W: 0, L: 0, I: 0, C: 0 }, init: 2, defense: 0, note: "Balanced. Allergic to fire." },
];

/** Concrete stats for a spirit at a given Force. Attributes never drop below 1. */
export function spiritStats(def: SpiritDef, force: number) {
  const a = (o: number) => Math.max(1, force + o);
  return {
    B: a(def.off.B), A: a(def.off.A), R: a(def.off.R), S: a(def.off.S), W: a(def.off.W), L: a(def.off.L), I: a(def.off.I), C: a(def.off.C),
    initiative: force * 2 + def.init,
    defense: force + def.defense,
    cm: Math.ceil(force / 2) + 8,
    attackRating: force * 2,
  };
}
