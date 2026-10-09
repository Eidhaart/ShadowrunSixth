"use client";
import { create } from "zustand";

interface UiState {
  paletteOpen: boolean;
  trayOpen: boolean;
  setPalette: (v: boolean) => void;
  setTray: (v: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
  paletteOpen: false,
  trayOpen: false,
  setPalette: (v) => set({ paletteOpen: v }),
  setTray: (v) => set({ trayOpen: v }),
}));
