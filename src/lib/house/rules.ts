/**
 * House rules: a GM's own take on the Sixth World. A ruleset holds numeric and switch overrides of
 * the mechanics the deck computes, plus homebrew items, rule notes and statuses. Every value has a
 * book default, so an empty ruleset plays exactly by the book.
 *
 * The active ruleset lives in a module variable so pure rule code (derive, combat math) can read it
 * without React. The store in ./store.ts keeps it current.
 */

export type TieRule = "graze" | "hit" | "miss";

export interface Mechanics {
  // combat
  tie: TieRule;
  edgeGap: number;
  edgeGain: number;
  zeroHitsMiss: boolean;
  /** Armor adds to the damage resistance pool (an older-edition habit many tables keep). */
  armorSoaks: boolean;
  /** Boxes of Stun that turn into one box of Physical once the Stun monitor is full. */
  stunSpill: number;
  // condition
  woundEvery: number;
  physBase: number;
  stunBase: number;
  overflowMult: number;
  // edge and initiative
  maxEdge: number;
  initDiceCap: number;
  minorBase: number;
  rerollRounds: boolean;
  // creation and advancement
  startKarma: number;
  maxUnspent: number;
  nuyenPerKarma: number;
  creationAvail: number;
  karmaCostPct: number;
}

export interface HouseItem {
  id: string;
  name: string;
  /** "augmentations" is the old name for cyberware, still found in saved items. */
  cat: "weapons" | "armor" | "cyberware" | "bioware" | "augmentations" | "electronics" | "tools" | "magic" | "vehicles" | "drones" | "ammo" | "identity" | "matrix";
  group: string;
  cost: number | null;
  avail?: number;
  legal?: "L" | "I";
  /** Weapons */
  dv?: string;
  ar?: (number | null)[];
  skill?: string;
  /** Armor: Defense Rating bonus */
  armor?: number;
  /** Augmentations */
  essence?: number;
  note?: string;
}

export interface HouseNote { id: string; title: string; text: string; tags: string[]; secret?: boolean }
export interface HouseStatus { id: string; name: string; text: string }

export interface Ruleset {
  id: string;
  name: string;
  blurb: string;
  updatedAt: number;
  /** Only the values that differ from the book. */
  mech: Partial<Mechanics>;
  items: HouseItem[];
  notes: HouseNote[];
  statuses: HouseStatus[];
}

export const BOOK: Mechanics = {
  tie: "graze",
  edgeGap: 4,
  edgeGain: 1,
  zeroHitsMiss: true,
  armorSoaks: false,
  stunSpill: 1,
  woundEvery: 3,
  physBase: 8,
  stunBase: 8,
  overflowMult: 2,
  maxEdge: 7,
  initDiceCap: 5,
  minorBase: 1,
  rerollRounds: true,
  startKarma: 50,
  maxUnspent: 5,
  nuyenPerKarma: 2000,
  creationAvail: 6,
  karmaCostPct: 100,
};

type Kind =
  | { kind: "num"; min: number; max: number; step?: number; unit?: string }
  | { kind: "bool" }
  | { kind: "choice"; options: { v: string; label: string }[] };

export interface Field { key: keyof Mechanics; label: string; help: string; group: Group; spec: Kind }
export type Group = "Combat" | "Damage and wounds" | "Edge and initiative" | "Creation and advancement";
export const GROUPS: { id: Group; blurb: string }[] = [
  { id: "Combat", blurb: "How attacks resolve at the table" },
  { id: "Damage and wounds", blurb: "Condition monitors, soak and the cost of getting hurt" },
  { id: "Edge and initiative", blurb: "Edge limits, the turn and Minor actions" },
  { id: "Creation and advancement", blurb: "The Forge budget and the price of growth" },
];

export const FIELDS: Field[] = [
  { key: "tie", group: "Combat", label: "When attack and defense hits tie", help: "The book calls a tie a graze: it connects, no damage.", spec: { kind: "choice", options: [{ v: "graze", label: "Graze, no damage" }, { v: "hit", label: "Hit, DV only" }, { v: "miss", label: "Miss" }] } },
  { key: "zeroHitsMiss", group: "Combat", label: "An attack with no hits always misses", help: "Turn off to let a 0 v 0 tie use the tie rule above.", spec: { kind: "bool" } },
  { key: "edgeGap", group: "Combat", label: "Lead in AR against DR that earns Edge", help: "Whoever is this far ahead gains Edge.", spec: { kind: "num", min: 1, max: 12 } },
  { key: "edgeGain", group: "Combat", label: "Edge gained from that lead", help: "Per attack.", spec: { kind: "num", min: 0, max: 3 } },
  { key: "armorSoaks", group: "Damage and wounds", label: "Armor adds to damage resistance", help: "The book resists with Body alone; armor raises Defense Rating instead.", spec: { kind: "bool" } },
  { key: "stunSpill", group: "Damage and wounds", label: "Stun boxes per Physical box once Stun is full", help: "1 spills box for box. 2 makes knockouts gentler.", spec: { kind: "num", min: 1, max: 4 } },
  { key: "woundEvery", group: "Damage and wounds", label: "Boxes per −1 wound modifier", help: "Lower is grittier.", spec: { kind: "num", min: 1, max: 10, unit: "boxes" } },
  { key: "physBase", group: "Damage and wounds", label: "Physical monitor base", help: "Boxes before half Body is added.", spec: { kind: "num", min: 1, max: 20 } },
  { key: "stunBase", group: "Damage and wounds", label: "Stun monitor base", help: "Boxes before half Willpower is added.", spec: { kind: "num", min: 1, max: 20 } },
  { key: "overflowMult", group: "Damage and wounds", label: "Overflow boxes per point of Body", help: "Past this you are dead.", spec: { kind: "num", min: 0, max: 5 } },
  { key: "maxEdge", group: "Edge and initiative", label: "Most Edge you can hold", help: "Gains past this are lost.", spec: { kind: "num", min: 1, max: 12 } },
  { key: "initDiceCap", group: "Edge and initiative", label: "Most initiative dice", help: "", spec: { kind: "num", min: 1, max: 8, unit: "D6" } },
  { key: "minorBase", group: "Edge and initiative", label: "Minor actions before initiative dice", help: "Minor actions are this plus your initiative dice.", spec: { kind: "num", min: 0, max: 4 } },
  { key: "rerollRounds", group: "Edge and initiative", label: "Reroll NPC initiative each round", help: "Off keeps the first roll all fight.", spec: { kind: "bool" } },
  { key: "startKarma", group: "Creation and advancement", label: "Karma to customize a new runner", help: "", spec: { kind: "num", min: 0, max: 200, step: 5 } },
  { key: "maxUnspent", group: "Creation and advancement", label: "Unspent Karma a runner may start with", help: "", spec: { kind: "num", min: 0, max: 50 } },
  { key: "nuyenPerKarma", group: "Creation and advancement", label: "Nuyen per Karma at creation", help: "", spec: { kind: "num", min: 0, max: 10000, step: 500, unit: "¥" } },
  { key: "creationAvail", group: "Creation and advancement", label: "Highest Availability at creation", help: "", spec: { kind: "num", min: 1, max: 20 } },
  { key: "karmaCostPct", group: "Creation and advancement", label: "Karma cost of advancement", help: "Scales every price on the Advance tab.", spec: { kind: "num", min: 25, max: 300, step: 25, unit: "%" } },
];

export function emptyRuleset(name = "My table"): Ruleset {
  return { id: `rs${Date.now().toString(36)}`, name, blurb: "", updatedAt: Date.now(), mech: {}, items: [], notes: [], statuses: [] };
}

export const PRESETS: { id: string; name: string; blurb: string; mech: Partial<Mechanics> }[] = [
  { id: "book", name: "By the book", blurb: "Sixth World core rules, untouched.", mech: {} },
  { id: "gritty", name: "Gritty streets", blurb: "Wounds bite early, ties miss, Edge is scarce. Every fight is a bad idea.", mech: { tie: "miss", woundEvery: 2, edgeGap: 5, maxEdge: 5, physBase: 7, stunBase: 7 } },
  { id: "cinematic", name: "Chrome and action", blurb: "Ties still hit, armor soaks, Edge flows. Runners are the action heroes.", mech: { tie: "hit", armorSoaks: true, edgeGap: 3, woundEvery: 4, maxEdge: 9 } },
  { id: "veteran", name: "Prime runners", blurb: "Experienced crews: more Karma, deeper gear access, cheaper growth.", mech: { startKarma: 100, maxUnspent: 10, creationAvail: 8, karmaCostPct: 75 } },
  { id: "classic", name: "Old school", blurb: "Armor soaks damage and Stun spills slowly, like earlier editions.", mech: { armorSoaks: true, stunSpill: 2, overflowMult: 1 } },
];

let active: Mechanics = BOOK;
let activeSet: Ruleset | null = null;

export function setActiveRules(rs: Ruleset | null) {
  activeSet = rs;
  active = { ...BOOK, ...(rs?.mech ?? {}) };
}

/** The mechanics in force right now. */
export const rules = (): Mechanics => active;
export const activeRuleset = () => activeSet;

/** Values that differ from the book, ready to list. */
export function diffs(m: Partial<Mechanics>): Field[] {
  return FIELDS.filter((f) => m[f.key] !== undefined && m[f.key] !== BOOK[f.key]);
}

export function show(f: Field, v: Mechanics[keyof Mechanics]): string {
  if (f.spec.kind === "bool") return v ? "Yes" : "No";
  if (f.spec.kind === "choice") return f.spec.options.find((o) => o.v === v)?.label ?? String(v);
  return `${v}${f.spec.unit ? (f.spec.unit === "%" ? "%" : ` ${f.spec.unit}`) : ""}`;
}

/** Keep only known keys with sane values, so an imported file cannot break the deck. */
export function sanitize(raw: unknown): Ruleset | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Ruleset>;
  const mech: Partial<Mechanics> = {};
  for (const f of FIELDS) {
    const v = (r.mech as Record<string, unknown> | undefined)?.[f.key];
    if (v === undefined) continue;
    if (f.spec.kind === "num" && typeof v === "number" && Number.isFinite(v)) (mech as Record<string, unknown>)[f.key] = Math.max(f.spec.min, Math.min(f.spec.max, v));
    if (f.spec.kind === "bool" && typeof v === "boolean") (mech as Record<string, unknown>)[f.key] = v;
    if (f.spec.kind === "choice" && f.spec.options.some((o) => o.v === v)) (mech as Record<string, unknown>)[f.key] = v;
  }
  const str = (x: unknown, n: number) => (typeof x === "string" ? x.slice(0, n) : "");
  const arr = <T,>(x: unknown, n: number): T[] => (Array.isArray(x) ? (x.slice(0, n) as T[]) : []);
  return {
    id: str(r.id, 40) || `rs${Date.now().toString(36)}`,
    name: str(r.name, 60) || "Imported rules",
    blurb: str(r.blurb, 400),
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : Date.now(),
    mech,
    items: arr<HouseItem>(r.items, 400).filter((i) => i && typeof i.name === "string").map((i) => ({ ...i, id: str(i.id, 40) || `hi${Math.random().toString(36).slice(2, 8)}`, name: str(i.name, 80), group: str(i.group, 40), note: i.note ? str(i.note, 600) : undefined })),
    notes: arr<HouseNote>(r.notes, 300).filter((n) => n && typeof n.title === "string").map((n) => ({ id: str(n.id, 40) || `hn${Math.random().toString(36).slice(2, 8)}`, title: str(n.title, 120), text: str(n.text, 6000), tags: arr<string>(n.tags, 8).map((t) => str(t, 24)), secret: !!n.secret })),
    statuses: arr<HouseStatus>(r.statuses, 60).filter((s) => s && typeof s.name === "string").map((s) => ({ id: str(s.id, 40) || `hs${Math.random().toString(36).slice(2, 8)}`, name: str(s.name, 24), text: str(s.text, 400) })),
  };
}

/** What players receive: secret notes stay with the GM. */
export function publicView(rs: Ruleset): Ruleset {
  return { ...rs, notes: rs.notes.filter((n) => !n.secret) };
}
