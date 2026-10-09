"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { useRulebook } from "@/lib/store/rulebook";
import { ATTRIBUTES, ATTR_ABBR, ATTR_LABEL, SKILLS, SKILL_BY_ID, type AttrKey } from "@/lib/sr6/data";
import { uid } from "@/lib/sr6/character";
import { parseQualities } from "@/lib/sr6/qualities";
import { COMPLEX_FORMS, SPELLS } from "@/lib/sr6/rules6";
import {
  ADV_COST, advance, attrMax, getAdv, learnableSkills, offers, qualityKey, skillName, undoLast,
  type AdvOp, type Offer,
} from "@/lib/sr6/advance";
import { Box, Empty } from "./ui";
import type { SheetCtx } from "./ctx";

/** A rating that can be raised: current value, the next one, and what it costs. */
function Raise({ label, abbr, cur, o, onBuy, sub }: { label: string; abbr: string; cur: number; o: Offer; onBuy: () => void; sub?: string }) {
  return (
    <div className={clsx("flex flex-col border px-2.5 py-2", o.ok ? "border-line hover:border-line-hi" : "border-line/60")}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-dim" title={label}>{abbr}</span>
        {sub && <span className="text-[10px] text-faint">{sub}</span>}
      </div>
      <div className="num my-1 text-2xl font-bold leading-none"><span key={cur} className="adv-pop inline-block">{cur}</span></div>
      <button className={clsx("btn small mt-auto w-full", o.ok && "primary")} disabled={!o.ok} onClick={onBuy} aria-label={`Raise ${label} to ${o.next} for ${o.cost} Karma`} title={o.why}>
        {o.ok || o.why?.startsWith("Needs") ? <span className="whitespace-nowrap">To {o.next} · <span className="num">{o.cost}</span></span> : "Max"}
      </button>
    </div>
  );
}

export function AdvanceTab({ ctx }: { ctx: SheetCtx }) {
  const { c, d, upd } = ctx;
  const book = useRulebook((s) => s.book);
  const o = offers(c);
  const adv = getAdv(c);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [award, setAward] = useState(3);
  const [newSkill, setNewSkill] = useState("");
  const [know, setKnow] = useState({ name: "", kind: "knowledge" as "knowledge" | "language" });
  const [qual, setQual] = useState({ id: "", level: 1, note: "" });
  const [custom, setCustom] = useState({ name: "", karma: 6 });
  const [spell, setSpell] = useState("");
  const [meta, setMeta] = useState("");

  const buy = (op: AdvOp, label: string, cost: number) => {
    let err = null as string | null;
    upd((x) => { err = advance(x, op, label, cost); });
    setMsg(err ? { ok: false, text: err } : { ok: true, text: op.k === "award" ? `${label}.` : `${label} for ${cost} Karma.` });
  };

  const awakened = c.magicType !== "mundane" && c.magicType !== "technomancer";
  const techno = c.magicType === "technomancer";
  const casts = awakened && c.magicType !== "adept";
  const qualityDefs = useMemo(() => parseQualities(book).filter((q) => q.kind === "positive"), [book]);
  const qdef = qualityDefs.find((q) => q.id === qual.id);
  const held = new Set(c.qualities.map((q) => q.name));
  const known = d.skills.filter((s) => s.rank > 0);
  const learnable = learnableSkills(c);
  const avail = o.avail;
  const can = (cost: number) => avail >= cost;
  const ruleSec = book?.sections.find((s) => /^(Character Advancement|Advancement|Improving (Your|the) Character|Karma Advancement)/i.test(s.title));

  const spellNames = useMemo(() => SPELLS.map((s) => s.name).filter((n) => !c.spells.includes(n)), [c.spells]);
  const formNames = COMPLEX_FORMS.map((f) => f.name).filter((n) => !c.complexForms.includes(n));

  return (
    <div className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
      {/* wallet */}
      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <section className="panel p-4">
          <div className="text-xs text-dim">Karma available</div>
          <div className={clsx("num text-5xl font-bold leading-tight", avail > 0 ? "text-accent glow" : "text-faint")}><span key={avail} className="adv-pop inline-block">{avail}</span></div>
          <div className="num mt-1 flex gap-4 text-xs text-dim"><span>Earned {c.karmaEarned}</span><span>Spent {c.karmaSpent}</span></div>
          <div className="mt-4 text-xs text-dim">Karma from the run</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {[1, 2, 3, 5].map((n) => <button key={n} className="btn small" onClick={() => buy({ k: "award", n }, `Awarded ${n} Karma`, 0)}>+{n}</button>)}
            <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (award > 0) buy({ k: "award", n: award }, `Awarded ${award} Karma`, 0); }}>
              <input className="field num !min-h-0 !w-16 !py-1" type="number" min={1} max={200} value={award} onChange={(e) => setAward(Math.max(1, Math.min(200, Math.floor(Number(e.target.value) || 1))))} aria-label="Karma to award" />
              <button className="btn small">Award</button>
            </form>
          </div>
          {msg && <p className={clsx("mt-3 text-sm", msg.ok ? "text-ok" : "text-danger")} role="status">{msg.text}</p>}
        </section>

        <section className="panel p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">History</h3>
            <button className="btn small ghost" disabled={!adv.log.length} onClick={() => { let label = ""; upd((x) => { label = undoLast(x)?.label ?? ""; }); if (label) setMsg({ ok: true, text: `Undid: ${label}. Karma refunded.` }); }}>
              <Icon name="undo" size={13} /> Undo last
            </button>
          </div>
          <ol className="max-h-72 divide-y divide-line overflow-y-auto text-sm">
            {[...adv.log].reverse().map((e) => (
              <li key={e.id} className="flex items-baseline justify-between gap-2 py-1.5">
                <span className="min-w-0">{e.label}<span className="block text-[11px] text-faint">{new Date(e.at).toLocaleDateString()}</span></span>
                <span className={clsx("num shrink-0 text-xs", e.cost < 0 ? "text-ok" : "text-dim")}>{e.cost < 0 ? `+${-e.cost}` : `−${e.cost}`}</span>
              </li>
            ))}
            {adv.log.length === 0 && <li className="py-1.5 text-dim">Nothing yet. Award the Karma from a run, then spend it.</li>}
          </ol>
        </section>

        <details className="panel quiet p-4 text-sm">
          <summary className="cursor-pointer font-display font-semibold">How advancement works</summary>
          <div className="mt-2 space-y-2 text-dim">
            <p>The gamemaster hands out Karma at the end of a run. Spend it between sessions; your GM may ask for downtime or a teacher before a raise counts.</p>
            <ul className="space-y-1">
              <li><b className="text-fg">Attributes, Edge, Magic, Resonance:</b> new rating × 5, up to your metatype maximum. Magic and Resonance top out at 6 plus your initiate or submersion grade.</li>
              <li><b className="text-fg">Skills:</b> new rank × 5; a new skill costs 5. Ranks top out at 9, or 10 with Aptitude.</li>
              <li><b className="text-fg">Specialization or expertise:</b> 5 each. Expertise turns a specialization&apos;s +2 into +3.</li>
              <li><b className="text-fg">Knowledge skill or language:</b> 3.</li>
              <li><b className="text-fg">Spells, rituals, preparations, complex forms:</b> 5 each.</li>
              <li><b className="text-fg">Qualities:</b> a positive quality costs double its listed Karma after creation. Buying off a negative one costs double its bonus.</li>
              <li><b className="text-fg">Initiation or submersion:</b> 10 + the new grade.</li>
            </ul>
            <p>The Forge keeps showing the runner as created; everything bought here is stored separately and can be undone in order.</p>
            {ruleSec && <Link href={`/rules?s=${encodeURIComponent(ruleSec.id)}`} target="_blank" className="inline-flex items-center gap-1.5 text-accent hover:underline"><Icon name="library" size={14} /> {ruleSec.title} in the rulebook (p. {ruleSec.page})</Link>}
          </div>
        </details>
      </aside>

      {/* spending */}
      <div className="min-w-0 space-y-4">
        <Box title="Attributes" right={<span className="text-xs text-dim">new rating × 5</span>}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {ATTRIBUTES.map((a: AttrKey) => {
              const x = o.attr[a];
              const aug = d.attrs[a] - x.cur;
              return <Raise key={a} label={ATTR_LABEL[a]} abbr={ATTR_ABBR[a]} cur={x.cur} o={x} sub={aug ? `${d.attrs[a]} aug` : `max ${attrMax(c, a)}`} onBuy={() => buy({ k: "attr", a }, `${ATTR_LABEL[a]} ${x.next}`, x.cost)} />;
            })}
            <Raise label="Edge" abbr="EDG" cur={o.edge.cur} o={o.edge} onBuy={() => buy({ k: "edge" }, `Edge ${o.edge.next}`, o.edge.cost)} />
            {o.magic && <Raise label={techno ? "Resonance" : "Magic"} abbr={techno ? "RES" : "MAG"} cur={o.magic.cur} o={o.magic} onBuy={() => buy({ k: "magic" }, `${techno ? "Resonance" : "Magic"} ${o.magic!.next}`, o.magic!.cost)} />}
          </div>
          <p className="mt-2 text-xs text-faint">Prices use your natural rating; augmentation bonuses sit on top. Buying back burned Edge works the same way.</p>
        </Box>

        <Box title="Skills" right={<span className="text-xs text-dim">new rank × 5</span>}>
          <ul className="divide-y divide-line">
            {known.map((s) => {
              const x = o.skill(s.id);
              return (
                <li key={s.id} className="flex items-center gap-2 py-1.5">
                  <span className="min-w-0 flex-1"><b className="font-display">{s.name}</b> <span className="num text-dim"><span key={x.cur} className="adv-pop inline-block">{x.cur}</span></span>{s.spec && <span className="ml-2 text-xs text-dim">{s.spec} +{s.expert ? 3 : 2}</span>}</span>
                  <button className={clsx("btn small shrink-0", x.ok && "primary")} disabled={!x.ok} title={x.why} onClick={() => buy({ k: "skill", id: s.id }, `${s.name} ${x.next}`, x.cost)}>
                    {x.ok || x.why?.startsWith("Needs") ? <span className="whitespace-nowrap">To {x.next} · <span className="num">{x.cost}</span></span> : "Max"}
                  </button>
                </li>
              );
            })}
            {known.length === 0 && <li className="py-1.5"><Empty>No trained skills yet.</Empty></li>}
          </ul>
          <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (newSkill) { buy({ k: "skill", id: newSkill }, `Learned ${skillName(newSkill)} 1`, ADV_COST.rating(1)); setNewSkill(""); } }}>
            <select className="field min-w-44 flex-1" value={newSkill} onChange={(e) => setNewSkill(e.target.value)} aria-label="New skill">
              <option value="">Learn a new skill…</option>
              {learnable.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button className="btn small" disabled={!newSkill || !can(ADV_COST.rating(1))}>Learn · {ADV_COST.rating(1)}</button>
          </form>
        </Box>

        <Box title="Specializations and expertise" right={<span className="text-xs text-dim">{ADV_COST.spec} each</span>}>
          <ul className="divide-y divide-line">
            {known.map((s) => {
              const def = SKILL_BY_ID[s.id];
              if (!s.spec) {
                return def?.specs.length ? (
                  <li key={s.id} className="flex flex-wrap items-center gap-2 py-1.5">
                    <span className="min-w-28 flex-1 font-display font-semibold">{s.name}</span>
                    <select className="field !w-auto min-w-40" value="" disabled={!can(ADV_COST.spec)} aria-label={`${s.name} specialization`} onChange={(e) => { if (e.target.value) buy({ k: "spec", id: s.id, name: e.target.value }, `${s.name}: ${e.target.value}`, ADV_COST.spec); }}>
                      <option value="">Specialize in…</option>
                      {def.specs.map((sp) => <option key={sp}>{sp}</option>)}
                    </select>
                  </li>
                ) : null;
              }
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-2 py-1.5">
                  <span className="min-w-28 flex-1"><b className="font-display">{s.name}</b> <span className="text-sm text-dim">{s.spec}</span></span>
                  {s.expert ? <span className="chip on">Expertise +3</span> : (
                    <button className="btn small" disabled={!can(ADV_COST.expert)} onClick={() => buy({ k: "expert", id: s.id }, `${s.name}: expertise in ${s.spec}`, ADV_COST.expert)}>Expertise · {ADV_COST.expert}</button>
                  )}
                </li>
              );
            })}
          </ul>
          {known.length === 0 && <Empty>Train a skill first.</Empty>}
        </Box>

        <div className="grid gap-4 xl:grid-cols-2">
          <Box title="Knowledge and languages" right={<span className="text-xs text-dim">{ADV_COST.knowledge} each</span>}>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {c.knowledge.map((k) => <span key={k.id} className="chip">{k.name}{k.kind === "language" ? " (language)" : ""}</span>)}
              {c.knowledge.length === 0 && <Empty>None yet.</Empty>}
            </div>
            <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); const n = know.name.trim(); if (!n) return; buy({ k: "knowledge", item: { id: uid("k"), name: n, kind: know.kind } }, `${know.kind === "language" ? "Language" : "Knowledge"}: ${n}`, ADV_COST.knowledge); setKnow({ ...know, name: "" }); }}>
              <input className="field min-w-36 flex-1" value={know.name} onChange={(e) => setKnow({ ...know, name: e.target.value })} placeholder="Seattle gangs, Japanese…" aria-label="Knowledge skill or language" />
              <select className="field !w-auto" value={know.kind} onChange={(e) => setKnow({ ...know, kind: e.target.value as "knowledge" | "language" })} aria-label="Kind"><option value="knowledge">Knowledge</option><option value="language">Language</option></select>
              <button className="btn small" disabled={!know.name.trim() || !can(ADV_COST.knowledge)}>Learn · {ADV_COST.knowledge}</button>
            </form>
          </Box>

          <Box title="Qualities" right={<span className="text-xs text-dim">× {ADV_COST.qualityMult} after creation</span>}>
            {qualityDefs.length > 0 ? (
              <div className="space-y-2">
                <select className="field" value={qual.id} onChange={(e) => { const q = qualityDefs.find((x) => x.id === e.target.value); setQual({ id: e.target.value, level: q?.minLevel ?? 1, note: "" }); }} aria-label="Positive quality">
                  <option value="">Take a positive quality…</option>
                  {qualityDefs.filter((q) => !held.has(q.name) || q.perLevel).map((q) => <option key={q.id} value={q.id}>{q.name}: {q.karma * ADV_COST.qualityMult} Karma{q.perLevel ? " per level" : ""}</option>)}
                </select>
                {qdef && (
                  <div className="flex flex-wrap items-center gap-2">
                    {qdef.perLevel && qdef.maxLevel > 1 && <label className="text-xs text-dim">Level <input className="field num !w-16" type="number" min={qdef.minLevel} max={qdef.maxLevel} value={qual.level} onChange={(e) => setQual({ ...qual, level: Math.max(qdef.minLevel, Math.min(qdef.maxLevel, Number(e.target.value) || 1)) })} /></label>}
                    {qdef.needs === "skill" && <select className="field !w-auto" value={qual.note} onChange={(e) => setQual({ ...qual, note: e.target.value })} aria-label="Skill"><option value="">Which skill?</option>{SKILLS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
                    {qdef.needs === "attribute" && <select className="field !w-auto" value={qual.note} onChange={(e) => setQual({ ...qual, note: e.target.value })} aria-label="Attribute"><option value="">Which attribute?</option>{ATTRIBUTES.map((a) => <option key={a} value={a}>{ATTR_LABEL[a]}</option>)}</select>}
                    {qdef.needs === "text" && <input className="field !w-44" value={qual.note} onChange={(e) => setQual({ ...qual, note: e.target.value })} placeholder={qdef.needsLabel ?? "Details"} aria-label="Details" />}
                    <button className="btn small primary" disabled={(qdef.needs && qdef.needs !== "text" && !qual.note) || !can(qdef.karma * qual.level * ADV_COST.qualityMult)} onClick={() => {
                      const cost = qdef.karma * qual.level * ADV_COST.qualityMult;
                      buy({ k: "quality", q: { id: uid("q"), name: qdef.name, kind: "positive", karma: qdef.karma, level: qual.level, note: qual.note || undefined, effect: qdef.effect } }, `Quality: ${qdef.name}${qual.level > 1 ? ` ${qual.level}` : ""}`, cost);
                      setQual({ id: "", level: 1, note: "" });
                    }}>Take · {qdef.karma * qual.level * ADV_COST.qualityMult}</button>
                  </div>
                )}
              </div>
            ) : (
              <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); const n = custom.name.trim(); if (!n) return; buy({ k: "quality", q: { id: uid("q"), name: n, kind: "positive", karma: custom.karma, level: 1 } }, `Quality: ${n}`, custom.karma * ADV_COST.qualityMult); setCustom({ ...custom, name: "" }); }}>
                <input className="field min-w-32 flex-1" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder="Positive quality" aria-label="Quality name" />
                <label className="flex items-center gap-1.5 text-xs text-dim">Listed cost<input className="field num !w-16" type="number" min={1} value={custom.karma} onChange={(e) => setCustom({ ...custom, karma: Math.max(1, Number(e.target.value) || 1) })} /></label>
                <button className="btn small" disabled={!custom.name.trim() || !can(custom.karma * ADV_COST.qualityMult)}>Take · {custom.karma * ADV_COST.qualityMult}</button>
                <p className="w-full text-xs text-faint">Mount the rulebook to pick qualities from the list with their effects.</p>
              </form>
            )}
            {c.qualities.some((q) => q.kind === "negative") && (
              <div className="mt-3">
                <div className="mb-1 text-xs text-dim">Buy off a negative quality</div>
                <ul className="divide-y divide-line text-sm">
                  {c.qualities.filter((q) => q.kind === "negative").map((q) => {
                    const cost = q.karma * q.level * ADV_COST.qualityMult;
                    return (
                      <li key={qualityKey(q)} className="flex items-center justify-between gap-2 py-1.5">
                        <span>{q.name}{q.level > 1 ? ` ${q.level}` : ""}</span>
                        <button className="btn small" disabled={!can(cost)} onClick={() => buy({ k: "buyoff", key: qualityKey(q), name: q.name }, `Bought off ${q.name}`, cost)}>Buy off · {cost}</button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </Box>
        </div>

        {(awakened || techno) && (
          <Box title={techno ? "Resonance" : "Magic"}>
            <div className="grid gap-4 md:grid-cols-2">
              {casts && (
                <form onSubmit={(e) => { e.preventDefault(); const n = spell.trim(); if (!n) return; buy({ k: "spell", name: n }, `Learned ${n}`, ADV_COST.spell); setSpell(""); }}>
                  <div className="mb-1 text-sm font-semibold">Learn a spell, ritual or formula <span className="text-xs font-normal text-dim">{ADV_COST.spell} Karma</span></div>
                  <div className="flex gap-2">
                    <input className="field flex-1" list="adv-spells" value={spell} onChange={(e) => setSpell(e.target.value)} placeholder="Spell name" aria-label="Spell name" />
                    <datalist id="adv-spells">{spellNames.map((n) => <option key={n} value={n} />)}</datalist>
                    <button className="btn small" disabled={!spell.trim() || !can(ADV_COST.spell)}>Learn</button>
                  </div>
                </form>
              )}
              {techno && (
                <form onSubmit={(e) => { e.preventDefault(); const n = spell.trim(); if (!n) return; buy({ k: "form", name: n }, `Learned ${n}`, ADV_COST.form); setSpell(""); }}>
                  <div className="mb-1 text-sm font-semibold">Learn a complex form <span className="text-xs font-normal text-dim">{ADV_COST.form} Karma</span></div>
                  <div className="flex gap-2">
                    <input className="field flex-1" list="adv-forms" value={spell} onChange={(e) => setSpell(e.target.value)} placeholder="Complex form" aria-label="Complex form" />
                    <datalist id="adv-forms">{formNames.map((n) => <option key={n} value={n} />)}</datalist>
                    <button className="btn small" disabled={!spell.trim() || !can(ADV_COST.form)}>Learn</button>
                  </div>
                </form>
              )}
              {c.magicType === "mystic" && (
                <div>
                  <div className="mb-1 text-sm font-semibold">Power points <span className="text-xs font-normal text-dim">{ADV_COST.pp} Karma each</span></div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="num text-dim">{d.slots.powerPoints} total</span>
                    <button className="btn small" disabled={!can(ADV_COST.pp)} onClick={() => buy({ k: "pp" }, "Power point", ADV_COST.pp)}>Buy one</button>
                  </div>
                </div>
              )}
              {c.magicType === "adept" && <p className="text-sm text-dim">Adepts gain a power point with every point of Magic. Raise Magic above, then add powers on the Magic tab.</p>}
              <div className={clsx(!casts && !techno && c.magicType !== "mystic" && "md:col-span-2")}>
                <div className="mb-1 text-sm font-semibold">{techno ? "Submersion" : "Initiation"} <span className="text-xs font-normal text-dim">grade {o.grade}{adv.metamagic.length ? ` · ${adv.metamagic.join(", ")}` : ""}</span></div>
                <div className="flex flex-wrap gap-2">
                  <input className="field min-w-36 flex-1" value={meta} onChange={(e) => setMeta(e.target.value)} placeholder={techno ? "Echo (optional)" : "Metamagic (optional)"} aria-label={techno ? "Echo" : "Metamagic"} />
                  <button className="btn small primary" disabled={!o.initiate?.ok} onClick={() => { buy({ k: "initiate", meta: meta.trim() || undefined }, `${techno ? "Submerged" : "Initiated"} to grade ${o.grade + 1}`, o.initiate!.cost); setMeta(""); }}>
                    Grade {o.grade + 1} · {o.initiate?.cost}
                  </button>
                </div>
                <p className="mt-1 text-xs text-faint">Each grade raises your {techno ? "Resonance" : "Magic"} maximum by 1.</p>
              </div>
            </div>
          </Box>
        )}
      </div>
    </div>
  );
}
