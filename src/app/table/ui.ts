"use client";
import { create } from "zustand";
import type { Layer } from "@/lib/vtt/types";

export type Tool = "select" | "pan" | "ruler" | "ping" | "draw" | "fog";
export type DrawKind = "path" | "rect" | "ellipse" | "text";
export type Panel = "chat" | "journal" | "compendium" | "house" | "scene";
export type Dialog =
  | { kind: "token"; id: string }
  | { kind: "card"; id: string }
  | { kind: "sheet"; runnerId: string }
  | { kind: "handout"; id: string }
  | { kind: "attack"; attackerId: string; targetId: string }
  | null;

export interface Cam { x: number; y: number; z: number }

interface TableUi {
  tool: Tool;
  draw: DrawKind;
  color: string;
  width: number;
  fill: boolean;
  fogMode: "reveal" | "hide";
  layer: Layer;
  selected: string[];
  snap: boolean;
  panel: Panel | null;
  dialog: Dialog;
  turnOpen: boolean;
  follow: boolean;
  /** Rolls made from NPC cards stay private. */
  secret: boolean;
  cams: Record<string, Cam>;
  /** Token picking a target for an attack. */
  targeting: string | null;
  /** The GM's client rolls defense and soak for GM-run targets on its own. */
  autoNpc: boolean;
  set: (p: Partial<Omit<TableUi, "set" | "select" | "setCam">>) => void;
  select: (ids: string[]) => void;
  setCam: (scene: string, cam: Cam) => void;
}

export const useTableUi = create<TableUi>((set) => ({
  tool: "select",
  draw: "path",
  color: "#ff3b5c",
  width: 4,
  fill: false,
  fogMode: "reveal",
  layer: "token",
  selected: [],
  snap: true,
  panel: "chat",
  dialog: null,
  turnOpen: false,
  follow: true,
  secret: false,
  cams: {},
  targeting: null,
  autoNpc: true,
  set: (p) => set(p),
  select: (ids) => set({ selected: ids }),
  setCam: (scene, cam) => set((s) => ({ cams: { ...s.cams, [scene]: cam } })),
}));

export const DRAW_COLORS = ["#ff3b5c", "#ffae3d", "#f6e33b", "#22f59a", "#1fe3f0", "#5b8cff", "#c39bff", "#ffffff", "#0b0d12"];
