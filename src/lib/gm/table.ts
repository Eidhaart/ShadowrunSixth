"use client";
import { useVtt } from "@/lib/vtt/store";
import { CELL, type Handout } from "@/lib/vtt/types";
import { vid } from "@/lib/vtt/ops";
import { assetOps, placeNpc } from "@/app/table/act";
import type { BinderEntry } from "./binder";

/** Bridges from the GM's binder and screen to the live table. */

export const tableReady = () => !!useVtt.getState().state && useVtt.getState().me.gm;

/** Start the table connection if nothing has yet (the GM hub can work before the Table page opens). */
export function ensureTable() { if (!useVtt.getState().loaded) void useVtt.getState().start(); }

/** The scene the GM is looking at, or the players' scene. */
export function gmScene() {
  const { state, viewing } = useVtt.getState();
  if (!state) return null;
  return state.scenes[viewing ?? ""] ?? state.scenes[state.playerScene ?? ""] ?? state.scenes[state.order[0]] ?? null;
}

/** Reveal a binder entry to the players as a handout. */
export function shareAsHandout(e: BinderEntry): string | null {
  const { state, dispatch } = useVtt.getState();
  if (!state) return "Open the Table first.";
  const a = assetOps(state, e.img, 1400, 1400);
  const id = vid("h");
  const h: Handout = { id, title: e.title, text: [e.sub, e.body.replace(/\[\[([^\]]+)\]\]/g, "$1")].filter(Boolean).join("\n\n"), img: a.id, shared: true };
  dispatch([...a.ops, { k: "set", p: ["handouts", id], v: h }]);
  return null;
}

/** Drop a binder NPC in the middle of the GM's current scene. */
export function putOnTable(e: BinderEntry): string | null {
  const scene = gmScene();
  if (!scene) return "Open the Table first.";
  const cx = Math.round(scene.cols / 2) * CELL, cy = Math.round(scene.rows / 2) * CELL;
  placeNpc(scene, cx, cy, { name: e.title, portrait: e.img, npc: e.npc, monitor: e.monitor });
  return null;
}
