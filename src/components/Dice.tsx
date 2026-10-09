"use client";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  BOOST_COST,
  BOOST_LABEL,
  applyPostBoost,
  bestTarget,
  canPostBoost,
  glitchOdds,
  hitOdds,
  type Die as DieT,
  type PostBoost,
  type RollResult,
} from "@/lib/sr6/dice";
import { Icon } from "@/components/Icon";
import { useRolls } from "@/lib/store/rolls";
import { doInitiative, doRoll, reshare, whoAmI } from "@/lib/actions";

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function DieFace({
  value,
  state,
  size = "3.1rem",
  onClick,
  title,
}: {
  value: number;
  state?: { hit?: boolean; one?: boolean; ghost?: boolean; boom?: boolean; bump?: boolean; rolling?: boolean; settle?: boolean; pick?: boolean };
  size?: string;
  onClick?: () => void;
  title?: string;
}) {
  const pips = PIPS[Math.min(6, Math.max(1, value))] ?? [];
  const cls = clsx(
    "die",
    state?.hit && "hit",
    state?.one && "one",
    state?.ghost && "ghost",
    state?.boom && "boom",
    state?.bump && "bump",
    state?.rolling && "rolling",
    state?.settle && "settle",
    state?.pick && "ring-2 ring-cyan cursor-pointer",
  );
  const body = Array.from({ length: 9 }, (_, i) => (pips.includes(i) ? <i key={i} /> : <span key={i} />));
  const style = { ["--s" as string]: size } as React.CSSProperties;
  return onClick ? (
    <button type="button" className={cls} style={style} onClick={onClick} title={title} aria-label={`Die showing ${value}`}>
      {body}
    </button>
  ) : (
    <div className={cls} style={style} title={title} role="img" aria-label={`Die showing ${value}`}>
      {body}
    </div>
  );
}

/** Shows the dice tumbling for a moment after a fresh roll, then settles on the real faces. */
function useRolling(r: RollResult): { rolling: boolean; tick: number; settle: boolean } {
  const [fresh] = useState(() => Date.now() - r.at < 900);
  const [rolling, setRolling] = useState(fresh);
  const [settle, setSettle] = useState(fresh);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!fresh) return;
    const iv = setInterval(() => setTick((t) => t + 1), 90);
    const t = setTimeout(() => { setRolling(false); clearInterval(iv); }, Math.min(900, 380 + r.dice.length * 22));
    const t2 = setTimeout(() => setSettle(false), 1600);
    return () => { clearInterval(iv); clearTimeout(t); clearTimeout(t2); };
  }, [fresh, r.id, r.dice.length]);
  return { rolling, tick, settle };
}

function Cheer({ r }: { r: RollResult }) {
  if (r.critGlitch)
    return <span className="chip" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>Critical glitch</span>;
  if (r.glitch)
    return <span className="chip" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>Glitch</span>;
  if (r.success === true) return <span className="chip on">Success</span>;
  if (r.success === false) return <span className="chip">Failed</span>;
  return null;
}

export function RollView({
  result,
  who,
  compact,
  edgeAvailable,
  onBoost,
}: {
  result: RollResult;
  who: string;
  compact?: boolean;
  /** If given, boosts costing more than this are disabled. */
  edgeAvailable?: number;
  onBoost?: (cost: number) => void;
}) {
  const replace = useRolls((s) => s.replace);
  const { rolling, tick, settle } = useRolling(result);
  const [pick, setPick] = useState<PostBoost | null>(null);
  const size = result.dice.length > 24 ? "2.2rem" : result.dice.length > 14 ? "2.6rem" : compact ? "2.4rem" : "3.1rem";

  const apply = (b: PostBoost, idx?: number) => {
    const next = applyPostBoost(result, b, idx);
    if (next === result) return;
    replace(result.id, next);
    onBoost?.(BOOST_COST[b]);
    reshare(who, next);
    setPick(null);
  };

  const boosts: PostBoost[] = ["rerollOne", "plusOne", "autoHit", "rerollFailed"];

  return (
    <div className="space-y-3" aria-live="polite">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <div className="font-display text-sm text-dim">
          <span className="text-fg">{result.spec.label || "Test"}</span> · {who}
        </div>
        <div className="text-xs text-faint num">
          {result.baseCount} dice{result.spec.threshold !== undefined && ` · threshold ${result.spec.threshold}`}
          {result.spec.explode && " · Edge, 6s explode"}
          {result.spec.glitchOn2 && " · 2s glitch"}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {result.dice.map((d: DieT, i) => (
          <DieFace
            key={i}
            value={rolling ? ((i * 7 + tick) % 6) + 1 : d.value}
            size={size}
            state={{
              rolling,
              settle: !rolling && settle,
              hit: !rolling && d.hit && !d.rerolled,
              one: !rolling && d.value === 1 && !d.rerolled,
              ghost: !rolling && d.rerolled,
              boom: !rolling && d.exploded,
              bump: !rolling && d.bumped,
              pick: pick !== null && !d.rerolled && (pick === "rerollOne" || (pick === "plusOne" && d.value < 6)),
            }}
            onClick={pick !== null && !d.rerolled ? () => apply(pick, i) : undefined}
          />
        ))}
        {result.autoHits > 0 &&
          Array.from({ length: result.autoHits }, (_, i) => (
            <div key={`a${i}`} className="die hit grid place-items-center font-display text-accent" style={{ ["--s" as string]: size } as React.CSSProperties} title="Bought hit">
              +1
            </div>
          ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className={clsx("font-display text-4xl glow", rolling && "opacity-30")}>
          <span className="num">{rolling ? "··" : result.totalHits}</span>
          <span className="ml-2 text-base text-dim">{result.totalHits === 1 ? "hit" : "hits"}</span>
        </div>
        {!rolling && <Cheer r={result} />}
        {!rolling && result.edgeSpent > 0 && <span className="chip">Edge spent: {result.edgeSpent}</span>}
      </div>

      {!compact && !rolling && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="text-xs text-faint">Edge, once per action:</span>
          {boosts.map((b) => {
            const can = canPostBoost(result, b) && (edgeAvailable === undefined || BOOST_COST[b] <= edgeAvailable);
            return (
              <button
                key={b}
                className={clsx("btn small", pick === b && "primary")}
                disabled={!can}
                onClick={() => {
                  if (b === "rerollOne" || b === "plusOne") {
                    if (pick === b) setPick(null);
                    else setPick(b);
                  } else apply(b);
                }}
                title={`${BOOST_COST[b]} Edge`}
              >
                {BOOST_LABEL[b]} <span className="num text-xs opacity-70">{BOOST_COST[b]}</span>
              </button>
            );
          })}
          {pick && (
            <button className="btn small ghost" onClick={() => { const i = bestTarget(result, pick); if (i >= 0) apply(pick, i); }}>
              Pick best die for me
            </button>
          )}
          {pick && <span className="text-xs text-cyan">Click a die to use it.</span>}
          {result.postBoost && <span className="text-xs text-faint">Edge already spent on this roll.</span>}
        </div>
      )}
    </div>
  );
}

export function Roller({ compact = false, defaultLabel = "" }: { compact?: boolean; defaultLabel?: string }) {
  const [pool, setPool] = useState(8);
  const [label, setLabel] = useState(defaultLabel);
  const [threshold, setThreshold] = useState<number | "">("");
  const [edge, setEdge] = useState(0);
  const [explode, setExplode] = useState(false);
  const [glitch2, setGlitch2] = useState(false);
  const [initBase, setInitBase] = useState(9);
  const [initDice, setInitDice] = useState(1);

  const odds = useMemo(() => {
    const total = explode ? pool + edge : pool;
    return {
      total,
      one: hitOdds(total, 1),
      thr: threshold === "" ? null : hitOdds(total, threshold),
      glitch: glitchOdds(total),
      expected: total / 3,
    };
  }, [pool, edge, explode, threshold]);

  const go = () =>
    doRoll(
      {
        label: label || "Test",
        pool,
        explode,
        glitchOn2: glitch2,
        threshold: threshold === "" ? undefined : threshold,
      },
      edge,
    );

  return (
    <div className={clsx("space-y-4", compact && "text-sm")}>
      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <div>
          <label className="mb-1 block text-xs text-dim" htmlFor="pool">Dice pool</label>
          <div className="flex items-center gap-1">
            <button className="btn small" aria-label="Fewer dice" onClick={() => setPool(Math.max(0, pool - 1))}><Icon name="minus" size={14} /></button>
            <input
              id="pool"
              className="field num w-16 text-center text-lg"
              type="number"
              min={0}
              max={99}
              value={pool}
              onChange={(e) => setPool(Math.max(0, Math.min(99, Number(e.target.value) || 0)))}
            />
            <button className="btn small" aria-label="More dice" onClick={() => setPool(Math.min(99, pool + 1))}><Icon name="plus" size={14} /></button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-dim" htmlFor="rl">What is this roll?</label>
          <input id="rl" className="field" placeholder="Firearms + Agility, Perception, Spellcasting..." value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map((n) => (
          <button key={n} className={clsx("chip num", pool === n && "on")} onClick={() => setPool(n)}>{n}</button>
        ))}
      </div>

      <div className="grid gap-3">
        <div className="max-w-40">
          <label className="mb-1 block text-xs text-dim" htmlFor="thr">Threshold (optional)</label>
          <input id="thr" className="field num" type="number" min={0} value={threshold} onChange={(e) => setThreshold(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))} />
        </div>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 accent-[var(--accent)]" checked={explode} onChange={(e) => setExplode(e.target.checked)} />
          <span>Edge boost: add Edge as dice, 6s explode <span className="text-faint">(4 Edge)</span></span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 accent-[var(--accent)]" checked={glitch2} onChange={(e) => setGlitch2(e.target.checked)} />
          <span>Foe spent 5 Edge: 2s count toward glitches</span>
        </label>
      </div>

      {explode && (
        <div className="max-w-40">
          <label className="mb-1 block text-xs text-dim" htmlFor="edge">Your Edge rating</label>
          <input id="edge" className="field num" type="number" min={0} max={9} value={edge} onChange={(e) => setEdge(Math.max(0, Math.min(9, Number(e.target.value) || 0)))} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-dim">
        <span>Expected hits <b className="num text-fg">{odds.expected.toFixed(1)}</b></span>
        <span>At least 1 hit <b className="num text-fg">{Math.round(odds.one * 100)}%</b></span>
        {odds.thr !== null && <span>Beat threshold <b className="num text-fg">{Math.round(odds.thr * 100)}%</b></span>}
        <span>Glitch <b className="num text-fg">{(odds.glitch * 100).toFixed(odds.glitch < 0.1 ? 1 : 0)}%</b></span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn primary" onClick={go}><Icon name="dice" size={18} /> Roll {odds.total} dice</button>
      </div>

      {!compact && (
        <div className="panel quiet p-3">
          <div className="mb-2 font-display text-sm text-dim">Initiative</div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-dim" htmlFor="ib">Reaction + Intuition</label>
              <input id="ib" className="field num w-24" type="number" value={initBase} onChange={(e) => setInitBase(Number(e.target.value) || 0)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-dim" htmlFor="id">Initiative dice</label>
              <input id="id" className="field num w-24" type="number" min={1} max={5} value={initDice} onChange={(e) => setInitDice(Math.max(1, Math.min(5, Number(e.target.value) || 1)))} />
            </div>
            <button className="btn" onClick={() => doInitiative(label || "Initiative", initBase, initDice)}>Roll initiative</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function RollLog({ limit = 30, compact }: { limit?: number; compact?: boolean }) {
  const log = useRolls((s) => s.log);
  const clear = useRolls((s) => s.clear);
  if (log.length === 0) return <p className="text-sm text-dim">No rolls yet. Your recent tests will show up here.</p>;
  return (
    <div className="space-y-3">
      {log.slice(0, limit).map((e) =>
        e.kind === "roll" ? (
          <div key={e.result.id} className="border-b border-line pb-3 last:border-0">
            <RollView result={e.result} who={e.who} compact={compact} />
          </div>
        ) : (
          <div key={e.result.id} className="flex flex-wrap items-center gap-3 border-b border-line pb-3 text-sm last:border-0">
            <span className="font-display">{e.result.label}</span>
            <span className="text-dim">{e.who}</span>
            <span className="num text-dim">{e.result.base + e.result.bonus} + [{e.result.dice.join(" + ")}]</span>
            <span className="font-display text-2xl glow num">{e.result.score}</span>
          </div>
        ),
      )}
      <button className="btn small ghost" onClick={clear}><Icon name="trash" size={14} /> Clear log</button>
    </div>
  );
}

export { whoAmI };
