"use client";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { doInitiative } from "@/lib/actions";
import { useRulebook } from "@/lib/store/rulebook";
import { spellList } from "@/lib/sr6/bookLists";
import { ATTR_LABEL, KARMA, type AttrKey } from "@/lib/sr6/data";
import { FOCUS_KINDS, SPIRIT_TYPES, nextPendingId, SUSTAIN_PENALTY, drainIsPhysical, editExt, evalFormula, getExt, sustainPenalty, xid } from "@/lib/sr6/ext";
import { Box, Empty, Stat, Stepper } from "./ui";
import { basePool, type SheetCtx } from "./ctx";
import { ResistPrompt, type Pending } from "./Resist";

const DRAIN_ATTRS: AttrKey[] = ["logic", "charisma", "intuition", "willpower"];
const QUICK: { id: string; name: string; skill: string; attr: string; note: string }[] = [
  { id: "counter", name: "Counterspell", skill: "sorcery", attr: "magic", note: "Sorcery + Magic, defends allies against a spell" },
  { id: "astral", name: "Astral perception", skill: "astral", attr: "intuition", note: "Astral + Intuition" },
  { id: "alchemy", name: "Alchemy", skill: "enchanting", attr: "magic", note: "Enchanting + Magic" },
  { id: "artifice", name: "Artificing", skill: "enchanting", attr: "magic", note: "Enchanting + Magic" },
  { id: "disench", name: "Disenchanting", skill: "enchanting", attr: "magic", note: "Enchanting + Magic" },
  { id: "ritual", name: "Ritual spellcasting", skill: "sorcery", attr: "magic", note: "Sorcery + Magic, needs a team and time" },
];

export function MagicTab({ ctx }: { ctx: SheetCtx }) {
  const { c, d, upd, who } = ctx;
  const book = useRulebook((s) => s.book);
  const e = getExt(c);
  const [force, setForce] = useState(Math.max(1, d.magic));
  const [pending, setPending] = useState<Pending | null>(null);
  const [newSpell, setNewSpell] = useState("");
  const [spirit, setSpirit] = useState({ type: "Air", force: Math.max(1, d.magic) });
  const [focus, setFocus] = useState({ name: "", kind: "Power", rating: 1 });
  const karmaAvail = c.karmaEarned - c.karmaSpent;
  const sorcery = basePool(c, d, "sorcery", "magic");
  const conjuring = basePool(c, d, "conjuring", "magic");
  const tradAttr = (c.tradition as AttrKey) || "logic";
  const sustain = sustainPenalty(e);
  const suggestions = useMemo(() => spellList(book).map((s) => s.name).filter((n) => !c.spells.includes(n)), [book, c.spells]);
  const ppUsed = c.adeptPowers.reduce((s, p) => s + p.cost, 0);
  const adept = c.magicType === "adept" || c.magicType === "mystic";
  const bonded = e.foci.filter((f) => f.bonded).length;

  const cast = (sp: string) => {
    ctx.rollPool(`Cast ${sp} (Force ${force})`, sorcery.base, { limit: force });
    setPending({ id: nextPendingId(), kind: "Drain", label: `${sp} at Force ${force}`, dv: evalFormula(e.formulas[sp] ?? "", force), physical: drainIsPhysical(force, d.magic), attr: tradAttr });
  };
  const toggleSustain = (sp: string) => upd((x) => editExt(x, (ex) => { ex.sustained = ex.sustained.includes(sp) ? ex.sustained.filter((s) => s !== sp) : [...ex.sustained, sp]; }));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
      <div className="space-y-4">
        <Box title="Spellcasting" right={<span className="num text-xs text-dim">{c.spells.length} / {d.slots.spells || "—"} spells</span>}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Magic" value={d.magic} tone="accent" />
            <Stat label="Force limit" value={force} sub="hits capped here" />
            <Stat label="Drain type" value={drainIsPhysical(force, d.magic) ? "Physical" : "Stun"} tone={drainIsPhysical(force, d.magic) ? "danger" : "cyan"} sub={drainIsPhysical(force, d.magic) ? "Force above Magic" : "Force within Magic"} />
            <Stat label="Sustaining" value={e.sustained.length ? `−${sustain}` : "—"} sub={e.sustained.length ? `${e.sustained.length} spell${e.sustained.length > 1 ? "s" : ""}` : "no penalty"} tone={e.sustained.length ? "danger" : undefined} />
          </div>
          <div className="no-print mt-3 flex flex-wrap items-end gap-4">
            <label className="text-xs text-dim">Force<div className="mt-1"><Stepper label="Force" value={force} min={1} max={Math.max(6, d.magic * 2)} onChange={setForce} /></div></label>
            <label className="text-xs text-dim">Drain attribute
              <select className="field mt-1 !w-32" value={c.tradition} onChange={(ev) => upd((x) => { x.tradition = ev.target.value; })}>
                {DRAIN_ATTRS.map((a) => <option key={a} value={a}>{ATTR_LABEL[a]}</option>)}
              </select>
            </label>
            <button className="btn small" onClick={() => setPending({ id: nextPendingId(), kind: "Drain", label: "a spell", dv: null, physical: drainIsPhysical(force, d.magic), attr: tradAttr })}>Resist drain by hand</button>
          </div>
          {pending && <div className="mt-3"><ResistPrompt key={pending.id} ctx={ctx} p={pending} onClose={() => setPending(null)} /></div>}
          <ul className="mt-3 divide-y divide-line">
            {c.spells.map((sp) => {
              const f = e.formulas[sp] ?? "";
              const dv = evalFormula(f, force);
              const on = e.sustained.includes(sp);
              return (
                <li key={sp} className="py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display flex-1 font-semibold">{sp}</span>
                    <input className="field num !min-h-0 !w-24 !py-0.5 text-xs" value={f} placeholder="Drain F/2" aria-label={`${sp} drain formula`} onChange={(ev) => upd((x) => editExt(x, (ex) => { ex.formulas[sp] = ev.target.value; }))} />
                    <span className="num w-14 text-right text-xs text-dim">{dv !== null ? `DV ${dv}` : "no DV"}</span>
                    <div className="no-print flex gap-1.5">
                      <button className="btn small primary" disabled={sorcery.blocked} onClick={() => cast(sp)}><Icon name="spark" size={13} /> Cast {ctx.poolOf(sorcery.base)}</button>
                      <button className={clsx("btn small", on && "primary")} aria-pressed={on} title={`Sustaining costs ${SUSTAIN_PENALTY} dice on every test`} onClick={() => toggleSustain(sp)}>{on ? "Sustained" : "Sustain"}</button>
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
            <datalist id="spell-names">{suggestions.slice(0, 200).map((n) => <option key={n} value={n} />)}</datalist>
            <button className="btn small" disabled={!newSpell.trim() || karmaAvail < KARMA.spell}>Learn</button>
          </form>
          <p className="mt-2 text-xs text-faint">Casting is Sorcery + Magic, limited by Force. Save each spell&apos;s drain as a formula (F/2, F−3, F+1) and the sheet works out the drain for the Force you chose, rolls the resistance and applies what gets through.</p>
        </Box>

        <Box title="Spirits" right={<span className="num text-xs text-dim">{e.spirits.length} summoned or bound</span>}>
          <div className="no-print mb-3 flex flex-wrap items-center gap-2">
            <button className="btn small" disabled={conjuring.blocked} onClick={() => ctx.rollPool(`Summon ${spirit.type} spirit (Force ${spirit.force})`, conjuring.base, { limit: spirit.force })}>Summon {ctx.poolOf(conjuring.base)}</button>
            <button className="btn small" disabled={conjuring.blocked} onClick={() => ctx.rollPool(`Banish spirit (Force ${spirit.force})`, conjuring.base, { limit: spirit.force })}>Banish {ctx.poolOf(conjuring.base)}</button>
            <span className="text-xs text-dim">Conjuring + Magic</span>
          </div>
          <ul className="divide-y divide-line text-sm">
            {e.spirits.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 py-1.5">
                <b className="font-display">{s.type} spirit</b>
                <span className="text-xs text-dim">Force</span><Stepper label={`${s.type} force`} value={s.force} min={1} max={12} onChange={(n) => upd((x) => editExt(x, (ex) => { const t = ex.spirits.find((q) => q.id === s.id); if (t) t.force = n; }))} />
                <span className="text-xs text-dim">services</span><Stepper label={`${s.type} services`} value={s.services} min={0} max={12} onChange={(n) => upd((x) => editExt(x, (ex) => { const t = ex.spirits.find((q) => q.id === s.id); if (t) t.services = n; }))} />
                <button className={clsx("btn small", s.bound && "primary")} aria-pressed={s.bound} onClick={() => upd((x) => editExt(x, (ex) => { const t = ex.spirits.find((q) => q.id === s.id); if (t) t.bound = !t.bound; }))}>{s.bound ? "Bound" : "Summoned"}</button>
                <button className="btn ghost small ml-auto" aria-label="Dismiss spirit" onClick={() => upd((x) => editExt(x, (ex) => { ex.spirits = ex.spirits.filter((q) => q.id !== s.id); }))}>×</button>
              </li>
            ))}
            {e.spirits.length === 0 && <li className="py-1.5 text-dim">No spirits under your command.</li>}
          </ul>
          <form className="no-print mt-2 flex flex-wrap items-center gap-2" onSubmit={(ev) => { ev.preventDefault(); upd((x) => editExt(x, (ex) => { ex.spirits.push({ id: xid("sp"), type: spirit.type, force: spirit.force, services: 1, bound: false, note: "" }); })); }}>
            <select className="field !w-32" aria-label="Spirit type" value={spirit.type} onChange={(ev) => setSpirit({ ...spirit, type: ev.target.value })}>{SPIRIT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            <Stepper label="New spirit force" value={spirit.force} min={1} max={12} onChange={(n) => setSpirit({ ...spirit, force: n })} />
            <button className="btn small">Add spirit</button>
          </form>
          <p className="mt-2 text-xs text-faint">Services owed equal the net hits of a summoning. Spend one by lowering the counter.</p>
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
