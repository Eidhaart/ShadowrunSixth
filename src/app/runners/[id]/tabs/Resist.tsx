"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Num } from "./ui";
import type { SheetCtx } from "./ctx";

export interface Pending {
  id: number;
  title: string;
  /** Damage Value to resist. Always editable before the roll. */
  dv: number;
  /** Fixed damage type, or "auto": Physical when what gets through is higher than `physicalAbove`. */
  type: "S" | "P" | "auto";
  physicalAbove?: number;
  poolLabel: string;
  base: number;
  /** Skip wound and sustaining penalties (damage to a vehicle or device, not to you). */
  bare?: boolean;
  /** Where the damage goes. Defaults to the runner's own condition monitor. */
  apply?: (taken: number, type: "S" | "P") => void;
  applyLabel?: string;
  note?: string;
}

/** Resist damage: roll the pool, subtract hits from the Damage Value, then apply what gets through. */
export function ResistPrompt({ ctx, p, onClose }: { ctx: SheetCtx; p: Pending; onClose: () => void }) {
  const [dv, setDv] = useState(p.dv);
  const [taken, setTaken] = useState<number | null>(null);
  const [hits, setHits] = useState(0);
  const pool = ctx.poolOf(p.base, p.bare ? { noWound: true, noSustain: true } : {});
  const resist = () => {
    const r = ctx.rollPool(`${p.title}: resistance`, p.base, p.bare ? { noWound: true, noSustain: true } : {});
    setHits(r.totalHits);
    setTaken(Math.max(0, dv - r.totalHits));
  };
  const kind: "S" | "P" = p.type === "auto" ? ((taken ?? dv) > (p.physicalAbove ?? 0) ? "P" : "S") : p.type;
  const word = kind === "P" ? "Physical" : "Stun";
  const apply = (n: number) => (p.apply ? p.apply(n, kind) : ctx.applyDamage(n, kind));
  return (
    <div className="border border-accent/50 bg-accent/5 p-3" role="group" aria-label={`Resist ${p.title}`}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="text-sm">
          <b className="font-display">{p.title}</b>
          <div className="text-xs text-dim">{p.note}</div>
        </div>
        {taken === null && <Num label="Damage Value" value={dv} onChange={setDv} min={0} max={99} className="w-24" />}
        {taken === null ? (
          <button className="btn small primary" onClick={resist}><Icon name="dice" size={14} /> Resist {pool} <span className="text-xs opacity-80">({p.poolLabel})</span></button>
        ) : (
          <>
            <span className="num text-sm">{dv} − {hits} hits = {taken === 0 ? <b className="text-ok">nothing gets through</b> : <b className="text-danger">{taken} {word}</b>}</span>
            {taken > 0 && <button className="btn small" onClick={() => { apply(taken); onClose(); }}>{p.applyLabel ?? "Apply"}</button>}
          </>
        )}
        <button className="btn ghost small ml-auto" onClick={onClose}>{taken === null ? "Skip" : "Done"}</button>
      </div>
      {taken === null && p.type === "auto" && <p className="mt-1 text-xs text-faint">Becomes Physical if what gets through is higher than {p.physicalAbove}.</p>}
    </div>
  );
}
