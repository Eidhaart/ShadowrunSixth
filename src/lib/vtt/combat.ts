import { CELL, rangeBand, type Attack, type Bar, type BarKey, type Obj, type Scene, type Token, type Weapon } from "./types";

/**
 * Sixth World combat math for the table. An attack is an opposed test: the attack pool against
 * the target's Defense (Reaction + Intuition). More attacker hits is a hit, a tie is a graze (it
 * connects but deals no damage), fewer is a miss. Damage is DV plus net hits, minus the hits on the
 * damage resistance test (Body). Attack Rating against Defense Rating: a side 4 or more ahead gains 1 Edge.
 */

export const BANDS = ["Close", "Near", "Medium", "Far", "Extreme"] as const;

/** "4P", "3S(e)", "5" → 4 Physical, 3 Stun, 5 Physical. */
export function parseDv(dv: string | number | undefined): { dv: number; type: "P" | "S" } {
  if (typeof dv === "number") return { dv, type: "P" };
  const m = /(\d+)\s*([PS])?/i.exec(dv ?? "");
  return { dv: m ? Number(m[1]) : 0, type: m?.[2]?.toUpperCase() === "S" ? "S" : "P" };
}

export function distanceMeters(a: Obj, b: Obj, scene: Scene): number {
  const dx = a.x + a.w / 2 - (b.x + b.w / 2), dy = a.y + a.h / 2 - (b.y + b.h / 2);
  // edge to edge: big tokens are closer than their centers
  const reach = (Math.max(a.w, a.h) + Math.max(b.w, b.h)) / 2 - CELL;
  return Math.max(0, (Math.hypot(dx, dy) - Math.max(0, reach)) / CELL) * scene.scale;
}

export const bandIndex = (m: number) => BANDS.indexOf(rangeBand(m) as (typeof BANDS)[number]);

export function edgeFromRatings(ar: number, dr: number): Attack["edgeTo"] {
  if (ar - dr >= 4) return "attacker";
  if (dr - ar >= 4) return "defender";
  return null;
}

export function outcomeOf(attackHits: number, defenseHits: number): { outcome: NonNullable<Attack["outcome"]>; net: number } {
  if (attackHits <= 0) return { outcome: "miss", net: 0 };
  const net = attackHits - defenseHits;
  return { outcome: net > 0 ? "hit" : net === 0 ? "graze" : "miss", net: Math.max(0, net) };
}

export const damageAfter = (dv: number, net: number, soakHits: number) => Math.max(0, dv + net - soakHits);

/** -1 die per 3 boxes filled on each monitor. */
export function woundPenalty(bars: Token["bars"]): number {
  const rows = (b?: Bar) => (b && b.max > 0 ? Math.floor(Math.max(0, b.max - b.cur) / 3) : 0);
  return rows(bars.b1) + rows(bars.b2);
}

/**
 * Damage onto token bars (boxes left). Stun that does not fit spills into Physical; Physical past
 * the monitor is overflow. Returns the new bars, overflow boxes and whether the target is down.
 */
export function damageBars(bars: Token["bars"], boxes: number, type: "P" | "S"): { bars: Token["bars"]; overflow: number; down: boolean } {
  const b1 = bars.b1 ? { ...bars.b1 } : { cur: 0, max: 0 };
  const b2 = bars.b2 ? { ...bars.b2 } : undefined;
  let phys = boxes;
  if (type === "S" && b2) {
    const take = Math.min(boxes, b2.cur);
    b2.cur -= take;
    phys = boxes - take;
  }
  const take = Math.min(phys, b1.cur);
  b1.cur -= take;
  const overflow = phys - take;
  const out: Token["bars"] = { ...bars, b1 };
  if (b2) out.b2 = b2;
  return { bars: out, overflow, down: b1.cur <= 0 || (!!b2 && b2.cur <= 0) };
}

export const statsOf = (t: Token) => (t.npc ?? t.card) as { dr: number; weapons?: Weapon[]; defend?: number; soak?: number; pools: { label: string; dice: number }[] } | undefined;

/** Defense and soak pools, falling back to pools named like them on older tokens. */
export function defensePools(t: Token): { defend: number; soak: number } {
  const s = statsOf(t);
  const find = (re: RegExp) => s?.pools.find((p) => re.test(p.label))?.dice;
  return { defend: s?.defend ?? find(/defen/i) ?? 6, soak: s?.soak ?? find(/soak|body/i) ?? 4 };
}

export function weaponsOf(t: Token): Weapon[] {
  const s = statsOf(t);
  if (s?.weapons?.length) return s.weapons;
  // older stat blocks: an "Attack" pool becomes a basic weapon
  const atk = s?.pools.find((p) => /attack|pistol|rifle|gun|blade|fire|close/i.test(p.label));
  return atk ? [{ name: atk.label, pool: atk.dice, dv: 3, type: "P", ar: [8, 8, 6, null, null] }] : [];
}

/** Who rolls for a token: its runner's owner, its only named owner, else the GM. */
export function controllerOf(t: Token): string | null {
  if (t.runner) return t.runner.owner;
  const named = t.owners.filter((o) => o !== "*");
  return named.length === 1 ? named[0] : null;
}

export const BAR_KEYS: BarKey[] = ["b1", "b2", "b3"];
