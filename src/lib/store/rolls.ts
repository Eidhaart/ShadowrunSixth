"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { InitiativeResult, RollResult } from "@/lib/sr6/dice";

export type LogEntry =
  | { kind: "roll"; who: string; result: RollResult }
  | { kind: "init"; who: string; result: InitiativeResult };

interface RollsState {
  log: LogEntry[];
  push: (e: LogEntry) => void;
  replace: (id: string, r: RollResult) => void;
  clear: () => void;
}

export const useRolls = create<RollsState>()(
  persist(
    (set) => ({
      log: [],
      push: (e) => set((s) => ({ log: [e, ...s.log].slice(0, 150) })),
      replace: (id, r) =>
        set((s) => ({
          log: s.log.map((e) => (e.kind === "roll" && e.result.id === id ? { ...e, result: r } : e)),
        })),
      clear: () => set({ log: [] }),
    }),
    { name: "sixthdeck.rolls", version: 1 },
  ),
);
