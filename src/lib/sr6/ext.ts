import type { Character } from "./character";
import type { Derived } from "./derive";

/** Everything the extra sheet tabs store. Optional on the character so old runners keep loading. */
export interface Program { id: string; name: string; note: string }
export interface Deck {
  name: string;
  /** Device Rating. */
  rating: number;
  /** The four numbers the deck provides. Each is assigned to one Matrix attribute. */
  array: [number, number, number, number];
  /** For Attack, Sleaze, Data Processing, Firewall: which array entry it uses. A permutation of 0..3. */
  assign: [number, number, number, number];
  programs: Program[];
  note: string;
}
export type SimMode = "ar" | "cold" | "hot";
export interface Sprite { id: string; type: string; rating: number; tasks: number; note: string }
export interface Spirit { id: string; type: string; force: number; services: number; bound: boolean; note: string }
export interface Focus { id: string; name: string; kind: string; rating: number; bonded: boolean; active: boolean }
export interface Vehicle {
  id: string; name: string; kind: "vehicle" | "drone";
  handling: number; speed: number; accel: number; body: number; armor: number; pilot: number; sensor: number;
  /** Condition boxes; 0 uses the default for the kind. */
  boxes: number; damage: number; note: string;
}
export interface CustomAction { id: string; name: string; skill: string; attr: string; limit: "attack" | "sleaze" | "dp" | "fw" | "none" }

export interface SheetExt {
  deck: Deck | null;
  mode: SimMode;
  /** Matrix condition damage taken. */
  matrixDamage: number;
  overwatch: number;
  customActions: CustomAction[];
  sprites: Sprite[];
  /** Attribute added to Willpower to resist fading. */
  fadeAttr: string;
  /** Drain or fading formula per spell or complex form name. "F" is the Force or Level. */
  formulas: Record<string, string>;
  spirits: Spirit[];
  foci: Focus[];
  /** Names of spells being sustained. Each costs 2 dice on every test. */
  sustained: string[];
  vehicles: Vehicle[];
}

export const emptyExt = (): SheetExt => ({
  deck: null, mode: "ar", matrixDamage: 0, overwatch: 0, customActions: [], sprites: [], fadeAttr: "resonance",
  formulas: {}, spirits: [], foci: [], sustained: [], vehicles: [],
});

export function getExt(c: Character): SheetExt {
  return { ...emptyExt(), ...(c.ext ?? {}) };
}

/** Edit the ext block in place inside a store update. */
export function editExt(c: Character, fn: (e: SheetExt) => void): void {
  const e = getExt(c);
  fn(e);
  c.ext = e;
}

export const xid = (p = "x") => `${p}_${Math.random().toString(36).slice(2, 9)}`;

export function newDeck(rating = 2, name = ""): Deck {
  const r = Math.max(1, Math.min(6, rating));
  return { name: name || `Deck rating ${r}`, rating: r, array: [r + 3, r + 2, r + 1, r], assign: [0, 1, 2, 3], programs: [], note: "" };
}

export const MATRIX_SLOTS = ["attack", "sleaze", "dp", "fw"] as const;
export type MatrixSlot = (typeof MATRIX_SLOTS)[number];
export const SLOT_LABEL: Record<MatrixSlot, string> = { attack: "Attack", sleaze: "Sleaze", dp: "Data Processing", fw: "Firewall" };
export const SLOT_ABBR: Record<MatrixSlot, string> = { attack: "A", sleaze: "S", dp: "D", fw: "F" };

/** Give `slot` the array entry at `valueIndex`, swapping with whichever slot had it so every entry stays used once. */
export function arrange(deck: Deck, slot: number, valueIndex: number): Deck {
  const assign = [...deck.assign] as Deck["assign"];
  const other = assign.indexOf(valueIndex);
  if (other >= 0 && other !== slot) assign[other] = assign[slot];
  assign[slot] = valueIndex;
  return { ...deck, assign };
}

export interface MatrixStats {
  source: "deck" | "persona" | "none";
  name: string;
  rating: number;
  attack: number;
  sleaze: number;
  dp: number;
  fw: number;
  condition: number;
  /** Attack Rating (Attack + Sleaze) and Defense Rating (Data Processing + Firewall) in the Matrix. */
  attackRating: number;
  defenseRating: number;
  init: { rank: number; dice: number };
}

export function matrixStats(c: Character, d: Derived): MatrixStats {
  const e = getExt(c);
  const dice = e.mode === "hot" ? 3 : e.mode === "cold" ? 2 : 1;
  const technomancer = c.magicType === "technomancer";
  let s: Omit<MatrixStats, "condition" | "attackRating" | "defenseRating" | "init"> & { source: MatrixStats["source"] };
  if (technomancer) {
    // A living persona: Charisma, Intuition, Logic and Willpower stand in for the deck.
    s = { source: "persona", name: "Living persona", rating: d.resonance, attack: d.attrs.charisma, sleaze: d.attrs.intuition, dp: d.attrs.logic, fw: d.attrs.willpower };
  } else if (e.deck) {
    const a = e.deck.array;
    const as = e.deck.assign;
    s = { source: "deck", name: e.deck.name, rating: e.deck.rating, attack: a[as[0]] ?? 0, sleaze: a[as[1]] ?? 0, dp: a[as[2]] ?? 0, fw: a[as[3]] ?? 0 };
  } else {
    s = { source: "none", name: "No deck", rating: 0, attack: 0, sleaze: 0, dp: 0, fw: 0 };
  }
  return {
    ...s,
    condition: 8 + Math.ceil(s.rating / 2),
    attackRating: s.attack + s.sleaze,
    defenseRating: s.dp + s.fw,
    init: { rank: s.dp + d.attrs.intuition, dice },
  };
}

export interface MatrixAction {
  id: string;
  name: string;
  group: "Attack" | "Sleaze" | "Data" | "Defense";
  skill: string;
  attr: string;
  limit: MatrixSlot | "none";
  /** What the target usually rolls. Check the book for edge cases. */
  against?: string;
  note: string;
  illegal?: boolean;
}

export const MATRIX_ACTIONS: MatrixAction[] = [
  { id: "brute", name: "Brute Force", group: "Attack", skill: "cracking", attr: "logic", limit: "attack", against: "Willpower + Firewall", note: "Loud. Net hits add to the damage.", illegal: true },
  { id: "spike", name: "Data Spike", group: "Attack", skill: "cracking", attr: "logic", limit: "attack", against: "Logic + Firewall", note: "Matrix damage to an icon, device or host.", illegal: true },
  { id: "crash", name: "Crash Program", group: "Attack", skill: "cracking", attr: "logic", limit: "attack", note: "Knock a running program offline.", illegal: true },
  { id: "jam", name: "Jam Signals", group: "Attack", skill: "cracking", attr: "logic", limit: "attack", note: "Block wireless in an area.", illegal: true },
  { id: "hotf", name: "Hack on the Fly", group: "Sleaze", skill: "cracking", attr: "logic", limit: "sleaze", against: "Intuition + Firewall", note: "Quiet access to a device or host.", illegal: true },
  { id: "control", name: "Control Device", group: "Sleaze", skill: "cracking", attr: "logic", limit: "sleaze", against: "Willpower + Firewall", note: "Take over a device you have access to.", illegal: true },
  { id: "spoof", name: "Spoof Command", group: "Sleaze", skill: "cracking", attr: "logic", limit: "sleaze", note: "Send a forged order to a device.", illegal: true },
  { id: "erase", name: "Erase Matrix Signature", group: "Sleaze", skill: "electronics", attr: "logic", limit: "sleaze", note: "Remove your mark from an icon.", illegal: true },
  { id: "edit", name: "Edit File", group: "Sleaze", skill: "electronics", attr: "logic", limit: "sleaze", note: "Change, copy or delete a file.", illegal: true },
  { id: "bomb", name: "Set Data Bomb", group: "Sleaze", skill: "electronics", attr: "logic", limit: "sleaze", note: "Trap a file against intruders.", illegal: true },
  { id: "hide", name: "Hide", group: "Sleaze", skill: "electronics", attr: "intuition", limit: "sleaze", note: "Slip out of sight in the Matrix." },
  { id: "percept", name: "Matrix Perception", group: "Data", skill: "electronics", attr: "intuition", limit: "dp", against: "Willpower + Sleaze", note: "Spot icons, files and marks." },
  { id: "search", name: "Matrix Search", group: "Data", skill: "electronics", attr: "intuition", limit: "dp", note: "Find information. Time depends on how obscure it is." },
  { id: "trace", name: "Trace Icon", group: "Data", skill: "electronics", attr: "intuition", limit: "dp", note: "Find the physical location behind an icon." },
  { id: "overwatch", name: "Check Overwatch Score", group: "Data", skill: "electronics", attr: "intuition", limit: "dp", note: "See how close the GOD is to converging." },
  { id: "reboot", name: "Reboot Device", group: "Data", skill: "electronics", attr: "logic", limit: "dp", note: "Restart a device you have access to." },
  { id: "defense", name: "Full Matrix Defense", group: "Defense", skill: "", attr: "willpower", limit: "fw", note: "Willpower + Firewall as a defense pool until your next turn." },
  { id: "jackout", name: "Jack Out", group: "Defense", skill: "", attr: "willpower", limit: "fw", note: "Leave the Matrix. Resisted if a program stops you." },
];

/**
 * Evaluate a drain or fading formula such as "F/2", "F-3" or "(F+1)/2". F is the Force or Level.
 * Division rounds up. Returns null for anything that is not a plain arithmetic formula.
 */
export function evalFormula(src: string, force: number): number | null {
  const s = src.replace(/\s+/g, "").toUpperCase();
  if (!s || !/^[F\d+\-*/().]+$/.test(s)) return null;
  let i = 0;
  const peek = () => s[i];
  const num = (): number => {
    if (peek() === "(") { i++; const v = expr(); if (peek() !== ")") throw new Error("paren"); i++; return v; }
    if (peek() === "F") { i++; return force; }
    if (peek() === "-") { i++; return -num(); }
    const m = /^\d+(\.\d+)?/.exec(s.slice(i));
    if (!m) throw new Error("num");
    i += m[0].length;
    return Number(m[0]);
  };
  const term = (): number => {
    let v = num();
    while (peek() === "*" || peek() === "/") {
      const op = s[i++];
      const r = num();
      v = op === "*" ? v * r : Math.ceil(v / r);
    }
    return v;
  };
  const expr = (): number => {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = s[i++];
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };
  try {
    const v = expr();
    if (i !== s.length || !Number.isFinite(v)) return null;
    return Math.max(1, Math.round(v));
  } catch {
    return null;
  }
}

/** Spell drain turns physical when the spell is cast above your Magic. */
export const drainIsPhysical = (force: number, magic: number) => force > magic;

export const SUSTAIN_PENALTY = 2;
export const sustainPenalty = (e: SheetExt) => e.sustained.length * SUSTAIN_PENALTY;

export const SPIRIT_TYPES = ["Air", "Beasts", "Earth", "Fire", "Man", "Water", "Guardian", "Guidance", "Plant", "Task", "Other"];
export const SPRITE_TYPES = ["Courier", "Crack", "Data", "Fault", "Machine", "Other"];
export const FOCUS_KINDS = ["Power", "Spell", "Spirit", "Weapon", "Qi", "Sustaining", "Banishing", "Other"];

export function vehicleBoxes(v: Vehicle): number {
  return v.boxes > 0 ? v.boxes : (v.kind === "drone" ? 6 : 12) + Math.ceil(v.body / 2);
}

export function newVehicle(kind: Vehicle["kind"] = "drone"): Vehicle {
  return { id: xid("v"), name: kind === "drone" ? "New drone" : "New vehicle", kind, handling: 4, speed: 3, accel: 3, body: 4, armor: 4, pilot: 3, sensor: 3, boxes: 0, damage: 0, note: "" };
}

let pendingSeq = 0;
/** Unique key for a fresh prompt, safe to call from event handlers. */
export const nextPendingId = () => ++pendingSeq;
