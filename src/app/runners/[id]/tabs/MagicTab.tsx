"use client";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { doInitiative } from "@/lib/actions";
import { useRulebook } from "@/lib/store/rulebook";
import { spellList } from "@/lib/sr6/bookLists";
import { ATTR_LABEL, KARMA, type AttrKey } from "@/lib/sr6/data";
import { SPELLS, SPIRITS, SPIRIT_ATTR_LABELS, SPIRIT_FORCE_CAP, type SpellDef } from "@/lib/sr6/rules6";
import {
  FOCUS_KINDS, SUSTAIN_PENALTY, adjustCap, drainValue, editExt, findSpell, getExt, nextPendingId, rollHits, spellDamage, spiritBlock, spiritType, sustainPenalty, xid,
} from "@/lib/sr6/ext";
import { Box, Empty, Stat, Stepper } from "./ui";
import { basePool, type SheetCtx } from "./ctx";
import { ResistPrompt, type Pending } from "./Resist";

const DRAIN_ATTRS: AttrKey[] = ["logic", "charisma", "intuition", "willpower"];
const QUICK: { id: string; name: string; skill: string; attr: string }[] = [
  { id: "counter", name: "Counterspelling", skill: "sorcery", attr: "magic" },
  { id: "astral", name: "Astral perception", skill: "astral", attr: "intuition" },
  { id: "alchemy", name: "Alchemy", skill: "enchanting", attr: "magic" },
  { id: "artifice", name: "Artificing", skill: "enchanting", attr: "magic" },
  { id: "disench", name: "Disenchanting", skill: "enchanting", attr: "magic" },
  { id: "ritual", name: "Ritual spellcasting", skill: "sorcery", attr: "magic" },
];
const ABBR = ["BOD", "AGI", "REA", "STR", "WIL", "LOG", "INT", "CHA"];
const KIND_LABEL = { direct: "direct", indirect: "indirect" } as const;

interface CastResult { id: number; name: string; spell: SpellDef | undefined; hits: number; amp: number; theirs: number }

export function MagicTab({ ctx }: { ctx: SheetCtx }) {
  const { c, d, upd, who } = ctx;
  const book = useRulebook((s) => s.book);
  const e = getExt(c);
  const [amp, setAmp] = useState(0);
  const [area, setArea] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const [cast, setCast] = useState<CastResult | null>(null);
  const [newSpell, setNewSpell] = useState("");
  const [spirit, setSpirit] = useState({ type: "air", force: Math.max(1, d.magic) });
  const [conj, setConj] = useState<{ id: number; type: string; force: number; mine: number; theirs: number } | null>(null);
  const [focus, setFocus] = useState({ name: "", kind: "Power", rating: 1 });
  const karmaAvail = c.karmaEarned - c.karmaSpent;
  const sorcery = basePool(c, d, "sorcery", "magic");
  const conjuring = basePool(c, d, "conjuring", "magic");
  const tradAttr = (c.tradition as AttrKey) || "logic";
  const tradVal = d.attrs[tradAttr] ?? 0;
  const drainBase = d.attrs.willpower + tradVal;
  const sustain = sustainPenalty(e);
  const cap = adjustCap(d.magic, c.skills.sorcery ? c.skills.sorcery.pts + c.skills.sorcery.kar : 0);
  const used = amp + area;
  const suggestions = useMemo(() => {
    const names = new Set<string>(SPELLS.map((s) => s.name));
    for (const s of spellList(book)) names.add(s.name);
    return [...names].filter((n) => !c.spells.includes(n)).sort();
  }, [book, c.spells]);
  const ppUsed = c.adeptPowers.reduce((s, p) => s + p.cost, 0);
  const adept = c.magicType === "adept" || c.magicType === "mystic";
  const bonded = e.foci.filter((f) => f.bonded).length;
  const forceTotal = e.spirits.reduce((s, x) => s + x.force, 0);
  const forceCap = d.magic * SPIRIT_FORCE_CAP;

  const baseDv = (sp: string, def: SpellDef | undefined) => def?.dv ?? e.dv[sp.toLowerCase()] ?? null;
  const adjFor = (def: SpellDef | undefined) => ({ amp: def?.kind ? amp : 0, area: def?.area ? area : 0 });
  const toggleSustain = (name: string) => upd((x) => editExt(x, (ex) => { ex.sustained = ex.sustained.includes(name) ? ex.sustained.filter((s) => s !== name) : [...ex.sustained, name]; }));

  const drainPrompt = (title: string, dv: number, note?: string): Pending => ({
    id: nextPendingId(), title, dv, type: "auto", physicalAbove: d.magic, poolLabel: `Willpower + ${ATTR_LABEL[tradAttr]}`, base: drainBase,
    note: note ?? "Drain is Stun, or Physical when what gets through is higher than your Magic.",
  });

  const doCast = (sp: string) => {
    const def = findSpell(sp);
    const adj = adjFor(def);
    const dv = drainValue(baseDv(sp, def) ?? 3, adj);
    const r = ctx.rollPool(`Cast ${sp}`, sorcery.base);
    if (def?.kind) setCast({ id: nextPendingId(), name: sp, spell: def, hits: r.totalHits, amp: adj.amp, theirs: 0 });
    else setCast(null);
    setPending(drainPrompt(`Drain from ${sp}`, dv, `${r.totalHits} hit${r.totalHits === 1 ? "" : "s"} on the cast. ${drainBase ? "" : ""}Drain DV ${dv}${adj.amp || adj.area ? ` (amp ${adj.amp}, area ${adj.area})` : ""}.`));
  };

  const summon = () => {
    const r = ctx.rollPool(`Summon ${spiritType(spirit.type)?.name ?? spirit.type} spirit, Force ${spirit.force} (Conjuring + Magic)`, conjuring.base);
    setConj({ id: nextPendingId(), type: spirit.type, force: spirit.force, mine: r.totalHits, theirs: rollHits(spirit.force * 2) });
    setPending(null);
  };
  const keepSpirit = () => {
    if (!conj) return;
    const net = conj.mine - conj.theirs;
    upd((x) => editExt(x, (ex) => { ex.spirits.push({ id: xid("sp"), type: conj.type, force: conj.force, services: Math.max(1, net), bound: false, damage: 0, note: "" }); }));
    setPending(drainPrompt("Drain from summoning", conj.theirs, "The spirit's hits are the drain, not net hits. If it knocks you out the spirit leaves."));
    setConj(null);
  };
  const banish = (id: string) => {
    const s = e.spirits.find((q) => q.id === id);
    if (!s) return;
    const r = ctx.rollPool(`Banish ${s.type} spirit, Force ${s.force} (Conjuring + Magic)`, conjuring.base);
    const theirs = rollHits(s.force * 2);
    const net = r.totalHits - theirs;
    if (net > 0) upd((x) => editExt(x, (ex) => { const t = ex.spirits.find((q) => q.id === id); if (t) { t.services -= net; if (t.services <= 0) ex.spirits = ex.spirits.filter((q) => q.id !== id); } }));
    setPending(drainPrompt(`Drain from banishing (${net > 0 ? `${net} service${net === 1 ? "" : "s"} gone` : "it holds"})`, theirs * 2, `You ${r.totalHits}, spirit ${theirs} on ${s.force * 2} dice. Drain is twice the spirit's hits.`));
  };
  const setSpirit_ = (id: string, fn: (t: (typeof e.spirits)[number]) => void) => upd((x) => editExt(x, (ex) => { const t = ex.spirits.find((q) => q.id === id); if (t) fn(t); }));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
      <div className="space-y-4">
        <Box title="Spellcasting" right={<span className="num text-xs text-dim">{c.spells.length} / {d.slots.spells || "—"} spells</span>}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Magic" value={d.magic} tone="accent" />
            <Stat label="Attack rating" value={d.magic + tradVal} sub={`Magic + ${ATTR_LABEL[tradAttr]}`} />
            <Stat label="Adjustments" value={`${used} / ${cap}`} sub="Amp Up + Area" tone={used > cap ? "danger" : undefined} />
            <Stat label="Sustaining" value={e.sustained.length ? `−${sustain}` : "—"} sub={e.sustained.length ? `${e.sustained.length} running` : "no penalty"} tone={e.sustained.length ? "danger" : undefined} />
          </div>
          <div className="no-print mt-3 flex flex-wrap items-end gap-4">
            <label className="text-xs text-dim">Amp Up<div className="mt-1"><Stepper label="Amp Up" value={amp} min={0} max={Math.max(0, cap - area)} onChange={setAmp} /></div></label>
            <label className="text-xs text-dim">Increase Area<div className="mt-1"><Stepper label="Increase Area" value={area} min={0} max={Math.max(0, cap - amp)} onChange={setArea} /></div></label>
            <label className="text-xs text-dim">Drain attribute
              <select className="field mt-1 !w-32" value={c.tradition} onChange={(ev) => upd((x) => { x.tradition = ev.target.value; })}>
                {DRAIN_ATTRS.map((a) => <option key={a} value={a}>{ATTR_LABEL[a]}</option>)}
              </select>
            </label>
            <button className="btn small" onClick={() => setPending(drainPrompt("Drain", 3))}>Resist drain by hand</button>
          </div>
          <p className="mt-1 text-xs text-faint">Amp Up adds 1 damage to a combat spell for 2 more drain. Increase Area widens an area spell by 2 m for 1 more drain. Adjustments are capped by the higher of Magic and Sorcery.</p>
          {pending && <div className="mt-3"><ResistPrompt key={pending.id} ctx={ctx} p={pending} onClose={() => setPending(null)} /></div>}
          {cast && cast.spell?.kind && <CastDamage key={cast.id} cast={cast} magic={d.magic} onClose={() => setCast(null)} />}
          <ul className="mt-3 divide-y divide-line">
            {c.spells.map((sp) => {
              const def = findSpell(sp);
              const on = e.sustained.includes(sp);
              const base = baseDv(sp, def);
              const adj = adjFor(def);
              const dv = base !== null ? drainValue(base, adj) : null;
              return (
                <li key={sp} className="py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="font-display font-semibold">{sp}</span>
                      {def && <span className="ml-2 text-xs text-dim">{def.cat}{def.kind ? `, ${KIND_LABEL[def.kind]}` : ""} · {def.range} · {def.type === "M" ? "mana" : "physical"} · {def.dur === "I" ? "instant" : def.dur === "S" ? "sustained" : def.dur === "L" ? "limited" : "permanent"}</span>}
                    </div>
                    {dv !== null ? (
                      <span className="num text-xs text-dim">DV {dv}{def?.dmg ? ` · ${def.dmg}` : ""}</span>
                    ) : (
                      <input className="field num no-print !min-h-0 !w-16 !py-0.5 text-xs" type="number" min={0} placeholder="DV" aria-label={`${sp} drain value`} value={e.dv[sp.toLowerCase()] ?? ""} onChange={(ev) => upd((x) => editExt(x, (ex) => { ex.dv[sp.toLowerCase()] = Math.max(0, Math.floor(Number(ev.target.value) || 0)); }))} />
                    )}
                    <div className="no-print flex gap-1.5">
                      <button className="btn small primary" disabled={sorcery.blocked} onClick={() => doCast(sp)}><Icon name="spark" size={13} /> Cast {ctx.poolOf(sorcery.base)}</button>
                      {(!def || def.dur !== "I") && <button className={clsx("btn small", on && "primary")} aria-pressed={on} title={`Sustaining costs ${SUSTAIN_PENALTY} dice on every test`} onClick={() => toggleSustain(sp)}>{on ? "Sustained" : "Sustain"}</button>}
                      <button className="btn small ghost" aria-label={`Forget ${sp}`} onClick={() => upd((x) => { x.spells = x.spells.filter((s) => s !== sp); editExt(x, (ex) => { ex.sustained = ex.sustained.filter((s) => s !== sp); }); })}>×</button>
                    </div>
                  </div>
                </li>
              );
            })}
            {c.spells.length === 0 && <li className="py-2"><Empty>No spells yet. Learn one below.</Empty></li>}
          </ul>
          <form className="no-print mt-3 flex gap-2" onSubmit={(ev) => { ev.preventDefault(); const n = newSpell.trim(); if (!n || karmaAvail < KARMA.spell) return; upd((x) => { x.karmaSpent += KARMA.spell; x.spells.push(n); }); setNewSpell(""); }}>
            <input className="field flex-1" list="spell-names" value={newSpell} onChange={(ev) => setNewSpell(ev.target.value)} placeholder={`Learn a spell (${KARMA.spell} Karma)`} aria-label="New spell name" />
            <datalist id="spell-names">{suggestions.slice(0, 250).map((n) => <option key={n} value={n} />)}</datalist>
            <button className="btn small" disabled={!newSpell.trim() || karmaAvail < KARMA.spell}>Learn</button>
          </form>
          <p className="mt-2 text-xs text-faint">Casting is Sorcery + Magic. Each sustained spell costs 2 dice on every test. Spells whose drain is not in the table (Animate and Shape, for one) take a value you type in.</p>
        </Box>

        <Box title="Spirits" right={<span className={clsx("num text-xs", forceTotal > forceCap ? "text-danger" : "text-dim")}>Force {forceTotal} / {forceCap}</span>}>
          <div className="no-print mb-3 flex flex-wrap items-center gap-2">
            <select className="field !w-28" aria-label="Spirit type" value={spirit.type} onChange={(ev) => setSpirit({ ...spirit, type: ev.target.value })}>{SPIRITS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <Stepper label="Force" value={spirit.force} min={1} max={Math.max(1, d.magic * 2)} onChange={(n) => setSpirit({ ...spirit, force: n })} />
            <button className="btn small primary" disabled={conjuring.blocked} onClick={summon}>Summon {ctx.poolOf(conjuring.base)}</button>
            <span className="text-xs text-dim">Conjuring + Magic vs Force × 2</span>
          </div>
          {conj && (
            <div className="mb-3 border border-accent/50 bg-accent/5 p-3 text-sm" role="status">
              You rolled <b className="num">{conj.mine}</b>, the spirit <b className="num">{conj.theirs}</b> on {conj.force * 2} dice.{" "}
              {conj.mine > conj.theirs ? <>It comes with <b>{conj.mine - conj.theirs}</b> service{conj.mine - conj.theirs === 1 ? "" : "s"}.</> : <>It does not come.</>}
              <span className="ml-2 inline-flex gap-1.5">
                {conj.mine > conj.theirs
                  ? <button className="btn small primary" onClick={keepSpirit}>Keep spirit, resist {conj.theirs} drain</button>
                  : <button className="btn small" onClick={() => { setPending(drainPrompt("Drain from summoning", conj.theirs)); setConj(null); }}>Resist {conj.theirs} drain</button>}
                <button className="btn ghost small" onClick={() => setConj(null)}>Dismiss</button>
              </span>
            </div>
          )}
          <ul className="divide-y divide-line text-sm">
            {e.spirits.map((s) => {
              const t = spiritType(s.type);
              const b = t ? spiritBlock(t, s.force) : null;
              return (
                <li key={s.id} className="py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="font-display">{t?.name ?? s.type} spirit</b>
                    <span className="text-xs text-dim">Force</span><Stepper label={`${s.type} force`} value={s.force} min={1} max={24} onChange={(n) => setSpirit_(s.id, (q) => { q.force = n; })} />
                    <span className="text-xs text-dim">services</span><Stepper label={`${s.type} services`} value={s.services} min={0} max={24} onChange={(n) => setSpirit_(s.id, (q) => { q.services = n; })} />
                    <div className="no-print ml-auto flex gap-1.5">
                      <button className="btn small" disabled={conjuring.blocked} onClick={() => banish(s.id)}>Banish</button>
                      <button className="btn ghost small" aria-label="Dismiss spirit" onClick={() => upd((x) => editExt(x, (ex) => { ex.spirits = ex.spirits.filter((q) => q.id !== s.id); }))}>×</button>
                    </div>
                  </div>
                  {b && t && (
                    <div className="num mt-1 text-xs text-dim">
                      {SPIRIT_ATTR_LABELS.map((l, i) => <span key={l} className="mr-2">{ABBR[i]} {b.attrs[i]}</span>)}
                      <div>Init {b.init}+{b.initDice}D6 · Astral {b.astralInit}+3D6 · DR {b.defense} · AR {b.attackRating} · Monitor {b.boxes} · {b.attack.name} {b.attack.dv}{b.attack.dmg}</div>
                      <div className="text-faint">{b.powers}</div>
                    </div>
                  )}
                </li>
              );
            })}
            {e.spirits.length === 0 && <li className="py-1.5 text-dim">No spirits under your command.</li>}
          </ul>
          <p className="mt-2 text-xs text-faint">Net hits are services. Drain from summoning is the spirit&apos;s hits; from banishing, twice its hits. Active spirits can total at most Magic × 3 Force. A summoned spirit leaves after one sunrise and one sunset.</p>
        </Box>
      </div>

      <div className="space-y-4">
        <Box title="Astral and enchanting">
          <div className="no-print mb-3 flex flex-wrap gap-2">
            <button className="btn small primary" onClick={() => doInitiative(`${who} astral initiative`, d.initiative.astralRank, d.initiative.astralDice, 0, who)}>Astral initiative {d.initiative.astralRank} + {d.initiative.astralDice}D6</button>
          </div>
          <ul className="divide-y divide-line">
            {QUICK.map((q) => {
              const b = basePool(c, d, q.skill, q.attr);
              return (
                <li key={q.id} className="flex items-center justify-between gap-2 py-1.5">
                  <div><div className="font-display font-semibold">{q.name}</div><div className="num text-xs text-dim">{b.parts}</div></div>
                  <button className="no-print btn small" disabled={b.blocked} onClick={() => ctx.rollPool(q.name, b.base)}>Roll {ctx.poolOf(b.base)}</button>
                </li>
              );
            })}
          </ul>
        </Box>

        <Box title="Foci" right={<span className="num text-xs text-dim">{bonded} bonded · Magic {d.magic}</span>}>
          <ul className="divide-y divide-line text-sm">
            {e.foci.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2 py-1.5">
                <span className="flex-1"><b className="font-display">{f.name}</b> <span className="text-xs text-dim">{f.kind} focus, rating {f.rating}</span></span>
                <button className={clsx("btn small", f.bonded && "primary")} aria-pressed={f.bonded} onClick={() => upd((x) => editExt(x, (ex) => { const t = ex.foci.find((q) => q.id === f.id); if (t) { t.bonded = !t.bonded; if (!t.bonded) t.active = false; } }))}>{f.bonded ? "Bonded" : "Bond"}</button>
                <button className={clsx("btn small", f.active && "primary")} disabled={!f.bonded} aria-pressed={f.active} onClick={() => upd((x) => editExt(x, (ex) => { const t = ex.foci.find((q) => q.id === f.id); if (t) t.active = !t.active; }))}>{f.active ? "Active" : "Inactive"}</button>
                <button className="btn ghost small" aria-label={`Remove ${f.name}`} onClick={() => upd((x) => editExt(x, (ex) => { ex.foci = ex.foci.filter((q) => q.id !== f.id); }))}>×</button>
              </li>
            ))}
            {e.foci.length === 0 && <li className="py-1.5 text-dim">No foci.</li>}
          </ul>
          <form className="no-print mt-2 grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_auto_auto_auto]" onSubmit={(ev) => { ev.preventDefault(); if (!focus.name.trim()) return; upd((x) => editExt(x, (ex) => { ex.foci.push({ id: xid("f"), name: focus.name.trim(), kind: focus.kind, rating: focus.rating, bonded: false, active: false }); })); setFocus({ ...focus, name: "" }); }}>
            <input className="field col-span-2 sm:col-span-1" value={focus.name} onChange={(ev) => setFocus({ ...focus, name: ev.target.value })} placeholder="Focus name" aria-label="Focus name" />
            <select className="field" aria-label="Focus kind" value={focus.kind} onChange={(ev) => setFocus({ ...focus, kind: ev.target.value })}>{FOCUS_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
            <Stepper label="Focus rating" value={focus.rating} min={1} max={9} onChange={(n) => setFocus({ ...focus, rating: n })} />
            <button className="btn small">Add</button>
          </form>
        </Box>

        {adept && (
          <Box title="Adept powers" right={<span className="num text-xs text-dim">{ppUsed.toFixed(2).replace(/\.?0+$/, "")} / {d.slots.powerPoints} PP</span>}>
            <ul className="divide-y divide-line text-sm">
              {c.adeptPowers.map((p, i) => (
                <li key={i} className="flex items-center justify-between py-1.5">
                  <span>{p.name}{p.level && p.level > 1 ? ` ${p.level}` : ""} {p.effect && <span className="text-xs text-ok">auto</span>}</span>
                  <span className="flex items-center gap-2"><span className="num text-xs text-dim">{p.cost} PP</span>
                    <button className="btn ghost small" aria-label={`Remove ${p.name}`} onClick={() => upd((x) => { x.adeptPowers.splice(i, 1); })}>×</button></span>
                </li>
              ))}
              {c.adeptPowers.length === 0 && <li className="py-1.5 text-dim">No powers yet. Add them in the Forge.</li>}
            </ul>
            {ppUsed > d.slots.powerPoints && <p className="mt-2 text-sm text-danger">You have spent more Power Points than your Magic allows.</p>}
          </Box>
        )}
      </div>
    </div>
  );
}

/** After a combat spell: enter the target's hits and see the damage. */
function CastDamage({ cast, magic, onClose }: { cast: CastResult; magic: number; onClose: () => void }) {
  const [theirs, setTheirs] = useState(0);
  const def = cast.spell!;
  const net = Math.max(0, cast.hits - theirs);
  const dmg = spellDamage(def.kind!, magic, net, cast.amp);
  return (
    <div className="no-print mt-3 flex flex-wrap items-end gap-3 border border-line bg-bg-2/60 p-3 text-sm">
      <div>
        <b className="font-display">{cast.name}</b> <span className="text-xs text-dim">{def.kind} · you rolled {cast.hits}</span>
        <div className="text-xs text-dim">Target rolls {def.kind === "direct" ? "Willpower + Intuition" : "Reaction + Willpower"}</div>
      </div>
      <label className="block text-xs text-dim">Target hits
        <input className="field num mt-1 !w-20" type="number" min={0} value={theirs} onChange={(ev) => setTheirs(Math.max(0, Math.floor(Number(ev.target.value) || 0)))} />
      </label>
      <div className="num">
        net {net} → <b className="text-accent">{dmg}{def.dmg ?? "P"}</b> damage
        <div className="text-xs text-dim">{def.kind === "direct" ? "Direct: not resisted." : `Indirect: ${Math.ceil(magic / 2)} base + net hits${cast.amp ? ` + ${cast.amp} amp` : ""}. The target resists with Body.`}</div>
      </div>
      <button className="btn ghost small ml-auto" onClick={onClose}>Done</button>
    </div>
  );
}
