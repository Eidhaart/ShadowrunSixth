/**
 * Item templates from Commlink 6's core data: which mounts and Capacity slots an item has, which
 * accessories come built in, where an accessory can go and what it costs there, and rating tables.
 * Names and pages only; the write-ups come from the user's own rulebook.
 */
import raw from "@/data/c6-gear.json";

/** A number, a "$RATING*500" formula, or a table indexed like the rating options. */
export type C6Val = number | string | { tab: (number | string | null)[] } | null | undefined;
type Pair = [string, C6Val];

export interface C6Variant { id: string; n?: string; use?: Pair[]; implant?: boolean; price?: C6Val; avail?: C6Val; legal?: "L" | "I"; ess?: C6Val; t?: string }
export interface C6Item {
  id: string; n: string; t: string; s: string; p?: number;
  price?: C6Val; avail?: C6Val; legal?: "L" | "I"; ess?: C6Val; count?: boolean; ratings?: number[];
  w?: { dv?: string; ar?: (number | null)[]; modes?: string | null; ammo?: string | null; skill?: string | null; spec?: string | null };
  a?: { def?: number; soc?: number };
  m?: { dr?: C6Val; a?: number; s?: number; d?: number; f?: number; prog?: number };
  hooks?: Pair[];
  inc?: [string, string, string | null][];
  use?: Pair[];
  var?: C6Variant[];
  /** Only for these hosts: template ids, subtypes or types (any one is enough). */
  req?: { g?: string[]; s?: string[]; t?: string[] };
}
interface C6Data { types: Record<string, string>; subtypes: Record<string, string>; hooks: Record<string, string>; items: C6Item[] }

export const C6 = raw as unknown as C6Data;
export const C6_BY_ID = new Map(C6.items.map((i) => [i.id, i]));

/** Name key shared by both catalogs: no brackets, no "rating 3"/"capacity 3", letters and digits only. */
export const nameKey = (s: string) =>
  s.toLowerCase().replace(/\(.*?\)/g, "").replace(/,?\s*(rating|capacity|force)\s*\d+/g, "").replace(/\bseries\b/g, "").replace(/[^a-z0-9]/g, "");

/** Names that differ between the Seattle gear list and Commlink 6. */
const ALIAS: Record<string, string> = {
  "coltgovernment2076": "colt_government_2076", "coltgovernmentmanhunter": "colt_manhunter", "aressupersquirt": "ares_s3_super_squirt",
  "silencersuppressor": "silencer", "smartgunsysteminternal": "smartgun_system", "smartgunsystemexternal": "smartgun_system",
  "rangerarmssm5": "ranger_arms_sm6", "defiancet250shortbarrel": "defiance_t250_shortbarrel",
};
const BY_KEY = new Map<string, C6Item>();
for (const i of C6.items) if (!BY_KEY.has(nameKey(i.n))) BY_KEY.set(nameKey(i.n), i);

/** The Commlink 6 template for a gear name, if there is one. */
export function c6For(name: string): C6Item | undefined {
  const k = nameKey(name);
  const a = ALIAS[k];
  return (a && C6_BY_ID.get(a)) || BY_KEY.get(k);
}

/** The rating in a gear name ("Goggles, capacity 4" → 4). */
export const ratingIn = (name: string): number | undefined => {
  const m = /(?:rating|capacity|force)\s*(\d+)/i.exec(name);
  return m ? Number(m[1]) : undefined;
};

/** Evaluate a template value for a rating: plain numbers, $RATING formulas and rating tables. */
export function c6Val(v: C6Val, rating = 1, ratings?: number[]): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "object" && "tab" in v) {
    const i = ratings ? Math.max(0, ratings.indexOf(rating)) : Math.max(0, rating - 1);
    const x = v.tab[Math.min(i, v.tab.length - 1)];
    return x == null ? null : typeof x === "number" ? x : c6Val(x, rating, ratings);
  }
  const expr = String(v).replace(/\$RATING/g, String(rating)).replace(/\s+/g, "");
  if (!/^[\d.+\-*/()]+$/.test(expr)) return null;
  try {
    const n = Function(`"use strict";return (${expr})`)() as number;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export const hookLabel = (h: string) => C6.hooks[h] ?? h.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export interface Slot {
  hook: string;
  label: string;
  /** Capacity for slots that hold several things; null for a mount that takes one accessory. */
  capacity: number | null;
}

const HIDDEN = new Set(["SOFTWARE"]);

/** The mounts and Capacity slots of an item, for its rating. External slots only show when the item has them. */
export function slotsOf(t: C6Item | undefined, rating?: number): Slot[] {
  if (!t?.hooks) return [];
  // every firearm can have a smartgun system built in later (p. 260), so it always has an internal slot
  const hooks: Pair[] = t.t === "WEAPON_FIREARMS" && !t.hooks.some(([h]) => h === "INTERNAL") ? [...t.hooks, ["INTERNAL", null]] : t.hooks;
  return hooks
    .filter(([h]) => !HIDDEN.has(h))
    .map(([hook, v]) => {
      const cap = c6Val(v, rating ?? t.ratings?.[0] ?? 1, t.ratings);
      return { hook, label: hookLabel(hook), capacity: cap == null || cap >= 99 ? (cap == null ? null : Infinity) : cap };
    });
}

export interface Fit { variant?: C6Variant; size: number; price: number | null; avail: number | null; legal?: "L" | "I" }

/** Whether a template goes into a slot, as itself or as one of its variants, and what it costs there. */
export function fitsIn(t: C6Item, hook: string, rating = 1): Fit | null {
  const base = t.use?.find(([h]) => h === hook);
  if (base) return { size: c6Val(base[1], rating, t.ratings) ?? 0, price: c6Val(t.price, rating, t.ratings), avail: c6Val(t.avail, rating, t.ratings), legal: t.legal };
  for (const v of t.var ?? []) {
    // a variant named after the slot with no slot of its own (the internal smartgun) goes there
    if (!v.use && v.id.toUpperCase() === hook) return { variant: v, size: 0, price: c6Val(v.price ?? t.price, rating, t.ratings), avail: c6Val(v.avail ?? t.avail, rating, t.ratings), legal: v.legal ?? t.legal };
    const u = v.use?.find(([h]) => h === hook);
    if (u) return { variant: v, size: c6Val(u[1], rating, t.ratings) ?? 0, price: c6Val(v.price ?? t.price, rating, t.ratings), avail: c6Val(v.avail ?? t.avail, rating, t.ratings), legal: v.legal ?? t.legal };
  }
  return null;
}

/** Whether a template's own requirements allow this host (a Light Fire silencer only fits a Light Fire). */
export function meetsReq(t: C6Item, host?: C6Item): boolean {
  if (!t.req) return true;
  if (!host) return !t.req.g || !!t.req.s || !!t.req.t;
  return !!(t.req.g?.includes(host.id) || t.req.s?.includes(host.s) || t.req.t?.includes(host.t));
}

/** Every template that can go into a slot. */
export function forSlot(hook: string): C6Item[] {
  return C6.items.filter((t) => fitsIn(t, hook));
}

/** Mount and legacy slot fields so the existing loadout checks understand a slot install. */
export const MOUNT_OF: Record<string, "top" | "under" | "barrel"> = { TOP: "top", UNDER: "under", BARREL: "barrel" };
export const WEAPON_HOOKS = new Set(["TOP", "UNDER", "BARREL", "STOCK", "SIDE_L", "SIDE_R", "INTERNAL", "FIREARMS_EXTERNAL", "MELEE_EXTERNAL", "RANGED_EXTERNAL", "UNDER_WEAPON_MOUNT"]);
export const LEGACY_SLOT: Record<string, "eyes" | "ears" | "limb" | "armor" | "optical" | "audio"> = {
  CYBEREYE_IMPLANT: "eyes", CYBEREAR_IMPLANT: "ears", CYBERLIMB_IMPLANT: "limb", ARMOR: "armor", OPTICAL: "optical", AUDIO: "audio",
};
