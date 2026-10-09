"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RuleCategory } from "@/lib/rules/types";

export type ThemeId = "sodium" | "matrix" | "astral" | "corp" | "terminal" | "neon" | "crimson" | "rust" | "jade" | "ice" | "blackout";

export const THEMES: { id: ThemeId; name: string; blurb: string; light?: boolean; swatch: [string, string, string] }[] = [
  { id: "sodium", name: "Sodium", blurb: "Seattle night, amber street light", swatch: ["#080a0e", "#ffae3d", "#43dbe8"] },
  { id: "matrix", name: "Matrix", blurb: "Cold AR overlay, cyan on deep teal", swatch: ["#04090c", "#3fe3ff", "#ff6fb1"] },
  { id: "astral", name: "Astral", blurb: "Aura-lit violet, gold highlights", swatch: ["#0a0710", "#c39bff", "#ffd27a"] },
  { id: "terminal", name: "Terminal", blurb: "Green phosphor, old-school deck", swatch: ["#020a04", "#39ff7a", "#d6ff5c"] },
  { id: "neon", name: "Neon", blurb: "Hot pink and electric cyan on indigo", swatch: ["#0b0620", "#ff3ea5", "#2df0ff"] },
  { id: "crimson", name: "Crimson", blurb: "Red Samurai black and blood red", swatch: ["#0c0607", "#ff3b3b", "#ffb34d"] },
  { id: "rust", name: "Rust", blurb: "Barrens scrap, burnt orange", swatch: ["#0e0a07", "#e2762a", "#6cc7b8"] },
  { id: "jade", name: "Jade", blurb: "Triad lacquer, gold on deep green", swatch: ["#060c0b", "#e8c15a", "#3fe0b0"] },
  { id: "blackout", name: "Blackout", blurb: "Maximum contrast, yellow on black", swatch: ["#000000", "#ffe600", "#00e5ff"] },
  { id: "corp", name: "Corp", blurb: "Clean arcology light, megacorp red", light: true, swatch: ["#e7eaee", "#c8102e", "#0b6bcb"] },
  { id: "ice", name: "Ice", blurb: "Pale lab light, cobalt blue", light: true, swatch: ["#e6eef5", "#0a6fd6", "#0a8f9c"] },
];

export type FontId = "street" | "terminal" | "clean" | "legible" | "system";
export const FONTS: { id: FontId; name: string; blurb: string; css: string }[] = [
  { id: "street", name: "Street", blurb: "Chakra Petch headings, Plex text", css: '"Chakra Petch", ui-sans-serif, system-ui, sans-serif' },
  { id: "terminal", name: "Terminal", blurb: "Monospace everywhere", css: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace' },
  { id: "clean", name: "Clean", blurb: "IBM Plex Sans throughout", css: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif' },
  { id: "legible", name: "Legible", blurb: "Atkinson Hyperlegible, easy on the eyes", css: '"Atkinson Hyperlegible", ui-sans-serif, system-ui, sans-serif' },
  { id: "system", name: "System", blurb: "Your device's own font", css: "ui-sans-serif, system-ui, sans-serif" },
];

export const ACCENT_PRESETS = ["#ffae3d", "#3fe3ff", "#c39bff", "#39ff7a", "#ff3ea5", "#ff3b3b", "#e2762a", "#e8c15a", "#4da3ff", "#ffffff"];

interface SettingsState {
  theme: ThemeId;
  customAccent: string | null;
  scanlines: number; // 0..1
  vignette: number; // 0..1
  glow: number; // 0..1.5
  flicker: boolean;
  fontScale: number; // 0.9..1.2
  density: "comfortable" | "compact";
  font: FontId;
  corners: "cut" | "square" | "round";
  /** HUD brackets on panel corners. */
  brackets: boolean;
  /** Page background: grid plus glow, glow only, or flat. */
  backdrop: "grid" | "glow" | "flat";
  motion: "full" | "reduced";
  sound: boolean;
  handle: string;
  chatUrl: string;
  room: string;
  /** GM claims the room's GM seat and can call for checks. */
  role: "player" | "gm";
  /** Runner id the chat speaks as, "npc" for a GM voice, or "" for yourself. */
  speakAs: string;
  npcName: string;
  /** Rule categories the library is filtered to; empty = everything. */
  lenses: RuleCategory[];
  pins: string[];
  skipBoot: boolean;
  togglePin: (id: string) => void;
  set: (p: Partial<Omit<SettingsState, "set" | "toggleLens" | "togglePin" | "reset">>) => void;
  toggleLens: (c: RuleCategory) => void;
  reset: () => void;
}

export const DEFAULT_CHAT_URL = "wss://sixthdeck-relay.onrender.com";

const defaults = {
  theme: "sodium" as ThemeId,
  customAccent: null as string | null,
  scanlines: 0.35,
  vignette: 0.7,
  glow: 1,
  flicker: false,
  fontScale: 1,
  density: "comfortable" as "comfortable" | "compact",
  font: "street" as FontId,
  corners: "cut" as "cut" | "square" | "round",
  brackets: true,
  backdrop: "grid" as "grid" | "glow" | "flat",
  motion: "full" as const,
  sound: false,
  handle: "",
  chatUrl: DEFAULT_CHAT_URL,
  room: "table-1",
  role: "player" as "player" | "gm",
  speakAs: "",
  npcName: "",
  lenses: [] as RuleCategory[],
  pins: [] as string[],
  skipBoot: false,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...defaults,
      set: (p) => set(p),
      toggleLens: (c) => {
        const cur = get().lenses;
        set({ lenses: cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c] });
      },
      togglePin: (id) => {
        const cur = get().pins;
        set({ pins: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-40) });
      },
      reset: () => set({ ...defaults }),
    }),
    {
      name: "sixthdeck.settings",
      version: 4,
      // v1 saved an empty chat URL by default; fill it with the hosted relay.
      migrate: (state, version) => {
        const s = state as Partial<SettingsState>;
        if (version < 2 && !s.chatUrl) s.chatUrl = DEFAULT_CHAT_URL;
        if (version < 3) { s.role = "player"; s.speakAs = ""; s.npcName = ""; }
        return s as SettingsState;
      },
    },
  ),
);
