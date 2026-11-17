/**
 * Weapon foci (p. 155): a melee weapon made into a focus. The focus is bought as its own gear item,
 * installed on the weapon (inId), and tracked on the Magic tab as a focus record (gearId). It adds its
 * Force in dice to Attack tests with that weapon while it is bonded and active. It does not change the
 * weapon's Damage Value or Attack Rating.
 */
import type { Character, GearItem } from "./character";
import { getExt, type Focus } from "./ext";
import { bondKarma } from "./data";
import { hostOf, isMelee } from "./loadout";

type C = Pick<Character, "gear" | "ext">;

/** The focus record for a gear item, matched by id; older saves are matched by name. */
export function focusFor(c: C, g: GearItem): Focus | undefined {
  const foci = getExt(c as Character).foci;
  return foci.find((f) => f.gearId === g.id) ?? foci.find((f) => !f.gearId && f.name === g.name);
}

export interface FocusOnWeapon { item: GearItem; focus?: Focus; force: number; bonus: number; why: string }

/** The weapon focus that is part of this weapon, if any, and what it adds right now. */
export function weaponFocus(c: C, w: GearItem): FocusOnWeapon | undefined {
  if (!isMelee(w)) return undefined;
  const item = c.gear.find((g) => g.fits === "melee" && g.inId === w.id && hostOf(c, g) === w);
  if (!item) return undefined;
  const focus = focusFor(c, item);
  const force = focus?.rating ?? Number(/force (\d+)/i.exec(item.name)?.[1] ?? 0);
  const on = !!focus && focus.kind === "Weapon" && focus.bonded && focus.active;
  const why = !focus ? "no focus record on the Magic tab"
    : focus.kind !== "Weapon" ? `${focus.kind.toLowerCase()} focus, not a weapon focus`
    : !focus.bonded ? "not bonded" : !focus.active ? "not active" : `weapon focus Force ${force}`;
  return { item, focus, force, bonus: on ? force : 0, why };
}

/** Dice a weapon's focus adds to its Attack test: Force when bonded and active, else 0. */
export const weaponFocusBonus = (c: C, w: GearItem): number => weaponFocus(c, w)?.bonus ?? 0;

/** Melee weapons that are not a focus yet. */
export const focusableWeapons = (c: C): GearItem[] => c.gear.filter((w) => isMelee(w) && !weaponFocus(c, w));

/**
 * Bond or unbond a focus (pp. 154-155, Magical Goods table p. 295). Before play the cost comes out of
 * creation Karma through budget(); in play it is paid from earned Karma at once and never given back,
 * not on unbonding, losing or deleting the focus. Returns why it was refused, or "" when done.
 */
export function toggleBond(c: Character, focusId: string, magic: number): string {
  const ex = getExt(c);
  const f = ex.foci.find((q) => q.id === focusId);
  if (!f) return "No such focus.";
  if (f.bonded) {
    f.bonded = false;
    f.active = false;
    delete f.karma; // spent is spent; bonding again costs again
    c.ext = ex;
    return "";
  }
  if (c.magicType === "mundane" || c.magicType === "technomancer") return "Only the Awakened can bond foci.";
  const bonded = ex.foci.filter((q) => q.bonded);
  if (bonded.length >= magic) return `You can bond at most ${magic} foci (your Magic).`;
  if (f.rating > magic) return `Force ${f.rating} is above your Magic (${magic}).`;
  const force = bonded.reduce((n, q) => n + q.rating, 0);
  if (force + f.rating > magic * 5) return `Bonded Force would be ${force + f.rating}; the limit is Magic × 5 (${magic * 5}).`;
  const cost = bondKarma(f);
  if (c.stage === "complete") {
    const left = c.karmaEarned - c.karmaSpent;
    if (left < cost) return `Bonding costs ${cost} Karma; you have ${left}.`;
    c.karmaSpent += cost;
    f.karma = cost;
  }
  f.bonded = true;
  c.ext = ex;
  return "";
}
