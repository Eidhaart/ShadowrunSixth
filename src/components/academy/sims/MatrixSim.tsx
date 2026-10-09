"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { DiceRow } from "../DiceRow";
import { Boxes } from "../widgets/ui";
import { Stars } from "./common";
import { useAcademy } from "@/lib/academy/progress";
import { BOOST_COST, BOOST_LABEL, type PostBoost } from "@/lib/sr6/dice";
import {
  BUILDS, DECK_MAX, HERO, HOST, IC_NAME, MODE_INFO, OS_LIMIT, PHYS_MAX, STUN_MAX, actions, begin, boost, canBoost, commit,
  debrief, hostAR, hostDR, newSim, type ActionId, type Build, type Ev, type Mode, type SimState,
} from "@/lib/academy/matrix/sim";

const BOOSTS: PostBoost[] = ["rerollOne", "plusOne", "autoHit", "rerollFailed"];
const TONE: Record<Ev["tone"], string> = {
  info: "border-line text-dim",
  sys: "border-line-hi text-fg",
  good: "border-ok text-fg",
  bad: "border-danger text-fg",
  os: "border-warn text-warn",
  ic: "border-danger text-danger",
};

function OsMeter({ os }: { os: number }) {
  const pct = Math.min(100, (os / OS_LIMIT) * 100);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs text-dim">
        <span>Overwatch Score</span>
        <span className={clsx("num text-base font-semibold", os >= 30 ? "text-danger" : os >= 20 ? "text-warn" : "text-fg")}>{os}<span className="text-dim"> / {OS_LIMIT}</span></span>
      </div>
      <div className={clsx("meter", os >= 30 && "hot")} role="meter" aria-valuemin={0} aria-valuemax={OS_LIMIT} aria-valuenow={os} aria-label="Overwatch Score">
        <div className="absolute inset-y-0 left-0 bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
        <div className="absolute inset-y-0 left-1/2 border-l border-line-hi" />
      </div>
    </div>
  );
}

function Hud({ s }: { s: SimState }) {
  const st = BUILDS[s.build];
  const f = Math.max(0, st.f - s.fwLoss);
  return (
    <aside className="panel space-y-4 p-4" aria-label="Status">
      <OsMeter os={s.os} />
      <div>
        <div className="mb-1 flex justify-between text-xs text-dim"><span>Deck damage</span><span className="num">{s.deck}/{DECK_MAX}</span></div>
        <Boxes total={DECK_MAX} filled={s.deck} per={3} hot />
      </div>
      {s.mode !== "ar" && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-dim"><span>{s.mode === "cold" ? "Stun (your body)" : "Physical (your body)"}</span><span className="num">{s.mode === "cold" ? s.stun : s.phys}/{s.mode === "cold" ? STUN_MAX : PHYS_MAX}</span></div>
          <Boxes total={s.mode === "cold" ? STUN_MAX : PHYS_MAX} filled={s.mode === "cold" ? s.stun : s.phys} per={3} hot />
        </div>
      )}
      <div className="grid grid-cols-4 gap-1 text-center">
        {([["A", st.a], ["S", st.s], ["D", st.d], ["F", f]] as const).map(([k, v]) => (
          <div key={k} className="border border-line bg-bg2 py-1"><div className="text-xs text-dim">{k}</div><div className={clsx("num text-lg font-semibold", k === "F" && s.fwLoss > 0 && "text-danger")}>{v}</div></div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="border border-line bg-bg2 p-2"><div className="text-xs text-dim">Your Edge</div><div className="num text-lg font-semibold text-accent">{s.edge}</div></div>
        <div className="border border-line bg-bg2 p-2"><div className="text-xs text-dim">Host Edge</div><div className="num text-lg font-semibold">{s.hostEdge}</div></div>
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-dim">Access</span><b className="capitalize">{s.access}{s.access !== "outsider" && (s.illegal ? " (illegal)" : " (clean)")}</b></div>
        <div className="flex justify-between"><span className="text-dim">Alarm</span><b className={s.alert ? "text-danger" : "text-ok"}>{s.alert ? "ON" : "quiet"}</b></div>
        <div className="flex justify-between"><span className="text-dim">Link-lock</span><b className={s.linkLock ? "text-danger" : ""}>{s.linkLock ? "LOCKED" : "no"}</b></div>
        <div className="flex justify-between"><span className="text-dim">Backdoor</span><b>{s.backdoor === null ? "none" : `+${s.backdoor} dice`}</b></div>
        <div className="flex justify-between"><span className="text-dim">Mode</span><b>{MODE_INFO[s.mode].name}</b></div>
      </div>
      <div className="border-t border-line pt-3 text-xs text-dim">
        <div>Your Attack Rating {st.a + st.s} vs their Defense Rating {hostDR}</div>
        <div>Their Attack Rating {hostAR} vs your Defense Rating {st.d + f}</div>
        <div className="mt-1">A lead of 4 or more earns the leader 1 bonus Edge each round.</div>
      </div>
      {s.ic.length > 0 && (
        <div className="space-y-1 border-t border-line pt-3">
          <div className="text-xs text-dim">IC in the host</div>
          {s.ic.map((i) => (
            <div key={i.id} className="flex items-center justify-between border border-danger/60 bg-bg2 px-2 py-1 text-sm"><span className="text-danger">{IC_NAME[i.kind]}</span><span className="num text-dim">{i.hp}/{HOST.rating * 2}</span></div>
          ))}
        </div>
      )}
      <ul className="space-y-1 border-t border-line pt-3 text-sm">
        {[["Find the ledger", s.knowsFile], ["Crack the encryption", s.cracked], ["Copy it", s.copied], ["Jack out with it", s.status === "won"]].map(([t, d]) => (
          <li key={t as string} className={clsx("flex items-center gap-2", d ? "text-ok" : "text-dim")}><Icon name={d ? "check" : "x"} size={13} /> {t as string}</li>
        ))}
      </ul>
    </aside>
  );
}

function LogView({ s }: { s: SimState }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [s.log.length, s.pending]);
  const lastDice = s.log.map((e, i) => (e.you || e.them ? i : -1)).filter((i) => i >= 0).slice(-2);
  return (
    <div className="panel quiet max-h-[34rem] min-h-72 space-y-2 overflow-y-auto p-3" aria-live="polite" aria-label="Mission log">
      {s.log.map((e, i) => (
        <div key={e.id} className={clsx("log-line border-l-2 bg-bg2/50 py-1.5 pl-3 pr-2 text-sm", TONE[e.tone])}>
          <div>{e.text}</div>
          {lastDice.includes(i) && (e.you || e.them) && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {e.you && <div><div className="mb-1 text-xs text-dim">{e.youLabel} · {e.you.totalHits} hit{e.you.totalHits === 1 ? "" : "s"}</div><DiceRow dice={e.you.dice} size="1.5rem" animate={false} /></div>}
              {e.them && <div><div className="mb-1 text-xs text-dim">{e.themLabel} · {e.them.totalHits} hit{e.them.totalHits === 1 ? "" : "s"}</div><DiceRow dice={e.them.dice} size="1.5rem" animate={false} /></div>}
            </div>
          )}
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}

function PendingPanel({ s, onBoost, onCommit }: { s: SimState; onBoost: (b: PostBoost) => void; onCommit: () => void }) {
  const p = s.pending!;
  const y = p.you.totalHits, t = p.them ? p.them.totalHits : null;
  const looks = t === null ? "Rolled" : y >= t && y >= 1 ? "Looks like a success" : "Looks like a failure";
  return (
    <div className="panel space-y-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold">{p.yourLabel}</h3>
        <span className={clsx("chip on", t !== null && !(y >= t && y >= 1) && "!border-danger !text-danger")}>{looks}</span>
      </div>
      <div className={clsx("grid gap-3", p.them && "sm:grid-cols-2")}>
        <div><div className="mb-1 text-xs text-dim">You · {y} hit{y === 1 ? "" : "s"}{p.penalty ? ` · −${p.penalty} dice from your Attack/Sleaze gap` : ""}</div><DiceRow key={p.you.id + p.you.edgeSpent} dice={p.you.dice} /></div>
        {p.them && <div><div className="mb-1 text-xs text-dim">{p.theirLabel} · {t} hit{t === 1 ? "" : "s"}</div><DiceRow dice={p.them.dice} /></div>}
      </div>
      {p.you.glitch && <p className="text-sm text-danger">{p.you.critGlitch ? "Critical glitch." : "Glitch."} More than half your dice are ones. Something goes wrong beyond the result.</p>}
      <div className="border-t border-line pt-3">
        <div className="mb-1.5 text-xs text-dim">Spend Edge on this roll (you have {s.edge}). One boost per roll.</div>
        <div className="flex flex-wrap gap-2">
          {BOOSTS.map((b) => (
            <button key={b} className="btn small" disabled={!canBoost(s, b)} onClick={() => onBoost(b)}>{BOOST_LABEL[b]} ({BOOST_COST[b]})</button>
          ))}
        </div>
      </div>
      <button className="btn primary" onClick={onCommit}>Lock it in</button>
    </div>
  );
}

function ActionButton({ a, onPick }: { a: ReturnType<typeof actions>[number]; onPick: (id: ActionId) => void }) {
  return (
    <button
      disabled={!a.enabled}
      onClick={() => onPick(a.id)}
      className={clsx("panel quiet w-full p-3 text-left transition-colors", a.enabled ? "hover:border-accent" : "opacity-45")}
      title={a.enabled ? a.blurb : a.why}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold">{a.label}</span>
        <span className="flex shrink-0 gap-1">
          <span className={clsx("chip", a.legal ? "on" : "!border-danger !text-danger")}>{a.legal ? "legal" : "illegal"}</span>
          {a.seconds >= 60 && <span className="chip">1 min</span>}
        </span>
      </div>
      <p className="mt-1 text-xs text-dim">{a.enabled ? a.blurb : a.why}</p>
      {a.enabled && a.id !== "defend" && (
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
          <span className="text-dim">Your pool <b className="num text-fg">{a.pool}</b>{a.penalty ? <span className="text-danger"> (−{a.penalty})</span> : null}</span>
          {a.theirs !== null && <span className="text-dim">Their pool <b className="num text-fg">{a.theirs}</b></span>}
          {a.odds !== null && <span className="text-dim">Chance <b className="num text-accent">{Math.round(a.odds * 100)}%</b></span>}
        </div>
      )}
    </button>
  );
}

function Setup({ onStart }: { onStart: (b: Build, m: Mode) => void }) {
  const [b, setB] = useState<Build>("ghost");
  const [m, setM] = useState<Mode>("cold");
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="panel space-y-3 p-5">
        <h2 className="text-2xl font-semibold">The job</h2>
        <p className="text-dim">Mr. Johnson wants one file: <b className="text-fg">the Q3 shipping ledger</b> on the accounting server of <b className="text-fg">Corvid Freight</b>. The proof is on it, the data is encrypted, and the host is a rating {HOST.rating} with Patrol IC and a nervous sysadmin.</p>
        <p className="text-dim">You are the decker: Cracking {HERO.cracking}, Electronics {HERO.electronics}, Logic {HERO.logic}, Willpower {HERO.willpower}, {HERO.edge} Edge. There are many ways to do this. A quiet one exists.</p>
        <ul className="grid gap-1 text-sm sm:grid-cols-3">
          <li className="flex items-center gap-2"><Stars n={1} max={1} /> Deliver the ledger</li>
          <li className="flex items-center gap-2"><Stars n={1} max={1} /> Overwatch Score under 20</li>
          <li className="flex items-center gap-2"><Stars n={1} max={1} /> Never trip the alarm</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h3 className="text-lg font-semibold">Pick your deck</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(BUILDS) as Build[]).map((k) => (
            <button key={k} onClick={() => setB(k)} aria-pressed={b === k} className={clsx("panel quiet p-3 text-left", b === k ? "!border-accent bg-accent/10 outline outline-1 outline-accent" : "hover:border-line-hi")}>
              <div className="flex items-baseline justify-between"><b>{BUILDS[k].name}</b><span className="num text-xs text-dim">A{BUILDS[k].a} S{BUILDS[k].s} D{BUILDS[k].d} F{BUILDS[k].f}</span></div>
              <p className="mt-1 text-sm text-dim">{BUILDS[k].blurb}</p>
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-2">
        <h3 className="text-lg font-semibold">Pick your mode</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(MODE_INFO) as Mode[]).map((k) => (
            <button key={k} onClick={() => setM(k)} aria-pressed={m === k} className={clsx("panel quiet p-3 text-left", m === k ? "!border-accent bg-accent/10 outline outline-1 outline-accent" : "hover:border-line-hi")}>
              <b>{MODE_INFO[k].name}</b>
              <p className="mt-1 text-xs text-dim">Initiative: {MODE_INFO[k].init}</p>
              <p className="text-xs text-dim">{MODE_INFO[k].dump}</p>
            </button>
          ))}
        </div>
      </section>
      <button className="btn primary" onClick={() => onStart(b, m)}><Icon name="bolt" size={15} /> Jack in</button>
    </div>
  );
}

function Debrief({ s, onAgain }: { s: SimState; onAgain: () => void }) {
  const d = debrief(s);
  return (
    <div className="panel mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">{d.headline}</h2>
        <Stars n={d.stars} />
      </div>
      <ul className="space-y-1">
        {d.goals.map((g) => <li key={g.text} className={clsx("flex items-center gap-2", g.ok ? "text-ok" : "text-dim")}><Icon name={g.ok ? "check" : "x"} size={14} /> {g.text}</li>)}
      </ul>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Rounds", s.round], ["Peak Overwatch", s.stats.peakOs], ["Hits taken", s.stats.hitsTaken], ["Edge spent", s.stats.edgeSpent]].map(([k, v]) => (
          <div key={k as string} className="border border-line bg-bg2 px-3 py-2"><div className="text-xs text-dim">{k}</div><div className="num text-xl font-semibold">{v}</div></div>
        ))}
      </div>
      {d.notes.length > 0 && (
        <div className="space-y-2 border-t border-line pt-3">
          <h3 className="font-semibold">What to take from this run</h3>
          <ul className="list-disc space-y-1.5 pl-5 text-dim">{d.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-2">
        <button className="btn primary" onClick={onAgain}>Run it again</button>
        <Link href="/learn/matrix" className="btn">Back to the lessons</Link>
      </div>
    </div>
  );
}

export function MatrixSim() {
  const [s, setS] = useState<SimState | null>(null);
  const record = useAcademy((a) => a.recordSim);

  const apply = (next: SimState) => {
    if (s && s.status === "play" && next.status !== "play") record("matrix", debrief(next).stars);
    setS(next);
  };

  if (!s) return <Setup onStart={(b, m) => setS(newSim(b, m))} />;
  if (s.status !== "play" && !s.pending) {
    return (
      <div className="space-y-4">
        <Debrief s={s} onAgain={() => setS(null)} />
        <details className="mx-auto max-w-3xl"><summary className="cursor-pointer text-sm text-dim">Show the mission log</summary><div className="mt-2"><LogView s={s} /></div></details>
      </div>
    );
  }
  const acts = actions(s);
  const groups: [string, ActionId[]][] = [
    ["Look", ["perceive", "search"]],
    ["Get in", ["probe", "backdoor", "bruteUser", "bruteAdmin"]],
    ["The file", ["crack", "disarm", "copy"]],
    ["Survive", ["spike", "defend", "jackout"]],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[17rem_1fr]">
      <Hud s={s} />
      <div className="space-y-4">
        <LogView s={s} />
        {s.pending ? (
          <PendingPanel s={s} onBoost={(b) => setS(boost(s, b))} onCommit={() => apply(commit(s))} />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-dim">Round {s.round}. Pick one Major action.{s.first === "host" ? " The host already acted this round." : " You are first; the host answers after you."}</p>
            {groups.map(([name, ids]) => (
              <div key={name} className="space-y-2">
                <h3 className="text-sm font-semibold text-dim">{name}</h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {ids.map((id) => acts.find((a) => a.id === id)!).map((a) => (
                    <ActionButton key={a.id} a={a} onPick={(id) => apply(begin(s, id))} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
