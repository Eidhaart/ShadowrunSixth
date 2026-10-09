import type { GearItem } from "@/lib/sr6/character";

export type CompCat = "weapons" | "ammo" | "armor" | "matrix" | "electronics" | "augmentations" | "tools" | "identity" | "magic" | "vehicles";

export const COMP_CATS: { id: CompCat; name: string; blurb: string }[] = [
  { id: "weapons", name: "Weapons", blurb: "Blades, clubs, pistols, rifles, launchers" },
  { id: "ammo", name: "Ammunition", blurb: "Rounds by weapon class, per 10" },
  { id: "armor", name: "Armor", blurb: "Clothing and armor" },
  { id: "matrix", name: "Matrix", blurb: "Commlinks, cyberdecks, rigger consoles" },
  { id: "electronics", name: "Electronics", blurb: "RFID tags, sensors, housings" },
  { id: "augmentations", name: "Augmentations", blurb: "Cyberware and bioware" },
  { id: "tools", name: "Tools and gear", blurb: "Toolkits, rope, climbing, survival" },
  { id: "identity", name: "Identity and services", blurb: "SINs, licenses, credsticks, DocWagon" },
  { id: "magic", name: "Magical supplies", blurb: "Lodge materials, reagents" },
  { id: "vehicles", name: "Vehicles and drones", blurb: "Ground, air, water, drones" },
];

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
  source: "built-in" | "imported";
}

export const RANGE_NAMES = ["Close", "Near", "Medium", "Far", "Extreme"] as const;
