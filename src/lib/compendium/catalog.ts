"use client";
import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import core from "@/data/gear-core.json";
import { COMMLINKS, CYBERDECKS, CYBERJACKS, RCCS } from "@/lib/sr6/rules6";
import { editExt } from "@/lib/sr6/ext";
import { uid, type Character, type GearItem } from "@/lib/sr6/character";
import type { CompItem } from "./types";
import { effective, useHouse } from "@/lib/house/store";
import type { HouseItem } from "@/lib/house/rules";
import { readXlsx } from "./xlsx";
import { normalize } from "./normalize";

type CoreItem = CompItem & { hasText?: boolean };

/** Matrix hardware the sheet already knows from rules6. Prices are not in the gear list yet. */
const MATRIX: CompItem[] = [
  ...COMMLINKS.map((l, i): CompItem => ({
    id: `matrix-${l.name.toLowerCase().replace(/\W+/g, "-")}`, name: l.name, cat: "matrix", group: "Commlink", cost: null, source: "built-in",
    stats: [["Rating", String(l.rating)], ["Data Proc.", String(l.d)], ["Firewall", String(l.f)], ["Programs", String(l.slots)]],
    gear: { name: l.name, category: "commlink", cost: 0, qty: 1 }, equip: { kind: "commlink", index: i }, book: "Core",
  })),
  ...CYBERDECKS.map((d, i): CompItem => ({
    id: `matrix-${d.name.toLowerCase().replace(/\W+/g, "-")}`, name: d.name, cat: "matrix", group: "Cyberdeck", cost: null, source: "built-in",
    stats: [["Rating", String(d.rating)], ["Attack", String(d.a)], ["Sleaze", String(d.s)], ["Programs", String(d.slots)]],
    gear: { name: d.name, category: "commlink", cost: 0, qty: 1 }, equip: { kind: "deck", index: i }, book: "Core",
  })),
  ...RCCS.map((r, i): CompItem => ({
    id: `matrix-${r.name.toLowerCase().replace(/\W+/g, "-")}`, name: r.name, cat: "matrix", group: "Rigger console", cost: null, source: "built-in",
    stats: [["Rating", String(r.rating)], ["Data Proc.", String(r.d)], ["Firewall", String(r.f)], ["Drones", String(r.rating * 3)]],
    gear: { name: r.name, category: "commlink", cost: 0, qty: 1 }, equip: { kind: "rcc", index: i }, book: "Core",
  })),
];

const BUILT_IN: CoreItem[] = [...(core as unknown as CoreItem[]), ...MATRIX];

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
  weapons: "weapon", armor: "armor", augmentations: "cyberware", electronics: "misc", tools: "misc", magic: "magic", vehicles: "vehicle", ammo: "ammo", identity: "misc", matrix: "commlink",
};

/** A homebrew item from the GM's house rules, shaped like any other catalog entry. */
export function houseToComp(h: HouseItem): CompItem {
  const stats: [string, string][] = [];
  if (h.dv) stats.push(["DV", h.dv]);
  if (h.ar?.some((v) => v != null)) stats.push(["AR", h.ar.map((v) => v ?? "–").join("/")]);
  if (h.armor) stats.push(["Defense", `+${h.armor}`]);
  if (h.essence) stats.push(["Essence", String(h.essence)]);
  return {
    id: `house-${h.id}`, name: h.name, cat: h.cat, group: h.group || "House", cost: h.cost, avail: h.avail, legal: h.legal, stats,
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
    for (const i of imported ?? []) map.set(i.id, { ...i, equip: i.equip ?? map.get(i.id)?.equip });
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
  if (same && item.cat !== "augmentations") same.qty += qty;
  else c.gear.push({ ...(JSON.parse(JSON.stringify(item.gear)) as Omit<GearItem, "id">), id: uid("g"), qty });
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
  const paid = opts.pay && price ? ` for ${price.toLocaleString("en-US")}¥` : "";
  return { ok: true, msg: `${item.name} added${paid}.${equipped ? ` Equipped as the ${equipped} on the ${equipped === "console" ? "Rigging" : "Matrix"} tab.` : ""}` };
}
