"use client";
import { rules } from "@/lib/house/rules";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { minorsFor, sortedTurn } from "@/lib/vtt/ops";
import { useVtt } from "@/lib/vtt/store";
import type { Token, TurnEntry } from "@/lib/vtt/types";
import { useTableUi } from "./ui";
import { newRound, nextTurn, rollInitFor } from "./act";

/**
 * Sixth World combat: everyone acts once per round in initiative order. Each turn is one Major action
 * and 1 + initiative dice Minor actions. Delaying holds your turn until you jump in.
 */
export function TurnOrder() {
  const state = useVtt((s) => s.state);
  const me = useVtt((s) => s.me);
  const dispatch = useVtt((s) => s.dispatch);
  const ui = useTableUi();
  if (!state) return null;
  const { turn } = state;
  const list = sortedTurn(turn.entries);
  const can = (e: TurnEntry) => me.gm || e.owner === me.handle;
  const tokenOf = (e: TurnEntry): Token | undefined => {
    if (!e.tokenId) return undefined;
    for (const s of Object.values(state.scenes)) { const o = s.objects[e.tokenId]; if (o?.kind === "token") return o; }
  };
  const merge = (e: TurnEntry, v: Partial<TurnEntry>) => dispatch([{ k: "merge", p: ["turn", "entries", e.id], v }]);
  const myTokens = Object.values(state.scenes[state.playerScene ?? ""]?.objects ?? {}).filter((o): o is Token => o.kind === "token" && (o.runner?.owner === me.handle || o.owners.includes(me.handle)));
  const missing = myTokens.filter((t) => !list.some((e) => e.tokenId === t.id));
  const cur = turn.current ? turn.entries[turn.current] : undefined;
  const myTurn = cur && cur.owner === me.handle;

  const addSelected = () => {
    const scene = state.scenes[useVtt.getState().viewing ?? ""];
    if (!scene) return;
    for (const id of ui.selected) { const o = scene.objects[id]; if (o?.kind === "token" && !list.some((e) => e.tokenId === o.id)) rollInitFor(o); }
  };

  return (
    <section className="vtt-turn-panel panel flex max-h-[min(70dvh,34rem)] w-72 flex-col overflow-hidden" aria-label="Turn order">
      <div className="panel-head gap-2 text-sm">
        <Icon name="bolt" size={15} />
        <span className="flex-1">Turn order</span>
        <span className="num text-xs text-dim">Round {turn.round}</span>
        <button className="btn small ghost !px-1.5" onClick={() => ui.set({ turnOpen: false })} aria-label="Hide turn order"><Icon name="x" size={14} /></button>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto">
        {list.length === 0 && <li className="p-3 text-sm text-dim">{me.gm ? "Select tokens and press Add, or use Init on a token." : "Roll initiative on your token to join."}</li>}
        {list.map((e) => {
          const t = tokenOf(e);
          const active = e.id === turn.current;
          const img = t?.img ? state.assets[t.img]?.data : undefined;
          return (
            <li key={e.id} className={clsx("vtt-turn-row flex items-center gap-2 border-b border-line px-2 py-1.5", active && "is-current", e.acted && !active && "opacity-50")}>
              <button className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full border border-line text-xs font-bold" style={{ background: t?.color ?? "var(--bg-2)" }}
                onClick={() => t && useVtt.setState({ focus: { x: t.x + t.w / 2, y: t.y + t.h / 2, scene: Object.values(state.scenes).find((s) => s.objects[t.id])!.id, at: Date.now() } })} title="Show on map">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {img ? <img src={img} alt="" className="size-full object-cover" /> : e.name.slice(0, 2).toUpperCase()}
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{e.name}{e.delayed && <span className="ml-1 text-xs font-normal text-cyan">delaying</span>}</div>
                <div className="flex items-center gap-0.5" title={`${e.minors} Minor actions left`}>
                  <span className="mr-1 text-[10px] text-faint">Minor</span>
                  {Array.from({ length: minorsFor(e.dice, rules().minorBase) }, (_, i) => (
                    <button key={i} disabled={!can(e)} className={clsx("vtt-pip", i < e.minors && "on")} onClick={() => merge(e, { minors: i < e.minors ? i : i + 1 })} aria-label={`Minor action ${i + 1}`} />
                  ))}
                </div>
              </div>
              {can(e) ? (
                <input className="vtt-num !w-12 text-right font-bold" type="number" value={e.score} onChange={(x) => merge(e, { score: Number(x.target.value) || 0 })} aria-label={`${e.name} initiative score`} />
              ) : <b className="num w-12 text-right">{e.score}</b>}
              {can(e) && (
                <div className="flex flex-col">
                  <button className="vtt-mini" title={e.delayed ? "Act now" : "Delay"} onClick={() => {
                    if (e.delayed) { merge(e, { delayed: false }); if (me.gm) dispatch([{ k: "merge", p: ["turn"], v: { current: e.id } }]); }
                    else merge(e, { delayed: true });
                  }}>{e.delayed ? "▶" : "⏸"}</button>
                  {me.gm && <button className="vtt-mini" title="Remove" onClick={() => dispatch([{ k: "del", p: ["turn", "entries", e.id] }, ...(turn.current === e.id ? [{ k: "merge" as const, p: ["turn"], v: { current: null } }] : [])])}>×</button>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <div className="space-y-1.5 border-t border-line p-2">
        {cur && <p className="text-xs text-dim"><b className="text-fg">{cur.name}</b> is up: 1 Major, {cur.minors} Minor{cur.minors === 1 ? "" : "s"} left.</p>}
        {me.gm ? (
          <div className="flex flex-wrap gap-1.5">
            <button className="btn small primary flex-1" onClick={nextTurn} disabled={!list.length}>{turn.current ? "Next" : "Start"}</button>
            <button className="btn small" onClick={() => newRound(true)} disabled={!list.length} title="Everyone acts again; NPC initiative is rerolled">New round</button>
            <button className="btn small" onClick={addSelected} disabled={!ui.selected.length} title="Roll initiative for the selected tokens not yet in the order">Add</button>
            <button className="btn small ghost" title="Clear the turn order" onClick={() => { if (confirm("Clear the turn order?")) dispatch([{ k: "set", p: ["turn"], v: { on: false, round: 1, current: null, entries: {} } }]); }}><Icon name="trash" size={14} /></button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {missing.map((t) => <button key={t.id} className="btn small primary flex-1" onClick={() => rollInitFor(t)}>Roll init: {t.name}</button>)}
            {myTurn && <button className="btn small primary flex-1" onClick={nextTurn}>End my turn</button>}
          </div>
        )}
        <label className="flex items-center gap-1.5 text-xs text-dim"><input type="checkbox" checked={ui.follow} onChange={(e) => ui.set({ follow: e.target.checked })} /> Camera follows the active token</label>
      </div>
    </section>
  );
}
