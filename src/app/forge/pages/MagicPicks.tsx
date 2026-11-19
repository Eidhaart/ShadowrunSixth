"use client";
import { useMemo, useState } from "react";
import { useRulebook } from "@/lib/store/rulebook";
import { adeptPowerList, complexFormList, ritualList, spellList, type BookEntry } from "@/lib/sr6/bookLists";
import { COMPLEX_FORMS, SPELLS, type SpellDef } from "@/lib/sr6/rules6";
import { derive } from "@/lib/sr6/derive";
import { Selector, type Avail, type Chosen } from "../wizard/Selector";
import { Initiation, MysticSplit, PowerPoints } from "../steps/MagicStep";
import { Note, Stepper, type StepProps } from "../ui";

const spellStats = (s: SpellDef) => `${s.cat} · ${s.range} · ${s.type} · ${s.dur === "I" ? "Instant" : s.dur === "S" ? "Sustained" : s.dur === "P" ? "Permanent" : s.dur}${s.dv != null ? ` · DV ${s.dv}` : ""}`;

/** Built-in spells, matched to the user's book for full text; book-only entries added after. */
function useSpellOffer() {
  const book = useRulebook((s) => s.book);
  return useMemo(() => {
    const fromBook = spellList(book);
    const byName = new Map(fromBook.map((e) => [e.name.toLowerCase(), e]));
    const out: (Avail & { stats?: string })[] = SPELLS.map((s) => {
      const e = byName.get(s.name.toLowerCase());
      return { id: `sp-${s.name}`, name: s.name, group: s.cat, cost: `DV ${s.dv ?? "—"}`, tone: "info" as const, summary: e?.summary ?? spellStats(s), page: e?.page, sectionId: e?.id, stats: spellStats(s) };
    });
    const known = new Set(SPELLS.map((s) => s.name.toLowerCase()));
    for (const e of fromBook) if (!known.has(e.name.toLowerCase())) out.push({ id: e.id, name: e.name, group: e.group, summary: e.summary, page: e.page, sectionId: e.id });
    return out;
  }, [book]);
}

export function SpellsPage({ c, patch }: StepProps) {
  const book = useRulebook((s) => s.book);
  const d = derive(c);
  const offer = useSpellOffer();
  const rituals = useMemo(() => ritualList(book), [book]);
  const [tab, setTab] = useState<"spells" | "rituals">("spells");
  const known = c.spells.length + (c.rituals?.length ?? 0);
  const left = d.slots.spells - known;
  const full = left <= 0;
  const why = d.slots.spells === 0
    ? (c.magicType === "aspected" && c.aspect && c.aspect !== "sorcery" ? `Only sorcerers start with spells; your aspect is ${c.aspect}.` : c.magicType === "mystic" ? "No Magic points go to spellcasting. Move some on the Magic page." : "No starting spells with this build.")
    : `All ${d.slots.spells} starting spells and rituals are picked. More are learned in play for 5 Karma each, not bought at creation.`;

  const available: Avail[] = tab === "spells"
    ? offer.map((o) => ({ ...o, taken: c.spells.includes(o.name), blocked: !c.spells.includes(o.name) && full ? why : undefined }))
    : rituals.map((r: BookEntry) => ({ id: r.id, name: r.name, group: r.group, summary: r.summary, page: r.page, sectionId: r.id, taken: (c.rituals ?? []).includes(r.name), blocked: !(c.rituals ?? []).includes(r.name) && full ? why : undefined }));

  const selected: Chosen[] = [
    ...c.spells.map((n) => { const o = offer.find((x) => x.name === n); return { key: `s:${n}`, name: n, sub: o?.stats ?? o?.group, sectionId: o?.sectionId, summary: o?.summary }; }),
    ...(c.rituals ?? []).map((n) => { const r = rituals.find((x) => x.name === n); return { key: `r:${n}`, name: n, cost: "ritual", tone: "neg" as const, sub: r?.group, sectionId: r?.id, summary: r?.summary }; }),
  ];

  return (
    <div>
      {c.magicType === "mystic" && <MysticSplit c={c} patch={patch} />}
      <Selector label={tab === "spells" ? "Spells" : "Rituals"} tabs={[{ id: "spells", label: "Spells" }, { id: "rituals", label: "Rituals" }]} tab={tab} onTab={(t) => setTab(t as "spells" | "rituals")}
        available={available} selected={selected}
        onAdd={(a) => patch((x) => { if (tab === "spells") { if (!x.spells.includes(a.name)) x.spells.push(a.name); } else { x.rituals = [...new Set([...(x.rituals ?? []), a.name])]; } })}
        onRemove={(key) => patch((x) => { const [k, ...rest] = key.split(":"); const n = rest.join(":"); if (k === "s") x.spells = x.spells.filter((s) => s !== n); else x.rituals = (x.rituals ?? []).filter((s) => s !== n); })}
        emptyAvailable={tab === "rituals" ? "Mount your rulebook to list the rituals." : undefined}
        selectedHead={<div className="flex justify-between text-xs text-dim"><span>Starting spells and rituals</span><span className={left < 0 ? "text-danger" : ""}><b className="num text-fg">{known}</b> / {d.slots.spells}</span></div>}
        footer={
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const f = (new FormData(e.currentTarget).get("free") as string)?.trim(); if (!f || full) return; patch((x) => { if (tab === "spells") x.spells.push(f); else x.rituals = [...(x.rituals ?? []), f]; }); e.currentTarget.reset(); }}>
            <input name="free" className="field" placeholder={`Or type a ${tab === "spells" ? "spell" : "ritual"} name`} aria-label="Custom name" />
            <button className="btn" disabled={full} title={full ? why : undefined}>Add</button>
          </form>
        } />
      <p className="mt-3 max-w-3xl text-xs text-faint">{c.magicType === "mystic" ? "Two spells or rituals for each priority Magic point given to spellcasting." : "Spells and rituals share one allowance: priority Magic × 2."} The rating used is the one on the priority table, before adjustment points or Karma.</p>
    </div>
  );
}

export function PowersPage({ c, patch }: StepProps) {
  const book = useRulebook((s) => s.book);
  const d = derive(c);
  const powers = useMemo(() => adeptPowerList(book), [book]);
  const sl = d.slots;
  const left = sl.powerPoints - sl.ppSpent;
  const available: Avail[] = powers.map((p) => {
    const have = c.adeptPowers.find((x) => x.name === p.name);
    const atTop = (have?.level ?? 0) >= (p.maxLevel ?? 1);
    const short = (p.pp ?? 0) > left + 1e-9;
    return {
      id: p.id, name: p.name, group: p.group, page: p.page, sectionId: p.id.replace(/-combat$/, ""), summary: p.summary,
      cost: `${p.pp} PP${p.perLevel ? "/lvl" : ""}`, taken: !!have, again: !!have && !!p.perLevel && !atTop, badge: p.effect ? "auto" : undefined,
      blocked: have && (!p.perLevel || atTop) ? undefined : short ? `Needs ${p.pp} PP; ${+Math.max(0, left).toFixed(2)} left.${c.magicType === "mystic" ? " Give another Magic point to adept powers." : ""}` : undefined,
    };
  });
  const selected: Chosen[] = c.adeptPowers.map((p, i) => {
    const def = powers.find((x) => x.name === p.name);
    return {
      key: p.name, name: `${p.name}${def?.perLevel ? ` ${p.level ?? 1}` : ""}`, cost: `${+p.cost.toFixed(2)} PP`, sectionId: def?.id.replace(/-combat$/, ""), summary: def?.summary,
      sub: p.effect ? "Applied on the sheet automatically" : undefined,
      controls: def?.perLevel ? (
        <div className="flex items-center gap-2 text-xs text-dim">Level
          <Stepper size="sm" label={`${p.name} level`} value={p.level ?? 1} min={1} max={def.maxLevel ?? 6} disableUp={(def.pp ?? 0) > left + 1e-9}
            onChange={(v) => patch((x) => { const q = x.adeptPowers[i]; q.level = v; q.cost = +((def.pp ?? 0) * v).toFixed(2); })} />
        </div>
      ) : undefined,
    };
  });
  return (
    <div>
      {c.magicType === "mystic" && <MysticSplit c={c} patch={patch} />}
      <PowerPoints c={c} />
      <Selector label="Adept powers" available={available} selected={selected}
        onAdd={(a) => { const p = powers.find((x) => x.id === a.id); if (!p) return; patch((x) => {
          const cur = x.adeptPowers.find((y) => y.name === p.name);
          if (cur) { cur.level = (cur.level ?? 1) + 1; cur.cost = +(cur.cost + (p.pp ?? 0)).toFixed(2); }
          else x.adeptPowers.push({ name: p.name, cost: p.pp ?? 0, level: 1, effect: p.effect });
        }); }}
        onRemove={(key) => patch((x) => { x.adeptPowers = x.adeptPowers.filter((y) => y.name !== key); })}
        emptyAvailable="Mount your rulebook to browse the adept powers with their costs and full text."
        selectedHead={<div className="flex justify-between text-xs text-dim"><span>Power Points</span><span className={left < 0 ? "text-danger" : ""}><b className="num text-fg">{+sl.ppSpent.toFixed(2)}</b> / {+sl.powerPoints.toFixed(2)}</span></div>} />
    </div>
  );
}

export function FormsPage({ c, patch }: StepProps) {
  const book = useRulebook((s) => s.book);
  const d = derive(c);
  const fromBook = useMemo(() => complexFormList(book), [book]);
  const left = d.slots.complexForms - c.complexForms.length;
  const why = `All ${d.slots.complexForms} starting forms are picked. More are learned in play.`;
  const offer = useMemo(() => {
    const byName = new Map(fromBook.map((e) => [e.name.toLowerCase(), e]));
    const out: Avail[] = COMPLEX_FORMS.map((f) => { const e = byName.get(f.name.toLowerCase()); return { id: `cf-${f.name}`, name: f.name, group: f.skill === "cracking" ? "Cracking" : "Electronics", cost: `Fade ${f.fade}`, tone: "info" as const, summary: e?.summary ?? f.note, page: e?.page, sectionId: e?.id }; });
    for (const e of fromBook) if (!COMPLEX_FORMS.some((f) => f.name.toLowerCase() === e.name.toLowerCase())) out.push({ id: e.id, name: e.name, summary: e.summary, page: e.page, sectionId: e.id });
    return out;
  }, [fromBook]);
  return (
    <Selector label="Complex forms" available={offer.map((o) => ({ ...o, taken: c.complexForms.includes(o.name), blocked: !c.complexForms.includes(o.name) && left <= 0 ? why : undefined }))}
      selected={c.complexForms.map((n) => { const o = offer.find((x) => x.name === n); return { key: n, name: n, cost: o?.cost, tone: "info", sub: o?.group, sectionId: o?.sectionId, summary: o?.summary }; })}
      onAdd={(a) => patch((x) => { if (!x.complexForms.includes(a.name)) x.complexForms.push(a.name); })}
      onRemove={(key) => patch((x) => { x.complexForms = x.complexForms.filter((s) => s !== key); })}
      selectedHead={<div className="flex justify-between text-xs text-dim"><span>Starting forms: priority Resonance × 2</span><span className={left < 0 ? "text-danger" : ""}><b className="num text-fg">{c.complexForms.length}</b> / {d.slots.complexForms}</span></div>} />
  );
}

export function InitiationPage({ c, patch }: StepProps) {
  return (
    <div className="max-w-3xl">
      <Initiation c={c} patch={patch} />
      <Note>Optional. Most new runners start at grade 0; a grade at creation is a big Karma spend that buys a {c.magicType === "technomancer" ? "echo" : "metamagic"} and a higher ceiling.</Note>
    </div>
  );
}
