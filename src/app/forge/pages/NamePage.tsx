"use client";
import { ARCHETYPES, METATYPES } from "@/lib/sr6/data";
import type { Bio } from "@/lib/sr6/character";
import { PortraitPicker } from "../PortraitPicker";
import { Field, RuleLink, type StepProps } from "../ui";
import { META_AVERAGE } from "./Metatype";

const BIO: { k: keyof Bio; label: string; ph: string }[] = [
  { k: "gender", label: "Gender", ph: "" }, { k: "age", label: "Age", ph: "27" }, { k: "height", label: "Height", ph: "" },
  { k: "weight", label: "Weight", ph: "" }, { k: "hair", label: "Hair", ph: "Shaved, chrome-blue" }, { k: "eyes", label: "Eyes", ph: "Cybereyes, amber" }, { k: "skin", label: "Skin", ph: "" },
];

export function NamePage({ c, patch }: StepProps) {
  const avg = META_AVERAGE[c.metatype];
  const setBio = (k: keyof Bio, v: string) => patch((x) => { const b = { ...(x.bio ?? {}) }; if (v) b[k] = v; else delete b[k]; x.bio = b; });
  return (
    <div>
      <div className="grid gap-5 md:grid-cols-[13rem_1fr]">
        <PortraitPicker value={c.portrait} name={c.alias || c.name} onChange={(v) => patch((d) => { if (v) d.portrait = v; else delete d.portrait; })} />
        <div className="grid content-start gap-4 md:grid-cols-2">
          <Field label="Street alias"><input className="field font-display text-lg" value={c.alias} onChange={(e) => patch((d) => { d.alias = e.target.value; })} placeholder="What the shadows call them" /></Field>
          <Field label="Name"><input className="field" value={c.name} onChange={(e) => patch((d) => { d.name = e.target.value; })} placeholder="Legal name, if they have one" /></Field>
          <Field label="Player"><input className="field" value={c.player} onChange={(e) => patch((d) => { d.player = e.target.value; })} /></Field>
          <Field label="Archetype">
            <select className="field" value={c.archetype ?? ""} onChange={(e) => patch((d) => { d.archetype = e.target.value || undefined; })}>
              <option value="">Not decided</option>
              {ARCHETYPES.map((a) => <option key={a}>{a}</option>)}
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Concept" hint="One or two sentences: what do they do, and what do they want?">
              <textarea className="field min-h-16" value={c.concept} onChange={(e) => patch((d) => { d.concept = e.target.value; })} />
            </Field>
          </div>
        </div>
      </div>

      <section className="mt-6">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-semibold">Appearance</h3>
          <button className="btn small" onClick={() => patch((x) => { x.bio = { ...(x.bio ?? {}), height: x.bio?.height || avg.height, weight: x.bio?.weight || avg.weight }; })}>
            Use {METATYPES[c.metatype].name.toLowerCase()} averages ({avg.height}, {avg.weight})
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {BIO.map((f) => (
            <Field key={f.k} label={f.label}><input className="field" value={c.bio?.[f.k] ?? ""} placeholder={f.k === "height" ? avg.height : f.k === "weight" ? avg.weight : f.ph} onChange={(e) => setBio(f.k, e.target.value)} /></Field>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-4">
        <Field label="Background" hint="Where they were born, raised and trained, and how they feel about the dark side of the Sixth World.">
          <textarea className="field min-h-36" value={c.background} onChange={(e) => patch((d) => { d.background = e.target.value; })} />
        </Field>
        <Field label="Notes"><textarea className="field min-h-20" value={c.notes} onChange={(e) => patch((d) => { d.notes = e.target.value; })} /></Field>
      </div>
      <RuleLink match={/^History$/i}>Read the history prompts in the rulebook</RuleLink>
    </div>
  );
}
