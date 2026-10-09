"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ModuleId } from "./types";

interface SimRecord {
  runs: number;
  bestStars: number;
  last?: { stars: number; at: number };
}

interface ProgressState {
  lessons: Record<string, true>; // `${module}/${lesson}`
  answers: Record<string, boolean>; // quiz id -> last answer correct
  sims: Partial<Record<ModuleId, SimRecord>>;
  examBest: Partial<Record<ModuleId, number>>;
  finishLesson: (mod: ModuleId, lesson: string) => void;
  answer: (id: string, ok: boolean) => void;
  recordSim: (mod: ModuleId, stars: number) => void;
  recordExam: (mod: ModuleId, score: number) => void;
  reset: (mod: ModuleId) => void;
}

export const useAcademy = create<ProgressState>()(
  persist(
    (set) => ({
      lessons: {},
      answers: {},
      sims: {},
      examBest: {},
      finishLesson: (mod, lesson) => set((s) => ({ lessons: { ...s.lessons, [`${mod}/${lesson}`]: true } })),
      answer: (id, ok) => set((s) => ({ answers: { ...s.answers, [id]: ok } })),
      recordSim: (mod, stars) =>
        set((s) => {
          const cur = s.sims[mod] ?? { runs: 0, bestStars: 0 };
          return { sims: { ...s.sims, [mod]: { runs: cur.runs + 1, bestStars: Math.max(cur.bestStars, stars), last: { stars, at: Date.now() } } } };
        }),
      recordExam: (mod, score) => set((s) => ({ examBest: { ...s.examBest, [mod]: Math.max(s.examBest[mod] ?? 0, score) } })),
      reset: (mod) =>
        set((s) => {
          const lessons = Object.fromEntries(Object.entries(s.lessons).filter(([k]) => !k.startsWith(mod + "/")));
          const answers = Object.fromEntries(Object.entries(s.answers).filter(([k]) => !k.startsWith(mod + ".")));
          const sims = { ...s.sims };
          delete sims[mod];
          const examBest = { ...s.examBest };
          delete examBest[mod];
          return { lessons: lessons as Record<string, true>, answers, sims, examBest };
        }),
    }),
    { name: "sixthdeck.academy", version: 1, skipHydration: true },
  ),
);
