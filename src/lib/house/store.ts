"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { emptyRuleset, PRESETS, sanitize, setActiveRules, type HouseItem, type Ruleset } from "./rules";

interface HouseState {
  /** The GM's own rulesets on this device. */
  sets: Record<string, Ruleset>;
  /** The ruleset this device uses when it is not a player at someone else's table; null is the book. */
  activeId: string | null;
  /** The ruleset of the table this device last played at as a player. */
  tableRules: Ruleset | null;
  /** True while this device sits at a table as a player, so the GM's rules win. */
  asPlayer: boolean;
  /** Items this person made for themselves; always in their Compendium. */
  mine: HouseItem[];
  addMine: (it: HouseItem) => void;
  updateMine: (it: HouseItem) => void;
  removeMine: (id: string) => void;
  create: (name?: string, from?: string) => string;
  update: (id: string, fn: (r: Ruleset) => void) => void;
  remove: (id: string) => void;
  setActive: (id: string | null) => void;
  importOne: (raw: unknown) => Ruleset | null;
  setTable: (r: Ruleset | null, asPlayer: boolean) => void;
}

/** The ruleset in force on this device. */
export function effective(s: Pick<HouseState, "sets" | "activeId" | "tableRules" | "asPlayer">): Ruleset | null {
  if (s.asPlayer) return s.tableRules;
  return s.activeId ? s.sets[s.activeId] ?? null : null;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export const useHouse = create<HouseState>()(
  persist(
    (set, get) => ({
      sets: {},
      activeId: null,
      tableRules: null,
      asPlayer: false,
      mine: [],
      addMine: (it) => set((s) => ({ mine: [it, ...s.mine.filter((x) => x.id !== it.id)] })),
      updateMine: (it) => set((s) => ({ mine: s.mine.map((x) => (x.id === it.id ? it : x)) })),
      removeMine: (id) => set((s) => ({ mine: s.mine.filter((x) => x.id !== id) })),
      create: (name, from) => {
        const r = emptyRuleset(name ?? "My table");
        const preset = PRESETS.find((p) => p.id === from);
        if (preset) { r.mech = { ...preset.mech }; r.name = name ?? preset.name; r.blurb = preset.blurb; }
        else if (from && get().sets[from]) { const src = clone(get().sets[from]); Object.assign(r, { ...src, id: r.id, name: name ?? `${src.name} copy` }); }
        set((s) => ({ sets: { ...s.sets, [r.id]: r } }));
        return r.id;
      },
      update: (id, fn) => {
        const cur = get().sets[id];
        if (!cur) return;
        const next = clone(cur);
        fn(next);
        next.updatedAt = Date.now();
        set((s) => ({ sets: { ...s.sets, [id]: next } }));
      },
      remove: (id) => set((s) => {
        const sets = { ...s.sets };
        delete sets[id];
        return { sets, activeId: s.activeId === id ? null : s.activeId };
      }),
      setActive: (id) => set({ activeId: id }),
      importOne: (raw) => {
        const r = sanitize(raw);
        if (!r) return null;
        if (get().sets[r.id]) r.id = `${r.id}-${Date.now().toString(36)}`;
        set((s) => ({ sets: { ...s.sets, [r.id]: r } }));
        return r;
      },
      setTable: (r, asPlayer) => {
        const s = get();
        if (s.asPlayer === asPlayer && JSON.stringify(s.tableRules) === JSON.stringify(r)) return;
        set({ tableRules: r, asPlayer });
      },
    }),
    { name: "sixthdeck.house", version: 1, skipHydration: true },
  ),
);

// keep the pure rule code in step with the store
setActiveRules(effective(useHouse.getState()));
useHouse.subscribe((s) => setActiveRules(effective(s)));
