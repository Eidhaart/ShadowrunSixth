"use client";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { useRulebook } from "@/lib/store/rulebook";
import { parseQualities, type QualityDef } from "@/lib/sr6/qualities";
import { uid } from "@/lib/sr6/character";
import { ATTRIBUTES, ATTR_LABEL, KARMA, SKILLS } from "@/lib/sr6/data";
import { budget } from "@/lib/sr6/derive";
import { Budget, Note, StepHeader, Stepper, type StepProps } from "../ui";

export function Qualities({ c, patch }: StepProps) {
  const book = useRulebook((s) => s.book);
  const defs = useMemo(() => parseQualities(book), [book]);
  const b = budget(c);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"positive" | "negative">("positive");
  const [custom, setCustom] = useState({ name: "", karma: 5, kind: "positive" as "positive" | "negative" });

  const shown = defs.filter((d) => d.kind === kind && (!q || d.name.toLowerCase().includes(q.toLowerCase())));
  const picked = (d: QualityDef) => c.qualities.some((x) => x.id === d.id);

  const add = (d: QualityDef) =>
    patch((x) => {
      x.qualities.push({ id: d.id, name: d.name, kind: d.kind, karma: d.karma, level: d.minLevel, effect: d.effect,
        note: d.needs === "skill" ? "firearms" : d.needs === "attribute" ? "body" : undefined });
    });

  return (
    <div>
      <StepHeader title="Qualities" lead={`Positive qualities cost Karma; negative ones give it back. You can take at most ${KARMA.maxQualities} in total, and the net bonus from negatives is capped at ${KARMA.maxQualityKarma} Karma.`} rule={/^Select Qualities$/i} />
      <div className="mb-5 grid max-w-xl gap-4 sm:grid-cols-2">
        <Budget label="Qualities taken" left={KARMA.maxQualities - b.qualities.count} total={KARMA.maxQualities} />
        <Budget label="Negative bonus used" left={KARMA.maxQualityKarma - Math.min(KARMA.maxQualityKarma, b.qualities.net)} total={KARMA.maxQualityKarma} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <div className="inline-flex border border-line" role="tablist" aria-label="Quality type">
              {(["positive", "negative"] as const).map((k) => (
                <button key={k} role="tab" aria-selected={kind === k} className={clsx("px-3 py-1.5 font-display text-sm", kind === k ? "bg-accent text-accentink" : "hover:text-accent")} onClick={() => setKind(k)}>
                  {k === "positive" ? "Positive" : "Negative"}
                </button>
              ))}
            </div>
            <input className="field min-w-40 flex-1" placeholder="Search qualities" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search qualities" />
          </div>
          {defs.length === 0 && <Note>Mount your rulebook to browse the full list of qualities with their costs. Until then you can add one by hand on the right.</Note>}
          <ul className="max-h-[34rem] divide-y divide-line overflow-auto border border-line">
            {shown.map((d) => (
              <li key={d.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display font-semibold">
                      {d.name}
                      <span className={clsx("num ml-2 text-sm font-normal", d.kind === "positive" ? "text-accent" : "text-cyan")}>
                        {d.kind === "positive" ? "" : "+"}{d.karma} Karma{d.perLevel ? " / level" : ""}
                      </span>
                      {d.effect && <span className="ml-2 text-xs font-normal text-ok">automated</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-dim">{d.effectText || d.blurb}</p>
                    <p className="mt-0.5 text-[11px] text-faint">p.{d.page}</p>
                  </div>
                  <button className="btn small shrink-0" disabled={picked(d) || b.qualities.count >= KARMA.maxQualities} onClick={() => add(d)}>{picked(d) ? "Taken" : "Take"}</button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 text-lg font-semibold">Your qualities</h3>
          {c.qualities.length === 0 && <p className="text-sm text-dim">None yet. Qualities make a runner feel like a person; a couple of each is a good start.</p>}
          <ul className="space-y-2">
            {c.qualities.map((qk, i) => {
              const def = defs.find((d) => d.id === qk.id);
              return (
                <li key={qk.id + i} className="panel quiet p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-display font-semibold">{qk.name} <span className="num text-sm font-normal text-dim">{qk.kind === "positive" ? "-" : "+"}{qk.karma * qk.level} Karma</span></div>
                    <button className="hover:text-danger" onClick={() => patch((x) => { x.qualities.splice(i, 1); })} aria-label={`Remove ${qk.name}`}>×</button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {def?.perLevel && <Stepper size="sm" label={`${qk.name} level`} value={qk.level} min={def.minLevel} max={def.maxLevel} onChange={(v) => patch((x) => { x.qualities[i].level = v; })} />}
                    {def?.needs === "skill" && (
                      <select className="field w-48" aria-label="Skill" value={qk.note} onChange={(e) => patch((x) => { x.qualities[i].note = e.target.value; })}>
                        {SKILLS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    )}
                    {def?.needs === "attribute" && (
                      <select className="field w-48" aria-label="Attribute" value={qk.note} onChange={(e) => patch((x) => { x.qualities[i].note = e.target.value; })}>
                        {ATTRIBUTES.map((a) => <option key={a} value={a}>{ATTR_LABEL[a]}</option>)}
                      </select>
                    )}
                    {def?.needs === "text" && (
                      <input className="field w-56" aria-label={def.needsLabel} placeholder={def.needsLabel} value={qk.note ?? ""} onChange={(e) => patch((x) => { x.qualities[i].note = e.target.value; })} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <details className="mt-6 border border-line p-3">
            <summary className="cursor-pointer font-display text-sm text-dim">Add a quality by hand</summary>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <input className="field w-44" placeholder="Name" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} aria-label="Quality name" />
              <input className="field num w-20" type="number" min={1} value={custom.karma} onChange={(e) => setCustom({ ...custom, karma: Math.max(1, Number(e.target.value) || 1) })} aria-label="Karma" />
              <select className="field w-32" value={custom.kind} onChange={(e) => setCustom({ ...custom, kind: e.target.value as "positive" | "negative" })} aria-label="Type"><option value="positive">Positive</option><option value="negative">Negative</option></select>
              <button className="btn" disabled={!custom.name.trim() || b.qualities.count >= KARMA.maxQualities} onClick={() => { patch((x) => { x.qualities.push({ id: uid("q"), name: custom.name.trim(), kind: custom.kind, karma: custom.karma, level: 1 }); }); setCustom({ ...custom, name: "" }); }}>Add</button>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
