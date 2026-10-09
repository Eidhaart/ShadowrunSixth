"use client";
import { isPortrait } from "@/lib/portrait";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { newCharacter, type Character } from "@/lib/sr6/character";
import { budget, derive } from "@/lib/sr6/derive";

interface RunnersState {
  runners: Record<string, Character>;
  /** Draft being built in the Forge; kept separately so a half-finished runner never pollutes the roster. */
  draft: Character | null;
  create: () => Character;
  startDraft: (from?: Character) => Character;
  patchDraft: (fn: (c: Character) => void) => void;
  discardDraft: () => void;
  finishDraft: () => Character | null;
  update: (id: string, fn: (c: Character) => void) => void;
  remove: (id: string) => void;
  importOne: (c: Character) => Character;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export const useRunners = create<RunnersState>()(
  persist(
    (set, get) => ({
      runners: {},
      draft: null,
      create: () => {
        const c = newCharacter();
        set((s) => ({ runners: { ...s.runners, [c.id]: c } }));
        return c;
      },
      startDraft: (from) => {
        const c = from ? clone(from) : newCharacter();
        set({ draft: c });
        return c;
      },
      patchDraft: (fn) => {
        const d = get().draft;
        if (!d) return;
        const next = clone(d);
        fn(next);
        next.updatedAt = Date.now();
        set({ draft: next });
      },
      discardDraft: () => set({ draft: null }),
      finishDraft: () => {
        const d = get().draft;
        if (!d) return null;
        const done = { ...clone(d), stage: "complete" as const, updatedAt: Date.now() };
        const prev = get().runners[done.id];
        if (prev) {
          // Editing a runner that is already in play: keep the play state.
          done.edgeCurrent = prev.edgeCurrent;
          done.karmaEarned = prev.karmaEarned;
          done.karmaSpent = prev.karmaSpent;
          done.nuyen = prev.nuyen;
          done.damage = prev.damage;
          done.statuses = prev.statuses;
          done.notes = prev.notes;
        } else {
          // Start play with a full Edge pool, the unspent Karma and the leftover nuyen.
          const b = budget(done);
          done.edgeCurrent = derive(done).edge;
          done.karmaEarned = Math.max(0, b.karma.left);
          done.karmaSpent = 0;
          done.nuyen = Math.max(0, b.nuyen.left);
        }
        set((s) => ({ runners: { ...s.runners, [done.id]: done }, draft: null }));
        return done;
      },
      update: (id, fn) => {
        const cur = get().runners[id];
        if (!cur) return;
        const next = clone(cur);
        fn(next);
        next.updatedAt = Date.now();
        set((s) => ({ runners: { ...s.runners, [id]: next } }));
      },
      remove: (id) =>
        set((s) => {
          const r = { ...s.runners };
          delete r[id];
          return { runners: r };
        }),
      importOne: (c) => {
        const copy = clone(c);
        if (copy.portrait && !isPortrait(copy.portrait)) delete copy.portrait;
        if (get().runners[copy.id]) copy.id = newCharacter().id;
        copy.updatedAt = Date.now();
        set((s) => ({ runners: { ...s.runners, [copy.id]: copy } }));
        return copy;
      },
    }),
    { name: "sixthdeck.runners", version: 1 },
  ),
);
