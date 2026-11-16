/**
 * What is installed in what: implants in cybereyes, cyberears and cyberlimbs, modifications in armor,
 * enhancements in goggles and microphones, accessories on weapons. Pure functions over the gear list.
 */
import type { Character, GearItem, GearSlot } from "./character";

type Gear = Pick<Character, "gear">;

export const SLOT_LABEL: Record<GearSlot, string> = {
  eyes: "cybereyes", ears: "cyberears", limb: "a cyberlimb", armor: "armor", optical: "an optical device", audio: "an audio device", weapon: "a weapon",
};

const canHold = (host: GearItem, slot: GearSlot) => (slot === "weapon" ? host.category === "weapon" : host.holds === slot);

/** Items this one could go into. */
export function hostsFor(c: Gear, g: GearItem): GearItem[] {
  if (!g.fits) return [];
  return c.gear.filter((h) => h.id !== g.id && !h.inId && canHold(h, g.fits!));
}

/** The item it is installed in, if that item is still there. */
export function hostOf(c: Gear, g: GearItem): GearItem | undefined {
  if (!g.inId || !g.fits) return undefined;
  const h = c.gear.find((x) => x.id === g.inId);
  return h && canHold(h, g.fits) ? h : undefined;
}

export const installedIn = (c: Gear, host: GearItem): GearItem[] => c.gear.filter((g) => g.inId === host.id && hostOf(c, g) === host);

export const capacityUsed = (c: Gear, host: GearItem): number => installedIn(c, host).reduce((n, g) => n + (g.capCost ?? 0) * (g.qty || 1), 0);

/** Room left in a host for one more `g`; Infinity for weapons, which use mounts instead. */
export function roomFor(c: Gear, host: GearItem, g: GearItem): boolean {
  if (g.fits === "weapon") return true;
  return capacityUsed(c, host) - (g.inId === host.id ? (g.capCost ?? 0) * (g.qty || 1) : 0) + (g.capCost ?? 0) * (g.qty || 1) <= (host.capacity ?? 0);
}

/**
 * Essence an item costs. An implant installed in cybereyes, cyberears or a cyberlimb uses that item's
 * Capacity instead of the body's Essence.
 */
export function essenceOf(c: Gear, g: GearItem): number {
  if (!g.essence) return 0;
  if ((g.category === "cyberware" || g.category === "bioware") && hostOf(c, g)) return 0;
  return g.essence * (g.qty || 1);
}

/** The gear list with installed items right under their host. */
export function ordered(c: Gear, items: GearItem[] = c.gear): { g: GearItem; host?: GearItem }[] {
  const out: { g: GearItem; host?: GearItem }[] = [];
  const shown = new Set(items.map((g) => g.id));
  for (const g of items) {
    const host = hostOf(c, g);
    if (host && shown.has(host.id)) continue; // listed under its host
    out.push({ g, host });
    for (const k of installedIn(c, g)) if (shown.has(k.id)) out.push({ g: k, host: g });
  }
  return out;
}

const hasSmartlink = (c: Gear) => c.gear.some((g) => /smartlink/i.test(g.name));

/**
 * Attack Ratings with the weapon's accessories applied: a smartgun system read through a smartlink adds 2,
 * a laser sight adds 1, and the two do not add up (p. 260).
 */
export function weaponAR(c: Gear, w: GearItem): { ar: (number | null)[]; bonus: number; why: string } {
  const base = (w.ar ?? [null, null, null, null, null]).map((v) => (v == null ? null : v));
  const on = installedIn(c, w);
  const smartgun = w.smartgun || on.some((a) => /^smartgun system/i.test(a.name));
  const bonus = smartgun && hasSmartlink(c) ? 2 : on.some((a) => /^laser sight/i.test(a.name)) ? 1 : 0;
  const why = bonus === 2 ? "smartgun and smartlink +2" : bonus === 1 ? "laser sight +1" : "";
  return { ar: bonus ? base.map((v) => (v == null ? null : v + bonus)) : base, bonus, why };
}

export interface LoadoutIssue { level: "error" | "warn"; text: string }

export function loadoutIssues(c: Gear): LoadoutIssue[] {
  const out: LoadoutIssue[] = [];
  for (const h of c.gear) {
    const kids = installedIn(c, h);
    if (!kids.length) continue;
    if (h.category === "weapon") {
      // one accessory per mount; "top or under" takes whichever is free
      const taken = { top: 0, under: 0, barrel: 0 };
      let flex = 0;
      for (const k of kids) { if (k.mount === "top-under") flex += k.qty || 1; else if (k.mount) taken[k.mount] += k.qty || 1; }
      if (taken.barrel > 1) out.push({ level: "error", text: `${h.name}: only one accessory fits the barrel mount.` });
      if (taken.top > 1 || taken.under > 1 || Math.min(taken.top, 1) + Math.min(taken.under, 1) + flex > 2)
        out.push({ level: "error", text: `${h.name}: the top and underbarrel mounts hold one accessory each.` });
    } else {
      const used = capacityUsed(c, h);
      if (used > (h.capacity ?? 0)) out.push({ level: "error", text: `${h.name}: modifications use ${used} Capacity and it has ${h.capacity ?? 0}.` });
    }
  }
  // things that only work inside something else
  for (const g of c.gear) {
    if (!g.fits || g.fits === "weapon" || hostOf(c, g)) continue;
    const needsHost = !g.essence; // eyeware and earware can also be implanted on their own, for Essence
    if (needsHost) out.push({ level: "warn", text: `${g.name} is not installed: put it in ${SLOT_LABEL[g.fits]}.` });
  }
  return out;
}
