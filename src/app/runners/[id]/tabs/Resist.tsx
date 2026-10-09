"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Num } from "./ui";
import type { SheetCtx } from "./ctx";
import { ATTR_LABEL, type AttrKey } from "@/lib/sr6/data";

export interface Pending { id: number; kind: "Drain" | "Fading"; label: string; dv: number | null; physical: boolean; attr: string }

/** Resist drain or fading: roll Willpower + attribute, then apply what gets through to the condition monitor. */
export function ResistPrompt({ ctx, p, onClose }: { ctx: SheetCtx; p: Pending; onClose: () => void }) {
  const { d } = ctx;
  const [dv, setDv] = useState(p.dv ?? 3);
  const [taken, setTaken] = useState<number | null>(null);
  const base = d.attrs.willpower + (d.attrs[p.attr as AttrKey] ?? (p.attr === "resonance" ? d.resonance : 0));
  const kind = p.physical ? "P" : "S";
  const resist = () => {
    const r = ctx.rollPool(`${p.kind} resistance (${p.label})`, base);
    setTaken(Math.max(0, dv - r.totalHits));
  };
  return (
    <div className="border border-accent/50 bg-accent/5 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="text-sm">
          <b className="font-display">{p.kind}</b> from {p.label}: <b className="num text-accent">{dv}</b> {p.physical ? "Physical" : "Stun"}
          {p.dv === null && <span className="ml-1 text-xs text-dim">(no formula saved, set the value)</span>}
        </div>
        {p.dv === null && taken === null && <Num label="Value" value={dv} onChange={setDv} min={1} className="w-20" />}
        {taken === null ? (
          <button className="btn small primary" onClick={resist}><Icon name="dice" size={14} /> Resist {ctx.poolOf(base)} ({ATTR_LABEL.willpower} + {ATTR_LABEL[p.attr as keyof typeof ATTR_LABEL] ?? p.attr})</button>
        ) : (
          <>
            <span className="num text-sm">{taken === 0 ? "Nothing gets through." : <>Take <b className="text-danger">{taken}</b> {p.physical ? "Physical" : "Stun"}</>}</span>
            {taken > 0 && <button className="btn small" onClick={() => { ctx.applyDamage(taken, kind); onClose(); }}>Apply</button>}
          </>
        )}
        <button className="btn ghost small ml-auto" onClick={onClose}>{taken === null ? "Skip" : "Done"}</button>
      </div>
    </div>
  );
}
