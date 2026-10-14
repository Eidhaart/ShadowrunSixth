/**
 * The virtual tabletop, shared by everyone in a chat room. The relay keeps the authoritative copy;
 * clients send small path operations (see ops.ts) and the relay checks permissions and hides the GM
 * layer from players.
 */

export type Layer = "map" | "token" | "gm";
export const LAYERS: { id: Layer; name: string; blurb: string }[] = [
  { id: "map", name: "Map", blurb: "Background art and terrain" },
  { id: "token", name: "Tokens", blurb: "Runners, NPCs and drawings everyone sees" },
  { id: "gm", name: "GM", blurb: "Hidden from players" },
];

export interface Bar { cur: number; max: number }
export type BarKey = "b1" | "b2" | "b3";
export const BAR_META: Record<BarKey, { name: string; color: string }> = {
  b1: { name: "Physical", color: "var(--danger)" },
  b2: { name: "Stun", color: "var(--cyan)" },
  b3: { name: "Edge", color: "var(--accent)" },
};

/** A token tied to a runner that lives on its owner's device. */
export interface RunnerLink { owner: string; runnerId: string }

/** What a runner's owner publishes so the GM and the table can see the essentials. */
export interface Card {
  sub: string;
  attrs: [string, number][];
  init: { base: number; dice: number };
  dr: number;
  pools: { label: string; dice: number }[];
}

/** A GM-run character's stat block. */
export interface Npc {
  init: { base: number; dice: number };
  dr: number;
  pools: { label: string; dice: number }[];
  notes: string;
}

interface Base { id: string; layer: Layer; x: number; y: number; w: number; h: number; z: number }

export interface Token extends Base {
  kind: "token";
  rot: number;
  img?: string;
  color: string;
  name: string;
  showName: boolean;
  /** Handles that may move and edit it; "*" means every player. */
  owners: string[];
  runner?: RunnerLink;
  bars: Partial<Record<BarKey, Bar>>;
  barsPublic: boolean;
  markers: string[];
  /** Aura radius in meters. */
  aura?: number;
  auraColor?: string;
  npc?: Npc;
  card?: Card;
  locked?: boolean;
  notes?: string;
}

export interface Shape extends Base {
  kind: "path" | "rect" | "ellipse" | "text";
  /** Freehand points relative to (x, y), flattened. */
  pts?: number[];
  stroke: string;
  fill: string;
  width: number;
  text?: string;
  size?: number;
  by: string;
}

export type Obj = Token | Shape;

export interface FogRegion { x: number; y: number; w: number; h: number; mode: "reveal" | "hide" }

export interface Scene {
  id: string;
  name: string;
  cols: number;
  rows: number;
  /** Meters per grid square. */
  scale: number;
  grid: boolean;
  gridColor: string;
  gridOpacity: number;
  bg?: string;
  bgColor: string;
  fog: boolean;
  fogRegions: FogRegion[];
  objects: Record<string, Obj>;
  notes: string;
}

export interface Handout { id: string; title: string; img?: string; text: string; shared: boolean }

export interface TurnEntry {
  id: string;
  name: string;
  tokenId?: string;
  /** Handle allowed to update it besides the GM. */
  owner?: string;
  score: number;
  base: number;
  dice: number;
  /** Minor actions left this round. */
  minors: number;
  acted: boolean;
  delayed: boolean;
  /** Breaks ties: higher goes first. */
  tie: number;
}

export interface Turn { on: boolean; round: number; current: string | null; entries: Record<string, TurnEntry> }

export interface Asset { id: string; data: string; w: number; h: number }

export interface TableState {
  stamp: number;
  scenes: Record<string, Scene>;
  order: string[];
  playerScene: string | null;
  handouts: Record<string, Handout>;
  turn: Turn;
  assets: Record<string, Asset>;
}

export type Op =
  | { k: "set"; p: string[]; v: unknown }
  | { k: "del"; p: string[] }
  | { k: "merge"; p: string[]; v: Record<string, unknown> };

/** Short-lived effects that are broadcast but never stored. */
export type Fx =
  | { kind: "ping"; scene: string; x: number; y: number; color: string; focus?: boolean }
  | { kind: "ruler"; scene: string; pts: number[]; color: string; label: string }
  | { kind: "ruler-end" };

export const CELL = 70;

/** Sixth World range categories, by distance in meters. */
export function rangeBand(m: number): string {
  if (m <= 3) return "Close";
  if (m <= 50) return "Near";
  if (m <= 250) return "Medium";
  if (m <= 500) return "Far";
  return "Extreme";
}

export const MARKERS = ["Burning", "Chilled", "Corrosive", "Dazed", "Deafened", "Fatigued", "Frightened", "Hazed", "Hobbled", "Immobilized", "Nauseated", "Panicked", "Poisoned", "Prone", "Stilled", "Wet", "Zapped", "Blinded", "Invisible", "Cover", "Sustaining", "Astral", "Down"];
