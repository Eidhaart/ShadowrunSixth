"use client";
import { useMemo, useState, type ComponentType } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { DiceRow } from "../DiceRow";
import { Boxes, Pct, Readout, Seg, Stepper } from "./ui";
import { roll, type RollResult } from "@/lib/sr6/dice";
import { atLeast, binomPmf, drainDist, opposedOdds } from "@/lib/academy/stats";
import { SPELL, SPELLS, SPIRITS, spiritStats, type SpellCat, type SpiritKey } from "@/lib/academy/magic/data";

type Trad = "hermetic" | "shaman";
const TRAD: Record<Trad, { name: string; attr: string }> = { hermetic: { name: "Hermetic", attr: "Logic" }, shaman: { name: "Shaman", attr: "Charisma" } };

/** Damage type of drain: Stun, unless the damage is higher than Magic. */
const drainType = (dmg: number, magic: number) => (dmg > magic ? "Physical" : "Stun");

/* ───────────── 1. Which Awakened ───────────── */

const GOALS = [
  { id: "spells", label: "Throw spells", who: "Mage", sheet: "Magic 5-6, Sorcery 5, Willpower 4, tradition attribute 4+", why: "You want Combat and Illusion spells. You pay drain for every cast, so keep your drain pool as big as your attack pool.", tradeoff: "Powerful and fragile. Plan your Stun like a budget." },
  { id: "spirits", label: "Command spirits", who: "Mage (conjurer) or Aspected conjurer", sheet: "Magic 5-6, Conjuring 5, Willpower 4, tradition attribute 4+", why: "Your power is in what you call, not what you cast. A good summon does the work of three spells.", tradeoff: "Every spirit is a job you must define, and each summon costs drain." },
  { id: "body", label: "Hit things really hard", who: "Adept", sheet: "Magic 4-6, a handful of powers, high Agility and Body", why: "Your Magic becomes power points that buy permanent gifts. No drain on casting, no sustaining.", tradeoff: "No spells or summoning. You need a power to see the astral plane." },
  { id: "all", label: "A bit of everything", who: "Mystic adept", sheet: "Magic split between spells and powers", why: "You mix a few spells with a few powers. Flexible, but your Magic is split.", tradeoff: "Complicated to build. Not where beginners should start." },
] as const;

function TypesWidget() {
  const [g, setG] = useState<(typeof GOALS)[number]["id"]>("spells");
  const cur = GOALS.find((x) => x.id === g)!;
  return (
    <div className="space-y-3">
      <p className="text-sm text-dim">What do you want to do at the table?</p>
      <Seg value={g} onChange={setG} options={GOALS.map((x) => ({ id: x.id, label: x.label }))} />
      <div className="panel quiet space-y-2 p-4">
        <h4 className="text-xl font-semibold text-accent">{cur.who}</h4>
        <p>{cur.why}</p>
        <p className="text-sm text-dim"><b className="text-fg">Starting sheet:</b> {cur.sheet}</p>
        <p className="text-sm text-dim"><b className="text-fg">The catch:</b> {cur.tradeoff}</p>
      </div>
    </div>
  );
}

/* ───────────── 2. Build your caster ───────────── */

function SheetWidget() {
  const [magic, setMagic] = useState(6);
  const [sorcery, setSorcery] = useState(5);
  const [conj, setConj] = useState(4);
  const [wil, setWil] = useState(4);
  const [logic, setLogic] = useState(5);
  const [cha, setCha] = useState(3);
  const [trad, setTrad] = useState<Trad>("hermetic");
  const t = trad === "hermetic" ? logic : cha;
  return (
    <div className="space-y-4">
      <Seg value={trad} onChange={setTrad} options={(Object.keys(TRAD) as Trad[]).map((k) => ({ id: k, label: `${TRAD[k].name} (${TRAD[k].attr})` }))} />
      <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
        <Stepper label="Magic" value={magic} min={1} max={12} onChange={setMagic} />
        <Stepper label="Sorcery" value={sorcery} min={0} max={12} onChange={setSorcery} />
        <Stepper label="Conjuring" value={conj} min={0} max={12} onChange={setConj} />
        <Stepper label="Willpower" value={wil} min={1} max={9} onChange={setWil} />
        <Stepper label="Logic" value={logic} min={1} max={9} onChange={setLogic} />
        <Stepper label="Charisma" value={cha} min={1} max={9} onChange={setCha} />
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Readout label="Cast a spell" tone="accent">{sorcery + magic}<span className="text-sm text-dim"> dice</span></Readout>
        <Readout label={`Resist drain (Willpower + ${TRAD[trad].attr})`}>{wil + t}<span className="text-sm text-dim"> dice</span></Readout>
        <Readout label="Summon or banish">{conj + magic}<span className="text-sm text-dim"> dice</span></Readout>
        <Readout label="Attack Rating">{magic + t}</Readout>
        <Readout label="Base damage, Indirect">{Math.ceil(magic / 2)}</Readout>
        <Readout label="Max total spirit Force">{magic * 3}</Readout>
        <Readout label="Stun boxes">{8 + Math.ceil(wil / 2)}</Readout>
        <Readout label="Astral hours before harm">{magic * 2}</Readout>
      </div>
      <p className="text-xs text-dim">Notice how little there is: three pools and a few limits. Everything else in this module is those numbers plugged into a roll.</p>
    </div>
  );
}

/* ───────────── 3. The three-step caster ───────────── */

const HERO = { magic: 6, sorcery: 5, will: 5, trad: 5 };
const GUARD = { will: 3, intuition: 3, reaction: 3, body: 3 };
const CAST_SPELLS = ["stunbolt", "manabolt", "clout", "fireball", "stunball"] as const;

interface CastLog {
  spell: string;
  dv: number;
  attackRating: number;
  edgeGain: boolean;
  cast: RollResult;
  opp: RollResult;
  soak: RollResult | null;
  net: number;
  dmg: number;
  hitBoth: boolean;
  drain: RollResult;
  drainDmg: number;
  kind: "direct" | "indirect";
  dmgType: "S" | "P";
}

function CasterWidget() {
  const [id, setId] = useState<(typeof CAST_SPELLS)[number]>("stunbolt");
  const [amp, setAmp] = useState(0);
  const [area, setArea] = useState(0);
  const [log, setLog] = useState<CastLog | null>(null);
  const sp = SPELL[id];
  const dv = sp.dv + 2 * amp + (sp.area ? area : 0);
  const pick = (v: (typeof CAST_SPELLS)[number]) => { setId(v); setLog(null); setArea(0); };
  const cast = () => {
    const kind = sp.kind === "direct" ? "direct" : "indirect";
    const defPool = kind === "direct" ? GUARD.will + GUARD.intuition : GUARD.reaction + GUARD.will;
    const c = roll({ label: sp.name, pool: HERO.sorcery + HERO.magic });
    const o = roll({ label: "Guard", pool: defPool });
    const net = Math.max(0, c.totalHits - o.totalHits);
    let dmg = 0;
    let soak: RollResult | null = null;
    if (net > 0) {
      if (kind === "direct") dmg = net + amp;
      else {
        const base = Math.ceil(HERO.magic / 2) + net + amp;
        soak = roll({ label: "Body soak", pool: GUARD.body });
        dmg = Math.max(0, base - soak.totalHits);
      }
    }
    const d = roll({ label: "Drain", pool: HERO.will + HERO.trad });
    setLog({
      spell: sp.name, dv, attackRating: HERO.magic + HERO.trad, edgeGain: HERO.magic + HERO.trad - 7 >= 4,
      cast: c, opp: o, soak, net, dmg, hitBoth: !!sp.area && area >= 1, drain: d, drainDmg: Math.max(0, dv - d.totalHits), kind, dmgType: sp.dmg ?? "P",
    });
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-dim">You are a mage with Magic 6, Sorcery 5, Willpower 5 and a tradition attribute of 5. The target is a guard with Willpower 3, Intuition 3, Reaction 3, Body 3. A second guard stands 4 meters away.</p>
      <div className="space-y-2">
        <div className="text-xs text-dim">Step 1: adjust the spell</div>
        <Seg value={id} onChange={pick} options={CAST_SPELLS.map((k) => ({ id: k, label: SPELL[k].name }))} />
        <div className="flex flex-wrap items-center gap-6">
          <Stepper label="Amp Up" value={amp} min={0} max={3} onChange={(n) => { setAmp(n); setLog(null); }} hint="+1 base damage per +2 Drain Value" />
          {sp.area && <Stepper label="Increase Area (+2 m)" value={area} min={0} max={2} onChange={(n) => { setArea(n); setLog(null); }} />}
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="chip on">Drain Value {sp.dv}{amp ? ` + ${2 * amp} Amp` : ""}{sp.area && area ? ` + ${area} Area` : ""} = {dv}</span>
          <span className="chip">{sp.kind === "direct" ? "Direct: not resisted" : "Indirect: target soaks with Body"}</span>
          <span className="chip">{sp.type === "M" ? "Mana spell" : "Physical spell"}</span>
        </div>
      </div>
      <button className="btn primary" onClick={cast}><Icon name="dice" size={14} /> Cast it</button>
      {log && (
        <div className="log-line space-y-4 border-l-2 border-accent pl-3">
          <div className="text-sm">
            <b>Attack Rating step:</b> {log.attackRating} (Magic + tradition) against a Defense Rating of 7 is a gap of {log.attackRating - 7}.{" "}
            {log.edgeGain ? <span className="text-ok">That is 4 or more: you gain 1 Edge.</span> : <span className="text-dim">Under 4: nobody gains Edge.</span>}
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold">Step 2: Sorcery + Magic = 11 dice</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><div className="mb-1 text-xs text-dim">You · {log.cast.totalHits} hits</div><DiceRow dice={log.cast.dice} /></div>
              <div><div className="mb-1 text-xs text-dim">Guard ({log.kind === "direct" ? "Willpower + Intuition" : "Reaction + Willpower"}) · {log.opp.totalHits} hits</div><DiceRow dice={log.opp.dice} /></div>
            </div>
            <p className="text-sm">
              {log.net === 0 ? "No net hits. The spell fizzles against the guard." : log.kind === "direct"
                ? `${log.net} net hit${log.net === 1 ? "" : "s"}${amp ? ` + ${amp} Amp Up` : ""} = ${log.dmg} ${log.dmgType === "S" ? "Stun" : "Physical"} damage. Direct damage is not resisted.`
                : `Base ${Math.ceil(HERO.magic / 2)} + ${log.net} net${amp ? ` + ${amp} Amp Up` : ""}, then the guard soaks ${log.soak?.totalHits ?? 0} with Body: ${log.dmg} ${log.dmgType === "S" ? "Stun" : "Physical"} damage.`}
              {sp.area && (log.hitBoth ? " The second guard is inside the area too." : " The second guard is out of the area. Increase Area would have caught him.")}
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold">Step 3: resist drain, Willpower + tradition = 10 dice against {log.dv}</div>
            <DiceRow dice={log.drain.dice} />
            <p className="text-sm">
              {log.drainDmg === 0 ? `${log.drain.totalHits} hits meets the Drain Value. No damage.` : `${log.drain.totalHits} hits against ${log.dv}: you take ${log.drainDmg} ${drainType(log.drainDmg, HERO.magic)} damage.`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────── 4. Drain odds ───────────── */

function DrainWidget() {
  const [pool, setPool] = useState(10);
  const [dv, setDv] = useState(6);
  const [magic, setMagic] = useState(5);
  const [res, setRes] = useState<RollResult | null>(null);
  const dist = useMemo(() => drainDist(pool, dv), [pool, dv]);
  const exp = dist.reduce((s, p, k) => s + p * k, 0);
  const none = dist[0];
  const phys = dist.reduce((s, p, k) => s + (k > magic ? p : 0), 0);
  const maxP = Math.max(...dist, 0.01);
  return (
    <div className="space-y-4">
      <div className="grid gap-x-8 gap-y-1 sm:grid-cols-3">
        <Stepper label="Drain pool" value={pool} min={1} max={20} onChange={(n) => { setPool(n); setRes(null); }} hint="Willpower + tradition attribute" />
        <Stepper label="Drain Value" value={dv} min={1} max={15} onChange={(n) => { setDv(n); setRes(null); }} />
        <Stepper label="Your Magic" value={magic} min={1} max={12} onChange={setMagic} />
      </div>
      <div role="img" aria-label="Chance of each amount of drain damage" className="flex h-32 items-end gap-1 border-b border-line">
        {dist.map((p, k) => (
          <div key={k} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="num text-[0.65rem] text-dim">{p >= 0.01 ? Math.round(p * 100) : ""}</span>
            <div className={clsx("w-full", k === 0 ? "bg-ok/70" : k > magic ? "bg-danger/70" : "bg-accent/70")} style={{ height: `${(p / maxP) * 78}%`, minHeight: p > 0.0005 ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-dim num">{dist.map((_, k) => <span key={k} className="flex-1 text-center">{k}</span>)}</div>
      <div className="grid grid-cols-3 gap-2">
        <Readout label="No damage" tone="ok"><Pct v={none} /></Readout>
        <Readout label="Average damage" tone="accent">{exp.toFixed(1)}</Readout>
        <Readout label={`Physical (more than ${magic})`} tone={phys > 0.05 ? "bad" : undefined}><Pct v={phys} /></Readout>
      </div>
      <p className="text-xs text-dim">Bars show the chance of taking exactly that much damage. Green is none, orange is Stun, red is damage high enough to turn Physical.</p>
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <button className="btn small primary" onClick={() => setRes(roll({ label: "Drain", pool }))}><Icon name="dice" size={14} /> Roll a drain test</button>
        {res && <span className="text-sm">{res.totalHits} hits against {dv}: {Math.max(0, dv - res.totalHits) === 0 ? "no damage" : `${Math.max(0, dv - res.totalHits)} ${drainType(Math.max(0, dv - res.totalHits), magic)}`}</span>}
      </div>
      {res && <DiceRow dice={res.dice} />}
    </div>
  );
}

/* ───────────── 5. Direct versus indirect ───────────── */

function CombatWidget() {
  const [magic, setMagic] = useState(6);
  const [sorc, setSorc] = useState(5);
  const [will, setWill] = useState(3);
  const [int, setInt] = useState(3);
  const [rea, setRea] = useState(3);
  const [body, setBody] = useState(3);
  const stats = useMemo(() => {
    const pool = sorc + magic;
    const dPool = will + int, iPool = rea + will;
    const pa = binomPmf(pool), pd = binomPmf(dPool), pi = binomPmf(iPool), ps = binomPmf(body);
    let dd = 0, ii = 0;
    pa.forEach((x, a) => {
      pd.forEach((y, d) => { if (a > d) dd += x * y * (a - d); });
      pi.forEach((y, d) => {
        if (a <= d) return;
        ps.forEach((z, s) => { ii += x * y * z * Math.max(0, Math.ceil(magic / 2) + (a - d) - s); });
      });
    });
    return { pool, dPool, iPool, dOdds: opposedOdds(pool, dPool), iOdds: opposedOdds(pool, iPool), dAvg: dd, iAvg: ii };
  }, [magic, sorc, will, int, rea, body]);
  const better = stats.dAvg > stats.iAvg + 0.1 ? "Direct" : stats.iAvg > stats.dAvg + 0.1 ? "Indirect" : "Even";
  return (
    <div className="space-y-4">
      <div className="grid gap-x-8 gap-y-1 sm:grid-cols-3">
        <Stepper label="Your Magic" value={magic} min={1} max={12} onChange={setMagic} />
        <Stepper label="Your Sorcery" value={sorc} min={1} max={12} onChange={setSorc} />
        <Stepper label="Target Body" value={body} min={1} max={9} onChange={setBody} />
        <Stepper label="Target Willpower" value={will} min={1} max={9} onChange={setWill} />
        <Stepper label="Target Intuition" value={int} min={1} max={9} onChange={setInt} />
        <Stepper label="Target Reaction" value={rea} min={1} max={9} onChange={setRea} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className={clsx("panel quiet space-y-2 p-3", better === "Direct" && "!border-accent")}>
          <h4 className="font-semibold">Direct (Stunbolt, Manabolt)</h4>
          <p className="text-xs text-dim">{stats.pool} dice vs Willpower + Intuition = {stats.dPool}. Damage = net hits. Not resisted.</p>
          <div className="grid grid-cols-2 gap-2"><Readout label="You hit"><Pct v={stats.dOdds.win} /></Readout><Readout label="Avg damage per cast" tone="accent">{stats.dAvg.toFixed(1)}</Readout></div>
        </div>
        <div className={clsx("panel quiet space-y-2 p-3", better === "Indirect" && "!border-accent")}>
          <h4 className="font-semibold">Indirect (Fireball, Clout)</h4>
          <p className="text-xs text-dim">{stats.pool} dice vs Reaction + Willpower = {stats.iPool}. Damage = {Math.ceil(magic / 2)} + net hits, minus Body soak ({body} dice).</p>
          <div className="grid grid-cols-2 gap-2"><Readout label="You hit"><Pct v={stats.iOdds.win} /></Readout><Readout label="Avg damage per cast" tone="accent">{stats.iAvg.toFixed(1)}</Readout></div>
        </div>
      </div>
      <p className="text-sm">{better === "Even" ? "About the same damage with these numbers. Choose on other grounds: noise, armor, whether the target is a machine." : `${better} does more damage on average against this target. Raise their Body or lower their Willpower to see it flip.`}</p>
    </div>
  );
}

/* ───────────── 6. The sustain tax ───────────── */

function SustainWidget() {
  const [n, setN] = useState(1);
  const [pool, setPool] = useState(11);
  const pen = n * 2;
  const rows: [string, number][] = [["Cast a spell", pool], ["Resist drain", 10], ["Defense (Reaction + Intuition)", 7]];
  return (
    <div className="space-y-3">
      <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
        <Stepper label="Sustained spells" value={n} min={0} max={4} onChange={setN} />
        <Stepper label="Your cast pool" value={pool} min={4} max={20} onChange={setPool} />
      </div>
      <div className="space-y-2">
        {rows.map(([label, base]) => {
          const p = Math.max(0, base - pen);
          return (
            <div key={label} className="flex items-center gap-3 text-sm">
              <span className="w-56 shrink-0 text-dim">{label}</span>
              <span className="num w-20">{base} → <b className={clsx(pen && "text-danger")}>{p}</b></span>
              <div className="meter flex-1"><i style={{ width: `${Math.max(0, (p / base) * 100)}%` }} /></div>
              <span className="num w-24 text-right text-dim">avg {(p / 3).toFixed(1)} hits</span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-dim">Every sustained spell takes 2 dice off every action you make. It is the invisible cost of keeping an Invisibility or a Combat Sense running, so only sustain what you need.</p>
    </div>
  );
}

/* ───────────── 7. Spell browser ───────────── */

const CATS: ("All" | SpellCat)[] = ["All", "Combat", "Illusion", "Detection", "Health"];

function CatalogWidget() {
  const [cat, setCat] = useState<"All" | SpellCat>("Combat");
  const [pool, setPool] = useState(10);
  const list = SPELLS.filter((s) => cat === "All" || s.cat === cat);
  const dur = { I: "Instant", S: "Sustained", L: "Limited", P: "Permanent" } as const;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Seg value={cat} onChange={setCat} options={CATS.map((c) => ({ id: c, label: c }))} />
        <Stepper label="Your drain pool" value={pool} min={2} max={20} onChange={setPool} />
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {list.map((s) => {
          const safe = atLeast(pool, s.dv);
          return (
            <article key={s.id} className="panel quiet space-y-1 p-3">
              <div className="flex items-baseline justify-between gap-2"><h4 className="font-semibold">{s.name}</h4><span className="num text-sm text-accent">DV {s.dv}</span></div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <span className="chip">{s.range}</span>
                <span className="chip">{s.type === "M" ? "Mana" : "Physical"}</span>
                <span className="chip">{dur[s.duration]}</span>
                {s.kind !== "utility" && <span className="chip">{s.kind === "direct" ? "Direct" : "Indirect"}</span>}
                {s.dmg && <span className="chip">{s.dmg === "S" ? "Stun" : "Physical"}</span>}
                {s.loud && <span className="chip !border-danger !text-danger">loud</span>}
              </div>
              <p className="text-sm text-dim">{s.blurb}</p>
              <p className="text-xs text-dim">Chance you take no drain: <b className="num text-fg">{Math.round(safe * 100)}%</b></p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────── 8. Summon ───────────── */

function SummonWidget() {
  const [conj, setConj] = useState(4);
  const [magic, setMagic] = useState(6);
  const [force, setForce] = useState(4);
  const [dpool, setDpool] = useState(10);
  const [res, setRes] = useState<{ you: RollResult; sp: RollResult; drain: RollResult | null } | null>(null);
  const odds = useMemo(() => opposedOdds(conj + magic, force * 2), [conj, magic, force]);
  const go = () => {
    const you = roll({ label: "Conjuring + Magic", pool: conj + magic });
    const sp = roll({ label: "Spirit", pool: force * 2 });
    const ok = you.totalHits > sp.totalHits;
    setRes({ you, sp, drain: ok ? roll({ label: "Drain", pool: dpool }) : null });
  };
  const net = res ? res.you.totalHits - res.sp.totalHits : 0;
  const drainDV = res ? res.sp.totalHits : 0;
  const drainDmg = res?.drain ? Math.max(0, drainDV - res.drain.totalHits) : 0;
  return (
    <div className="space-y-4">
      <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
        <Stepper label="Conjuring" value={conj} min={1} max={12} onChange={(n) => { setConj(n); setRes(null); }} />
        <Stepper label="Magic" value={magic} min={1} max={12} onChange={(n) => { setMagic(n); setRes(null); }} />
        <Stepper label="Spirit Force" value={force} min={1} max={9} onChange={(n) => { setForce(n); setRes(null); }} />
        <Stepper label="Your drain pool" value={dpool} min={2} max={20} onChange={(n) => { setDpool(n); setRes(null); }} />
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Readout label="You roll">{conj + magic}</Readout>
        <Readout label="Spirit rolls (Force x 2)">{force * 2}</Readout>
        <Readout label="Chance to summon" tone="accent"><Pct v={odds.win} /></Readout>
        <Readout label="Avg services if it works">{odds.avgNetWhenWin.toFixed(1)}</Readout>
      </div>
      {force > magic * 3 && <p className="text-sm text-danger">That Force is above Magic x 3 ({magic * 3}). You could not hold this spirit.</p>}
      <button className="btn primary" onClick={go}><Icon name="bolt" size={14} /> Summon</button>
      {res && (
        <div className="log-line space-y-3 border-l-2 border-accent pl-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><div className="mb-1 text-xs text-dim">You · {res.you.totalHits} hits</div><DiceRow dice={res.you.dice} /></div>
            <div><div className="mb-1 text-xs text-dim">Spirit · {res.sp.totalHits} hits</div><DiceRow dice={res.sp.dice} /></div>
          </div>
          {net > 0 ? (
            <>
              <p className="text-sm"><b className="text-ok">It comes.</b> {net} net hit{net === 1 ? "" : "s"} means {net} service{net === 1 ? "" : "s"}. Drain Value equals the spirit&apos;s hits ({drainDV}), not your net hits.</p>
              {res.drain && <><DiceRow dice={res.drain.dice} /><p className="text-sm">{res.drain.totalHits} hits on drain: {drainDmg === 0 ? "no damage." : `${drainDmg} ${drainType(drainDmg, magic)} damage.`}</p></>}
            </>
          ) : (
            <p className="text-sm"><b className="text-danger">It does not come.</b> You needed at least 1 net hit. {res.you.totalHits === res.sp.totalHits ? "A tie is not enough." : "The spirit resisted."}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────── 9. Spirits ───────────── */

function SpiritsWidget() {
  const [k, setK] = useState<SpiritKey>("earth");
  const [force, setForce] = useState(4);
  const def = SPIRITS.find((s) => s.key === k)!;
  const st = spiritStats(def, force);
  const attrs: [string, number][] = [["Body", st.B], ["Agility", st.A], ["Reaction", st.R], ["Strength", st.S], ["Willpower", st.W], ["Logic", st.L], ["Intuition", st.I], ["Charisma", st.C]];
  return (
    <div className="space-y-3">
      <Seg value={k} onChange={setK} options={SPIRITS.map((s) => ({ id: s.key, label: s.name }))} />
      <Stepper label="Force" value={force} min={1} max={9} onChange={setForce} />
      <p className="text-sm text-dim">{def.note}</p>
      <div className="grid grid-cols-4 gap-2 md:grid-cols-8">
        {attrs.map(([n, v]) => <Readout key={n} label={n}>{v}</Readout>)}
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Readout label="Initiative">{st.initiative} + 2D6</Readout>
        <Readout label="Defense Rating">{st.defense}</Readout>
        <Readout label="Condition monitor">{st.cm}</Readout>
        <Readout label="Attack Rating">{st.attackRating}</Readout>
      </div>
      <p className="text-xs text-dim">Test pools against it: Force x 2 for summoning and banishing. A spirit gets one optional power for every 3 full points of Force ({Math.floor(force / 3)} here).</p>
    </div>
  );
}

/* ───────────── 10. Banish ───────────── */

function BanishWidget() {
  const [conj, setConj] = useState(5);
  const [magic, setMagic] = useState(5);
  const [force, setForce] = useState(4);
  const [services, setServices] = useState(3);
  const [dpool, setDpool] = useState(10);
  const [res, setRes] = useState<{ you: RollResult; sp: RollResult; drain: RollResult } | null>(null);
  const odds = useMemo(() => opposedOdds(conj + magic, force * 2), [conj, magic, force]);
  const go = () => {
    const you = roll({ label: "Conjuring + Magic", pool: conj + magic });
    const sp = roll({ label: "Spirit", pool: force * 2 });
    const drain = roll({ label: "Drain", pool: dpool });
    setRes({ you, sp, drain });
  };
  const net = res ? Math.max(0, res.you.totalHits - res.sp.totalHits) : 0;
  const left = Math.max(0, services - net);
  const dv = res ? res.sp.totalHits * 2 : 0;
  const dmg = res ? Math.max(0, dv - res.drain.totalHits) : 0;
  return (
    <div className="space-y-4">
      <div className="grid gap-x-8 gap-y-1 sm:grid-cols-3">
        <Stepper label="Conjuring" value={conj} min={1} max={12} onChange={(n) => { setConj(n); setRes(null); }} />
        <Stepper label="Magic" value={magic} min={1} max={12} onChange={(n) => { setMagic(n); setRes(null); }} />
        <Stepper label="Your drain pool" value={dpool} min={2} max={20} onChange={(n) => { setDpool(n); setRes(null); }} />
        <Stepper label="Spirit Force" value={force} min={1} max={9} onChange={(n) => { setForce(n); setRes(null); }} />
        <Stepper label="Services it has left" value={services} min={1} max={6} onChange={(n) => { setServices(n); setRes(null); }} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Readout label="You roll">{conj + magic}</Readout>
        <Readout label="Spirit rolls">{force * 2}</Readout>
        <Readout label="Chance of a net hit" tone="accent"><Pct v={odds.win} /></Readout>
      </div>
      <button className="btn primary" onClick={go}><Icon name="bolt" size={14} /> Banish it</button>
      {res && (
        <div className="log-line space-y-3 border-l-2 border-accent pl-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><div className="mb-1 text-xs text-dim">You · {res.you.totalHits} hits</div><DiceRow dice={res.you.dice} /></div>
            <div><div className="mb-1 text-xs text-dim">Spirit · {res.sp.totalHits} hits</div><DiceRow dice={res.sp.dice} /></div>
          </div>
          <p className="text-sm">{net === 0 ? "No net hits. The spirit keeps all its services." : left === 0 ? <><b className="text-ok">Banished.</b> {net} net hit{net === 1 ? "" : "s"} stripped all {services} services.</> : <>{net} net hit{net === 1 ? "" : "s"} strip {net} service{net === 1 ? "" : "s"}. It has {left} left.</>}</p>
          <p className="text-sm">Banishing drain is twice the spirit&apos;s hits: 2 x {res.sp.totalHits} = {dv}. Your {res.drain.totalHits} drain hits leave {dmg === 0 ? "no damage." : `${dmg} ${drainType(dmg, magic)} damage.`}</p>
          <DiceRow dice={res.drain.dice} />
        </div>
      )}
    </div>
  );
}

/* ───────────── 11. Astral clock ───────────── */

function AstralWidget() {
  const [magic, setMagic] = useState(5);
  const [hours, setHours] = useState(6);
  const limit = magic * 2;
  const over = Math.max(0, hours - limit);
  const essence = Math.max(0, 6 - over);
  const dead = over > 0 && essence <= 0;
  return (
    <div className="space-y-3">
      <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
        <Stepper label="Magic" value={magic} min={1} max={12} onChange={setMagic} />
        <Stepper label="Hours out of body" value={hours} min={0} max={24} onChange={setHours} />
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Readout label="Safe for">{limit}<span className="text-sm text-dim"> h</span></Readout>
        <Readout label="Essence lost" tone={over ? "bad" : "ok"}>{over}</Readout>
        <Readout label="Essence left (from 6)" tone={dead ? "bad" : undefined}>{essence}</Readout>
        <Readout label="Astral running">5 km / round</Readout>
      </div>
      <Boxes total={6} filled={6 - essence} per={2} hot />
      <p className={clsx("text-sm", dead ? "text-danger" : over ? "text-warn" : "text-dim")}>
        {dead ? "Essence hits zero. Your body dies and your astral form vanishes." : over ? `You are ${over} hour${over === 1 ? "" : "s"} past your limit. Essence returns 1 per hour after you get back, if you get back.` : `You have ${limit - hours} hour${limit - hours === 1 ? "" : "s"} before the clock starts to bite.`}
      </p>
      <p className="text-xs text-dim">Astral walking (100 m per round) lets you look around. Astral running (5 km per round) is a blur. A combat round is about 3 seconds, so a minute of running is about 100 km.</p>
    </div>
  );
}

export const MAGIC_WIDGETS: Record<string, ComponentType> = {
  types: TypesWidget,
  sheet: SheetWidget,
  caster: CasterWidget,
  drain: DrainWidget,
  combat: CombatWidget,
  sustain: SustainWidget,
  catalog: CatalogWidget,
  summon: SummonWidget,
  spirits: SpiritsWidget,
  banish: BanishWidget,
  astral: AstralWidget,
};
