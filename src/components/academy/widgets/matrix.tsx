"use client";
import { useMemo, useState, type ComponentType } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { DiceRow } from "../DiceRow";
import { Boxes, Pct, Readout, Seg, Stepper } from "./ui";
import { roll, d6 } from "@/lib/sr6/dice";
import { opposedOdds, bruteRun, probeRun, summarize, type EntryParams } from "@/lib/academy/stats";
import { ACTIONS, GOALS, IC_KIND, IC_LIST, type Goal, type IcKind } from "@/lib/academy/matrix/data";

/* ───────────── 1. Interface modes ───────────── */

const MODES = {
  ar: { name: "AR", sub: "Augmented reality", dice: 1, formula: "Reaction + Intuition", dump: "No dumpshock", body: "You stay in your body and see the Matrix drawn over the room. The safest option, and the slowest for hacking." },
  cold: { name: "Cold-sim VR", sub: "Filtered immersion", dice: 2, formula: "Intuition + Data Processing", dump: "Dumpshock 3 Stun", body: "Your senses move into the Matrix behind a safety filter. Faster than AR, and most biofeedback is dulled." },
  hot: { name: "Hot-sim VR", sub: "No filter, illegal", dice: 3, formula: "Intuition + Data Processing", dump: "Dumpshock 3 Physical", body: "The filter is off. You are the fastest person in the room and the easiest to cook. Biofeedback can physically hurt or kill you." },
} as const;

function ModesWidget() {
  const [mode, setMode] = useState<keyof typeof MODES>("ar");
  const [rea, setRea] = useState(3);
  const [int, setInt] = useState(4);
  const [dp, setDp] = useState(3);
  const [dice, setDice] = useState<number[] | null>(null);
  const m = MODES[mode];
  const base = mode === "ar" ? rea + int : int + dp;
  const roller = () => setDice(Array.from({ length: m.dice }, () => d6()));
  return (
    <div className="space-y-4">
      <Seg value={mode} onChange={(v) => { setMode(v); setDice(null); }} options={(Object.keys(MODES) as (keyof typeof MODES)[]).map((k) => ({ id: k, label: MODES[k].name }))} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <h4 className="text-xl font-semibold">{m.sub}</h4>
          <p className="text-dim">{m.body}</p>
          <div className="flex flex-wrap gap-2"><span className="chip on">{m.dump}</span><span className="chip">Initiative dice: {m.dice}D6</span></div>
        </div>
        <div className="space-y-2">
          <Stepper label="Reaction" value={rea} min={1} max={9} onChange={setRea} />
          <Stepper label="Intuition" value={int} min={1} max={9} onChange={setInt} />
          <Stepper label="Data Processing" value={dp} min={0} max={9} onChange={setDp} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <span className="text-sm text-dim">Initiative = {m.formula} + {m.dice}D6 =</span>
        <span className="num text-xl text-accent">{base} + {m.dice}D6</span>
        <button className="btn small primary" onClick={roller}><Icon name="dice" size={14} /> Roll it</button>
        {dice && <span className="num text-lg">[{dice.join(", ")}] = <b className="text-accent">{base + dice.reduce((a, b) => a + b, 0)}</b></span>}
      </div>
    </div>
  );
}

/* ───────────── 2. Deck builder ───────────── */

const STATS = ["Attack", "Sleaze", "Data Processing", "Firewall"] as const;
const VALUES = [5, 4, 3, 2];

function DeckWidget() {
  const [a, setA] = useState<number[]>([5, 2, 4, 3]); // A S D F values
  const set = (stat: number, v: number) => {
    const next = [...a];
    const other = next.indexOf(v);
    next[other] = next[stat];
    next[stat] = v;
    setA(next);
  };
  const [atk, slz, dp, fw] = a;
  const ar = atk + slz, dr = dp + fw;
  const brutePen = atk < slz ? slz - atk : 0;
  const probePen = slz < atk ? atk - slz : 0;
  const style = atk - slz >= 2 ? "Sledgehammer: loud and strong, great at Brute Force and Data Spike" : slz - atk >= 2 ? "Ghost: quiet and sneaky, best at Probe and Backdoor Entry" : dr - ar >= 2 ? "Tank: soaks hits and survives IC, a bit short on offence" : "All-rounder: no big weakness, no big edge";
  const presets: [string, number[]][] = [["Sledgehammer", [5, 2, 4, 3]], ["Ghost", [2, 5, 3, 4]], ["Tank", [3, 2, 4, 5]], ["Balanced", [4, 3, 2, 5]]];
  return (
    <div className="space-y-4">
      <p className="text-sm text-dim">This deck gives you the numbers 5, 4, 3 and 2. Tap a number to put it on a stat. The number that was there swaps places.</p>
      <div className="flex flex-wrap gap-2">
        {presets.map(([n, v]) => <button key={n} className="chip cursor-pointer hover:border-accent" onClick={() => setA(v)}>{n}</button>)}
      </div>
      <div className="space-y-2">
        {STATS.map((s, i) => (
          <div key={s} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-3">
            <span className="text-sm">{s}</span>
            <div className="flex gap-1.5">
              {VALUES.map((v) => (
                <button key={v} className={clsx("btn small !min-w-10", a[i] === v && "primary")} aria-pressed={a[i] === v} onClick={() => set(i, v)}>{v}</button>
              ))}
            </div>
            <div className="meter hidden sm:block"><i style={{ width: `${(a[i] / 5) * 100}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Readout label="Attack Rating (A + S)" tone="accent">{ar}</Readout>
        <Readout label="Defense Rating (DP + FW)" tone="accent">{dr}</Readout>
        <Readout label="Brute Force penalty" tone={brutePen ? "bad" : "ok"}>{brutePen ? `−${brutePen}` : "none"}</Readout>
        <Readout label="Probe penalty" tone={probePen ? "bad" : "ok"}>{probePen ? `−${probePen}` : "none"}</Readout>
      </div>
      <p className="text-sm"><b className="text-accent">Your build:</b> {style}.</p>
    </div>
  );
}

/* ───────────── 3. Pool tester ───────────── */

function PoolWidget() {
  const [you, setYou] = useState(11);
  const [them, setThem] = useState(8);
  const [res, setRes] = useState<{ a: ReturnType<typeof roll>; b: ReturnType<typeof roll> } | null>(null);
  const odds = useMemo(() => opposedOdds(you, them), [you, them]);
  const go = () => setRes({ a: roll({ label: "you", pool: you }), b: roll({ label: "them", pool: them }) });
  const net = res ? res.a.totalHits - res.b.totalHits : 0;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><div className="font-semibold text-accent">You</div><Stepper label="Dice pool" value={you} min={1} max={25} onChange={(n) => { setYou(n); setRes(null); }} hint="Cracking + Logic, for example" /></div>
        <div className="space-y-2"><div className="font-semibold text-cyan">The defense</div><Stepper label="Dice pool" value={them} min={1} max={25} onChange={(n) => { setThem(n); setRes(null); }} hint="Willpower + Firewall, for example" /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Readout label="You win" tone="ok"><Pct v={odds.win} /></Readout>
        <Readout label="Tie"><Pct v={odds.tie} /></Readout>
        <Readout label="You lose" tone="bad"><Pct v={odds.lose} /></Readout>
      </div>
      <p className="text-sm text-dim">On average you roll <b className="num text-fg">{odds.hitsYou.toFixed(1)}</b> hits and they roll <b className="num text-fg">{odds.hitsThem.toFixed(1)}</b>. A tie goes to the one who acted, but you only get net hits if you beat them.</p>
      <button className="btn primary" onClick={go}><Icon name="dice" size={16} /> Roll both</button>
      {res && (
        <div className="space-y-3" key={res.a.id}>
          <div><div className="mb-1 text-sm text-dim">You: {res.a.totalHits} hits</div><DiceRow dice={res.a.dice} /></div>
          <div><div className="mb-1 text-sm text-dim">Defense: {res.b.totalHits} hits</div><DiceRow dice={res.b.dice} /></div>
          <p className={clsx("font-semibold", net > 0 ? "text-ok" : net === 0 ? "text-accent" : "text-danger")}>
            {net > 0 ? `You win with ${net} net hit${net === 1 ? "" : "s"}.` : net === 0 ? "A tie: you act, but with no net hits." : `They win by ${-net}.`}
            {res.a.critGlitch ? " Critical glitch!" : res.a.glitch ? " Glitch!" : ""}
          </p>
        </div>
      )}
    </div>
  );
}

/* ───────────── 4. Overwatch meter ───────────── */

function OsWidget() {
  const [os, setOs] = useState(0);
  const [radar, setRadar] = useState(false);
  const [def, setDef] = useState(6);
  const [last, setLast] = useState<{ note: string; dice?: ReturnType<typeof roll> } | null>(null);
  const [rounds, setRounds] = useState(0);
  const over = os >= 40;
  const add = (n: number, note: string, dice?: ReturnType<typeof roll>) => {
    setOs((o) => o + n);
    setLast({ note, dice });
  };
  const illegal = () => {
    const r = roll({ label: "defender", pool: def });
    if (radar) { setRadar(false); add(0, `Under the Radar: the defender rolled ${r.totalHits} hits, but none of them count.`, r); }
    else add(r.totalHits, `The defender rolled ${r.totalHits} hit${r.totalHits === 1 ? "" : "s"}: +${r.totalHits} OS, whether or not you won.`, r);
  };
  const tick = (n: number, label: string) => { setRounds((x) => x + 1); add(n, label); };
  const reset = () => { setOs(0); setRadar(false); setLast(null); setRounds(0); };
  const pct = Math.min(100, (os / 40) * 100);
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-baseline justify-between"><span className="text-sm text-dim">Overwatch Score</span><span className={clsx("num text-3xl font-bold", over ? "text-danger" : os >= 30 ? "text-accent glow" : "")}>{os}<span className="text-base text-faint"> / 40</span></span></div>
        <div className={clsx("meter !h-4", os >= 28 && "hot")}><i style={{ width: `${pct}%` }} /></div>
        <div className="mt-1 flex justify-between text-[0.7rem] text-faint num"><span>0</span><span>10</span><span>20</span><span>30</span><span>Convergence</span></div>
      </div>
      {over ? (
        <div className="border border-danger bg-danger/10 p-4">
          <div className="font-display text-xl font-bold text-danger">CONVERGENCE</div>
          <p className="text-sm">GOD has locked onto you. Your last illegal device is bricked, you are dumped from the Matrix with dumpshock, and your physical location goes to the authorities. That took {rounds} rounds of play here.</p>
          <button className="btn mt-3" onClick={reset}>Start again</button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3"><Stepper label="Defender dice" value={def} min={1} max={16} onChange={setDef} hint="Willpower + Firewall of the target" /></div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button className="btn justify-start" onClick={illegal}>Take an illegal action (Probe, Brute Force, Crack File)</button>
            <button className="btn justify-start" onClick={() => add(1, "A hacking program was used on an action: +1 OS.")}>Use a hacking program on an action (+1)</button>
            <button className="btn justify-start" onClick={() => tick(1, "A round passes with illegal User access: +1 OS.")}>One round of illegal <b>User</b> access (+1)</button>
            <button className="btn justify-start" onClick={() => tick(3, "A round passes with illegal Admin access: +3 OS.")}>One round of illegal <b>Admin</b> access (+3)</button>
            <button className="btn justify-start" onClick={() => tick(0, "A round passes with Admin gained through a backdoor: no upkeep.")}>One round of Admin through a <b>backdoor</b> (+0)</button>
            <button className={clsx("btn justify-start", radar && "primary")} disabled={radar} onClick={() => setRadar(true)}>{radar ? "Under the Radar armed: next illegal action adds 0" : "Spend 3 Edge: Under the Radar"}</button>
          </div>
          <div className="flex gap-2"><button className="btn small ghost" onClick={reset}>Reboot (reset OS)</button></div>
        </>
      )}
      {last && (
        <div key={os + last.note} className="log-line space-y-2 border-l-2 border-accent pl-3">
          <p className="text-sm">{last.note}</p>
          {last.dice && <DiceRow dice={last.dice.dice} size="1.7rem" />}
        </div>
      )}
    </div>
  );
}

/* ───────────── 5. Access ladder ───────────── */

const LEVELS = [
  { id: "out", name: "Outsider", gist: "You are in the lobby.", can: "Look around, talk to others on the host, and attempt hacks.", ex: ["Matrix Perception", "Matrix Search", "Probe", "Brute Force", "Data Spike", "Send Message", "Enter/Exit Host"], get: "You have this as soon as you arrive." },
  { id: "usr", name: "User", gist: "You hold a staff badge.", can: "Read and work with files and basic functions, like any ordinary account.", ex: ["Edit File", "Crack File", "Hash Check", "Control Device", "Change Icon", "Disarm Data Bomb"], get: "Legitimately, with a login. Illegally, with Brute Force or Probe. Illegal User access costs +1 OS per round." },
  { id: "adm", name: "Admin", gist: "You hold the master keys.", can: "Change configuration, switch devices on and off, and take drastic actions.", ex: ["Snoop", "Trace Icon", "Crash Program", "Format Device", "Reboot Device", "Set Data Bomb", "Jam Signals", "Check OS"], get: "Illegally, with Brute Force or a Probe plus Backdoor Entry. Illegal Admin costs +3 OS per round, but a backdoor entry does not count as illegal Admin." },
] as const;

function LadderWidget() {
  const [sel, setSel] = useState<(typeof LEVELS)[number]["id"]>("out");
  const cur = LEVELS.find((l) => l.id === sel)!;
  return (
    <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
      <div className="flex flex-col-reverse gap-1.5" role="tablist">
        {LEVELS.map((l, i) => (
          <button key={l.id} role="tab" aria-selected={sel === l.id} onClick={() => setSel(l.id)} style={{ marginLeft: `${i * 1.25}rem` }} className={clsx("border px-3 py-3 text-left transition-colors", sel === l.id ? "border-accent bg-panelhi text-accent" : "border-line hover:border-line-hi")}>
            <div className="font-display font-semibold">{l.name}</div>
            <div className="text-xs text-dim">{l.gist}</div>
          </button>
        ))}
      </div>
      <div className="space-y-3">
        <p><b>What you can do:</b> {cur.can}</p>
        <div className="flex flex-wrap gap-1.5">{cur.ex.map((e) => <span key={e} className="chip">{e}</span>)}</div>
        <p className="text-sm text-dim"><b className="text-fg">How you get it:</b> {cur.get}</p>
        <p className="text-xs text-faint">Each action in the rulebook lists the access it needs. Higher levels can do everything below them.</p>
      </div>
    </div>
  );
}

/* ───────────── 6. Hammer or lockpick ───────────── */

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fmtTime = (s: number) => (s < 60 ? `${Math.round(s)} s` : `${(s / 60).toFixed(s < 600 ? 1 : 0)} min`);

function EntryCol({ title, sub, r, win }: { title: string; sub: string; r: ReturnType<typeof summarize>; win: boolean }) {
  return (
    <div className={clsx("space-y-2 border p-3", win ? "border-ok" : "border-line")}>
      <div className="flex items-baseline justify-between"><h4 className="font-semibold">{title}</h4>{win && <span className="chip on">cheaper</span>}</div>
      <p className="text-xs text-dim">{sub}</p>
      <div className="grid grid-cols-2 gap-2">
        <Readout label="OS at the end (typical)">{r.osMedian}</Readout>
        <Readout label="OS on a bad day" tone={r.osBad >= 40 ? "bad" : undefined}>{r.osBad}</Readout>
        <Readout label="Chance of Convergence" tone={r.convergence > 0.05 ? "bad" : "ok"}>{Math.round(r.convergence * 100)}%</Readout>
        <Readout label="Time to get in">{fmtTime(r.secMedian)}</Readout>
      </div>
    </div>
  );
}

function EntryWidget() {
  const [pool, setPool] = useState(11);
  const [atk, setAtk] = useState(3);
  const [slz, setSlz] = useState(5);
  const [fw, setFw] = useState(4);
  const [wp, setWp] = useState(4);
  const [stay, setStay] = useState(8);
  const [seed, setSeed] = useState(1);
  const res = useMemo(() => {
    const p: EntryParams = { pool, attack: atk, sleaze: slz, firewall: fw, willpower: wp, stay };
    const rng = mulberry(seed * 7919 + pool * 31 + atk * 17 + slz * 13 + fw * 11 + wp * 5 + stay);
    const brute = Array.from({ length: 1500 }, () => bruteRun(p, rng));
    const probe = Array.from({ length: 1500 }, () => probeRun(p, rng));
    return { brute: summarize(brute), probe: summarize(probe) };
  }, [pool, atk, slz, fw, wp, stay, seed]);
  return (
    <div className="space-y-4">
      <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
        <Stepper label="Your Cracking + Logic" value={pool} min={4} max={20} onChange={setPool} />
        <Stepper label="Your Attack" value={atk} min={1} max={6} onChange={setAtk} />
        <Stepper label="Your Sleaze" value={slz} min={1} max={6} onChange={setSlz} />
        <Stepper label="Host Firewall" value={fw} min={1} max={9} onChange={setFw} />
        <Stepper label="Spider Willpower (0 = none)" value={wp} min={0} max={8} onChange={setWp} hint="0 means nobody is watching: the host defends with Firewall x 2" />
        <Stepper label="Rounds you stay inside" value={stay} min={0} max={20} onChange={setStay} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <EntryCol title="Brute Force to Admin" sub="One try per round. Every try alerts the host. Illegal Admin costs 3 OS each round you stay." r={res.brute} win={res.brute.osMedian < res.probe.osMedian} />
        <EntryCol title="Probe, then Backdoor Entry" sub="One Probe try per minute, then Backdoor Entry. Admin through a backdoor has no upkeep." r={res.probe} win={res.probe.osMedian <= res.brute.osMedian} />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-dim">
        <span>Each column plays this hack 1,500 times with the real rules.</span>
        <button className="btn small" onClick={() => setSeed((s) => s + 1)}>Run another batch</button>
      </div>
      <p className="text-sm">Try lowering your Sleaze below your Attack. The Probe route gets worse, because Probe is Sleaze-linked and you pay the difference in dice.</p>
    </div>
  );
}

/* ───────────── 7. Edge ───────────── */

type Side = { a: number; s: number; d: number; f: number };
function SideCol({ title, v, set }: { title: string; v: Side; set: (n: Side) => void }) {
  return (
    <div className="space-y-1"><div className="font-semibold">{title}</div>
      <Stepper label="Attack" value={v.a} min={0} max={9} onChange={(n) => set({ ...v, a: n })} />
      <Stepper label="Sleaze" value={v.s} min={0} max={9} onChange={(n) => set({ ...v, s: n })} />
      <Stepper label="Data Processing" value={v.d} min={0} max={9} onChange={(n) => set({ ...v, d: n })} />
      <Stepper label="Firewall" value={v.f} min={0} max={9} onChange={(n) => set({ ...v, f: n })} />
    </div>
  );
}

function EdgeWidget() {
  const [me, setMe] = useState({ a: 5, s: 3, d: 3, f: 4 });
  const [foe, setFoe] = useState({ a: 4, s: 4, d: 3, f: 2 });
  const myAR = me.a + me.s, myDR = me.d + me.f, foeAR = foe.a + foe.s, foeDR = foe.d + foe.f;
  const mine = myAR - foeDR, theirs = foeAR - myDR;
  const msg = (g: number) => (g >= 4 ? "gets 1 bonus Edge" : "no Edge");
  return (
    <div className="space-y-4">
      <div className="grid gap-6 sm:grid-cols-2"><SideCol title="You" v={me} set={setMe} /><SideCol title="The target" v={foe} set={setFoe} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={clsx("border p-3", mine >= 4 ? "border-ok" : "border-line")}>
          <div className="text-sm text-dim">Your Attack Rating {myAR} vs their Defense Rating {foeDR}</div>
          <div className="text-lg">Gap {mine >= 0 ? "+" : ""}{mine}: <b className={mine >= 4 ? "text-ok" : ""}>you {msg(mine)}</b></div>
        </div>
        <div className={clsx("border p-3", theirs >= 4 ? "border-danger" : "border-line")}>
          <div className="text-sm text-dim">Their Attack Rating {foeAR} vs your Defense Rating {myDR}</div>
          <div className="text-lg">Gap {theirs >= 0 ? "+" : ""}{theirs}: <b className={theirs >= 4 ? "text-danger" : ""}>they {msg(theirs)}</b></div>
        </div>
      </div>
      <p className="text-xs text-faint">A gap of 4 or more gives the higher side a point of bonus Edge. No one gains more than 2 bonus Edge in one round.</p>
    </div>
  );
}

/* ───────────── 8. IC zoo ───────────── */

function IcWidget() {
  const [kind, setKind] = useState<IcKind | "all">("all");
  const list = IC_LIST.filter((i) => kind === "all" || i.kind === kind);
  return (
    <div className="space-y-3">
      <Seg value={kind} onChange={setKind} options={[{ id: "all", label: "All 13" }, ...(Object.keys(IC_KIND) as IcKind[]).map((k) => ({ id: k, label: IC_KIND[k] }))]} />
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((i) => (
          <article key={i.name} className="panel quiet space-y-1.5 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-lg font-semibold">{i.name}</h4>
              <span className="text-sm text-danger" aria-label={`Threat ${i.threat} of 5`}>{"●".repeat(i.threat)}<span className="text-line-hi">{"●".repeat(5 - i.threat)}</span></span>
            </div>
            <p className="text-sm">{i.effect}</p>
            <p className="text-xs text-dim"><b className="text-cyan">You defend with:</b> {i.defense}</p>
            <p className="text-xs text-dim"><b className="text-accent">What to do:</b> {i.tip}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ───────────── 9. Damage lab ───────────── */

type Src = "killer" | "black" | "sparky" | "blaster";
const SRC: Record<Src, { label: string; note: string }> = {
  killer: { label: "Killer IC", note: "Matrix damage = host rating + net hits." },
  black: { label: "Black IC", note: "Host rating + net hits as Matrix damage AND as biofeedback damage." },
  sparky: { label: "Sparky", note: "Host rating + net hits as biofeedback damage only. Your deck is untouched." },
  blaster: { label: "Blaster", note: "Matrix damage equal to the host rating, plus link-lock." },
};

function DamageWidget() {
  const [src, setSrc] = useState<Src>("killer");
  const [rating, setRating] = useState(4);
  const [net, setNet] = useState(2);
  const [fw, setFw] = useState(4);
  const [wil, setWil] = useState(3);
  const [dev, setDev] = useState(4);
  const [deckDmg, setDeckDmg] = useState(0);
  const [stun, setStun] = useState(0);
  const [locked, setLocked] = useState(false);
  const [last, setLast] = useState<{ lines: string[]; dice: ReturnType<typeof roll>[] } | null>(null);
  const boxes = Math.ceil(dev / 2) + 8;
  const stunBoxes = 8 + Math.ceil(wil / 2);
  const bricked = deckDmg >= boxes;
  const penalty = Math.floor(deckDmg / 3);

  const hit = () => {
    const lines: string[] = [];
    const dice: ReturnType<typeof roll>[] = [];
    const matrixRaw = src === "blaster" ? rating : rating + net;
    let dDeck = 0, dBody = 0;
    if (src !== "sparky") {
      const r = roll({ label: "Firewall soak", pool: fw });
      dice.push(r);
      dDeck = Math.max(0, matrixRaw - r.totalHits);
      lines.push(`Matrix damage ${matrixRaw}, your Firewall soaks ${r.totalHits}: ${dDeck} box${dDeck === 1 ? "" : "es"} on your deck.`);
    }
    if (src === "black" || src === "sparky") {
      const bioRaw = rating + net;
      const r = roll({ label: "Willpower soak", pool: wil });
      dice.push(r);
      dBody = Math.max(0, bioRaw - r.totalHits);
      lines.push(`Biofeedback ${bioRaw}, your Willpower soaks ${r.totalHits}: ${dBody} damage to you.`);
    }
    if (src === "blaster") { setLocked(true); lines.push("You are link-locked."); }
    setDeckDmg((x) => Math.min(boxes, x + dDeck));
    setStun((x) => Math.min(stunBoxes, x + dBody));
    setLast({ lines, dice });
  };
  const reset = () => { setDeckDmg(0); setStun(0); setLocked(false); setLast(null); };
  return (
    <div className="space-y-4">
      <Seg value={src} onChange={(v) => { setSrc(v); reset(); }} options={(Object.keys(SRC) as Src[]).map((k) => ({ id: k, label: SRC[k].label }))} />
      <p className="text-sm text-dim">{SRC[src].note}</p>
      <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
        <Stepper label="Host rating" value={rating} min={1} max={12} onChange={setRating} />
        <Stepper label="Their net hits" value={net} min={0} max={8} onChange={setNet} />
        <Stepper label="Your Firewall" value={fw} min={0} max={9} onChange={setFw} />
        <Stepper label="Your Willpower" value={wil} min={1} max={9} onChange={(n) => { setWil(n); setStun(0); }} />
        <Stepper label="Deck rating" value={dev} min={1} max={9} onChange={(n) => { setDev(n); setDeckDmg(0); }} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 text-sm text-dim">Deck condition monitor ({boxes} boxes){penalty > 0 && <span className="text-danger"> · −{penalty} to all tests</span>}</div>
          <Boxes total={boxes} filled={deckDmg} hot={deckDmg > boxes - 3} />
          {bricked && <p className="mt-1 font-semibold text-danger">Bricked. The deck is dead.</p>}
        </div>
        <div>
          <div className="mb-1 text-sm text-dim">Your Stun monitor ({stunBoxes} boxes)</div>
          <Boxes total={stunBoxes} filled={stun} hot={stun > stunBoxes - 3} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn primary" onClick={hit} disabled={bricked}>Take a hit</button>
        <button className="btn ghost" onClick={reset}>Repair and reset</button>
        {locked && <span className="chip on">link-locked</span>}
      </div>
      {last && (
        <div key={deckDmg + stun + last.lines.join()} className="log-line space-y-2 border-l-2 border-accent pl-3">
          {last.dice.map((d, i) => <div key={i}><div className="text-xs text-dim">{d.spec.label}</div><DiceRow dice={d.dice} size="1.7rem" /></div>)}
          {last.lines.map((l, i) => <p key={i} className="text-sm">{l}</p>)}
        </div>
      )}
    </div>
  );
}

/* ───────────── 10. Action finder ───────────── */

function ActionsWidget() {
  const [goal, setGoal] = useState<Goal>("in");
  const list = ACTIONS.filter((a) => a.goals.includes(goal));
  const [name, setName] = useState<string>("Probe");
  const sel = list.find((a) => a.name === name) ?? list[0];
  return (
    <div className="space-y-3">
      <div className="text-sm text-dim">I want to…</div>
      <Seg value={goal} onChange={(g) => { setGoal(g); setName(""); }} options={GOALS.map((g) => ({ id: g.id, label: g.label }))} />
      <div className="grid gap-3 md:grid-cols-[14rem_1fr]">
        <div className="flex flex-col gap-1.5">
          {list.map((a) => (
            <button key={a.name} onClick={() => setName(a.name)} className={clsx("flex items-center justify-between gap-2 border px-3 py-2 text-left text-sm", sel?.name === a.name ? "border-accent bg-panelhi" : "border-line hover:border-line-hi")}>
              <span>{a.name}</span>
              <span className={clsx("text-[0.65rem] uppercase", a.legal ? "text-ok" : "text-danger")}>{a.legal ? "legal" : "illegal"}</span>
            </button>
          ))}
        </div>
        {sel && (
          <div className="space-y-2 border border-line bg-bg2 p-4">
            <div className="flex flex-wrap items-center gap-2"><h4 className="text-xl font-semibold">{sel.name}</h4><span className={clsx("chip", sel.legal ? "on" : "")}>{sel.legal ? "Legal" : "Illegal: adds OS"}</span><span className="chip">{sel.kind}</span><span className="chip">Access: {sel.access}</span></div>
            <p>{sel.plain}</p>
            <p className="num text-sm text-cyan">{sel.test}</p>
            <p className="text-sm text-dim"><b className="text-accent">Watch out:</b> {sel.watch}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export const MATRIX_WIDGETS: Record<string, ComponentType> = {
  modes: ModesWidget,
  deck: DeckWidget,
  pool: PoolWidget,
  os: OsWidget,
  ladder: LadderWidget,
  entry: EntryWidget,
  edge: EdgeWidget,
  ic: IcWidget,
  damage: DamageWidget,
  actions: ActionsWidget,
};
