"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RuleCategory } from "@/lib/rules/types";

export type ThemeId = "sodium" | "matrix" | "astral" | "corp";

export const THEMES: { id: ThemeId; name: string; blurb: string; swatch: [string, string, string] }[] = [
  { id: "sodium", name: "Sodium", blurb: "Seattle night, amber street light", swatch: ["#080a0e", "#ffae3d", "#43dbe8"] },
  { id: "matrix", name: "Matrix", blurb: "Cold AR overlay, cyan on deep teal", swatch: ["#04090c", "#3fe3ff", "#ff6fb1"] },
  { id: "astral", name: "Astral", blurb: "Aura-lit violet, gold highlights", swatch: ["#0a0710", "#c39bff", "#ffd27a"] },
  { id: "corp", name: "Corp", blurb: "Clean arcology light, megacorp red", swatch: ["#e7eaee", "#c8102e", "#0b6bcb"] },
];

interface SettingsState {
  theme: ThemeId;
  customAccent: string | null;
  scanlines: number; // 0..1
  vignette: number; // 0..1
  glow: number; // 0..1.5
  flicker: boolean;
  fontScale: number; // 0.9..1.2
  density: "comfortable" | "compact";
  motion: "full" | "reduced";
  sound: boolean;
  handle: string;
  chatUrl: string;
  room: string;
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
  density: "comfortable" as const,
  motion: "full" as const,
  sound: false,
  handle: "",
  chatUrl: DEFAULT_CHAT_URL,
  room: "table-1",
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
      version: 2,
      // v1 saved an empty chat URL by default; fill it with the hosted relay.
      migrate: (state, version) => {
        const s = state as Partial<SettingsState>;
        if (version < 2 && !s.chatUrl) s.chatUrl = DEFAULT_CHAT_URL;
        return s as SettingsState;
      },
    },
  ),
);
