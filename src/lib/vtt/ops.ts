import type { Op, Scene, TableState, TurnEntry } from "./types";

/** Apply operations without mutating the input; untouched branches keep their identity. */
export function applyOps<T>(state: T, ops: Op[]): T {
  let s = state as unknown;
  for (const op of ops) s = applyOne(s, op);
  return s as T;
}

function applyOne(node: unknown, op: Op, depth = 0): unknown {
  const key = op.p[depth];
  const obj = (node && typeof node === "object" ? node : {}) as Record<string, unknown>;
  if (depth === op.p.length - 1) {
    const copy = { ...obj };
    if (op.k === "del") delete copy[key];
    else if (op.k === "set") copy[key] = op.v;
    else {
      const prev = copy[key];
      copy[key] = { ...(prev && typeof prev === "object" ? prev : {}), ...op.v };
    }
    return copy;
  }
  if (op.k === "del" && !(key in obj)) return obj;
  return { ...obj, [key]: applyOne(obj[key], op, depth + 1) };
}

export const getIn = (s: unknown, p: string[]): unknown => p.reduce<unknown>((n, k) => (n && typeof n === "object" ? (n as Record<string, unknown>)[k] : undefined), s);

export function emptyTable(): TableState {
  return { stamp: Date.now(), scenes: {}, order: [], playerScene: null, handouts: {}, turn: { on: false, round: 1, current: null, entries: {} }, assets: {}, combat: {} };
}

export function newScene(id: string, name: string): Scene {
  return { id, name, cols: 30, rows: 20, scale: 1.5, grid: true, gridColor: "#ffffff", gridOpacity: 0.12, bgColor: "#0b0d12", fog: false, fogRegions: [], objects: {}, notes: "" };
}

/** Turn order as acted: highest score first, ties broken by the tie value. */
export function sortedTurn(entries: Record<string, TurnEntry>): TurnEntry[] {
  return Object.values(entries).sort((a, b) => b.score - a.score || b.tie - a.tie || a.name.localeCompare(b.name));
}

/** The entry after the current one, or null when everyone has acted. */
export function nextUp(entries: Record<string, TurnEntry>, current: string | null): TurnEntry | null {
  const list = sortedTurn(entries).filter((e) => !e.acted && !e.delayed && e.id !== current);
  return list[0] ?? null;
}

let n = 0;
export const vid = (p: string) => `${p}${Date.now().toString(36)}${(n++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
