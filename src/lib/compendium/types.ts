import type { GearItem } from "@/lib/sr6/character";

export type CompCat = "weapons" | "ammo" | "armor" | "matrix" | "electronics" | "cyberware" | "bioware" | "tools" | "identity" | "magic" | "vehicles" | "drones";

export const COMP_CATS: { id: CompCat; name: string; blurb: string }[] = [
  { id: "weapons", name: "Weapons", blurb: "Blades, clubs, pistols, rifles, launchers" },
  { id: "ammo", name: "Ammunition", blurb: "Rounds by weapon class, per 10" },
  { id: "armor", name: "Armor", blurb: "Clothing, armor, helmets and shields" },
  { id: "cyberware", name: "Cyberware", blurb: "Headware, eyes, ears, bodyware, cyberlimbs, implant weapons" },
  { id: "bioware", name: "Bioware", blurb: "Bioware and cultured bioware" },
  { id: "matrix", name: "Matrix", blurb: "Commlinks, cyberdecks, rigger consoles" },
  { id: "electronics", name: "Electronics", blurb: "RFID tags, sensors, housings" },
  { id: "tools", name: "Tools and gear", blurb: "Toolkits, rope, climbing, survival" },
  { id: "identity", name: "Identity and services", blurb: "SINs, licenses, credsticks, DocWagon" },
  { id: "magic", name: "Magic", blurb: "Foci, spell formulas, lodge materials, reagents" },
  { id: "vehicles", name: "Vehicles", blurb: "Bikes, cars, trucks, boats, aircraft" },
  { id: "drones", name: "Drones", blurb: "Micro, mini, small, medium and large drones" },
];

/** Older saved items used one "augmentations" category; it is cyberware unless it says bioware. */
export function fixCat(cat: string, group = ""): CompCat {
  if (cat === "augmentations") return /bio/i.test(group) ? "bioware" : "cyberware";
  return cat as CompCat;
}

/** Something a matrix slot or rigger console can equip directly when the item lands on a sheet. */
export type Equip = { kind: "deck" | "commlink" | "cyberjack" | "rcc"; index: number };

export interface CompItem {
  id: string;
  name: string;
  cat: CompCat;
  /** Sub-type shown as a filter, e.g. "Blade" or "Heavy Pistol". */
  group: string;
  /** Nuyen; null when the list has no price. */
  cost: number | null;
  /** What the price buys, e.g. "per 10" or "per month". */
  per?: string;
  avail?: number;
  /** "L" needs a license, "I" is illegal. */
  legal?: "L" | "I";
  /** Stat chips in display order. */
  stats: [string, string][];
  dv?: string;
  ar?: (number | null)[];
  skill?: string;
  essence?: number;
  book?: string;
  page?: number;
  wireless?: string;
  note?: string;
  /** Template for the sheet item created when this is added to a runner. */
  gear: Omit<GearItem, "id">;
  equip?: Equip;
  /** Vehicles and drones: added to the Rigging tab with these stats. */
  vehicle?: { kind: "vehicle" | "drone"; handlingOn: number; handlingOff: number; accel: number; speedInterval: number; topSpeed: number; body: number; armor: number; pilot: number; sensor: number; seats: number };
  /** Built-in parts sold only with this item (an underbarrel launcher); they come along when it is added. */
  parts?: Omit<GearItem, "id">[];
  source: "built-in" | "imported" | "house" | "mine";
}

export const RANGE_NAMES = ["Close", "Near", "Medium", "Far", "Extreme"] as const;
