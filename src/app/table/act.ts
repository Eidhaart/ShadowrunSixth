"use client";
import { doInitiative, doRoll } from "@/lib/actions";
import { useRunners } from "@/lib/store/characters";
import { CELL, type Op, type Scene, type TableState, type Token, type TurnEntry } from "@/lib/vtt/types";
import { nextUp, sortedTurn, vid } from "@/lib/vtt/ops";
import { useVtt } from "@/lib/vtt/store";
import { barsFor, blankNpc, cardFor, npcFor } from "@/lib/vtt/runner";
import { useTableUi } from "./ui";

const TOKEN_COLORS = ["#ff3b5c", "#ffae3d", "#22f59a", "#1fe3f0", "#5b8cff", "#c39bff", "#f6e33b"];
const colorFor = (s: string) => TOKEN_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % TOKEN_COLORS.length];

/** A portrait data URL stored once as a shared asset. */
export function assetOps(state: TableState, data: string | undefined, w = 300, h = 300): { id?: string; ops: Op[] } {
  if (!data) return { ops: [] };
  const found = Object.values(state.assets).find((a) => a.data === data);
  if (found) return { id: found.id, ops: [] };
  if (data.length > 690_000) return { ops: [] };
  const id = vid("a");
  return { id, ops: [{ k: "set", p: ["assets", id], v: { id, data, w, h } }] };
}

export function baseToken(name: string, x: number, y: number, layer: Token["layer"], owners: string[]): Token {
  return {
    id: vid("t"), kind: "token", layer, x: Math.round(x / CELL) * CELL, y: Math.round(y / CELL) * CELL, w: CELL, h: CELL, z: Date.now(),
    rot: 0, color: colorFor(name), name, showName: true, owners, bars: {}, barsPublic: false, markers: [],
  };
}

/** Put one of my runners on the map, linked to the sheet on this device. */
export function placeRunner(runnerId: string, scene: Scene, x: number, y: number) {
  const { state, me, dispatch } = useVtt.getState();
  const r = useRunners.getState().runners[runnerId];
  if (!state || !r) return;
  const a = assetOps(state, r.portrait);
  const t = baseToken(r.alias || r.name || "Runner", x, y, "token", [me.handle]);
  t.runner = { owner: me.handle, runnerId };
  t.bars = barsFor(r);
  t.card = cardFor(r);
  t.img = a.id;
  dispatch([...a.ops, { k: "set", p: ["scenes", scene.id, "objects", t.id], v: t }]);
  useTableUi.getState().select([t.id]);
}

/** A GM-run copy of a character (or a blank grunt) on the GM or token layer. */
export function placeNpc(scene: Scene, x: number, y: number, from?: { name: string; portrait?: string; char?: Parameters<typeof npcFor>[0] }) {
  const { state, dispatch } = useVtt.getState();
  if (!state) return;
  const layer = useTableUi.getState().layer === "gm" ? "gm" : "token";
  const name = from?.name ?? "Grunt";
  const t = baseToken(name, x, y, layer, []);
  const block = from?.char ? npcFor(from.char) : blankNpc();
  t.npc = block.npc;
  t.bars = block.bars;
  t.showName = layer === "gm";
  const a = assetOps(state, from?.portrait);
  t.img = a.id;
  dispatch([...a.ops, { k: "set", p: ["scenes", scene.id, "objects", t.id], v: t }]);
  useTableUi.getState().select([t.id]);
}

/** Initiative for a token: rolls it, adds or updates its turn entry. */
export function rollInitFor(t: Token, edgeBoost = false) {
  const { state, me, dispatch } = useVtt.getState();
  if (!state) return;
  const init = t.npc?.init ?? t.card?.init ?? { base: 8, dice: 1 };
  const secret = me.gm && !!t.npc;
  const label = `${t.name} initiative`;
  const r = secret
    ? { score: init.base + (edgeBoost ? 3 : 0) + Array.from({ length: Math.min(5, init.dice) }, () => 1 + Math.floor(Math.random() * 6)).reduce((a, b) => a + b, 0), dice: [] as number[] }
    : doInitiative(label, init.base, init.dice, edgeBoost ? 3 : 0, t.name);
  const existing = Object.values(state.turn.entries).find((e) => e.tokenId === t.id);
  const owner = t.runner?.owner ?? (t.owners.length === 1 && t.owners[0] !== "*" ? t.owners[0] : undefined);
  if (existing) {
    dispatch([{ k: "merge", p: ["turn", "entries", existing.id], v: { score: r.score, base: init.base, dice: init.dice, minors: 1 + init.dice, acted: false, delayed: false, tie: Math.random() } }]);
    return;
  }
  const e: TurnEntry = { id: vid("i"), name: t.name, tokenId: t.id, owner: owner ?? (me.gm ? undefined : me.handle), score: r.score, base: init.base, dice: init.dice, minors: 1 + init.dice, acted: false, delayed: false, tie: Math.random() };
  if (!me.gm && e.owner !== me.handle) return;
  const ops: Op[] = [{ k: "set", p: ["turn", "entries", e.id], v: e }];
  if (me.gm && !state.turn.on) ops.push({ k: "merge", p: ["turn"], v: { on: true } });
  dispatch(ops);
}

/** Move to the next actor. When everyone has gone, a new combat round begins. */
export function nextTurn() {
  const { state, me, dispatch } = useVtt.getState();
  if (!state) return;
  const { entries, current } = state.turn;
  const ops: Op[] = [];
  if (current && entries[current]) ops.push({ k: "merge", p: ["turn", "entries", current], v: { acted: true } });
  const after = { ...entries, ...(current && entries[current] ? { [current]: { ...entries[current], acted: true } } : {}) };
  const nx = nextUp(after, null);
  if (nx) ops.push({ k: "merge", p: ["turn"], v: { current: nx.id } });
  else if (!me.gm) ops.push({ k: "merge", p: ["turn"], v: { current: null } });
  else return newRound(false);
  dispatch(ops);
  if (nx) follow(nx);
}

/** A new combat round: everyone may act again, Minor actions refresh. Optionally reroll initiative. */
export function newRound(reroll: boolean) {
  const { state, me, dispatch } = useVtt.getState();
  if (!state) return;
  const ops: Op[] = [];
  const updated: Record<string, TurnEntry> = {};
  for (const e of Object.values(state.turn.entries)) {
    const v: Partial<TurnEntry> = { acted: false, delayed: false, minors: 1 + e.dice };
    // the GM rerolls NPCs; runners roll their own
    if (reroll && me.gm && !e.owner) v.score = e.base + Array.from({ length: Math.min(5, e.dice) }, () => 1 + Math.floor(Math.random() * 6)).reduce((a, b) => a + b, 0);
    updated[e.id] = { ...e, ...v };
    ops.push({ k: "merge", p: ["turn", "entries", e.id], v });
  }
  const first = sortedTurn(updated)[0];
  ops.push({ k: "merge", p: ["turn"], v: { round: state.turn.round + 1, current: first?.id ?? null } });
  dispatch(ops);
  if (first) follow(first);
}

function follow(e: TurnEntry) {
  const { state } = useVtt.getState();
  if (!state || !e.tokenId || !useTableUi.getState().follow) return;
  for (const s of Object.values(state.scenes)) {
    const t = s.objects[e.tokenId];
    if (t) { useVtt.setState({ focus: { x: t.x + t.w / 2, y: t.y + t.h / 2, scene: s.id, at: Date.now() } }); return; }
  }
}

/** Roll a pool from a token's card or NPC block. NPC rolls by the GM can stay secret. */
export function rollPool(t: Token, label: string, dice: number) {
  const { me } = useVtt.getState();
  const secret = me.gm && !!t.npc && useTableUi.getState().secret;
  doRoll({ label: `${t.name}: ${label}`, pool: dice }, 0, t.name, !secret);
}
