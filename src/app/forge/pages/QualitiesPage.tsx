"use client";
import { useMemo, useState } from "react";
import { useRulebook } from "@/lib/store/rulebook";
import { parseQualities, type QualityDef } from "@/lib/sr6/qualities";
import { uid, type QualityPick } from "@/lib/sr6/character";
import { ATTRIBUTES, ATTR_LABEL, KARMA, METATYPES, SKILLS } from "@/lib/sr6/data";
import { budget } from "@/lib/sr6/derive";
import { Selector, type Avail, type Chosen } from "../wizard/Selector";
import { Stepper, type StepProps } from "../ui";

const costOf = (q: { kind: string; karma: number; level?: number }, perLevel?: boolean) => {
  const k = q.karma * (perLevel ? q.level ?? 1 : 1);
  return q.kind === "positive" ? `${k} Karma` : `+${k} Karma`;
};

export function QualitiesPage({ c, patch }: StepProps) {
  const book = useRulebook((s) => s.book);
  const defs = useMemo(() => parseQualities(book), [book]);
  const byId = useMemo(() => new Map(defs.map((d) => [d.id, d])), [defs]);
  const [tab, setTab] = useState<"positive" | "negative">("positive");
  const [custom, setCustom] = useState({ name: "", karma: 5 });
  const b = budget(c);
  const full = b.qualities.count >= KARMA.maxQualities;

  const why = (d: QualityDef): string | undefined => {
    if (c.qualities.some((x) => x.id === d.id)) return undefined;
    if (full) return `${KARMA.maxQualities} qualities is the most a new runner can have. Drop one first.`;
    if (d.kind === "positive" && d.karma * d.minLevel > b.karma.left) return `Costs ${d.karma * d.minLevel} Karma; you have ${Math.max(0, b.karma.left)} left.`;
    if (d.kind === "negative" && b.qualities.net + d.karma * d.minLevel > KARMA.maxQualityKarma)
      return `Negative qualities can give at most ${KARMA.maxQualityKarma} Karma more than your positive ones cost. This would make it ${b.qualities.net + d.karma * d.minLevel}.`;
    return undefined;
  };

  const available: Avail[] = defs.filter((d) => d.kind === tab).map((d) => ({
    id: d.id, name: d.name, page: d.page, sectionId: d.sectionId, summary: d.effectText || d.blurb,
    cost: `${d.kind === "positive" ? "" : "+"}${d.karma}${d.perLevel ? "/lvl" : ""}`, tone: d.kind === "positive" ? "pos" : "neg",
    taken: c.qualities.some((x) => x.id === d.id), blocked: why(d), badge: d.effect ? "auto" : undefined,
  }));

  const add = (a: Avail) => {
    const d = byId.get(a.id);
    if (!d) return;
    patch((x) => {
      x.qualities.push({ id: d.id, name: d.name, kind: d.kind, karma: d.karma, level: d.minLevel, effect: d.effect,
        note: d.needs === "skill" ? "firearms" : d.needs === "attribute" ? "body" : undefined });
    });
  };

  const controls = (q: QualityPick, i: number, d?: QualityDef) => (
    <div className="flex flex-wrap items-center gap-2">
      {d?.perLevel && <Stepper size="sm" label={`${q.name} level`} value={q.level} min={d.minLevel} max={d.maxLevel}
        disableUp={q.kind === "positive" ? b.karma.left < q.karma : b.qualities.net + q.karma > KARMA.maxQualityKarma}
        onChange={(v) => patch((x) => { x.qualities[i].level = v; })} />}
      {d?.needs === "skill" && (
        <select className="field w-44" aria-label={`${q.name} skill`} value={q.note} onChange={(e) => patch((x) => { x.qualities[i].note = e.target.value; })}>
          {SKILLS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      {d?.needs === "attribute" && (
        <select className="field w-44" aria-label={`${q.name} attribute`} value={q.note} onChange={(e) => patch((x) => { x.qualities[i].note = e.target.value; })}>
          {ATTRIBUTES.map((a) => <option key={a} value={a}>{ATTR_LABEL[a]}</option>)}
        </select>
      )}
      {d?.needs === "text" ? (
        <input className="field min-w-40 flex-1" aria-label={d.needsLabel} placeholder={d.needsLabel} value={q.note ?? ""} onChange={(e) => patch((x) => { x.qualities[i].note = e.target.value; })} />
      ) : !d?.needs && (
        <input className="field min-w-40 flex-1 text-sm" aria-label={`${q.name} note`} placeholder="Note: what it means for this runner" value={q.note ?? ""}
          onChange={(e) => patch((x) => { x.qualities[i].note = e.target.value || undefined; })} />
      )}
    </div>
  );

  const racial: Chosen[] = METATYPES[c.metatype].racial.map((r) => ({
    key: `racial-${r}`, name: r, cost: "racial", tone: "info", locked: `Comes with being ${METATYPES[c.metatype].name.toLowerCase()}. It does not count toward the limit.`,
    sectionId: book?.sections.find((s) => s.title.toLowerCase() === r.toLowerCase())?.id,
  }));
  const selected: Chosen[] = [
    ...c.qualities.map((q, i) => {
      const d = byId.get(q.id);
      return {
        key: `${q.id}#${i}`, name: `${q.name}${d?.perLevel ? ` ${q.level}` : ""}`, cost: costOf(q, d?.perLevel), tone: q.kind === "positive" ? "pos" : "neg",
        sectionId: d?.sectionId, summary: d?.effectText || d?.blurb, sub: d?.effect ? "Applied on the sheet automatically" : undefined,
        controls: controls(q, i, d),
      } satisfies Chosen;
    }),
    ...racial,
  ];

  return (
    <Selector label="Qualities" tabs={[{ id: "positive", label: "Positive" }, { id: "negative", label: "Negative" }]} tab={tab} onTab={(t) => setTab(t as "positive" | "negative")}
      available={available} selected={selected} onAdd={add}
      onRemove={(key) => patch((x) => { const i = Number(key.split("#")[1]); if (Number.isInteger(i)) x.qualities.splice(i, 1); })}
      emptyAvailable="Mount your rulebook to browse every quality with its cost and full text. You can add one by hand below."
      emptySelected="Qualities make a runner feel like a person. A couple of each is a good start."
      selectedHead={<div className="flex justify-between text-xs text-dim"><span>Taken <b className="num text-fg">{b.qualities.count}</b> / {KARMA.maxQualities}</span><span>Net bonus <b className="num text-fg">{b.qualities.net}</b> / {KARMA.maxQualityKarma}</span></div>}
      footer={
        <details>
          <summary className="cursor-pointer text-xs text-dim">Add a {tab} quality by hand</summary>
          <form className="mt-2 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (!custom.name.trim() || full) return; patch((x) => { x.qualities.push({ id: uid("q"), name: custom.name.trim(), kind: tab, karma: custom.karma, level: 1 }); }); setCustom({ ...custom, name: "" }); }}>
            <input className="field min-w-32 flex-1" placeholder="Name" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} aria-label="Quality name" />
            <input className="field num w-20" type="number" min={1} value={custom.karma} onChange={(e) => setCustom({ ...custom, karma: Math.max(1, Number(e.target.value) || 1) })} aria-label="Karma" />
            <button className="btn" disabled={!custom.name.trim() || full}>Add</button>
          </form>
        </details>
      } />
  );
}
