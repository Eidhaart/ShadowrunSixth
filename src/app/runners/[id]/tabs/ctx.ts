import type { Character } from "@/lib/sr6/character";
import type { Derived } from "@/lib/sr6/derive";
import type { RollResult } from "@/lib/sr6/dice";
import { SKILL_BY_ID, ATTR_LABEL, type AttrKey } from "@/lib/sr6/data";

/** `adjust` is a flat dice modifier for this roll only (noise, Overclock, speed penalties). */
export interface RollOpts { noWound?: boolean; noSustain?: boolean; adjust?: number }

/** What the sheet tabs get from the sheet: the runner, edits, and rolls that already know about wounds, sustaining and Edge. */
export interface SheetCtx {
  c: Character;
  d: Derived;
  who: string;
  upd: (fn: (x: Character) => void) => void;
  rollPool: (label: string, base: number, opts?: RollOpts) => RollResult;
  /** Pool actually rolled for a base value after wounds, sustaining, sheet and situation modifiers. */
  poolOf: (base: number, opts?: RollOpts) => number;
  applyDamage: (boxes: number, kind: "P" | "S") => void;
  awakened: boolean;
}

export interface Base { base: number; parts: string; blocked: boolean }

/** Skill rank + attribute for a roll, with the untrained rule: attribute minus 1, or blocked if the skill needs training. */
export function basePool(c: Character, d: Derived, skill: string, attr: string): Base {
  const val = (a: string) => (a === "magic" ? d.magic : a === "resonance" ? d.resonance : d.attrs[a as AttrKey] ?? 0);
  const a = val(attr);
  const aName = (ATTR_LABEL as Record<string, string>)[attr] ?? attr;
  if (!skill) return { base: a, parts: `${aName} ${a}`, blocked: false };
  const def = SKILL_BY_ID[skill];
  const e = c.skills[skill];
  const rank = e ? e.pts + e.kar : 0;
  if (rank > 0) return { base: rank + a, parts: `${def?.name ?? skill} ${rank} + ${aName} ${a}`, blocked: false };
  return { base: Math.max(0, a - 1), parts: `${aName} ${a} − 1 untrained`, blocked: !(def?.untrained ?? true) };
}
