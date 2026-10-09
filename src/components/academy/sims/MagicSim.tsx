"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { DiceRow } from "../DiceRow";
import { Boxes, Stepper } from "../widgets/ui";
import { Stars } from "./common";
import { useAcademy } from "@/lib/academy/progress";
import { BOOST_COST, BOOST_LABEL, type PostBoost } from "@/lib/sr6/dice";
import { SPELL } from "@/lib/academy/magic/data";
import {
  DEFAULT_KNOWN, FORCE_CAP, HERO, KNOWN_CHOICES, MAX_KNOWN, PHYS_MAX, SCENES, STUN_MAX, begin, boost, canBoost, debrief, drop, liveTargets,
  moves, newSim, previewBanish, previewSpell, previewSummon, step, move, sustainPenalty, type Ev, type MState, type Trad,
} from "@/lib/academy/magic/sim";

const BOOSTS: PostBoost[] = ["rerollOne", "plusOne", "autoHit", "rerollFailed"];
const TONE: Record<Ev["tone"], string> = {
  info: "border-line text-dim",
  sys: "border-line-hi text-fg",
  good: "border-ok text-fg",
  bad: "border-danger text-fg",
  drain: "border-warn text-warn",
};

function Setup({ onStart }: { onStart: (t: Trad, known: string[]) => void }) {
  const [trad, setTrad] = useState<Trad>("hermetic");
  const [known, setKnown] = useState<string[]>(DEFAULT_KNOWN);
  const toggle = (id: string) => setKnown((k) => (k.includes(id) ? k.filter((x) => x !== id) : k.length >= MAX_KNOWN ? k : [...k, id]));
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="panel space-y-3 p-5">
        <h2 className="text-2xl font-semibold">The job</h2>
        <p className="text-dim">Halcyon Biolab keeps a sample your client wants. It sits in a cold room at the end of a service corridor, past a loading dock, a camera and a bound spirit. Your team is in the van. You are the only Awakened on the run.</p>
        <p className="text-dim">Every spell costs drain. You have <b className="text-fg">{STUN_MAX} Stun boxes</b> and <b className="text-fg">{PHYS_MAX} Physical</b>, and drain cannot be healed. A quiet run exists.</p>
        <ul className="grid gap-1 text-sm sm:grid-cols-3">
          <li className="flex items-center gap-2"><Stars n={1} max={1} /> Deliver the sample</li>
          <li className="flex items-center gap-2"><Stars n={1} max={1} /> 5 or less damage in total</li>
          <li className="flex items-center gap-2"><Stars n={1} max={1} /> Never raise the alarm</li>
        </ul>
        <p className="text-xs text-dim">You: Magic {HERO.magic}, Sorcery {HERO.sorcery}, Conjuring {HERO.conjuring}, Astral {HERO.astral}, Willpower {HERO.will}, tradition attribute {HERO.tradAttr}, {HERO.edge} Edge. Cast: {HERO.sorcery + HERO.magic} dice. Resist drain: {HERO.will + HERO.tradAttr} dice.</p>
      </section>
      <section className="space-y-2">
        <h3 className="text-lg font-semibold">Pick your tradition</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {([["hermetic", "Hermetic", "Logic is your tradition attribute. A mage of formulas and diagrams."], ["shaman", "Shaman", "Charisma is your tradition attribute. You follow a mentor spirit and your gut."]] as const).map(([k, n, d]) => (
            <button key={k} aria-pressed={trad === k} onClick={() => setTrad(k)} className={clsx("panel quiet p-3 text-left", trad === k ? "!border-accent bg-accent/10 outline outline-1 outline-accent" : "hover:border-line-hi")}>
              <b>{n}</b><p className="mt-1 text-sm text-dim">{d} Same dice either way in this job.</p>
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-2">
        <div className="flex items-baseline justify-between"><h3 className="text-lg font-semibold">Pick {MAX_KNOWN} spells</h3><span className="num text-sm text-dim">{known.length}/{MAX_KNOWN}</span></div>
        <p className="text-sm text-dim">You always have summoning, banishing and astral perception. These five are the spells you know. Think about the dock camera, the spirit and the barrier on the lab door.</p>
        <div className="grid gap-2 md:grid-cols-2">
          {KNOWN_CHOICES.map((id) => {
            const sp = SPELL[id];
            const on = known.includes(id);
            return (
              <button key={id} aria-pressed={on} onClick={() => toggle(id)} className={clsx("panel quiet p-3 text-left", on ? "!border-accent bg-accent/10 outline outline-1 outline-accent" : "hover:border-line-hi")}>
                <div className="flex items-baseline justify-between"><b>{sp.name}</b><span className="num text-xs text-dim">DV {sp.dv} · {sp.type === "M" ? "Mana" : "Physical"} · {sp.duration === "S" ? "Sustained" : "Instant"}</span></div>
                <p className="mt-1 text-xs text-dim">{sp.blurb}</p>
              </button>
            );
          })}
        </div>
      </section>
      <button className="btn primary" disabled={known.length !== MAX_KNOWN} onClick={() => onStart(trad, known)}><Icon name="bolt" size={15} /> Start the night</button>
    </div>
  );
}

function Hud({ s, onDrop }: { s: MState; onDrop: (id: string) => void }) {
  const pen = sustainPenalty(s);
  return (
    <aside className="panel space-y-4 p-4" aria-label="Status">
      <div>
        <div className="mb-1 text-xs text-dim">Scene</div>
        <div className="font-semibold">{SCENES[s.scene].title}</div>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs text-dim"><span>Stun</span><span className="num">{s.stun}/{STUN_MAX}</span></div>
        <Boxes total={STUN_MAX} filled={s.stun} per={3} hot />
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs text-dim"><span>Physical</span><span className="num">{s.phys}/{PHYS_MAX}</span></div>
        <Boxes total={PHYS_MAX} filled={s.phys} per={3} hot />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="border border-line bg-bg2 p-2"><div className="text-xs text-dim">Edge</div><div className="num text-lg font-semibold text-accent">{s.edge}</div></div>
        <div className="border border-line bg-bg2 p-2"><div className="text-xs text-dim">Dice lost</div><div className={clsx("num text-lg font-semibold", pen && "text-danger")}>{pen ? `−${pen}` : "0"}</div></div>
      </div>
      <div className="flex justify-between text-sm"><span className="text-dim">Alarm</span><b className={s.alarm ? "text-danger" : "text-ok"}>{s.alarm ? "RAISED" : "quiet"}</b></div>
      <div className="space-y-1 border-t border-line pt-3">
        <div className="text-xs text-dim">Sustained spells (−2 dice each)</div>
        {s.sustained.length === 0 && <div className="text-sm text-dim">None</div>}
        {s.sustained.map((x) => (
          <div key={x.id} className="flex items-center justify-between border border-line bg-bg2 px-2 py-1 text-sm">
            <span>{SPELL[x.id].name} <span className="num text-dim">({x.hits} hits)</span></span>
            <button className="btn small ghost" onClick={() => onDrop(x.id)}>Drop</button>
          </div>
        ))}
      </div>
      <div className="space-y-1 border-t border-line pt-3">
        <div className="text-xs text-dim">Your spirits (Force limit {FORCE_CAP})</div>
        {s.friends.length === 0 && <div className="text-sm text-dim">None</div>}
        {s.friends.map((f) => <div key={f.id} className="flex justify-between border border-line bg-bg2 px-2 py-1 text-sm"><span>Force {f.force} spirit</span><span className="num text-dim">{f.services} service{f.services === 1 ? "" : "s"}</span></div>)}
      </div>
      {s.foes.length > 0 && (
        <div className="space-y-1 border-t border-line pt-3">
          <div className="text-xs text-dim">In the room</div>
          {s.foes.map((f) => (
            <div key={f.id} className={clsx("flex items-center justify-between border px-2 py-1 text-sm", f.down ? "border-line text-dim line-through" : f.aware ? "border-danger/70" : "border-line")}>
              <span>{f.name}</span>
              <span className="num text-xs text-dim">{f.down ? "down" : f.distracted ? "busy" : f.aware ? "alert" : "unaware"}</span>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-1 border-t border-line pt-3 text-sm">
        <div className="text-xs text-dim">What you know</div>
        <div className={s.intel.dock ? "" : "text-dim"}>{s.intel.dock ? "Two guards and a camera at the dock" : "Dock: unknown"}</div>
        <div className={s.intel.barrier ? "" : "text-dim"}>{s.intel.barrier ? "Mana barrier, rating 3, on the lab door" : "Barrier: unknown"}</div>
        <div className={s.intel.spirit ? "" : "text-dim"}>{s.intel.spirit ? "Force 4 earth spirit, 3 services" : "Spirit: unknown"}</div>
      </div>
    </aside>
  );
}

function LogView({ s }: { s: MState }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [s.log.length, s.pending]);
  const last = s.log.map((e, i) => (e.a || e.b ? i : -1)).filter((i) => i >= 0).slice(-2);
  return (
    <div className="panel quiet max-h-[32rem] min-h-72 space-y-2 overflow-y-auto p-3" aria-live="polite" aria-label="Mission log">
      {s.log.map((e, i) => (
        <div key={e.id} className={clsx("log-line border-l-2 bg-bg2/50 py-1.5 pl-3 pr-2 text-sm", TONE[e.tone])}>
          <div>{e.text}</div>
          {last.includes(i) && (e.a || e.b) && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {e.a && <div><div className="mb-1 text-xs text-dim">{e.aLabel} · {e.a.totalHits} hit{e.a.totalHits === 1 ? "" : "s"}</div><DiceRow dice={e.a.dice} size="1.5rem" animate={false} /></div>}
              {e.b && <div><div className="mb-1 text-xs text-dim">{e.bLabel} · {e.b.totalHits} hit{e.b.totalHits === 1 ? "" : "s"}</div><DiceRow dice={e.b.dice} size="1.5rem" animate={false} /></div>}
            </div>
          )}
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}

function PendingPanel({ s, onBoost, onStep }: { s: MState; onBoost: (b: PostBoost) => void; onStep: () => void }) {
  const p = s.pending!;
  const drain = p.phase === "drain";
  const r = drain ? p.drain! : p.cast;
  return (
    <div className="panel space-y-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold">{drain ? `Resist drain (Drain Value ${p.dv})` : p.label}</h3>
        <span className="chip on">{drain ? `${r.totalHits} hit${r.totalHits === 1 ? "" : "s"} vs ${p.dv}` : p.opp ? `${r.totalHits} v ${p.opp.totalHits}` : `${r.totalHits} hit${r.totalHits === 1 ? "" : "s"}`}</span>
      </div>
      <div className={clsx("grid gap-3", !drain && p.opp && "sm:grid-cols-2")}>
        <div>
          <div className="mb-1 text-xs text-dim">{drain ? "Willpower + tradition attribute" : "You"}{p.penalty ? ` · −${p.penalty} dice from sustaining` : ""}</div>
          <DiceRow key={r.id + r.edgeSpent + p.phase} dice={r.dice} />
        </div>
        {!drain && p.opp && <div><div className="mb-1 text-xs text-dim">{p.oppLabel}</div><DiceRow dice={p.opp.dice} /></div>}
      </div>
      <div className="border-t border-line pt-3">
        <div className="mb-1.5 text-xs text-dim">Spend Edge on this roll (you have {s.edge}).{drain ? " A drain reroll saves boxes." : ""}</div>
        <div className="flex flex-wrap gap-2">
          {BOOSTS.map((b) => <button key={b} className="btn small" disabled={!canBoost(s, b)} onClick={() => onBoost(b)}>{BOOST_LABEL[b]} ({BOOST_COST[b]})</button>)}
        </div>
      </div>
      <button className="btn primary" onClick={onStep}>{drain ? "Take the drain" : p.kind === "assense" || p.kind === "command" ? "Lock it in" : "Lock it in and resist drain"}</button>
    </div>
  );
}

function Pct({ v }: { v: number | null }) { return <b className="num text-accent">{v === null ? "-" : `${Math.round(v * 100)}%`}</b>; }

function SpellTray({ s, onCast }: { s: MState; onCast: (a: Parameters<typeof begin>[1]) => void }) {
  const [sel, setSel] = useState<string>(s.known[0]);
  const [amp, setAmp] = useState(0);
  const [area, setArea] = useState(0);
  const [target, setTarget] = useState<number | null>(null);
  const sp = SPELL[sel];
  const foes = liveTargets(s);
  const t = target !== null && foes.some((f) => f.id === target) ? target : foes.find((f) => f.kind !== "camera")?.id ?? foes[0]?.id ?? null;
  const targets = sp.kind === "utility" || t === null ? [] : [t];
  const pv = previewSpell(s, { spell: sel, amp, area, targets });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {s.known.map((id) => (
          <button key={id} onClick={() => { setSel(id); setAmp(0); setArea(0); }} aria-pressed={sel === id} className={clsx("chip cursor-pointer", sel === id && "on")}>{SPELL[id].name}</button>
        ))}
      </div>
      <div className="panel quiet space-y-3 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <b>{sp.name}</b>
          <span className="text-xs text-dim">{sp.type === "M" ? "Mana" : "Physical"} · {sp.kind === "direct" ? "Direct" : sp.kind === "indirect" ? "Indirect" : "Sustained"}{sp.loud ? " · loud" : ""}</span>
        </div>
        <p className="text-sm text-dim">{sp.blurb}</p>
        {sp.kind !== "utility" && (
          <div className="flex flex-wrap items-center gap-6">
            <Stepper label="Amp Up" value={amp} min={0} max={3} onChange={setAmp} hint="+1 base damage per +2 Drain Value" />
            {sp.area && <Stepper label="Increase Area" value={area} min={0} max={2} onChange={setArea} hint="+2 meters per +1 Drain Value" />}
          </div>
        )}
        {sp.kind !== "utility" && (
          <div className="flex flex-wrap gap-2">
            {foes.map((f) => <button key={f.id} className={clsx("chip cursor-pointer", t === f.id && "on")} onClick={() => setTarget(f.id)}>{f.name}</button>)}
            {sp.area && area >= 1 && <span className="text-xs text-dim">Increased area reaches everyone in the room.</span>}
          </div>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-dim">
          <span>Your pool <b className="num text-fg">{pv.pool}</b></span>
          {pv.theirs !== null && <span>Their pool <b className="num text-fg">{pv.theirs}</b></span>}
          {pv.odds !== null && <span>Chance to hit <Pct v={pv.odds} /></span>}
          <span>Drain Value <b className="num text-fg">{pv.dv}</b> against {pv.drainPool} dice</span>
          <span>No drain <Pct v={pv.noDrain} /></span>
          {pv.edgeGain && <span className="text-ok">+1 Edge (Attack Rating gap)</span>}
        </div>
        {pv.why && !pv.ok && <p className="text-sm text-danger">{pv.why}</p>}
        {pv.note && pv.ok && <p className="text-xs text-dim">{pv.note}</p>}
        <button className="btn primary" disabled={!pv.ok} onClick={() => onCast({ kind: "spell", spell: sel, amp, area, targets })}>Cast {sp.name}</button>
      </div>
    </div>
  );
}

function ConjuringTray({ s, onGo }: { s: MState; onGo: (a: Parameters<typeof begin>[1]) => void }) {
  const [force, setForce] = useState(3);
  const sv = previewSummon(s, force);
  const bv = previewBanish(s);
  const spiritFoe = s.foes.find((f) => f.kind === "spirit" && !f.down);
  const fr = s.friends.find((f) => f.services > 0);
  const [cmdTarget, setCmdTarget] = useState<number | null>(null);
  const targets = s.foes.filter((f) => !f.down && f.kind !== "camera");
  const tgt = cmdTarget !== null && targets.some((f) => f.id === cmdTarget) ? cmdTarget : targets[0]?.id ?? null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="panel quiet space-y-2 p-3">
        <b>Summon a spirit</b>
        <p className="text-xs text-dim">Conjuring + Magic against Force x 2. Services are your net hits. Drain is the spirit&apos;s hits. A spirit stays all night.</p>
        <Stepper label="Force" value={force} min={1} max={6} onChange={setForce} />
        <div className="flex flex-wrap gap-x-4 text-sm text-dim"><span>You <b className="num text-fg">{sv.pool}</b></span><span>Spirit <b className="num text-fg">{sv.theirs}</b></span><span>Chance <Pct v={sv.odds} /></span></div>
        {sv.why && <p className="text-xs text-danger">{sv.why}</p>}
        <button className="btn" disabled={!sv.ok} onClick={() => onGo({ kind: "summon", force })}>Summon</button>
      </div>
      <div className="panel quiet space-y-2 p-3">
        <b>Banish the spirit</b>
        <p className="text-xs text-dim">Conjuring + Magic against its Force x 2. Each net hit strips a service. Drain is twice its hits.</p>
        {spiritFoe ? <div className="flex flex-wrap gap-x-4 text-sm text-dim"><span>You <b className="num text-fg">{bv.pool}</b></span><span>Spirit <b className="num text-fg">{bv.theirs}</b></span><span>Chance <Pct v={bv.odds} /></span></div> : <p className="text-sm text-dim">No hostile spirit here.</p>}
        {bv.note && spiritFoe && <p className="text-xs text-dim">{bv.note}</p>}
        <button className="btn" disabled={!spiritFoe} onClick={() => onGo({ kind: "banish" })}>Banish</button>
      </div>
      {fr && (
        <div className="panel quiet space-y-2 p-3 md:col-span-2">
          <b>Give your spirit a service</b>
          <p className="text-xs text-dim">One service is one clear job. Distracting something keeps it busy for the scene. Attacking rolls Force x 2 against its Reaction + Intuition.</p>
          <div className="flex flex-wrap gap-2">{targets.map((f) => <button key={f.id} className={clsx("chip cursor-pointer", tgt === f.id && "on")} onClick={() => setCmdTarget(f.id)}>{f.name}</button>)}</div>
          <div className="flex flex-wrap gap-2">
            <button className="btn" disabled={tgt === null} onClick={() => tgt !== null && onGo({ kind: "command", command: "distract", target: tgt })}>Distract it</button>
            <button className="btn" disabled={tgt === null} onClick={() => tgt !== null && onGo({ kind: "command", command: "attack", target: tgt })}>Attack it</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Debrief({ s, onAgain }: { s: MState; onAgain: () => void }) {
  const d = debrief(s);
  return (
    <div className="panel mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-semibold">{d.headline}</h2><Stars n={d.stars} /></div>
      <ul className="space-y-1">{d.goals.map((g) => <li key={g.text} className={clsx("flex items-center gap-2", g.ok ? "text-ok" : "text-dim")}><Icon name={g.ok ? "check" : "x"} size={14} /> {g.text}</li>)}</ul>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Spells and rolls", s.stats.casts], ["Drain taken", s.stats.drainTaken], ["Edge spent", s.stats.edgeSpent], ["Spirits called", s.stats.summoned]].map(([k, v]) => (
          <div key={k as string} className="border border-line bg-bg2 px-3 py-2"><div className="text-xs text-dim">{k}</div><div className="num text-xl font-semibold">{v}</div></div>
        ))}
      </div>
      {d.notes.length > 0 && (
        <div className="space-y-2 border-t border-line pt-3">
          <h3 className="font-semibold">What to take from this run</h3>
          <ul className="list-disc space-y-1.5 pl-5 text-dim">{d.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-2"><button className="btn primary" onClick={onAgain}>Run it again</button><Link href="/learn/magic" className="btn">Back to the lessons</Link></div>
    </div>
  );
}

export function MagicSim() {
  const [s, setS] = useState<MState | null>(null);
  const [tab, setTab] = useState<"spells" | "conjuring">("spells");
  const record = useAcademy((a) => a.recordSim);
  const apply = (next: MState) => {
    if (s && s.status === "play" && next.status !== "play") record("magic", debrief(next).stars);
    setS(next);
  };
  if (!s) return <Setup onStart={(t, k) => setS(newSim(t, k))} />;
  if (s.status !== "play" && !s.pending) {
    return (
      <div className="space-y-4">
        <Debrief s={s} onAgain={() => setS(null)} />
        <details className="mx-auto max-w-3xl"><summary className="cursor-pointer text-sm text-dim">Show the mission log</summary><div className="mt-2"><LogView s={s} /></div></details>
      </div>
    );
  }
  const mv = moves(s);
  return (
    <div className="grid gap-4 lg:grid-cols-[17rem_1fr]">
      <Hud s={s} onDrop={(id) => setS(drop(s, id))} />
      <div className="space-y-4">
        <LogView s={s} />
        {s.pending ? (
          <PendingPanel s={s} onBoost={(b) => setS(boost(s, b))} onStep={() => apply(step(s))} />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <button className={clsx("chip cursor-pointer", tab === "spells" && "on")} onClick={() => setTab("spells")}>Spells</button>
              <button className={clsx("chip cursor-pointer", tab === "conjuring" && "on")} onClick={() => setTab("conjuring")}>Spirits</button>
              {!s.assensed && <button className="btn small" onClick={() => apply(begin(s, { kind: "assense" }))}><Icon name="eye" size={14} /> Look on the astral</button>}
            </div>
            {tab === "spells" ? <SpellTray key={s.scene} s={s} onCast={(a) => apply(begin(s, a))} /> : <ConjuringTray s={s} onGo={(a) => apply(begin(s, a))} />}
            <div className="space-y-2 border-t border-line pt-3">
              <h3 className="text-sm font-semibold text-dim">Move</h3>
              <div className="grid gap-2 md:grid-cols-3">
                {mv.map((m) => (
                  <button key={m.id} disabled={!m.enabled} onClick={() => apply(move(s, m.id))} className={clsx("panel quiet p-3 text-left", m.enabled ? "hover:border-accent" : "opacity-45")} title={m.enabled ? m.blurb : m.why}>
                    <div className="font-semibold">{m.label}</div>
                    <p className="mt-1 text-xs text-dim">{m.enabled ? m.blurb : m.why}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
