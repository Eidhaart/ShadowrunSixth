/**
 * What is installed in what: implants in cybereyes, cyberears and cyberlimbs, modifications in armor,
 * enhancements in goggles and microphones, accessories on weapons. Pure functions over the gear list.
 */
import type { Character, GearItem, GearSlot } from "./character";
import { C6_BY_ID, LEGACY_SLOT, MOUNT_OF, WEAPON_HOOKS, c6For, ratingIn, slotsOf, type C6Item, type Slot } from "./c6";

type Gear = Pick<Character, "gear">;

export const SLOT_LABEL: Record<GearSlot, string> = {
  eyes: "cybereyes", ears: "cyberears", limb: "a cyberlimb", armor: "armor", optical: "an optical device", audio: "an audio device", weapon: "a weapon", melee: "a melee weapon",
};

/** Close-combat weapons: a weapon focus can only be one of these (p. 155). */
export const isMelee = (g: GearItem) =>
  g.category === "weapon" && (g.skill === "close-combat" || (g.skill === "exotic-weapons" && !!g.ar && g.ar[0] != null && g.ar.slice(1).every((v) => v == null)));

const canHold = (host: GearItem, slot: GearSlot) =>
  slot === "weapon" ? host.category === "weapon" : slot === "melee" ? isMelee(host) : host.holds === slot;

/** Items this one could go into. */
export function hostsFor(c: Gear, g: GearItem): GearItem[] {
  if (!g.fits) return [];
  return c.gear.filter((h) => h.id !== g.id && !h.inId && canHold(h, g.fits!));
}

/** The item it is installed in, if that item is still there. */
export function hostOf(c: Gear, g: GearItem): GearItem | undefined {
  if (!g.inId) return undefined;
  // put in a named mount or slot from the item's own editor: the host is whatever it was put in
  if (g.slot) return c.gear.find((x) => x.id === g.inId);
  if (!g.fits) return undefined;
  const h = c.gear.find((x) => x.id === g.inId);
  return h && canHold(h, g.fits) ? h : undefined;
}

export const installedIn = (c: Gear, host: GearItem): GearItem[] => c.gear.filter((g) => g.inId === host.id && hostOf(c, g) === host);

export const capacityUsed = (c: Gear, host: GearItem): number => installedIn(c, host).reduce((n, g) => n + (g.capCost ?? 0) * (g.qty || 1), 0);

// ---- Commlink 6 style mounts and slots ---------------------------------------------------------

/** The Commlink 6 template behind a gear item. */
export const templateOf = (g: GearItem): C6Item | undefined => (g.c6 ? C6_BY_ID.get(g.c6) : undefined) ?? c6For(g.name);
export const ratingOf = (g: GearItem): number | undefined => g.rating ?? ratingIn(g.name);
const REVERSE: Record<string, string> = Object.fromEntries(Object.entries(LEGACY_SLOT).map(([k, v]) => [v, k]));

/**
 * An item's mounts and Capacity slots. From its Commlink 6 template when there is one; otherwise a
 * firearm gets the usual top, underbarrel and barrel mounts and a Capacity item its one slot.
 */
export function slotsFor(g: GearItem): Slot[] {
  const t = templateOf(g);
  let out = slotsOf(t, ratingOf(g));
  if (!t) {
    if (g.category === "weapon" && (g.skill ?? "firearms") === "firearms") out = [{ hook: "TOP", label: "Top mount", capacity: null }, { hook: "UNDER", label: "Underbarrel mount", capacity: null }, { hook: "BARREL", label: "Barrel mount", capacity: null }];
    else if (g.capacity && g.holds && REVERSE[g.holds]) out = [{ hook: REVERSE[g.holds], label: g.holds === "armor" ? "Armor modifications" : `${g.holds[0].toUpperCase()}${g.holds.slice(1)} enhancements`, capacity: g.capacity }];
  }
  // the sheet's own Capacity (from the rulebook table) wins over the template's for a single Capacity slot
  const caps = out.filter((s) => s.capacity != null && s.capacity !== Infinity);
  if (caps.length === 1 && g.capacity) caps[0].capacity = g.capacity;
  return out;
}

/** What sits in one slot of a host. Legacy installs (no slot recorded) count toward the matching slot. */
export function inSlot(c: Gear, host: GearItem, s: Slot): GearItem[] {
  return installedIn(c, host).filter((k) => k.fits !== "melee" && (k.slot ? k.slot === s.hook : (MOUNT_OF[s.hook] && k.mount === MOUNT_OF[s.hook]) || (!MOUNT_OF[s.hook] && LEGACY_SLOT[s.hook] && k.fits === LEGACY_SLOT[s.hook])));
}

export const slotUsed = (c: Gear, host: GearItem, s: Slot) => inSlot(c, host, s).reduce((n, k) => n + (k.capCost ?? 0) * (k.qty || 1), 0);

/** Room in a slot for something of the given size: a mount holds one thing, a Capacity slot adds up. */
export function slotRoom(c: Gear, host: GearItem, s: Slot, size: number, except?: string): boolean {
  const kids = inSlot(c, host, s).filter((k) => k.id !== except);
  if (s.capacity == null) return kids.length === 0;
  if (s.capacity === Infinity) return true;
  return kids.reduce((n, k) => n + (k.capCost ?? 0) * (k.qty || 1), 0) + size <= s.capacity;
}

/** Put `g` into a slot of `host`, filling in the fields the older checks read. */
export function putInSlot(host: GearItem, g: GearItem, hook: string, size: number): void {
  g.inId = host.id;
  g.slot = hook;
  if (WEAPON_HOOKS.has(hook)) { g.fits = "weapon"; const m = MOUNT_OF[hook]; if (m) g.mount = m; else delete g.mount; }
  else if (LEGACY_SLOT[hook]) g.fits = LEGACY_SLOT[hook];
  g.capCost = size || undefined;
  if (!g.capCost) delete g.capCost;
}

/** Room left in a host for one more `g`; Infinity for weapons, which use mounts instead. */
export function roomFor(c: Gear, host: GearItem, g: GearItem): boolean {
  if (g.fits === "weapon") return true;
  if (g.fits === "melee") return !installedIn(c, host).some((k) => k.fits === "melee" && k.id !== g.id); // one focus per weapon
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
      if (kids.filter((k) => k.fits === "melee").length > 1) out.push({ level: "error", text: `${h.name}: a weapon can be only one weapon focus.` });
      // one accessory per mount; "top or under" takes whichever is free
      const taken = { top: 0, under: 0, barrel: 0 };
      let flex = 0;
      for (const k of kids.filter((x) => x.fits === "weapon")) { if (k.mount === "top-under") flex += k.qty || 1; else if (k.mount) taken[k.mount] += k.qty || 1; }
      if (taken.barrel > 1) out.push({ level: "error", text: `${h.name}: only one accessory fits the barrel mount.` });
      if (taken.top > 1 || taken.under > 1 || Math.min(taken.top, 1) + Math.min(taken.under, 1) + flex > 2)
        out.push({ level: "error", text: `${h.name}: the top and underbarrel mounts hold one accessory each.` });
    } else if (kids.some((k) => k.slot)) {
      const capSlots = slotsFor(h).filter((sl) => sl.capacity != null && sl.capacity !== Infinity);
      for (const sl of capSlots) {
        const used = slotUsed(c, h, sl);
        if (used > sl.capacity!) out.push({ level: "error", text: `${h.name}: ${capSlots.length > 1 ? `${sl.label.toLowerCase()} use` : "modifications use"} ${used} Capacity and it has ${sl.capacity}.` });
      }
    } else {
      const used = capacityUsed(c, h);
      if (used > (h.capacity ?? 0)) out.push({ level: "error", text: `${h.name}: modifications use ${used} Capacity and it has ${h.capacity ?? 0}.` });
    }
  }
  // things that only work inside something else
  for (const g of c.gear) {
    if (g.fits === "melee" && !hostOf(c, g)) { out.push({ level: "warn", text: `${g.name} is not part of a weapon: choose the melee weapon it is, or it gives no bonus.` }); continue; }
    if (!g.fits || g.fits === "weapon" || hostOf(c, g)) continue;
    const needsHost = !g.essence; // eyeware and earware can also be implanted on their own, for Essence
    if (needsHost) out.push({ level: "warn", text: `${g.name} is not installed: put it in ${SLOT_LABEL[g.fits]}.` });
  }
  return out;
}
