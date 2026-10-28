"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { Roller } from "@/components/Dice";
import { doInitiative, doRoll } from "@/lib/actions";
import { BOOST_COST, BOOST_LABEL, type PostBoost } from "@/lib/sr6/dice";
import { BOOK, diffs, rules, show } from "@/lib/house/rules";
import { effective, useHouse } from "@/lib/house/store";
import { useBinder, KIND } from "@/lib/gm/binder";
import { putOnTable } from "@/lib/gm/table";
import { audio } from "@/lib/audio/ambient";
import { sortedTurn } from "@/lib/vtt/ops";
import { useVtt } from "@/lib/vtt/store";
import { BAR_META, MARKERS, type Token } from "@/lib/vtt/types";
import { newRound, nextTurn } from "@/app/table/act";
import type { Panel } from "@/lib/gm/screen";
import { MusicDeck } from "./Music";
import { Rich } from "./Binder";

export interface WidgetProps { panel: Panel; setData: (d: Record<string, unknown>) => void }

const NO_ENTRIES = {};

// ───────────────────────── notes and dice ─────────────────────────

export function NotesWidget({ panel, setData }: WidgetProps) {
  return <textarea className="screen-notes size-full resize-none bg-transparent p-3 text-sm leading-relaxed outline-none" value={String(panel.data?.text ?? "")} onChange={(e) => setData({ text: e.target.value })} placeholder="Who owes whom, the alarm timer, the name you just made up…" aria-label="Notes" />;
}

export function DiceWidget() {
  return <div className="p-2"><Roller compact /></div>;
}

// ───────────────────────── table widgets ─────────────────────────

function NeedTable() {
  return <p className="p-3 text-sm text-dim">This follows your table. Open the <Link className="text-accent underline" href="/table">Table</Link> as GM, or join a room as GM, and it fills in.</p>;
}

export function TurnWidget() {
  const state = useVtt((s) => s.state);
  if (!state) return <NeedTable />;
  const list = sortedTurn(state.turn.entries);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-dim"><span>Round <b className="num text-fg">{state.turn.round}</b></span><span>{list.length} in the fight</span></div>
      <ol className="min-h-0 flex-1 overflow-y-auto">
        {list.map((e) => (
          <li key={e.id} className={clsx("flex items-center gap-2 border-t border-line px-3 py-1.5 text-sm", e.id === state.turn.current && "screen-current", e.acted && e.id !== state.turn.current && "opacity-45")}>
            <b className="num w-7 text-right">{e.score}</b>
            <span className="min-w-0 flex-1 truncate">{e.name}{e.delayed && <span className="ml-1 text-xs text-cyan">delaying</span>}</span>
            <span className="num text-xs text-faint" title="Minor actions left">{e.minors}m</span>
          </li>
        ))}
        {list.length === 0 && <li className="px-3 py-2 text-sm text-dim">No one has rolled initiative.</li>}
      </ol>
      <div className="flex gap-1.5 border-t border-line p-2">
        <button className="btn small primary flex-1" onClick={nextTurn} disabled={!list.length}>{state.turn.current ? "Next" : "Start"}</button>
        <button className="btn small" onClick={() => newRound(true)} disabled={!list.length}>New round</button>
      </div>
    </div>
  );
}

function Boxes({ cur, max, color }: { cur: number; max: number; color: string }) {
  return (
    <span className="flex flex-wrap gap-[2px]" title={`${cur} of ${max} left`}>
      {Array.from({ length: Math.min(max, 24) }, (_, i) => <i key={i} className="block h-2 w-1.5" style={{ background: i < cur ? color : "var(--line)" }} />)}
    </span>
  );
}

export function PartyWidget() {
  const state = useVtt((s) => s.state);
  if (!state) return <NeedTable />;
  const scene = state.scenes[state.playerScene ?? ""];
  const crew = Object.values(scene?.objects ?? {}).filter((o): o is Token => o.kind === "token" && (!!o.runner || o.owners.some((x) => x !== "*")));
  if (!crew.length) return <p className="p-3 text-sm text-dim">No runners on the players&apos; scene yet.</p>;
  return (
    <ul className="divide-y divide-line">
      {crew.map((t) => (
        <li key={t.id} className="space-y-1 px-3 py-2">
          <div className="flex items-center gap-2">
            <b className="min-w-0 flex-1 truncate text-sm">{t.name}</b>
            <span className="text-xs text-faint">{t.runner?.owner ?? t.owners.join(", ")}</span>
          </div>
          {(["b1", "b2", "b3"] as const).map((k) => t.bars[k] && t.bars[k]!.max > 0 && (
            <div key={k} className="flex items-center gap-2 text-[11px]"><span className="w-12 text-dim">{BAR_META[k].name}</span><Boxes cur={t.bars[k]!.cur} max={t.bars[k]!.max} color={BAR_META[k].color} /><span className="num text-faint">{t.bars[k]!.cur}</span></div>
          ))}
          {t.markers.length > 0 && <div className="flex flex-wrap gap-1">{t.markers.map((m) => <span key={m} className="chip !py-0 !text-[10px]">{m}</span>)}</div>}
        </li>
      ))}
    </ul>
  );
}

// ───────────────────────── rules at a glance ─────────────────────────

const TOPICS = [["combat", "Combat"], ["damage", "Damage"], ["edge", "Edge"], ["tests", "Tests"], ["status", "Statuses"]] as const;

function Row({ k, v, changed }: { k: string; v: React.ReactNode; changed?: boolean }) {
  return <tr className="border-t border-line"><td className="py-1 pr-2 align-top text-dim">{k}</td><td className={clsx("py-1 text-right align-top num", changed && "font-semibold text-accent")}>{v}</td></tr>;
}

export function RulesWidget({ panel, setData }: WidgetProps) {
  useHouse((h) => JSON.stringify(effective(h)?.mech ?? {}));
  const statuses = useHouse((h) => effective(h)?.statuses);
  const topic = String(panel.data?.topic ?? "combat");
  const R = rules();
  const ch = (k: keyof typeof R) => R[k] !== BOOK[k];
  const tie = R.tie === "graze" ? "Graze: hits, no damage" : R.tie === "hit" ? "Hit, DV only" : "Miss";
  return (
    <div className="flex h-full flex-col">
      <nav className="flex flex-wrap gap-1 border-b border-line px-2 py-1.5">
        {TOPICS.map(([id, label]) => <button key={id} className={clsx("chip !py-0.5 !text-[11px]", topic === id && "on")} onClick={() => setData({ topic: id })}>{label}</button>)}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 text-[13px]">
        {topic === "combat" && (
          <table className="w-full">
            <tbody>
              <Row k="Range bands" v="Close ≤3 m · Near ≤50 · Medium ≤250 · Far ≤500 · Extreme" />
              <Row k="Attack" v="Weapon skill + attribute vs Defense (REA + INT)" />
              <Row k={`AR beats DR by ${R.edgeGap}+`} v={`Attacker +${R.edgeGain} Edge`} changed={ch("edgeGap") || ch("edgeGain")} />
              <Row k={`DR beats AR by ${R.edgeGap}+`} v={`Defender +${R.edgeGain} Edge`} changed={ch("edgeGap") || ch("edgeGain")} />
              <Row k="More attacker hits" v="Hit: DV + net hits" />
              <Row k="Tied hits" v={tie} changed={ch("tie")} />
              <Row k="No attack hits" v={R.zeroHitsMiss ? "Always a miss" : "Use the tie rule"} changed={ch("zeroHitsMiss")} />
              <Row k="Damage resistance" v={R.armorSoaks ? "Body + armor" : "Body"} changed={ch("armorSoaks")} />
              <Row k="Each turn" v={`1 Major, ${R.minorBase} + initiative dice Minor`} changed={ch("minorBase")} />
              <Row k="Initiative" v={`REA + INT + up to ${R.initDiceCap}D6`} changed={ch("initDiceCap")} />
            </tbody>
          </table>
        )}
        {topic === "damage" && (
          <table className="w-full">
            <tbody>
              <Row k="Physical monitor" v={`${R.physBase} + half Body`} changed={ch("physBase")} />
              <Row k="Stun monitor" v={`${R.stunBase} + half Willpower`} changed={ch("stunBase")} />
              <Row k="Wound modifier" v={`−1 per ${R.woundEvery} boxes, each monitor`} changed={ch("woundEvery")} />
              <Row k="Stun past a full track" v={R.stunSpill === 1 ? "Spills box for box into Physical" : `${R.stunSpill} Stun make 1 Physical`} changed={ch("stunSpill")} />
              <Row k="Physical full" v="Unconscious, then overflow" />
              <Row k="Overflow" v={`Body × ${R.overflowMult} boxes, then dead`} changed={ch("overflowMult")} />
              <Row k="Soak" v="Each hit removes one box" />
            </tbody>
          </table>
        )}
        {topic === "edge" && (
          <table className="w-full">
            <tbody>
              <Row k="Most Edge held" v={R.maxEdge} changed={ch("maxEdge")} />
              {(Object.keys(BOOST_COST) as PostBoost[]).map((b) => <Row key={b} k={BOOST_LABEL[b]} v={`${BOOST_COST[b]} Edge, after the roll`} />)}
              <Row k="Edge before the roll" v="4 Edge: + Edge dice, 6s explode" />
              <Row k="Limit" v="One Edge boost per action" />
            </tbody>
          </table>
        )}
        {topic === "tests" && (
          <table className="w-full">
            <tbody>
              <Row k="Hit" v="Each 5 or 6" />
              <Row k="Glitch" v="More than half the dice show 1" />
              <Row k="Critical glitch" v="A glitch with no hits" />
              <Row k="Opposed test" v="Most hits wins; the acting side wins ties" />
              <Row k="Net hits" v="Your hits minus theirs" />
              <Row k="Untrained" v="Attribute − 1, where the skill allows it" />
            </tbody>
          </table>
        )}
        {topic === "status" && (
          <div className="flex flex-wrap gap-1">
            {MARKERS.map((m) => <span key={m} className="chip !text-[11px]">{m}</span>)}
            {(statuses ?? []).map((s) => <span key={s.id} className="chip !border-astral/60 !text-[11px]" title={s.text}>{s.name}</span>)}
          </div>
        )}
      </div>
      {diffs(effective(useHouse.getState())?.mech ?? {}).length > 0 && <p className="border-t border-line px-3 py-1 text-[11px] text-accent">Highlighted values are your house rules.</p>}
    </div>
  );
}

export function HouseWidget() {
  const rs = useHouse((h) => effective(h));
  const changed = rs ? diffs(rs.mech) : [];
  return (
    <div className="space-y-2 p-3 text-sm">
      <div className="flex items-center justify-between"><b className="font-display">{rs?.name ?? "By the book"}</b><Link className="text-xs text-accent underline" href="/gm?tab=house">Edit</Link></div>
      {changed.length === 0 ? <p className="text-dim">No changes to the mechanics.</p> : (
        <ul className="space-y-1">{changed.map((f) => <li key={f.key} className="border-l-2 border-accent pl-2"><span className="text-dim">{f.label}:</span> <b>{show(f, { ...BOOK, ...rs!.mech }[f.key])}</b></li>)}</ul>
      )}
      {rs && rs.notes.length > 0 && <p className="text-xs text-faint">{rs.notes.length} written house rules, {rs.items.length} items.</p>}
    </div>
  );
}

// ───────────────────────── binder widgets ─────────────────────────

export function EntryWidget({ panel, setData }: WidgetProps) {
  const entries = useBinder((s) => s.entries) ?? NO_ENTRIES;
  const list = useMemo(() => Object.values(entries).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || a.title.localeCompare(b.title)), [entries]);
  const id = String(panel.data?.id ?? "");
  const e = entries[id] ?? list[0];
  if (!e) return <p className="p-3 text-sm text-dim">Your binder is empty. Add entries on the Binder tab.</p>;
  const follow = (title: string) => { const hit = list.find((x) => x.title.toLowerCase() === title.toLowerCase()); if (hit) setData({ id: hit.id }); };
  return (
    <div className="flex h-full flex-col">
      <select className="field !min-h-0 rounded-none border-x-0 border-t-0 !py-1 text-sm" value={e.id} onChange={(ev) => setData({ id: ev.target.value })} aria-label="Binder entry">
        {list.map((x) => <option key={x.id} value={x.id}>{x.pinned ? "★ " : ""}{x.title} · {KIND[x.kind].name}</option>)}
      </select>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        <div className="flex gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {e.img && <img src={e.img} alt="" className="h-24 w-20 shrink-0 border border-line object-cover" style={{ objectPosition: "50% 20%" }} />}
          <div className="min-w-0"><b className="block font-display text-lg leading-tight">{e.title}</b>{e.sub && <span className="text-sm text-dim">{e.sub}</span>}</div>
        </div>
        <Rich text={e.body} onLink={follow} />
      </div>
    </div>
  );
}

export function NpcsWidget({ panel, setData }: WidgetProps) {
  const entries = useBinder((s) => s.entries) ?? NO_ENTRIES;
  const tableOk = useVtt((s) => !!s.state && s.me.gm);
  const npcs = useMemo(() => Object.values(entries).filter((e) => e.kind === "npc" && e.npc).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || a.title.localeCompare(b.title)), [entries]);
  const secret = !!panel.data?.secret;
  const [open, setOpen] = useState<string | null>(null);
  if (!npcs.length) return <p className="p-3 text-sm text-dim">Add NPCs on the Binder tab and they show up here with their rolls.</p>;
  return (
    <div className="flex h-full flex-col">
      <label className="flex items-center gap-1.5 border-b border-line px-3 py-1.5 text-xs text-dim"><input type="checkbox" checked={secret} onChange={(e) => setData({ secret: e.target.checked })} /> Roll in secret (not shared to chat)</label>
      <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
        {npcs.map((e) => (
          <li key={e.id} className="px-3 py-1.5">
            <button className="flex w-full items-center gap-2 text-left" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {e.img ? <img src={e.img} alt="" className="size-7 shrink-0 object-cover" /> : <Icon name="runners" size={16} className="shrink-0 text-faint" />}
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{e.title}</span>
              <span className="num text-xs text-faint">DR {e.npc!.dr}</span>
            </button>
            {open === e.id && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                <button className="btn small !min-h-0 !py-1" onClick={() => doInitiative(`${e.title} initiative`, e.npc!.init.base, e.npc!.init.dice, 0, e.title)}>Init {e.npc!.init.base}+{e.npc!.init.dice}D6</button>
                {(e.npc!.weapons ?? []).map((w, i) => <button key={`w${i}`} className="btn small !min-h-0 !py-1" onClick={() => doRoll({ label: `${e.title}: ${w.name}`, pool: w.pool }, 0, e.title, !secret)}>{w.name} {w.pool}</button>)}
                <button className="btn small !min-h-0 !py-1" onClick={() => doRoll({ label: `${e.title}: Defense`, pool: e.npc!.defend ?? 6 }, 0, e.title, !secret)}>Defend {e.npc!.defend ?? 6}</button>
                <button className="btn small !min-h-0 !py-1" onClick={() => doRoll({ label: `${e.title}: Soak`, pool: e.npc!.soak ?? 4 }, 0, e.title, !secret)}>Soak {e.npc!.soak ?? 4}</button>
                {e.npc!.pools.map((p, i) => <button key={`p${i}`} className="btn small !min-h-0 !py-1" onClick={() => doRoll({ label: `${e.title}: ${p.label}`, pool: p.dice }, 0, e.title, !secret)}>{p.label} {p.dice}</button>)}
                {tableOk && <button className="btn small !min-h-0 !py-1" onClick={() => putOnTable(e)}><Icon name="map" size={12} /> On table</button>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────────────────── music, clock, names ─────────────────────────

export function MusicWidget() {
  return <div className="h-full overflow-y-auto"><MusicDeck compact /></div>;
}

const fmt = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(x).padStart(2, "0")}`; };

function beep() {
  const a = audio(); if (!a) return;
  void a.ctx.resume();
  for (let i = 0; i < 3; i++) {
    const o = a.ctx.createOscillator(), g = a.ctx.createGain(), t = a.ctx.currentTime + i * 0.25;
    o.frequency.value = 880; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g); g.connect(a.ctx.destination); o.start(t); o.stop(t + 0.22);
  }
}

export function TimerWidget({ panel, setData }: WidgetProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const start = Number(panel.data?.start ?? 0), end = Number(panel.data?.end ?? 0), rang = !!panel.data?.rang;
  useEffect(() => { if (end && now >= end && !rang) { beep(); setData({ ...panel.data, rang: true }); } }, [now, end, rang]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-3 p-3">
      <div>
        <div className="text-xs text-dim">Session</div>
        <div className="flex items-baseline gap-2">
          <b className="num font-display text-3xl">{start ? fmt(now - start) : "0:00"}</b>
          <button className="btn small !min-h-0 !py-1" onClick={() => setData({ ...panel.data, start: start ? 0 : Date.now() })}>{start ? "Reset" : "Start"}</button>
        </div>
      </div>
      <div>
        <div className="text-xs text-dim">Countdown{end && now >= end ? <span className="ml-1 text-danger">Time&apos;s up</span> : null}</div>
        <div className="flex flex-wrap items-baseline gap-1.5">
          <b className={clsx("num font-display text-2xl", end && now >= end && "text-danger")}>{end ? fmt(end - now) : "–"}</b>
          {[1, 3, 5, 10].map((mn) => <button key={mn} className="btn small !min-h-0 !px-2 !py-1" onClick={() => setData({ ...panel.data, end: Date.now() + mn * 60000, rang: false })}>{mn}m</button>)}
          {end ? <button className="btn small ghost !min-h-0 !px-2 !py-1" onClick={() => setData({ ...panel.data, end: 0 })}>Clear</button> : null}
        </div>
      </div>
    </div>
  );
}

const PARTS = {
  first: ["Kai", "Rook", "Mira", "Dex", "Juno", "Sable", "Tomas", "Yuki", "Nadia", "Oskar", "Lena", "Ravi", "Ines", "Marcus", "Aiko", "Bram", "Cleo", "Dmitri", "Esme", "Felix", "Hana", "Ivo", "Kasia", "Luca", "Noor", "Pavel", "Quinn", "Rosa", "Sven", "Tala", "Vik", "Wren", "Zoe"],
  last: ["Okafor", "Vance", "Nakamura", "Reyes", "Lindqvist", "Kowalski", "Haddad", "Sato", "Moreau", "Brandt", "Castillo", "Ivanova", "Park", "O'Rourke", "Mbeki", "Tanaka", "Novak", "Silva", "Andersson", "Zhou"],
  handle: ["Static", "Wire", "Ghost", "Hex", "Rust", "Neon", "Patch", "Splice", "Torque", "Cinder", "Vapor", "Glitch", "Shiv", "Echo", "Chrome", "Moth", "Relay", "Drift", "Fuse", "Lantern", "Sparrow", "Kestrel", "Jackal", "Viper"],
  barA: ["The Rusty", "The Neon", "The Broken", "The Drowned", "The Lucky", "The Hollow", "The Silver", "The Ninth"],
  barB: ["Socket", "Chrome", "Anchor", "Lantern", "Ferret", "Circuit", "Gutter", "Monorail", "Kraken", "Jackpot"],
  corpA: ["Helix", "Meridian", "Obsidian", "Northgate", "Arclight", "Vantage", "Kestrel", "Sable", "Tessellate", "Brightwater"],
  corpB: ["Dynamics", "Biotech", "Solutions", "Logistics", "Systems", "Holdings", "Security", "Pharma", "Data", "Industries"],
  gang: ["Ancients", "Halloweeners", "Rats", "Red Hand", "Lost Saints", "Chrome Wolves", "Gutter Kings", "Night Owls", "Static Boys", "Iron Maidens"],
  street: ["Ash", "Pike", "Cedar", "Union", "Harbor", "Mercer", "Denny", "Eastlake", "Rainier", "Marginal"],
};
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const GEN: Record<string, () => string> = {
  Person: () => `${pick(PARTS.first)} ${pick(PARTS.last)}`,
  Handle: () => `"${pick(PARTS.handle)}" ${pick(PARTS.first)}`,
  Bar: () => `${pick(PARTS.barA)} ${pick(PARTS.barB)}`,
  Corp: () => `${pick(PARTS.corpA)} ${pick(PARTS.corpB)}`,
  Gang: () => `The ${pick(PARTS.gang)}`,
  Street: () => `${100 + Math.floor(Math.random() * 3900)} ${pick(PARTS.street)} ${pick(["Way", "Avenue", "Street", "Boulevard"])}`,
};

export function NamesWidget({ panel, setData }: WidgetProps) {
  const kind = String(panel.data?.kind ?? "Person");
  const [names, setNames] = useState<string[]>([]);
  const roll = (k = kind) => setNames(Array.from({ length: 6 }, () => GEN[k]()));
  return (
    <div className="flex h-full flex-col">
      <nav className="flex flex-wrap gap-1 border-b border-line px-2 py-1.5">
        {Object.keys(GEN).map((k) => <button key={k} className={clsx("chip !py-0.5 !text-[11px]", kind === k && "on")} onClick={() => { setData({ kind: k }); roll(k); }}>{k}</button>)}
      </nav>
      <ul className="min-h-0 flex-1 overflow-y-auto px-3 py-1.5 text-sm">
        {(names.length ? names : ["Press Roll for names"]).map((n, i) => <li key={i} className={clsx("py-0.5", !names.length && "text-faint")}>{n}</li>)}
      </ul>
      <div className="border-t border-line p-2"><button className="btn small primary w-full" onClick={() => roll()}><Icon name="dice" size={14} /> Roll {kind.toLowerCase()} names</button></div>
    </div>
  );
}
