"use client";
import clsx from "clsx";
import { DiceRow } from "@/components/academy/DiceRow";
import type { Die } from "@/lib/sr6/dice";
import type { WireDie, WireMsg } from "@/lib/comms";
import { rollOutcome } from "@/lib/callState";

type Roll = Extract<WireMsg, { type: "roll" }>;

export const toDice = (d: WireDie[]): Die[] => d.map((x) => ({ value: x.v, hit: !!x.hit, exploded: x.boom, rerolled: x.gone }));

/** Dice, hits and verdict for one roll. Dice tumble only when `animate` is set (live arrivals). */
export function RollBody({ m, animate, compact }: { m: Roll; animate: boolean; compact?: boolean }) {
  const out = rollOutcome(m);
  const size = compact ? "1.9rem" : "2.2rem";
  return (
    <div>
      <DiceRow dice={toDice(m.dice)} size={size} animate={animate} />
      {m.opposed && (
        <div className="mt-3 border-t border-dashed border-line pt-2">
          <div className="mb-1.5 flex items-baseline gap-2 font-mono text-xs text-dim">
            <span>{m.opposed.label}</span><span>{m.opposed.pool} dice</span>
            <b className="ml-auto text-sm text-fg">{m.opposed.hits} hits</b>
          </div>
          <DiceRow dice={toDice(m.opposed.dice)} size="1.6rem" animate={animate} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sm">
        <span><b className="text-2xl text-accent tabular-nums">{m.hits}</b> hits</span>
        {m.opposed && (
          <span className="text-dim">vs {m.opposed.hits}{m.hits > m.opposed.hits ? ` · net ${m.hits - m.opposed.hits}` : ""}</span>
        )}
        {out !== "none" && (
          <span
            className={clsx(
              "stamp rounded-sm border px-2 py-0.5 text-xs font-bold uppercase tracking-wider",
              out === "success" && "border-ok/60 bg-ok/10 text-ok",
              out === "fail" && "border-danger/60 bg-danger/10 text-danger",
              out === "tie" && "border-accent/60 bg-accent/10 text-accent",
            )}
          >
            {out === "success" ? "Success" : out === "fail" ? "Failed" : "Tie · GM decides"}
            {m.threshold && !m.opposed ? ` · needs ${m.threshold}` : ""}
          </span>
        )}
        {m.critGlitch ? (
          <span className="stamp rounded-sm border border-danger bg-danger/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-danger">Critical glitch</span>
        ) : m.glitch ? (
          <span className="stamp rounded-sm border border-accent/60 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-accent">Glitch</span>
        ) : null}
      </div>
      {((m.breakdown && m.breakdown !== `${m.pool} dice`) || m.edgeSpent > 0) && (
        <p className="mt-1.5 font-mono text-xs text-faint">
          {m.breakdown ?? ""}{m.breakdown ? " = " : ""}{m.pool} dice{m.edgeSpent ? ` · Edge ${m.edgeSpent}` : ""}
        </p>
      )}
    </div>
  );
}
