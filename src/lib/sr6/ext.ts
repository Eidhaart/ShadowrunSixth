import type { Character } from "./character";
import type { Derived } from "./derive";
import { d6 } from "./dice";
import {
  JUMPED_IN, PROGRAMS, SPELL_BY_NAME, SPIRITS, SPRITES,
  type MatrixAction, type Rcc, type SpellDef, type SpiritType, type SpriteType,
} from "./rules6";

/** Everything the extra sheet tabs store. All optional on the character so old runners keep loading. */

export interface Program { id: string; defId: string; name: string; note: string; active: boolean }
export interface DeckGear { name: string; rating: number; a: number; s: number; slots: number }
export interface LinkGear { kind: "commlink" | "cyberjack"; name: string; rating: number; d: number; f: number; slots: number; dice: number }
export type Assign = [number, number, number, number];

export interface MatrixGear {
  deck: DeckGear | null;
  link: LinkGear | null;
  /** For Attack, Sleaze, Data Processing, Firewall: which of [deck A, deck S, link D, link F] it takes. A permutation of 0..3. */
  assign: Assign;
  programs: Program[];
}

export type SimMode = "ar" | "cold" | "hot";
export interface Sprite { id: string; type: string; level: number; tasks: number; registered: boolean; damage: number; note: string }
export interface Spirit { id: string; type: string; force: number; services: number; bound: boolean; damage: number; note: string }
export interface Focus { id: string; name: string; kind: string; rating: number; bonded: boolean; active: boolean }
export interface Vehicle {
  id: string; name: string; kind: "vehicle" | "drone";
  handlingOn: number; handlingOff: number; accel: number; speedInterval: number; topSpeed: number;
  body: number; armor: number; pilot: number; sensor: number; seats: number;
  /** Current speed, in the same unit as the speed interval. */
  speed: number;
  damage: number;
  /** Rigger is jumped in: uses mental attributes instead of Physical ones. */
  jumped: boolean;
  offroad: boolean;
  /** Maneuvering and Targeting autosoft ratings for remote control. */
  maneuver: number; targeting: number;
  note: string;
}
export interface CustomAction { id: string; name: string; skill: string; attr: string; legal: boolean }

export interface SheetExt {
  matrix: MatrixGear;
  mode: SimMode;
  /** Matrix condition damage taken on the device. */
  matrixDamage: number;
  overwatch: number;
  noise: number;
  overclock: boolean;
  fullDefense: boolean;
  /** Technomancer living-persona bonus points on Attack, Sleaze, Data Processing, Firewall. */
  tmBonus: [number, number, number, number];
  customActions: CustomAction[];
  sprites: Sprite[];
  spirits: Spirit[];
  foci: Focus[];
  /** Names of spells and complex forms being sustained. Each costs 2 dice on every test. */
  sustained: string[];
  /** Manual drain or fading values for spells and forms the tables do not cover, keyed by lowercase name. */
  dv: Record<string, number>;
  vehicles: Vehicle[];
  rcc: Rcc | null;
}

export const emptyMatrix = (): MatrixGear => ({ deck: null, link: null, assign: [0, 1, 2, 3], programs: [] });

export const emptyExt = (): SheetExt => ({
  matrix: emptyMatrix(), mode: "ar", matrixDamage: 0, overwatch: 0, noise: 0, overclock: false, fullDefense: false,
  tmBonus: [0, 0, 0, 0], customActions: [], sprites: [], spirits: [], foci: [], sustained: [], dv: {}, vehicles: [], rcc: null,
});

const num = (v: unknown, fb = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fb);
const isAssign = (a: unknown): a is Assign => Array.isArray(a) && a.length === 4 && [0, 1, 2, 3].every((i) => a.includes(i));

/** Fill defaults and upgrade shapes saved by earlier versions. */
export function getExt(c: Character): SheetExt {
  const raw = (c.ext ?? {}) as Partial<SheetExt> & Record<string, unknown>;
  const base = emptyExt();
  const m = (raw.matrix ?? {}) as Partial<MatrixGear>;
  const matrix: MatrixGear = {
    deck: m.deck ?? null,
    link: m.link ?? null,
    assign: isAssign(m.assign) ? m.assign : [0, 1, 2, 3],
    programs: Array.isArray(m.programs) ? m.programs : [],
  };
  const spirits = (Array.isArray(raw.spirits) ? raw.spirits : []).map((s) => {
    const o = s as unknown as Record<string, unknown>;
    return { id: String(o.id), type: String(o.type ?? "air").toLowerCase(), force: num(o.force, 1), services: num(o.services), bound: !!o.bound, damage: num(o.damage), note: String(o.note ?? "") } as Spirit;
  });
  const sprites = (Array.isArray(raw.sprites) ? raw.sprites : []).map((s) => {
    const o = s as unknown as Record<string, unknown>;
    return { id: String(o.id), type: String(o.type ?? "courier").toLowerCase(), level: num(o.level ?? o.rating, 1), tasks: num(o.tasks), registered: !!o.registered, damage: num(o.damage), note: String(o.note ?? "") } as Sprite;
  });
  const vehicles = (Array.isArray(raw.vehicles) ? raw.vehicles : []).map((v) => {
    const o = v as unknown as Record<string, unknown>;
    const nv = newVehicle(o.kind === "vehicle" ? "vehicle" : "drone");
    return { ...nv, ...(o as Partial<Vehicle>), handlingOn: num(o.handlingOn ?? o.handling, nv.handlingOn), handlingOff: num(o.handlingOff ?? o.handling, nv.handlingOff), speed: o.speedInterval ? num(o.speed) : 0 } as Vehicle;
  });
  return {
    ...base,
    ...(raw as Partial<SheetExt>),
    matrix, spirits, sprites, vehicles,
    tmBonus: Array.isArray(raw.tmBonus) && raw.tmBonus.length === 4 ? (raw.tmBonus as SheetExt["tmBonus"]) : base.tmBonus,
    customActions: Array.isArray(raw.customActions) ? raw.customActions.map((a) => ({ ...a, legal: (a as Partial<CustomAction>).legal ?? false })) : [],
    sustained: Array.isArray(raw.sustained) ? raw.sustained : [],
    dv: raw.dv && typeof raw.dv === "object" ? raw.dv : {},
    foci: Array.isArray(raw.foci) ? raw.foci : [],
  };
}

/** Edit the ext block in place inside a store update. */
export function editExt(c: Character, fn: (e: SheetExt) => void): void {
  const e = getExt(c);
  fn(e);
  c.ext = e;
}

export const xid = (p = "x") => `${p}_${Math.random().toString(36).slice(2, 9)}`;

let pendingSeq = 0;
/** Unique key for a fresh prompt, safe to call from event handlers. */
export const nextPendingId = () => ++pendingSeq;

/** Roll `n` dice and count hits (5 and 6). Used for the other side of an opposed test the GM would roll. */
export function rollHits(n: number): number {
  let h = 0;
  for (let i = 0; i < Math.max(0, n); i++) if (d6() >= 5) h++;
  return h;
}

/* ------------------------------------------------------------------ Matrix */

export const MATRIX_SLOTS = ["attack", "sleaze", "dp", "fw"] as const;
export type MatrixSlot = (typeof MATRIX_SLOTS)[number];
export const SLOT_LABEL: Record<MatrixSlot, string> = { attack: "Attack", sleaze: "Sleaze", dp: "Data Processing", fw: "Firewall" };

/** Give `slot` the value at `valueIndex`, swapping with whichever slot had it so every value stays used once. */
export function arrange(assign: Assign, slot: number, valueIndex: number): Assign {
  const next = [...assign] as Assign;
  const other = next.indexOf(valueIndex);
  if (other >= 0 && other !== slot) next[other] = next[slot];
  next[slot] = valueIndex;
  return next;
}

/** Best values first, in the given order of slots (0 attack, 1 sleaze, 2 dp, 3 firewall). */
export function arrangeBy(values: number[], order: number[]): Assign {
  const idx = [0, 1, 2, 3].sort((a, b) => values[b] - values[a] || a - b);
  const out: Assign = [0, 1, 2, 3];
  order.forEach((slot, rank) => { out[slot] = idx[rank]; });
  return out;
}
export const PRESETS: { name: string; blurb: string; order: number[] }[] = [
  { name: "Attacker", blurb: "Attack, Sleaze, Data Processing, Firewall", order: [0, 1, 2, 3] },
  { name: "Infiltrator", blurb: "Sleaze, Attack, Firewall, Data Processing", order: [1, 0, 3, 2] },
  { name: "Analyst", blurb: "Data Processing, Sleaze, Firewall, Attack", order: [3, 1, 0, 2] },
  { name: "Defender", blurb: "Firewall, Data Processing, Sleaze, Attack", order: [3, 2, 1, 0] },
];

export const gearValues = (g: MatrixGear): number[] => [g.deck?.a ?? 0, g.deck?.s ?? 0, g.link?.d ?? 0, g.link?.f ?? 0];

/** A technomancer's bonus point cap on one attribute: half its base rounded up, never more than 4. */
export const tmCap = (base: number) => Math.min(4, Math.ceil(base / 2));

/** Spread Resonance bonus points in priority order, respecting the per-attribute cap. */
export function autoTmBonus(base: number[], resonance: number, order: number[]): SheetExt["tmBonus"] {
  const out: SheetExt["tmBonus"] = [0, 0, 0, 0];
  let left = resonance;
  for (const slot of order) {
    const put = Math.min(left, tmCap(base[slot]));
    out[slot] = put;
    left -= put;
  }
  return out;
}

export interface MatrixStats {
  source: "deck" | "persona" | "none";
  name: string;
  rating: number;
  attack: number;
  sleaze: number;
  dp: number;
  fw: number;
  /** Matrix condition monitor boxes, 0 for a living persona (it uses Stun). */
  boxes: number;
  attackRating: number;
  defenseRating: number;
  slots: number;
  slotsUsed: number;
  /** Dice penalty from damage to the device: −1 per 3 full boxes. */
  damagePenalty: number;
  /** Net noise after Signal Scrubber. */
  noise: number;
  init: { rank: number; dice: number };
  /** Bonus points a technomancer has spent, and the base values they started from. */
  tm?: { base: number[]; spent: number; bonus: number[] };
}

const active = (g: MatrixGear, defId: string) => g.programs.some((p) => p.active && p.defId === defId);

export function programSlots(g: MatrixGear): { cap: number; used: number } {
  const cap = (g.deck?.slots ?? g.link?.slots ?? 0) + (active(g, "vm") ? 2 : 0);
  const used = g.programs.filter((p) => p.active && p.defId !== "vm").length + (active(g, "vm") ? 1 : 0);
  return { cap, used };
}

export function matrixStats(c: Character, d: Derived): MatrixStats {
  const e = getExt(c);
  const g = e.matrix;
  const mode = e.mode;
  const slots = programSlots(g);
  const noise = Math.max(0, e.noise - (active(g, "scrubber") ? 2 : 0));
  const armor = active(g, "armor") ? PROGRAMS.find((p) => p.id === "armor")?.defense ?? 0 : 0;
  const toolbox = active(g, "toolbox") ? PROGRAMS.find((p) => p.id === "toolbox")?.dp ?? 0 : 0;
  const finish = (s: { source: MatrixStats["source"]; name: string; rating: number; attack: number; sleaze: number; dp: number; fw: number; boxes: number; init: MatrixStats["init"]; tm?: MatrixStats["tm"] }): MatrixStats => {
    const dp = s.dp + toolbox;
    return {
      ...s, dp, slots: slots.cap, slotsUsed: slots.used, noise,
      attackRating: s.attack + s.sleaze,
      defenseRating: dp + s.fw + armor,
      damagePenalty: s.boxes ? Math.floor(Math.min(e.matrixDamage, s.boxes) / 3) : 0,
    };
  };
  if (c.magicType === "technomancer") {
    const base = [d.attrs.charisma, d.attrs.intuition, d.attrs.logic, d.attrs.willpower];
    let left = d.resonance;
    const bonus = base.map((b, i) => {
      const put = Math.max(0, Math.min(e.tmBonus[i] ?? 0, tmCap(b), left));
      left -= put;
      return put;
    });
    const v = base.map((b, i) => b + bonus[i]);
    return finish({
      source: "persona", name: "Living persona", rating: d.resonance, attack: v[0], sleaze: v[1], dp: v[2], fw: v[3], boxes: 0,
      init: { rank: d.attrs.logic + d.attrs.intuition, dice: mode === "ar" ? d.initiative.dice : Math.min(5, 1 + (mode === "hot" ? 2 : 1)) },
      tm: { base, spent: d.resonance - left, bonus },
    });
  }
  if (!g.deck && !g.link) {
    return finish({ source: "none", name: "No deck", rating: 0, attack: 0, sleaze: 0, dp: 0, fw: 0, boxes: 0, init: { rank: d.initiative.rank, dice: d.initiative.dice } });
  }
  const vals = gearValues(g);
  const at = (i: number) => vals[g.assign[i]] ?? 0;
  const rating = g.deck?.rating ?? g.link?.rating ?? 0;
  const vrDice = mode === "hot" ? 2 : mode === "cold" ? 1 : 0;
  const dp = at(2) + toolbox;
  return finish({
    source: "deck",
    name: [g.deck?.name, g.link?.name].filter(Boolean).join(" + "),
    rating, attack: at(0), sleaze: at(1), dp: at(2), fw: at(3),
    boxes: 8 + Math.ceil(rating / 2),
    init: mode === "ar"
      ? { rank: d.initiative.rank, dice: d.initiative.dice }
      : { rank: d.attrs.intuition + dp, dice: Math.min(5, 1 + vrDice + (g.link?.kind === "cyberjack" ? g.link.dice : 0)) },
  });
}

/** Dice adjustments to a Matrix action, with a short explanation. */
export function actionAdjust(a: Pick<MatrixAction, "linked"> | { linked?: "attack" | "sleaze" }, m: MatrixStats, e: SheetExt): { adjust: number; parts: string[] } {
  const parts: string[] = [];
  let adjust = 0;
  if (e.overclock && active(e.matrix, "overclock")) { adjust += 2; parts.push("Overclock +2"); }
  if (m.noise > 0) { adjust -= m.noise; parts.push(`noise −${m.noise}`); }
  if (m.damagePenalty > 0) { adjust -= m.damagePenalty; parts.push(`damage −${m.damagePenalty}`); }
  if (a.linked) {
    const low = m.attack <= m.sleaze ? "attack" : "sleaze";
    const diff = Math.abs(m.attack - m.sleaze);
    if (a.linked === low && diff > 0) { adjust -= diff; parts.push(`${a.linked} is your lower: −${diff}`); }
  }
  return { adjust, parts };
}

/** Overwatch gained by an illegal action: all the defender's hits (not net), plus 1 if a hacking program modified it. */
export const overwatchGain = (defenderHits: number, hackingProgram: boolean) => Math.max(0, defenderHits) + (hackingProgram ? 1 : 0);

export const DUMPSHOCK_DV = 3;
/** Cold-sim dumpshock is Stun, hot-sim is Physical. Biofeedback is resisted with Willpower. */
export const biofeedbackType = (mode: SimMode): "S" | "P" => (mode === "hot" ? "P" : "S");

/* ------------------------------------------------------------------ Magic */

export const SUSTAIN_PENALTY = 2;
export const sustainPenalty = (e: SheetExt) => e.sustained.length * SUSTAIN_PENALTY;

/** Find a known spell in the table, tolerating a suffix like "Increase Attribute (Body)". */
export function findSpell(name: string): SpellDef | undefined {
  const k = name.trim().toLowerCase();
  return SPELL_BY_NAME[k] ?? SPELL_BY_NAME[k.replace(/\s*[([].*$/, "")];
}

export interface CastAdjust { amp: number; area: number }
export function adjustCap(magic: number, sorcery: number) { return Math.max(magic, sorcery); }

/** Drain Value: base +2 per Amp Up point of damage, +1 per extra 2 m of radius. */
export const drainValue = (base: number, adj: CastAdjust) => Math.max(1, base + adj.amp * 2 + adj.area);

/** Indirect: ceil(Magic/2) + net hits + Amp Up. Direct: net hits + Amp Up, not resisted. */
export function spellDamage(kind: "direct" | "indirect", magic: number, netHits: number, amp: number) {
  return Math.max(0, (kind === "indirect" ? Math.ceil(magic / 2) : 0) + Math.max(0, netHits) + amp);
}

/** Drain turns Physical when what gets through is higher than Magic. */
export const drainIsPhysical = (damage: number, magic: number) => damage > magic;

export const FOCUS_KINDS = ["Power", "Spell", "Spirit", "Weapon", "Qi", "Sustaining", "Banishing", "Other"];

export interface SpiritBlock {
  attrs: number[]; init: number; initDice: number; astralInit: number; defense: number; boxes: number; attackRating: number;
  attack: { name: string; dv: number; dmg: "P" | "S" }; move: number; powers: string;
}
export const spiritType = (id: string): SpiritType | undefined => SPIRITS.find((s) => s.id === id || s.name.toLowerCase() === id);
export function spiritBlock(t: SpiritType, force: number): SpiritBlock {
  return {
    attrs: t.attrs.map((o) => Math.max(1, force + o)),
    init: force * 2 + t.init,
    initDice: 2,
    astralInit: force * 2,
    defense: force + t.defense,
    boxes: Math.ceil(force / 2) + 8,
    attackRating: force * 2,
    attack: { name: t.attack.name, dv: t.attack.dvKind === "force" ? force : Math.ceil(force / 2), dmg: t.attack.dmg },
    move: t.move,
    powers: t.powers,
  };
}

export interface SpriteBlock { attack: number; sleaze: number; dp: number; fw: number; init: number; initDice: number; boxes: number; attackRating: number; defenseRating: number }
export const spriteType = (id: string): SpriteType | undefined => SPRITES.find((s) => s.id === id || s.name.toLowerCase() === id);
export function spriteBlock(t: SpriteType, level: number): SpriteBlock {
  const a = Math.max(1, level + t.a), s = Math.max(1, level + t.s), dp = Math.max(1, level + t.d), fw = Math.max(1, level + t.f);
  return { attack: a, sleaze: s, dp, fw, init: level * 2 + t.init, initDice: 4, boxes: Math.ceil(level / 2) + 8, attackRating: a + s, defenseRating: dp + fw };
}

/* ------------------------------------------------------------------ Rigging */

export const vehicleBoxes = (v: Pick<Vehicle, "body">) => Math.ceil(v.body / 2) + 8;

export function newVehicle(kind: Vehicle["kind"] = "drone"): Vehicle {
  return {
    id: xid("v"), name: kind === "drone" ? "New drone" : "New vehicle", kind,
    handlingOn: 4, handlingOff: 5, accel: 9, speedInterval: 20, topSpeed: 160, body: 4, armor: 4, pilot: 3, sensor: 3, seats: kind === "drone" ? 0 : 4,
    speed: 0, damage: 0, jumped: false, offroad: false, maneuver: 0, targeting: 0, note: "",
  };
}

export interface VehicleStats {
  boxes: number;
  /** Handling threshold: on or off road, +1 per 3 boxes of damage. */
  handling: number;
  /** Cumulative −1 per Speed Interval passed, on Handling tests and attacks. */
  speedPenalty: number;
  attackRating: number;
  defenseRating: number;
  /** Physical damage when ramming: Body ÷ 2 (up) plus 1 per Speed Interval. */
  ramDamage: number;
  /** Dice for Piloting tests: the rigger's skill and attribute (jumped in: Intuition for Reaction), or the drone's Pilot and Maneuvering autosoft. */
  pilotPool: { base: number; label: string; blocked: boolean };
  autosofts: number;
  /** Drone initiative: Pilot × 2 plus 4D6. */
  init: number;
}
export function vehicleStats(c: Character, d: Derived, v: Vehicle): VehicleStats {
  const rank = c.skills.piloting ? c.skills.piloting.pts + c.skills.piloting.kar : 0;
  const reactionLike = v.jumped ? d.attrs.intuition : d.attrs.reaction;
  const remote = v.kind === "drone" && !v.jumped;
  const driverPiloting = remote ? v.pilot : rank;
  const pilotPool = remote
    ? { base: v.pilot + v.maneuver, label: `Pilot ${v.pilot} + Maneuvering ${v.maneuver}`, blocked: false }
    : rank > 0
      ? { base: rank + reactionLike, label: `Piloting ${rank} + ${v.jumped ? "Intuition" : "Reaction"} ${reactionLike}`, blocked: false }
      : { base: Math.max(0, reactionLike - 1), label: `${v.jumped ? "Intuition" : "Reaction"} ${reactionLike} − 1 untrained`, blocked: true };
  const intervals = v.speedInterval > 0 ? Math.floor(v.speed / v.speedInterval) : 0;
  const boxes = vehicleBoxes(v);
  return {
    boxes,
    handling: (v.offroad ? v.handlingOff : v.handlingOn) + Math.floor(Math.min(v.damage, boxes) / 3),
    speedPenalty: intervals,
    attackRating: driverPiloting + v.sensor,
    defenseRating: driverPiloting + v.armor,
    ramDamage: Math.ceil(v.body / 2) + intervals,
    pilotPool,
    autosofts: Math.ceil(v.pilot / 2),
    init: v.pilot * 2,
  };
}

/** Jumped-in attribute that replaces a physical one. */
export const jumpedAttr = (attr: string) => JUMPED_IN[attr] ?? attr;
