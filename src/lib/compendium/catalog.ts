"use client";
import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import core from "@/data/gear-core.json";
import { COMMLINKS, CYBERDECKS, CYBERJACKS, RCCS } from "@/lib/sr6/rules6";
import { editExt, newVehicle } from "@/lib/sr6/ext";
import { uid, type Character, type GearItem } from "@/lib/sr6/character";
import { fixCat, type CompItem } from "./types";
import { ARMOR, BIOWARE, CYBERWARE, DRONES, FOCI, FORMULAS, VEHICLES, av, type AugRow, type VehRow } from "@/data/core-gear";
import { effective, useHouse } from "@/lib/house/store";
import type { HouseItem } from "@/lib/house/rules";
import { readXlsx } from "./xlsx";
import { normalize } from "./normalize";

type CoreItem = CompItem & { hasText?: boolean };

/** Matrix hardware the sheet already knows from rules6, with core rulebook prices and Availability. */
const MATRIX: CompItem[] = [
  ...COMMLINKS.map((l, i): CompItem => ({
    id: `matrix-${l.name.toLowerCase().replace(/\W+/g, "-")}`, name: l.name, cat: "matrix", group: "Commlink", cost: l.cost, avail: l.avail, source: "built-in",
    stats: [["Rating", String(l.rating)], ["Data Proc.", String(l.d)], ["Firewall", String(l.f)], ["Programs", String(l.slots)]],
    gear: { name: l.name, category: "commlink", cost: l.cost, qty: 1 }, equip: { kind: "commlink", index: i }, book: "Core", page: 267,
  })),
  ...CYBERDECKS.map((d, i): CompItem => ({
    id: `matrix-${d.name.toLowerCase().replace(/\W+/g, "-")}`, name: d.name, cat: "matrix", group: "Cyberdeck", cost: d.cost, avail: d.avail, legal: "I", source: "built-in",
    stats: [["Rating", String(d.rating)], ["Attack", String(d.a)], ["Sleaze", String(d.s)], ["Programs", String(d.slots)]],
    gear: { name: d.name, category: "commlink", cost: d.cost, qty: 1 }, equip: { kind: "deck", index: i }, book: "Core", page: 267,
  })),
  ...RCCS.map((r, i): CompItem => ({
    id: `matrix-${r.name.toLowerCase().replace(/\W+/g, "-")}`, name: r.name, cat: "matrix", group: "Rigger console", cost: r.cost, avail: r.avail, legal: "L", source: "built-in",
    stats: [["Rating", String(r.rating)], ["Data Proc.", String(r.d)], ["Firewall", String(r.f)], ["Drones", String(r.rating * 3)]],
    gear: { name: r.name, category: "commlink", cost: r.cost, qty: 1 }, equip: { kind: "rcc", index: i }, book: "Core", page: 197,
  })),
];

/**
 * The gear list prints integrated parts (the Ares Alpha's grenade launcher, the Raiden's underbarrel
 * shotgun) as their own rows with no price, because they are never sold alone. Fold each into the
 * weapon it belongs to: shown with it, and added to a sheet with it.
 */
function foldParts(items: CoreItem[]): CoreItem[] {
  const parts = items.filter((i) => !i.cost && i.cat === "weapons");
  const out = items.filter((i) => !parts.includes(i)).map((i) => ({ ...i }));
  for (const p of parts) {
    const words = p.name.split(" ");
    let parent: CoreItem | undefined;
    for (let n = words.length - 1; n > 0 && !parent; n--) {
      const base = words.slice(0, n).join(" ");
      parent = out.filter((o) => o.cat === "weapons" && (o.name === base || o.name.endsWith(` ${base}`))).sort((a, b) => b.name.length - a.name.length)[0];
    }
    if (!parent) continue; // a priceless part we cannot place is left out rather than sold for nothing
    const what = p.name.slice(p.name.lastIndexOf(parent.name.split(" ").pop()!) + parent.name.split(" ").pop()!.length).trim() || p.group;
    const ar = p.stats.find(([k]) => k === "AR")?.[1];
    const dv = p.stats.find(([k]) => k === "DV")?.[1];
    // one "Built in" chip per weapon, listing every part
    const prev = parent.stats.findIndex(([k]) => k === "Built in");
    if (prev >= 0) parent.stats[prev] = ["Built in", `${parent.stats[prev][1]} + ${what}`];
    else parent.stats = [...parent.stats.slice(0, 2), ["Built in", what], ...parent.stats.slice(2)];
    parent.note = [parent.note, `Built-in ${what.toLowerCase()}: DV ${dv ?? "by ammo"}, AR ${ar ?? "–"}${p.stats.find(([k]) => k === "Ammo") ? `, ammo ${p.stats.find(([k]) => k === "Ammo")![1]}` : ""}. Comes with the ${parent.name}.`].filter(Boolean).join(" ");
    parent.parts = [...(parent.parts ?? []), { ...p.gear, name: `${parent.name}: ${what}`, cost: 0, notes: `Built into the ${parent.name}.` }];
  }
  return out;
}

const slug = (s: string) => s.toLowerCase().replace(/['’]/g, "").replace(/\W+/g, "-").replace(/^-|-$/g, "");
const essText = (n: number) => String(Math.round(n * 100) / 100);

/** Armor, cyberware, bioware, foci, vehicles and drones from the core rulebook tables. */
function coreTables(): CompItem[] {
  const out: CompItem[] = [];
  for (const [name, dr, cap, a, cost, group] of ARMOR) {
    const { avail, legal } = av(a);
    out.push({ id: `armor-${slug(name)}`, name, cat: "armor", group, cost, avail, legal, source: "built-in", book: "Core", page: group === "Armor" ? 267 : 268,
      stats: [["Defense", `+${dr}`], ["Capacity", String(cap)]],
      gear: { name, category: "armor", cost, qty: 1, armor: dr, worn: group === "Armor" && name !== "Full body armor helmet" ? true : undefined } });
  }
  const aug = (r: AugRow, cat: "cyberware" | "bioware") => {
    const { avail, legal } = av(r.avail);
    const [lo, hi] = r.ratings ?? [0, 0];
    for (let rating = lo; rating <= hi; rating++) {
      const name = rating ? `${r.name}, rating ${rating}` : r.name;
      const ess = r.essPerRating && rating ? r.ess * rating : r.ess;
      const cost = r.costPerRating && rating ? r.cost * rating : r.cost;
      const stats: [string, string][] = [["Essence", essText(ess)]];
      if (r.cap) stats.push(["Capacity", r.cap.replace("Rating", String(rating || "R"))]);
      if (r.plus) stats.push(["Plus", r.plus]);
      out.push({ id: `${cat}-${slug(name)}`, name, cat, group: r.group, cost, avail: r.group === "Cyberlimb accessory" ? avail : avail, legal, source: "built-in", book: "Core", page: cat === "bioware" ? 294 : 285,
        stats, essence: ess, gear: { name, category: cat, cost, qty: 1, essence: ess } });
    }
  };
  for (const r of CYBERWARE) aug(r, "cyberware");
  for (const r of BIOWARE) aug(r, "bioware");
  for (const [n, perForce, karma] of FOCI)
    for (let f = 1; f <= 6; f++) {
      const name = `${n}, Force ${f}`;
      out.push({ id: `magic-${slug(name)}`, name, cat: "magic", group: "Focus", cost: perForce * f, avail: f, legal: "L", source: "built-in", book: "Core", page: 295,
        stats: [["Force", String(f)], ["Bonding", `${karma * f} Karma`]], gear: { name, category: "magic", cost: perForce * f, qty: 1 } });
    }
  for (const [kind, a, cost] of FORMULAS) {
    const { avail, legal } = av(a);
    const name = `Spell formula, ${kind.toLowerCase()}`;
    out.push({ id: `magic-${slug(name)}`, name, cat: "magic", group: "Spell formula", cost, avail, legal, source: "built-in", book: "Core", page: 295, stats: [["Category", kind]], gear: { name, category: "magic", cost, qty: 1 } });
  }
  const veh = (v: VehRow, cat: "vehicles" | "drones") => {
    const [name, group, hand, accel, interval, top, body, armor, pilot, sensor, seats, a, cost] = v;
    const [on, off] = hand.split("/").map(Number);
    const { avail, legal } = av(a.split("/")[0]);
    out.push({
      id: `${cat}-${slug(name)}`, name, cat, group, cost, avail, legal, source: "built-in", book: "Core", page: 301,
      stats: [["Handling", hand], ["Accel", String(accel)], ["Speed int.", String(interval)], ["Top speed", String(top)], ["Body", String(body)], ["Armor", String(armor)], ["Pilot", String(pilot)], ["Sensor", String(sensor)], ...(cat === "vehicles" ? [["Seats", seats] as [string, string]] : [])],
      gear: { name, category: "vehicle", cost, qty: 1 },
      vehicle: { kind: cat === "drones" ? "drone" : "vehicle", handlingOn: on, handlingOff: off ?? on, accel, speedInterval: interval, topSpeed: top, body, armor, pilot, sensor, seats: Number(seats.split("/").pop()) || 0 },
    });
  };
  for (const v of VEHICLES) veh(v, "vehicles");
  for (const v of DRONES) veh(v, "drones");
  return out;
}

/** Only the core rulebook: other sourcebooks in the gear list are left out. Old categories are mapped. */
const coreOnly = (items: CoreItem[]) => items.filter((i) => !i.book || i.book === "Core").map((i) => ({ ...i, cat: fixCat(i.cat, i.group) }));

const BUILT_IN: CoreItem[] = foldParts([...coreOnly(core as unknown as CoreItem[]), ...MATRIX, ...coreTables()]);

interface GearListState {
  imported: CompItem[] | null;
  fileName: string;
  importedAt: number;
  importFile: (f: File) => Promise<number>;
  clear: () => void;
}

/** The user's own copy of the community gear list, parsed on this device and kept in local storage. */
export const useGearList = create<GearListState>()(
  persist(
    (set) => ({
      imported: null,
      fileName: "",
      importedAt: 0,
      importFile: async (f) => {
        const items = normalize(readXlsx(new Uint8Array(await f.arrayBuffer())), "imported");
        if (!items.length) throw new Error("No gear found in that workbook. Is it the 6th World Gear List?");
        set({ imported: items, fileName: f.name, importedAt: Date.now() });
        return items.length;
      },
      clear: () => set({ imported: null, fileName: "", importedAt: 0 }),
    }),
    { name: "sixthdeck.gearlist", version: 1 },
  ),
);

const GEAR_CAT: Record<HouseItem["cat"], GearItem["category"]> = {
  weapons: "weapon", armor: "armor", cyberware: "cyberware", bioware: "bioware", augmentations: "cyberware", electronics: "misc", tools: "misc", magic: "magic", vehicles: "vehicle", drones: "vehicle", ammo: "ammo", identity: "misc", matrix: "commlink",
};

/** A homebrew item from the GM's house rules, shaped like any other catalog entry. */
export function houseToComp(h: HouseItem): CompItem {
  const stats: [string, string][] = [];
  if (h.dv) stats.push(["DV", h.dv]);
  if (h.ar?.some((v) => v != null)) stats.push(["AR", h.ar.map((v) => v ?? "–").join("/")]);
  if (h.armor) stats.push(["Defense", `+${h.armor}`]);
  if (h.essence) stats.push(["Essence", String(h.essence)]);
  return {
    id: `house-${h.id}`, name: h.name, cat: fixCat(h.cat, h.group), group: h.group || "House", cost: h.cost, avail: h.avail, legal: h.legal, stats,
    dv: h.dv, ar: h.ar, skill: h.skill, essence: h.essence, note: h.note, book: "House rules", source: "house",
    gear: { name: h.name, category: GEAR_CAT[h.cat], cost: h.cost ?? 0, qty: 1, dv: h.dv, ar: h.ar as GearItem["ar"], skill: h.skill, armor: h.armor, worn: h.cat === "armor" ? true : undefined, essence: h.essence, notes: h.note },
  };
}

/** Every item: the bundled stats, with an imported list layered over it (adding its text and any new rows), plus house items. */
export function useCatalog(): CoreItem[] {
  const imported = useGearList((s) => s.imported);
  const house = useHouse((s) => effective(s)?.items);
  const mine = useHouse((s) => s.mine);
  return useMemo(() => {
    const map = new Map<string, CoreItem>(BUILT_IN.map((i) => [i.id, i]));
    for (const i of coreOnly((imported ?? []) as CoreItem[])) map.set(i.id, { ...i, equip: i.equip ?? map.get(i.id)?.equip, vehicle: map.get(i.id)?.vehicle });
    for (const h of house ?? []) { const c = houseToComp(h); map.set(c.id, c); }
    for (const h of mine ?? []) { const c = { ...houseToComp(h), id: `mine-${h.id}`, book: "My items", source: "mine" as const }; map.set(c.id, c); }
    return [...map.values()];
  }, [imported, house, mine]);
}

export function findItem(list: CompItem[], id: string): CompItem | undefined {
  return list.find((i) => i.id === id);
}

export const DRAG_TYPE = "application/x-sixthdeck-gear";

export interface AddResult { ok: boolean; msg: string }

/** Put a compendium item on a runner. Stacks with an identical item, equips Matrix hardware into an
 *  empty slot, and pays for it from the runner's nuyen when `pay` is set. */
export function addToRunner(c: Character, item: CompItem, opts: { pay: boolean; qty?: number }): AddResult {
  const qty = opts.qty ?? 1;
  const price = (item.cost ?? 0) * qty;
  if (opts.pay && price > c.nuyen) return { ok: false, msg: `${item.name} costs ${price.toLocaleString("en-US")}¥; ${c.alias || c.name || "the runner"} has ${c.nuyen.toLocaleString("en-US")}¥.` };
  const same = c.gear.find((g) => g.name === item.gear.name && g.category === item.gear.category && g.cost === item.gear.cost);
  if (same && item.cat !== "cyberware" && item.cat !== "bioware" && !item.vehicle) same.qty += qty;
  else c.gear.push({ ...(JSON.parse(JSON.stringify(item.gear)) as Omit<GearItem, "id">), id: uid("g"), qty });
  // integrated parts come with the weapon, one set per weapon
  for (const part of item.parts ?? []) {
    const have = c.gear.find((g) => g.name === part.name);
    if (have) have.qty += qty; else c.gear.push({ ...(JSON.parse(JSON.stringify(part)) as Omit<GearItem, "id">), id: uid("g"), qty });
  }
  if (opts.pay) c.nuyen -= price;
  let equipped = "";
  if (item.equip) {
    editExt(c, (ex) => {
      const e = item.equip!;
      if (e.kind === "deck" && !ex.matrix.deck) { const d = CYBERDECKS[e.index]; if (d) { ex.matrix.deck = { name: d.name, rating: d.rating, a: d.a, s: d.s, slots: d.slots }; equipped = "deck"; } }
      if (e.kind === "commlink" && !ex.matrix.link) { const l = COMMLINKS[e.index]; if (l) { ex.matrix.link = { kind: "commlink", name: l.name, rating: l.rating, d: l.d, f: l.f, slots: l.slots, dice: 0 }; equipped = "commlink"; } }
      if (e.kind === "cyberjack" && !ex.matrix.link) {
        const j = CYBERJACKS[e.index];
        if (j) { ex.matrix.link = { kind: "cyberjack", name: `Cyberjack ${j.rating}`, rating: j.rating, d: j.d, f: j.f, slots: 0, dice: j.dice }; equipped = "cyberjack"; }
      }
      if (e.kind === "rcc" && !ex.rcc) { const r = RCCS[e.index]; if (r) { ex.rcc = { ...r }; equipped = "console"; } }
    });
  }
  // vehicles and drones go straight onto the Rigging tab, ready to drive
  if (item.vehicle) {
    for (let n = 0; n < qty; n++) editExt(c, (ex) => { ex.vehicles.push({ ...newVehicle(item.vehicle!.kind), ...item.vehicle!, name: item.name }); });
    equipped = "rig";
  }
  const paid = opts.pay && price ? ` for ${price.toLocaleString("en-US")}¥` : "";
  const where = equipped === "rig" ? ` It is on the Rigging tab.` : equipped ? ` Equipped as the ${equipped} on the ${equipped === "console" ? "Rigging" : "Matrix"} tab.` : "";
  return { ok: true, msg: `${item.name} added${paid}.${where}` };
}
