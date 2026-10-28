"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * GM screens: boards of panels the GM arranges freely. Several screens (combat, legwork, the heist)
 * live side by side; each panel keeps its own position, size and contents.
 */

export type WidgetType = "notes" | "dice" | "turn" | "party" | "rules" | "music" | "house" | "entry" | "npcs" | "timer" | "names";

export interface Panel {
  id: string;
  type: WidgetType;
  x: number; y: number; w: number; h: number; z: number;
  collapsed?: boolean;
  title?: string;
  /** Widget-specific contents: notes text, an entry id, a rules topic. */
  data?: Record<string, unknown>;
}

export interface Screen { id: string; name: string; panels: Panel[] }

export const GRID = 20;

export const WIDGETS: Record<WidgetType, { name: string; icon: string; blurb: string; w: number; h: number }> = {
  rules: { name: "Rules at a glance", icon: "library", blurb: "Your table's numbers for combat, damage and Edge", w: 420, h: 460 },
  turn: { name: "Turn order", icon: "bolt", blurb: "Initiative, Minor actions, next turn", w: 300, h: 340 },
  party: { name: "The crew", icon: "runners", blurb: "Every runner's damage, Edge and statuses", w: 340, h: 300 },
  npcs: { name: "NPCs", icon: "skull", blurb: "Binder NPCs with one-tap rolls", w: 360, h: 360 },
  music: { name: "Music", icon: "spark", blurb: "Soundscapes and tracks for the table", w: 340, h: 380 },
  notes: { name: "Notes", icon: "library", blurb: "Scratch space for tonight", w: 340, h: 260 },
  dice: { name: "Dice", icon: "dice", blurb: "A quick pool roller", w: 340, h: 320 },
  entry: { name: "Binder page", icon: "star", blurb: "Keep one binder entry open", w: 380, h: 420 },
  timer: { name: "Clock", icon: "undo", blurb: "Session time and a countdown", w: 260, h: 220 },
  names: { name: "Names on the fly", icon: "spark", blurb: "Street names, bars and corps for improvised NPCs", w: 300, h: 260 },
  house: { name: "House rules", icon: "gavel", blurb: "What differs from the book tonight", w: 320, h: 280 },
};

const pid = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const sid = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const lay = (type: WidgetType, x: number, y: number, w?: number, h?: number, data?: Panel["data"]): Panel =>
  ({ id: pid(), type, x, y, w: w ?? WIDGETS[type].w, h: h ?? WIDGETS[type].h, z: 1, data });

export const PRESET_SCREENS: { id: string; name: string; blurb: string; make: () => Panel[] }[] = [
  {
    id: "run", name: "Running the game", blurb: "Rules, turn order, the crew, music and notes",
    make: () => [lay("rules", 0, 0, 420, 520), lay("turn", 440, 0, 300, 340), lay("party", 760, 0, 340, 340), lay("music", 440, 360, 340, 300), lay("notes", 800, 360, 300, 300), lay("dice", 0, 540, 420, 300)],
  },
  {
    id: "combat", name: "Combat", blurb: "Initiative, NPC rolls and the damage rules side by side",
    make: () => [lay("turn", 0, 0, 300, 400), lay("npcs", 320, 0, 380, 400), lay("rules", 720, 0, 400, 520, { topic: "combat" }), lay("party", 0, 420, 300, 300), lay("dice", 320, 420, 380, 300)],
  },
  {
    id: "legwork", name: "Legwork", blurb: "Binder pages, improvised names and a clock",
    make: () => [lay("entry", 0, 0, 420, 480), lay("npcs", 440, 0, 360, 320), lay("names", 820, 0, 300, 300), lay("notes", 440, 340, 360, 300), lay("timer", 820, 320, 300, 220)],
  },
];

interface ScreenState {
  screens: Screen[];
  active: string | null;
  addScreen: (preset?: string, name?: string) => string;
  renameScreen: (id: string, name: string) => void;
  removeScreen: (id: string) => void;
  setActive: (id: string) => void;
  addPanel: (screen: string, type: WidgetType) => void;
  updatePanel: (screen: string, id: string, p: Partial<Panel>) => void;
  removePanel: (screen: string, id: string) => void;
  front: (screen: string, id: string) => void;
}

export const useScreens = create<ScreenState>()(
  persist(
    (set, get) => {
      const mapScreen = (id: string, fn: (s: Screen) => Screen) => set((st) => ({ screens: st.screens.map((s) => (s.id === id ? fn(s) : s)) }));
      return {
        screens: [],
        active: null,
        addScreen: (preset, name) => {
          const p = PRESET_SCREENS.find((x) => x.id === preset) ?? PRESET_SCREENS[0];
          const s: Screen = { id: sid(), name: name ?? p.name, panels: preset === "blank" ? [] : p.make() };
          set((st) => ({ screens: [...st.screens, s], active: s.id }));
          return s.id;
        },
        renameScreen: (id, name) => mapScreen(id, (s) => ({ ...s, name: name.slice(0, 40) })),
        removeScreen: (id) => set((st) => {
          const screens = st.screens.filter((s) => s.id !== id);
          return { screens, active: st.active === id ? screens[0]?.id ?? null : st.active };
        }),
        setActive: (id) => set({ active: id }),
        addPanel: (screen, type) => mapScreen(screen, (s) => {
          // drop it in the first free spot along the top, below the lowest panel if the row is full
          const bottom = s.panels.reduce((m, p) => Math.max(m, p.y + (p.collapsed ? 40 : p.h)), 0);
          const z = s.panels.reduce((m, p) => Math.max(m, p.z), 0) + 1;
          return { ...s, panels: [...s.panels, { ...lay(type, 0, bottom ? bottom + GRID : 0), z }] };
        }),
        updatePanel: (screen, id, p) => mapScreen(screen, (s) => ({ ...s, panels: s.panels.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
        removePanel: (screen, id) => mapScreen(screen, (s) => ({ ...s, panels: s.panels.filter((x) => x.id !== id) })),
        front: (screen, id) => {
          const s = get().screens.find((x) => x.id === screen);
          if (!s) return;
          const top = s.panels.reduce((m, p) => Math.max(m, p.z), 0);
          // already alone on top: nothing to do
          if (s.panels.find((p) => p.id === id)?.z === top && s.panels.filter((p) => p.z === top).length === 1) return;
          mapScreen(screen, (sc) => ({ ...sc, panels: sc.panels.map((x) => (x.id === id ? { ...x, z: top + 1 } : x)) }));
        },
      };
    },
    { name: "sixthdeck.screens", version: 1, skipHydration: true },
  ),
);
