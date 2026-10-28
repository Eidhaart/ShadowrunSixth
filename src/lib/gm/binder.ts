"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { idbDel, idbGet, idbSet } from "@/lib/idb";
import type { MusicTrack, Npc } from "@/lib/vtt/types";

/**
 * The GM's binder: everything a GM keeps between sessions. Notes, NPCs with stat blocks, places,
 * factions, clues and session logs, plus the music library. It stays on this device (in IndexedDB,
 * so portraits fit) and exports as one file.
 */

export type EntryKind = "note" | "npc" | "place" | "faction" | "clue" | "session";

export const KINDS: { id: EntryKind; name: string; plural: string; icon: string; hue: string; blurb: string }[] = [
  { id: "npc", name: "NPC", plural: "NPCs", icon: "runners", hue: "var(--accent)", blurb: "Contacts, opposition, the fixer who owes you" },
  { id: "place", name: "Place", plural: "Places", icon: "map", hue: "var(--cyan)", blurb: "Bars, safehouses, the arcology's loading dock" },
  { id: "faction", name: "Faction", plural: "Factions", icon: "shield", hue: "var(--astral)", blurb: "Corps, gangs, syndicates and their agendas" },
  { id: "clue", name: "Clue", plural: "Clues", icon: "search", hue: "#22f59a", blurb: "What the runners can find, and where" },
  { id: "session", name: "Session", plural: "Sessions", icon: "learn", hue: "#ffae3d", blurb: "What happened, Karma and nuyen paid" },
  { id: "note", name: "Note", plural: "Notes", icon: "library", hue: "var(--fg-dim)", blurb: "Anything else" },
];
export const KIND: Record<EntryKind, (typeof KINDS)[number]> = Object.fromEntries(KINDS.map((k) => [k.id, k])) as never;

export interface BinderEntry {
  id: string;
  kind: EntryKind;
  title: string;
  body: string;
  tags: string[];
  /** Portrait or picture as a data URL. */
  img?: string;
  /** NPC stat block, ready to drop on the table. */
  npc?: Npc;
  /** NPC condition monitors and Edge. */
  monitor?: { physical: number; stun: number; edge: number };
  /** Short line under the title: role, address, affiliation. */
  sub?: string;
  pinned?: boolean;
  createdAt: number;
  updatedAt: number;
}

interface BinderState {
  entries: Record<string, BinderEntry>;
  tracks: MusicTrack[];
  create: (kind: EntryKind, init?: Partial<BinderEntry>) => string;
  update: (id: string, fn: (e: BinderEntry) => void) => void;
  remove: (id: string) => void;
  addTrack: (t: MusicTrack) => void;
  removeTrack: (id: string) => void;
  importAll: (raw: unknown) => number;
}

const vid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const idbStorage = createJSONStorage(() => ({
  getItem: async (k: string) => (await idbGet<string>(k).catch(() => undefined)) ?? null,
  setItem: (k: string, v: string) => idbSet(k, v).catch(() => undefined),
  removeItem: (k: string) => idbDel(k).catch(() => undefined),
}));

export const STARTER_NPC: Npc = {
  init: { base: 8, dice: 1 }, dr: 6, defend: 7, soak: 4, notes: "",
  pools: [{ label: "Perception", dice: 6 }, { label: "Con", dice: 7 }],
  weapons: [{ name: "Heavy pistol", pool: 8, dv: 3, type: "P", ar: [10, 10, 8, null, null] }],
};

export const useBinder = create<BinderState>()(
  persist(
    (set, get) => ({
      entries: {},
      tracks: [],
      create: (kind, init) => {
        const id = vid("b");
        const now = Date.now();
        const e: BinderEntry = { id, kind, title: `New ${KIND[kind].name.toLowerCase()}`, body: "", tags: [], createdAt: now, updatedAt: now, ...(kind === "npc" ? { npc: structuredClone(STARTER_NPC), monitor: { physical: 10, stun: 10, edge: 2 } } : {}), ...init };
        if (kind === "session" && !init?.title) e.title = `Session, ${new Date().toLocaleDateString()}`;
        set((s) => ({ entries: { ...s.entries, [id]: e } }));
        return id;
      },
      update: (id, fn) => {
        const cur = get().entries[id];
        if (!cur) return;
        const next = structuredClone(cur);
        fn(next);
        next.updatedAt = Date.now();
        set((s) => ({ entries: { ...s.entries, [id]: next } }));
      },
      remove: (id) => set((s) => { const entries = { ...s.entries }; delete entries[id]; return { entries }; }),
      addTrack: (t) => set((s) => ({ tracks: [...s.tracks.filter((x) => x.id !== t.id), t] })),
      removeTrack: (id) => set((s) => ({ tracks: s.tracks.filter((x) => x.id !== id) })),
      importAll: (raw) => {
        const r = raw as { entries?: Record<string, BinderEntry>; tracks?: MusicTrack[] };
        if (!r || typeof r !== "object" || typeof r.entries !== "object") return 0;
        const ok = Object.values(r.entries ?? {}).filter((e) => e && typeof e.title === "string" && KIND[e.kind as EntryKind]);
        set((s) => ({
          entries: { ...s.entries, ...Object.fromEntries(ok.map((e) => [e.id, { ...e, tags: Array.isArray(e.tags) ? e.tags : [], body: String(e.body ?? "") }])) },
          tracks: [...s.tracks, ...(Array.isArray(r.tracks) ? r.tracks.filter((t) => t && t.src && !s.tracks.some((x) => x.id === t.id)) : [])],
        }));
        return ok.length;
      },
    }),
    { name: "sixthdeck.binder", version: 1, storage: idbStorage, skipHydration: true },
  ),
);

/** Find entries by [[Title]] links. */
export function linkTargets(body: string): string[] {
  return [...body.matchAll(/\[\[([^\]]{1,80})\]\]/g)].map((m) => m[1].trim());
}
