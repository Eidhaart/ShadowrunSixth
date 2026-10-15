"use client";
import { useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { BAR_META, LAYERS, MARKERS, type BarKey, type Obj, type Scene, type Token } from "@/lib/vtt/types";
import { controls, seesBars, useVtt } from "@/lib/vtt/store";
import { useTableUi, type Cam } from "./ui";
import { rollInitFor } from "./act";
import { weaponsOf } from "@/lib/vtt/combat";

function BarInput({ t, k, can, scene }: { t: Token; k: BarKey; can: boolean; scene: string }) {
  const dispatch = useVtt((s) => s.dispatch);
  const b = t.bars[k];
  if (!b) return null;
  const setCur = (cur: number) => dispatch([{ k: "merge", p: ["scenes", scene, "objects", t.id], v: { bars: { ...t.bars, [k]: { ...b, cur: Math.max(0, Math.min(b.max, cur)) } } } }]);
  return (
    <div className="flex items-center gap-1" title={`${BAR_META[k].name}: boxes left`}>
      <span className="size-2.5 rounded-full" style={{ background: BAR_META[k].color }} />
      <button className="vtt-mini" disabled={!can} onClick={() => setCur(b.cur - 1)} aria-label={`${BAR_META[k].name} minus one`}>−</button>
      <input className="vtt-num" disabled={!can} type="number" value={b.cur} onChange={(e) => setCur(Number(e.target.value) || 0)} aria-label={BAR_META[k].name} />
      <span className="num text-[11px] text-faint">/{b.max}</span>
      <button className="vtt-mini" disabled={!can} onClick={() => setCur(b.cur + 1)} aria-label={`${BAR_META[k].name} plus one`}>+</button>
    </div>
  );
}

/** Floating controls for the selected object, Roll20's token bubble and radial menu in one strip. */
export function TokenHud({ o, scene, cam }: { o: Obj; scene: Scene; cam: Cam }) {
  const me = useVtt((s) => s.me);
  const dispatch = useVtt((s) => s.dispatch);
  const state = useVtt((s) => s.state);
  const ui = useTableUi();
  const [markers, setMarkers] = useState(false);
  const can = controls(o, me);
  const p = ["scenes", scene.id, "objects", o.id];
  const left = Math.max(8, (o.x - cam.x) * cam.z);
  const top = (o.y + o.h - cam.y) * cam.z + 26;
  const t = o.kind === "token" ? o : null;
  const inTurn = t && state ? Object.values(state.turn.entries).some((e) => e.tokenId === t.id) : false;
  const mine = t && (t.runner?.owner === me.handle || t.owners.includes(me.handle));
  const canDelete = me.gm || (o.kind !== "token" ? o.by === me.handle : o.owners.length === 1 && o.owners[0] === me.handle);
  const zs = Object.values(scene.objects).map((x) => x.z);

  const del = () => { dispatch([{ k: "del", p }]); ui.select([]); };

  return (
    <div className="vtt-hud absolute z-20 flex max-w-[min(30rem,calc(100%-1rem))] flex-col gap-1.5 p-2" style={{ left: Math.min(left, 9999), top }} onPointerDown={(e) => e.stopPropagation()}>
      {t && (
        <div className="flex items-center gap-2">
          <b className="truncate text-sm">{t.name || "Token"}</b>
          {t.layer === "gm" && <span className="chip !text-[10px] text-astral">GM layer</span>}
          {t.locked && <span className="chip !text-[10px]">Locked</span>}
        </div>
      )}
      {t && seesBars(t, me) && Object.keys(t.bars).length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {(["b1", "b2", "b3"] as const).map((k) => <BarInput key={k} t={t} k={k} can={can} scene={scene.id} />)}
        </div>
      )}
      {t && t.markers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {t.markers.map((m) => (
            <button key={m} className="chip !text-[11px]" disabled={!can} onClick={() => dispatch([{ k: "merge", p, v: { markers: t.markers.filter((x) => x !== m) } }])} title="Remove">{m} ×</button>
          ))}
        </div>
      )}
      {markers && t && (
        <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto border-t border-line pt-1.5">
          {MARKERS.map((m) => (
            <button key={m} className={clsx("chip !text-[11px]", t.markers.includes(m) && "!border-accent text-accent")}
              onClick={() => dispatch([{ k: "merge", p, v: { markers: t.markers.includes(m) ? t.markers.filter((x) => x !== m) : [...t.markers, m] } }])}>{m}</button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1">
        {t && (me.gm || mine) && weaponsOf(t).length > 0 && (
          <button className={clsx("vtt-tool !w-auto px-2 text-xs", ui.targeting === t.id && "on")} onClick={() => ui.set({ targeting: ui.targeting === t.id ? null : t.id })} title="Attack: then click the target">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><circle cx="12" cy="12" r="7" /><path d="M12 2v5M12 17v5M2 12h5M17 12h5" /></svg> Attack
          </button>
        )}
        {t && (t.card || t.npc) && <button className="vtt-tool" onClick={() => ui.set({ dialog: { kind: "card", id: t.id } })} title="Stats and rolls"><Icon name="dice" size={15} /></button>}
        {t?.runner?.owner === me.handle && <button className="vtt-tool" onClick={() => ui.set({ dialog: { kind: "sheet", runnerId: t.runner!.runnerId } })} title="Open my sheet"><Icon name="runners" size={15} /></button>}
        {t && can && <button className={clsx("vtt-tool", markers && "on")} onClick={() => setMarkers(!markers)} title="Status markers"><Icon name="spark" size={15} /></button>}
        {t && (me.gm || mine) && (
          <button className="vtt-tool !w-auto px-2 text-xs" onClick={() => rollInitFor(t)} title={inTurn ? "Reroll initiative" : "Roll initiative and join the turn order"}>
            <Icon name="bolt" size={14} /> {inTurn ? "Reroll" : "Init"}
          </button>
        )}
        {can && t && <button className="vtt-tool" onClick={() => dispatch([{ k: "merge", p, v: { rot: ((t.rot || 0) + 45) % 360 } }])} title="Rotate 45°"><Icon name="undo" size={15} className="-scale-x-100" /></button>}
        {me.gm && (
          <>
            <button className="vtt-tool" onClick={() => dispatch([{ k: "merge", p, v: { z: Math.max(...zs) + 1 } }])} title="To front"><Icon name="up" size={15} /></button>
            <button className="vtt-tool" onClick={() => dispatch([{ k: "merge", p, v: { z: Math.min(...zs) - 1 } }])} title="To back"><Icon name="up" size={15} className="rotate-180" /></button>
            <select className="vtt-select" value={o.layer} onChange={(e) => { dispatch([{ k: "merge", p, v: { layer: e.target.value } }]); }} aria-label="Layer">
              {LAYERS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </>
        )}
        {t && me.gm && <button className="vtt-tool" onClick={() => ui.set({ dialog: { kind: "token", id: t.id } })} title="Edit token"><Icon name="settings" size={15} /></button>}
        {canDelete && <button className="vtt-tool text-danger" onClick={del} title="Delete"><Icon name="trash" size={15} /></button>}
      </div>
    </div>
  );
}
