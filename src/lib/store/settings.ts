"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RuleCategory } from "@/lib/rules/types";

import type { FontId, HeadsId, MotifId, OrnamentId, ThemeId, VoiceId } from "@/lib/style/catalog";
export { THEMES, FONTS } from "@/lib/style/catalog";
export type { ThemeId, FontId } from "@/lib/style/catalog";

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
  /** Legacy toggle; ornament replaces it. */
  brackets: boolean;
  /** Page background motif. */
  backdrop: MotifId;
  motifStrength: number; // 0..2
  ornament: OrnamentId;
  /** Symbol before every panel title; "" for none. */
  glyph: string;
  heads: HeadsId;
  voice: VoiceId;
  /** Name in the header and boot screen. */
  deckName: string;
  /** Up to four characters in the logo square. */
  deckTag: string;
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
  backdrop: "grid" as MotifId,
  motifStrength: 1,
  ornament: "brackets" as OrnamentId,
  glyph: "",
  heads: "plain" as HeadsId,
  voice: "deck" as VoiceId,
  deckName: "",
  deckTag: "",
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
      version: 5,
      // v1 saved an empty chat URL by default; fill it with the hosted relay.
      migrate: (state, version) => {
        const s = state as Partial<SettingsState>;
        if (version < 2 && !s.chatUrl) s.chatUrl = DEFAULT_CHAT_URL;
        if (version < 3) { s.role = "player"; s.speakAs = ""; s.npcName = ""; }
        if (version < 5 && s.brackets === false) s.ornament = "none";
        return s as SettingsState;
      },
    },
  ),
);
