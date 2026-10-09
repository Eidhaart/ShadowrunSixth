"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { RollView } from "@/components/Dice";
import { doInitiative, doRoll } from "@/lib/actions";
import { useRunners } from "@/lib/store/characters";
import { useRolls } from "@/lib/store/rolls";
import { useRulebook } from "@/lib/store/rulebook";
import { useComms } from "@/lib/store/comms";
import { damageAfterSoak } from "@/lib/sr6/dice";
import { derive, type Derived } from "@/lib/sr6/derive";
import type { Character } from "@/lib/sr6/character";
import {
  ATTRIBUTES, ATTR_ABBR, ATTR_LABEL, KARMA, METATYPES, MAGIC_TYPE_LABEL, SKILLS, SKILL_BY_ID, LIFESTYLES,
  type AttrKey,
} from "@/lib/sr6/data";
import { runnerToFoundry } from "@/lib/foundry";
import { getExt, sustainPenalty } from "@/lib/sr6/ext";
import type { RollOpts, SheetCtx } from "./tabs/ctx";
import { MatrixTab } from "./tabs/MatrixTab";
import { MagicTab } from "./tabs/MagicTab";
import { RiggingTab } from "./tabs/RiggingTab";
import { GearTab } from "./tabs/GearTab";

const STATUSES = ["Burning", "Chilled", "Corrosive", "Dazed", "Deafened", "Fatigued", "Frightened", "Hazed", "Hobbled", "Immobilized", "Nauseated", "Panicked", "Poisoned", "Prone", "Stilled", "Wet", "Zapped"];
const RANGES = ["Close", "Near", "Medium", "Far", "Extreme"] as const;

function Box({ title, children, className, right }: { title: string; children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <section className={clsx("panel", className)}>
      <div className="panel-head text-sm"><span className="flex-1">{title}</span>{right}</div>
      <div className="p-3.5">{children}</div>
    </section>
  );
}

/** Damage track in rows of three with the wound penalty marked at the end of each row. */
function Track({ label, boxes, filled, onSet, tone }: { label: string; boxes: number; filled: number; onSet: (n: number) => void; tone: "phys" | "stun" | "over" }) {
  const rows = Math.ceil(boxes / 3);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-display font-semibold">{label}</span>
        <span className="num text-dim">{filled} / {boxes}</span>
      </div>
      <div className="space-y-1">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-1">
            {Array.from({ length: Math.min(3, boxes - r * 3) }, (_, k) => {
              const n = r * 3 + k + 1;
              const on = n <= filled;
              return (
                <button
                  key={n}
                  onClick={() => onSet(filled === n ? n - 1 : n)}
                  aria-label={`${label} box ${n}${on ? ", damaged" : ""}`}
                  aria-pressed={on}
                  className={clsx("h-7 w-7 border transition-colors", on ? (tone === "phys" ? "border-danger bg-danger/80" : tone === "stun" ? "border-cyan bg-cyan/70" : "border-faint bg-faint") : "border-linehi hover:border-accent")}
                />
              );
            })}
            {tone !== "over" && Math.min(3, boxes - r * 3) === 3 && (
              <span className={clsx("num ml-1 w-6 text-xs", filled >= (r + 1) * 3 ? "text-danger" : "text-faint")}>−{r + 1}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EdgeTracker({ c, d, upd }: { c: Character; d: Derived; upd: (fn: (x: Character) => void) => void }) {
  const cap = 7;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-display font-semibold">Edge</span>
        <span className="num text-sm text-dim">{c.edgeCurrent} now · rating {d.edge}</span>
      </div>
      <div className="flex gap-1" role="img" aria-label={`${c.edgeCurrent} Edge of ${cap}`}>
        {Array.from({ length: cap }, (_, i) => (
          <span key={i} className={clsx("h-6 flex-1 border", i < c.edgeCurrent ? (i < d.edge ? "border-accent bg-accent" : "border-cyan bg-cyan") : "border-line", i === d.edge - 1 && "outline outline-1 outline-offset-2 outline-accent/40")} />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <button className="btn small" disabled={c.edgeCurrent >= cap} onClick={() => upd((x) => { x.edgeCurrent = Math.min(cap, x.edgeCurrent + 1); })}><Icon name="plus" size={13} /> Gain</button>
        <button className="btn small" disabled={c.edgeCurrent <= 0} onClick={() => upd((x) => { x.edgeCurrent = Math.max(0, x.edgeCurrent - 1); })}><Icon name="minus" size={13} /> Spend</button>
        <button className="btn small" onClick={() => upd((x) => { x.edgeCurrent = Math.min(x.edgeCurrent, d.edge); })} title="Edge above your rating goes away; Edge below it stays">End confrontation</button>
        <button className="btn small ghost" onClick={() => upd((x) => { x.edgeCurrent = d.edge; })}>New session</button>
        <button className="btn small danger" disabled={d.edge <= 0} onClick={() => { if (confirm("Burn Edge? You permanently lose 1 rank of Edge and spend all your Edge now. It can be bought back with Karma.")) upd((x) => { x.edgeBurned = (x.edgeBurned ?? 0) + 1; x.edgeCurrent = 0; }); }}>Burn</button>
      </div>
    </div>
  );
}

const TABS = [
  { id: "sheet", label: "Sheet" },
  { id: "matrix", label: "Matrix" },
  { id: "magic", label: "Magic" },
  { id: "rig", label: "Rigging" },
  { id: "gear", label: "Gear" },
] as const;

function TabBar({ tab, setTab, awakened, sustained }: { tab: string; setTab: (t: (typeof TABS)[number]["id"]) => void; awakened: boolean; sustained: number }) {
  return (
    <div className="no-print mb-4 flex gap-1 overflow-x-auto border-b border-line" role="tablist" aria-label="Sheet sections">
      {TABS.filter((x) => x.id !== "magic" || awakened).map((x) => (
        <button
          key={x.id}
          role="tab"
          aria-selected={tab === x.id}
          onClick={() => setTab(x.id)}
          className={clsx("-mb-px whitespace-nowrap border-b-2 px-4 py-2 font-display text-sm font-semibold transition-colors", tab === x.id ? "border-accent text-accent" : "border-transparent text-dim hover:text-fg")}
        >
          {x.label}{(x.id === "magic" || (x.id === "matrix" && !awakened)) && sustained > 0 && <span className="ml-1.5 chip !py-0">−{sustained * 2}</span>}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ id }: { id: string }) {
  const c = useRunners((s) => s.runners[id]);
  const update = useRunners((s) => s.update);
  const book = useRulebook((s) => s.book);
  const commsStatus = useComms((s) => s.status);
  const send = useComms((s) => s.send);

  const [tab, setTab] = useState<"sheet" | "matrix" | "magic" | "rig" | "gear">("sheet");
  const [mod, setMod] = useState(0);
  const [edgePre, setEdgePre] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  const [soak, setSoak] = useState({ dv: 6, net: 0, type: "P" as "P" | "S", rollId: null as string | null });
  const [builder, setBuilder] = useState<{ skill: string; attr: AttrKey | "magic" | "resonance"; spec: boolean }>({ skill: "firearms", attr: "agility", spec: false });
  const [target, setTarget] = useState({ dr: 4, range: 1 });
  const [newSpell, setNewSpell] = useState("");
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notes, setNotes] = useState(c?.notes ?? "");

  const log = useRolls((s) => s.log);
  const last = useMemo(() => log.find((e) => e.kind === "roll" && e.result.id === lastId), [log, lastId]);
  const soakEntry = useMemo(() => log.find((e) => e.kind === "roll" && e.result.id === soak.rollId), [log, soak.rollId]);

  useEffect(() => () => { if (notesTimer.current) clearTimeout(notesTimer.current); }, []);

  if (!c) {
    return (
      <div className="mx-auto max-w-xl p-10">
        <h1 className="text-3xl font-bold">Runner not found</h1>
        <p className="mt-2 text-dim">This sheet is stored on the device that created it. If you built it elsewhere, export it there and import the file on the Runners page.</p>
        <Link href="/runners" className="btn mt-4">Back to runners</Link>
      </div>
    );
  }

  const d = derive(c);
  const who = c.alias || c.name || "Runner";
  const upd = (fn: (x: Character) => void) => update(c.id, fn);
  const meta = METATYPES[c.metatype];
  const penalty = d.woundPenalty;
  const awakened = c.magicType !== "mundane" && c.magicType !== "technomancer";

  const sustain = sustainPenalty(getExt(c));
  const poolOf = (base: number, opts: RollOpts = {}) =>
    Math.max(0, base - (opts.noWound ? 0 : penalty) - (opts.noSustain ? 0 : sustain) + (opts.adjust ?? 0) + c.poolMod + mod);
  const rollPool = (label: string, base: number, opts: RollOpts = {}) => {
    const pool = poolOf(base, opts);
    const useEdge = edgePre && c.edgeCurrent >= 4;
    if (useEdge) upd((x) => { x.edgeCurrent -= 4; });
    const r = doRoll({ label, pool, explode: useEdge, glitchOn2: d.glitchOn2 }, useEdge ? d.edge : 0, who);
    setLastId(r.id);
    if (useEdge) setEdgePre(false);
    return r;
  };

  const attrValue = (a: AttrKey | "magic" | "resonance") => (a === "magic" ? d.magic : a === "resonance" ? d.resonance : d.attrs[a]);
  const skillRank = (sid: string) => (c.skills[sid] ? c.skills[sid].pts + c.skills[sid].kar : 0);

  const applyDamage = (boxes: number, kind: "P" | "S") =>
    upd((x) => {
      let phys = x.damage.physical;
      let stun = x.damage.stun;
      let over = x.damage.overflow;
      if (kind === "S") {
        const room = Math.max(0, d.condition.stun - stun);
        const toStun = Math.min(boxes, room);
        stun += toStun;
        phys += boxes - toStun; // a full Stun monitor spills into Physical
      } else phys += boxes;
      if (phys > d.condition.physical) {
        over += phys - d.condition.physical;
        phys = d.condition.physical;
      }
      x.damage = { physical: phys, stun, overflow: Math.min(over, d.condition.overflow) };
    });

  const ctx: SheetCtx = { c, d, who, upd, rollPool, poolOf, applyDamage: (b, k) => applyDamage(b, k), awakened };

  const soakResult = soakEntry && soakEntry.kind === "roll" ? damageAfterSoak(soak.dv, soak.net, soakEntry.result.totalHits) : null;

  // Karma advancement
  const karmaAvail = c.karmaEarned - c.karmaSpent;
  const spend = (cost: number, fn: (x: Character) => void) => upd((x) => { x.karmaSpent += cost; fn(x); });
  const maxSkill = (sid: string) => (c.qualities.some((q) => q.name.startsWith("Aptitude") && q.note === sid) ? 10 : 9);

  const weapons = c.gear.filter((g) => g.category === "weapon");

  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(c, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${who.replace(/\W+/g, "-")}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportFoundry = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(runnerToFoundry(c, d), null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${who.replace(/\W+/g, "-")}.foundry.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const shareToChat = () => {
    send({
      type: "chat", id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, from: who, at: Date.now(), source: "deck",
      text: `${who}: ${meta.name}${c.archetype ? ` ${c.archetype}` : ""}. Init ${d.initiative.rank}+${d.initiative.dice}D6, DR ${d.defenseRating}, Edge ${d.edge}, Condition ${d.condition.physical}/${d.condition.stun}.`,
    });
  };

  const statusDesc = (name: string) => book?.sections.find((s) => s.chapter === "Game Concepts" && s.parent === "Status List" && s.title.replace(/\s*[IV#, ]+$/g, "").toLowerCase().startsWith(name.toLowerCase()))?.text.replace(/\s+/g, " ").slice(0, 280);

  const poolBreakdown = (() => {
    const def = SKILL_BY_ID[builder.skill];
    const rank = def ? skillRank(builder.skill) : 0;
    const sp = c.skills[builder.skill]?.spec;
    const untrained = def && rank === 0;
    const parts = [def ? `${def.name} ${untrained ? "(untrained −1)" : rank}` : "", `${ATTR_LABEL[builder.attr as keyof typeof ATTR_LABEL]} ${attrValue(builder.attr)}`];
    let total = attrValue(builder.attr) + (def ? (untrained ? -1 : rank) : 0);
    if (builder.spec && sp) { parts.push("+2 specialization"); total += 2; }
    if (penalty) { parts.push(`−${penalty} wounds`); total -= penalty; }
    if (c.poolMod) { parts.push(`${c.poolMod > 0 ? "+" : "−"}${Math.abs(c.poolMod)} sheet`); total += c.poolMod; }
    if (mod) { parts.push(`${mod > 0 ? "+" : "−"}${Math.abs(mod)} situation`); total += mod; }
    return { text: parts.filter(Boolean).join("  "), total: Math.max(0, total), canSpec: !!sp };
  })();

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-8">
      {/* header */}
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold md:text-4xl">{who}</h1>
          <p className="mt-1 text-dim">{c.alias && c.name ? `${c.name} · ` : ""}{meta.name}{c.magicType !== "mundane" ? ` · ${MAGIC_TYPE_LABEL[c.magicType]}` : ""}{c.archetype ? ` · ${c.archetype}` : ""}</p>
          {c.concept && <p className="mt-1 max-w-2xl text-sm text-faint">{c.concept}</p>}
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Link href={`/forge?edit=${c.id}`} className="btn small"><Icon name="forge" size={14} /> Edit build</Link>
          <button className="btn small" onClick={() => window.print()}><Icon name="print" size={14} /> Print</button>
          <button className="btn small" onClick={exportJson}><Icon name="download" size={14} /> Export</button>
          <button className="btn small" onClick={exportFoundry}><Icon name="link" size={14} /> For Foundry</button>
          <button className="btn small" disabled={commsStatus === "off"} onClick={shareToChat}><Icon name="comms" size={14} /> Share</button>
        </div>
      </header>

      {(d.dead || d.unconscious || penalty > 0) && (
        <div className={clsx("mb-5 border-l-2 px-4 py-2.5 text-sm", d.dead ? "border-danger bg-danger/15" : d.unconscious ? "border-danger bg-danger/10" : "border-accent bg-accent/10")} role="status">
          {d.dead ? "Dead. Overflow damage has reached twice Body." : d.unconscious ? "Unconscious. A condition monitor is full." : `Wound modifier: −${penalty} dice on every test except Damage Resistance. It is applied to every roll below automatically.`}
        </div>
      )}

      <TabBar tab={tab} setTab={setTab} awakened={awakened} sustained={getExt(c).sustained.length} />
      <div className={clsx(tab !== "matrix" && "hidden print:block")}><MatrixTab ctx={ctx} /></div>
      {awakened && <div className={clsx(tab !== "magic" && "hidden print:block")}><MagicTab ctx={ctx} /></div>}
      <div className={clsx(tab !== "rig" && "hidden print:block")}><RiggingTab ctx={ctx} /></div>
      <div className={clsx(tab !== "gear" && "hidden print:block")}><GearTab ctx={ctx} /></div>

      <div className={clsx("grid gap-4 lg:grid-cols-3", tab !== "sheet" && "hidden print:grid")}>
        {/* left column */}
        <div className="space-y-4">
          <Box title="Condition" right={<button className="no-print btn small ghost" onClick={() => upd((x) => { x.damage = { physical: 0, stun: 0, overflow: 0 }; })}>Heal all</button>}>
            <div className="space-y-4">
              <Track label="Physical" boxes={d.condition.physical} filled={c.damage.physical} tone="phys" onSet={(n) => upd((x) => { x.damage.physical = n; if (n < d.condition.physical) x.damage.overflow = 0; })} />
              <Track label="Stun" boxes={d.condition.stun} filled={c.damage.stun} tone="stun" onSet={(n) => upd((x) => { x.damage.stun = n; })} />
              <Track label="Overflow" boxes={d.condition.overflow} filled={c.damage.overflow} tone="over" onSet={(n) => upd((x) => { x.damage.overflow = n; })} />
            </div>
          </Box>

          <Box title="Take a hit" className="no-print">
            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs text-dim">Damage Value<input className="field num mt-1" type="number" min={0} value={soak.dv} onChange={(e) => setSoak({ ...soak, dv: Math.max(0, Number(e.target.value) || 0), rollId: null })} /></label>
              <label className="text-xs text-dim">Net hits<input className="field num mt-1" type="number" min={0} value={soak.net} onChange={(e) => setSoak({ ...soak, net: Math.max(0, Number(e.target.value) || 0), rollId: null })} /></label>
              <label className="text-xs text-dim">Type<select className="field mt-1" value={soak.type} onChange={(e) => setSoak({ ...soak, type: e.target.value as "P" | "S" })}><option value="P">Physical</option><option value="S">Stun</option></select></label>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button className="btn small primary" onClick={() => { const r = rollPool("Damage Resistance (Body)", d.attrs.body, { noWound: true }); setSoak({ ...soak, rollId: r.id }); }}>Roll Body to soak</button>
              {soakResult && (
                <>
                  <span className="num text-sm text-dim">{soakResult.modified} − {soakEntry && soakEntry.kind === "roll" ? soakEntry.result.totalHits : 0} = <b className="text-fg">{soakResult.taken}</b> {soak.type === "P" ? "Physical" : "Stun"}</span>
                  <button className="btn small" onClick={() => { applyDamage(soakResult.taken, soak.type); setSoak({ ...soak, rollId: null }); }}>Apply</button>
                </>
              )}
            </div>
            <p className="mt-2 text-xs text-faint">Armor is already in your Defense Rating, so only Body is rolled. Stun spills into Physical and Physical spills into Overflow.</p>
          </Box>

          <Box title="Edge"><EdgeTracker c={c} d={d} upd={upd} /></Box>

          <Box title="Attributes">
            <dl className="grid grid-cols-4 gap-1.5 text-center">
              {ATTRIBUTES.map((a) => (
                <div key={a} className="border border-line py-1.5">
                  <dt className="text-[11px] text-faint">{ATTR_ABBR[a]}</dt>
                  <dd className="num text-xl font-semibold">{d.attrs[a]}</dd>
                  <dd className="num text-[10px] text-faint">max {d.attrMax[a]}</dd>
                </div>
              ))}
              <div className="border border-line py-1.5"><dt className="text-[11px] text-faint">EDG</dt><dd className="num text-xl font-semibold">{d.edge}</dd></div>
              <div className="border border-line py-1.5"><dt className="text-[11px] text-faint">ESS</dt><dd className="num text-xl font-semibold">{d.essence.toFixed(1)}</dd></div>
              {c.magicType !== "mundane" && <div className="border border-line py-1.5"><dt className="text-[11px] text-faint">{c.magicType === "technomancer" ? "RES" : "MAG"}</dt><dd className="num text-xl font-semibold">{c.magicType === "technomancer" ? d.resonance : d.magic}</dd></div>}
            </dl>
            <div className="mt-3 grid grid-cols-2 gap-1.5 text-sm">
              {[
                ["Defense Rating", d.defenseRating],
                ["Unarmed AR", d.unarmedAR],
                ["Walk / Sprint", `${d.movement.walk} / ${d.movement.sprint} m`],
                ["Armor worn", d.armor],
              ].map(([k, v]) => <div key={k as string} className="flex justify-between border-b border-line py-1"><span className="text-dim">{k}</span><b className="num">{v}</b></div>)}
            </div>
            <div className="no-print mt-3 flex flex-wrap gap-1.5">
              <button className="btn small" onClick={() => rollPool("Composure (Willpower + Charisma)", d.composure)}>Composure {d.composure}</button>
              <button className="btn small" onClick={() => rollPool("Judge Intentions (Willpower + Intuition)", d.judgeIntentions)}>Judge {d.judgeIntentions}</button>
              <button className="btn small" onClick={() => rollPool("Lift/Carry (Body + Willpower)", d.liftCarry)}>Lift {d.liftCarry}</button>
              <button className="btn small" onClick={() => rollPool("Memory (Logic + Intuition)", d.memory)}>Memory {d.memory}</button>
            </div>
          </Box>
        </div>

        {/* centre */}
        <div className="space-y-4">
          <Box title="Test builder" className="no-print">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-dim">Skill
                <select className="field mt-1" value={builder.skill} onChange={(e) => { const s = SKILL_BY_ID[e.target.value]; setBuilder({ skill: e.target.value, attr: s ? s.attr : builder.attr, spec: false }); }}>
                  <option value="">No skill (attribute only)</option>
                  {SKILLS.map((s) => <option key={s.id} value={s.id}>{s.name}{skillRank(s.id) ? ` ${skillRank(s.id)}` : ""}</option>)}
                </select>
              </label>
              <label className="text-xs text-dim">Attribute
                <select className="field mt-1" value={builder.attr} onChange={(e) => setBuilder({ ...builder, attr: e.target.value as AttrKey })}>
                  {ATTRIBUTES.map((a) => <option key={a} value={a}>{ATTR_LABEL[a]} {d.attrs[a]}</option>)}
                  {c.magicType !== "mundane" && c.magicType !== "technomancer" && <option value="magic">Magic {d.magic}</option>}
                  {c.magicType === "technomancer" && <option value="resonance">Resonance {d.resonance}</option>}
                </select>
              </label>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
              {poolBreakdown.canSpec && <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" className="accent-[var(--accent)]" checked={builder.spec} onChange={(e) => setBuilder({ ...builder, spec: e.target.checked })} /> {c.skills[builder.skill]?.spec} applies</label>}
              <label className="flex items-center gap-1.5 text-sm">Situation <input className="field num w-16" type="number" value={mod} onChange={(e) => setMod(Number(e.target.value) || 0)} aria-label="Situational dice modifier" /></label>
              <label className="flex items-center gap-1.5 text-sm" title="Costs 4 Edge: add your Edge rating as dice and let 6s explode"><input type="checkbox" className="accent-[var(--accent)]" checked={edgePre} disabled={c.edgeCurrent < 4} onChange={(e) => setEdgePre(e.target.checked)} /> Spend 4 Edge: +{d.edge} dice, 6s explode</label>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="num min-w-0 text-xs text-dim">{poolBreakdown.text}</p>
              <button className="btn primary shrink-0" onClick={() => rollPool(`${SKILL_BY_ID[builder.skill]?.name ?? "Attribute"} + ${ATTR_LABEL[builder.attr as keyof typeof ATTR_LABEL]}${builder.spec && poolBreakdown.canSpec ? ` (${c.skills[builder.skill]?.spec})` : ""}`, poolBreakdown.total + penalty - c.poolMod - mod)}>
                <Icon name="dice" size={16} /> Roll {poolBreakdown.total + (edgePre && c.edgeCurrent >= 4 ? d.edge : 0)}
              </button>
            </div>
          </Box>

          <Box title="Skills">
            {d.skills.length === 0 && <p className="text-sm text-dim">No skills yet.</p>}
            <ul className="divide-y divide-line">
              {d.skills.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <span className="font-display font-semibold">{s.name}</span> <span className="num text-sm text-dim">{s.rank}</span>
                    <span className="num ml-2 text-xs text-faint">+{ATTR_ABBR[s.attr as keyof typeof ATTR_ABBR]} {s.attrValue}</span>
                    {s.spec && <div className="text-xs text-dim">{s.spec} +2</div>}
                  </div>
                  <div className="no-print flex shrink-0 items-center gap-1.5">
                    <button className="btn small" onClick={() => rollPool(`${s.name} + ${ATTR_LABEL[s.attr as keyof typeof ATTR_LABEL]}`, s.pool)} title={`Pool ${poolOf(s.pool)} after modifiers`}>{poolOf(s.pool)}</button>
                    {s.specPool !== undefined && <button className="btn small" onClick={() => rollPool(`${s.name} + ${ATTR_LABEL[s.attr as keyof typeof ATTR_LABEL]} (${s.spec})`, s.specPool!)} title="With specialization">{poolOf(s.specPool)}*</button>}
                    <button className="btn small ghost" aria-label={`Load ${s.name} into the test builder`} onClick={() => setBuilder({ skill: s.id, attr: SKILL_BY_ID[s.id].attr, spec: false })}>…</button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-faint">Starred pools include the specialization. Untrained skills can be rolled from the test builder at attribute −1 where the book allows it.</p>
          </Box>

          {weapons.length > 0 && (
            <Box title="Weapons">
              <div className="no-print mb-3 flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-1.5">Range <select className="field w-28" value={target.range} onChange={(e) => setTarget({ ...target, range: Number(e.target.value) })}>{RANGES.map((r, i) => <option key={r} value={i}>{r}</option>)}</select></label>
                <label className="flex items-center gap-1.5">Target DR <input className="field num w-16" type="number" min={0} value={target.dr} onChange={(e) => setTarget({ ...target, dr: Math.max(0, Number(e.target.value) || 0) })} /></label>
              </div>
              <ul className="divide-y divide-line">
                {weapons.map((w) => {
                  const sk = w.skill ?? "firearms";
                  const rank = skillRank(sk);
                  const melee = sk === "close-combat";
                  const ar0 = w.ar?.[target.range];
                  const ar = ar0 == null ? null : ar0 + (melee ? d.attrs.strength : 0);
                  const base = (SKILL_BY_ID[sk] ? (rank > 0 ? rank : -1) : 0) + d.attrs[SKILL_BY_ID[sk]?.attr as AttrKey ?? "agility"];
                  const diff = ar == null ? 0 : ar - target.dr;
                  return (
                    <li key={w.id} className="py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-display font-semibold">{w.name}</div>
                          <div className="num text-xs text-dim">DV {w.dv || "?"} · AR {(w.ar ?? []).map((v) => (v == null ? "—" : v + (melee ? d.attrs.strength : 0))).join("/")}</div>
                          {ar == null ? <div className="text-xs text-danger">Cannot attack at {RANGES[target.range]} range.</div> : diff >= 4 ? <div className="text-xs text-ok">AR beats DR by {diff}: you gain 1 Edge.</div> : diff <= -4 ? <div className="text-xs text-danger">DR beats AR by {-diff}: the target gains 1 Edge.</div> : null}
                        </div>
                        <div className="no-print flex shrink-0 gap-1.5">
                          {diff >= 4 && <button className="btn small ghost" onClick={() => upd((x) => { x.edgeCurrent = Math.min(7, x.edgeCurrent + 1); })}>+1 Edge</button>}
                          <button className="btn small primary" disabled={ar == null} onClick={() => rollPool(`${w.name} (${SKILL_BY_ID[sk]?.name ?? "Attack"})`, Math.max(0, base))}>Attack {poolOf(base)}</button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Box>
          )}

        </div>

        {/* right */}
        <div className="space-y-4">
          <Box title="Latest roll" className="no-print">
            {last && last.kind === "roll" ? (
              <RollView result={last.result} who={who} edgeAvailable={c.edgeCurrent} onBoost={(cost) => upd((x) => { x.edgeCurrent = Math.max(0, x.edgeCurrent - cost); })} />
            ) : (
              <p className="text-sm text-dim">Roll something from this sheet and the dice land here, with Edge boosts that spend from your Edge pool.</p>
            )}
          </Box>

          <Box title="Initiative" right={<span className="num text-sm text-dim">{d.initiative.rank} + {d.initiative.dice}D6</span>}>
            <div className="no-print flex flex-wrap gap-2">
              <button className="btn small primary" onClick={() => doInitiative(`${who} initiative`, d.initiative.rank, d.initiative.dice, 0, who)}>Roll initiative</button>
              <button className="btn small" disabled={c.edgeCurrent < 1} onClick={() => { upd((x) => { x.edgeCurrent -= 1; }); doInitiative(`${who} initiative (+3 Edge)`, d.initiative.rank, d.initiative.dice, 3, who); }}>Roll with +3 (1 Edge)</button>
              {awakened && <button className="btn small" onClick={() => doInitiative(`${who} astral initiative`, d.initiative.astralRank, d.initiative.astralDice, 0, who)}>Astral {d.initiative.astralRank} + {d.initiative.astralDice}D6</button>}
            </div>
            <p className="mt-2 text-xs text-faint">Wound modifiers do not change initiative dice; add any status adjustments by hand.</p>
          </Box>

          <Box title="Statuses" className="no-print">
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => {
                const on = c.statuses.includes(s);
                return <button key={s} className={clsx("chip", on && "on")} aria-pressed={on} title={statusDesc(s)} onClick={() => upd((x) => { x.statuses = on ? x.statuses.filter((y) => y !== s) : [...x.statuses, s]; })}>{s}</button>;
              })}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">Sheet dice modifier
              <input className="field num w-16" type="number" value={c.poolMod} onChange={(e) => upd((x) => { x.poolMod = Number(e.target.value) || 0; })} />
              <span className="text-xs text-faint">added to every pool until you clear it</span>
            </label>
          </Box>

          <Box title="Karma and nuyen" className="no-print">
            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <div className="border border-line py-1.5"><div className="text-[11px] text-faint">Available</div><div className="num text-xl font-semibold">{karmaAvail}</div></div>
              <div className="border border-line py-1.5"><div className="text-[11px] text-faint">Earned</div><div className="num text-xl font-semibold">{c.karmaEarned}</div></div>
              <div className="border border-line py-1.5"><div className="text-[11px] text-faint">Nuyen</div><div className="num text-xl font-semibold">{c.nuyen.toLocaleString("en-US")}</div></div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[1, 3, 5].map((n) => <button key={n} className="btn small" onClick={() => upd((x) => { x.karmaEarned += n; })}>+{n} Karma</button>)}
              <button className="btn small" onClick={() => { const v = Number(prompt("Nuyen change (negative to spend)", "0")); if (v) upd((x) => { x.nuyen = Math.max(0, x.nuyen + v); }); }}>± Nuyen</button>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer font-display text-sm text-dim">Advance the runner</summary>
              <div className="mt-2 space-y-3 text-sm">
                <div>
                  <div className="mb-1 text-xs text-faint">Skills (5 × new rank)</div>
                  <ul className="space-y-1">
                    {SKILLS.filter((s) => (c.skills[s.id] || s.untrained)).map((s) => {
                      const r = skillRank(s.id); const cost = KARMA.skillRank(r + 1);
                      return <li key={s.id} className="flex items-center justify-between"><span>{s.name} <span className="num text-dim">{r} → {r + 1}</span></span>
                        <button className="btn small" disabled={karmaAvail < cost || r >= maxSkill(s.id)} onClick={() => spend(cost, (x) => { const e = x.skills[s.id] ?? { pts: 0, kar: 0 }; e.kar += 1; x.skills[s.id] = e; })}>{cost} Karma</button></li>;
                    })}
                  </ul>
                </div>
                <div>
                  <div className="mb-1 text-xs text-faint">Attributes (5 × new rank)</div>
                  <ul className="space-y-1">
                    {ATTRIBUTES.map((a) => {
                      const r = d.attrs[a]; const cost = KARMA.attributeRank(r + 1);
                      return <li key={a} className="flex items-center justify-between"><span>{ATTR_LABEL[a]} <span className="num text-dim">{r} → {r + 1}</span></span>
                        <button className="btn small" disabled={karmaAvail < cost || r >= d.attrMax[a]} onClick={() => spend(cost, (x) => { x.attrKar[a] = (x.attrKar[a] ?? 0) + 1; })}>{cost} Karma</button></li>;
                    })}
                    <li className="flex items-center justify-between"><span>Edge <span className="num text-dim">{d.edge} → {d.edge + 1}</span></span>
                      <button className="btn small" disabled={karmaAvail < KARMA.attributeRank(d.edge + 1) || d.edge >= meta.ranges.edge[1]} onClick={() => spend(KARMA.attributeRank(d.edge + 1), (x) => { x.karEdge += 1; })}>{KARMA.attributeRank(d.edge + 1)} Karma</button></li>
                  </ul>
                </div>
                <div>
                  <div className="mb-1 text-xs text-faint">Specializations ({KARMA.specialization} Karma each)</div>
                  <ul className="space-y-1">
                    {Object.entries(c.skills).filter(([, e]) => e.pts + e.kar > 0 && !e.spec).map(([sid]) => {
                      const def = SKILL_BY_ID[sid];
                      return def?.specs.length ? (
                        <li key={sid}><select className="field" aria-label={`${def.name} specialization`} value="" disabled={karmaAvail < KARMA.specialization} onChange={(e) => e.target.value && spend(KARMA.specialization, (x) => { x.skills[sid].spec = e.target.value; x.skills[sid].specVia = "karma"; })}><option value="">{def.name}: choose</option>{def.specs.map((sp) => <option key={sp}>{sp}</option>)}</select></li>
                      ) : null;
                    })}
                  </ul>
                </div>
                {awakened && (
                  <div className="flex gap-2">
                    <input className="field" placeholder="New spell (5 Karma)" value={newSpell} onChange={(e) => setNewSpell(e.target.value)} aria-label="New spell name" />
                    <button className="btn" disabled={!newSpell.trim() || karmaAvail < KARMA.spell} onClick={() => { spend(KARMA.spell, (x) => { x.spells.push(newSpell.trim()); }); setNewSpell(""); }}>Learn</button>
                  </div>
                )}
              </div>
            </details>
          </Box>

          <Box title="Qualities and gear">
            <ul className="mb-3 text-sm">
              {c.qualities.map((q, i) => <li key={i}>{q.name}{q.level > 1 ? ` ${q.level}` : ""}{q.note ? ` (${SKILL_BY_ID[q.note]?.name ?? q.note})` : ""}<span className={clsx("ml-1 text-xs", q.kind === "negative" ? "text-cyan" : "text-faint")}>{q.kind === "negative" ? "negative" : ""}</span>{q.effect && <span className="ml-1 text-xs text-ok">auto</span>}</li>)}
              {meta.racial.map((r) => <li key={r} className="text-dim">{r} <span className="text-xs text-faint">racial</span></li>)}
            </ul>
            <ul className="divide-y divide-line text-sm">
              {c.gear.map((g) => <li key={g.id} className="flex justify-between py-1"><span>{g.name}{g.qty > 1 ? ` ×${g.qty}` : ""}</span><span className="num text-xs text-dim">{g.armor ? `Armor ${g.armor}` : g.dv ? `DV ${g.dv}` : g.essence ? `Ess ${g.essence}` : ""}</span></li>)}
              {c.gear.length === 0 && <li className="py-1 text-dim">No gear recorded.</li>}
            </ul>
            <p className="mt-2 text-xs text-dim">Lifestyle: {LIFESTYLES.find((l) => l.id === c.lifestyle)?.name}{c.lifestyleMonths ? `, ${c.lifestyleMonths} month${c.lifestyleMonths === 1 ? "" : "s"} prepaid` : ""}</p>
            {c.knowledge.length > 0 && <p className="mt-1 text-xs text-dim">Knowledge: {c.knowledge.map((k) => k.name).join(", ")}</p>}
          </Box>

          {c.contacts.length > 0 && (
            <Box title="Contacts">
              <ul className="divide-y divide-line text-sm">{c.contacts.map((k) => <li key={k.id} className="flex justify-between py-1"><span><b className="font-display">{k.name}</b> <span className="text-dim">{k.role}</span></span><span className="num text-dim">C{k.connection} / L{k.loyalty}</span></li>)}</ul>
            </Box>
          )}

          <Box title="Notes">
            <textarea className="field min-h-32" value={notes} aria-label="Notes" onChange={(e) => { const v = e.target.value; setNotes(v); if (notesTimer.current) clearTimeout(notesTimer.current); notesTimer.current = setTimeout(() => upd((x) => { x.notes = v; }), 500); }} placeholder="Session notes, heat, favours owed..." />
          </Box>
        </div>
      </div>
    </div>
  );
}
