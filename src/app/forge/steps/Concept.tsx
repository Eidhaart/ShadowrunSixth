"use client";
import { ARCHETYPES } from "@/lib/sr6/data";
import { Field, StepHeader, type StepProps, RuleLink } from "../ui";

export function Concept({ c, patch }: StepProps) {
  return (
    <div>
      <StepHeader title="Who are you running?" lead="Start with the person. Name, street alias and a one-line concept are enough; the history can grow as the numbers do." rule={/^Step One/i} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name"><input className="field" value={c.name} onChange={(e) => patch((d) => { d.name = e.target.value; })} placeholder="Legal name, if they have one" /></Field>
        <Field label="Street alias"><input className="field" value={c.alias} onChange={(e) => patch((d) => { d.alias = e.target.value; })} placeholder="What the shadows call them" /></Field>
        <Field label="Player"><input className="field" value={c.player} onChange={(e) => patch((d) => { d.player = e.target.value; })} /></Field>
        <Field label="Archetype (optional)">
          <select className="field" value={c.archetype ?? ""} onChange={(e) => patch((d) => { d.archetype = e.target.value || undefined; })}>
            <option value="">Not decided</option>
            {ARCHETYPES.map((a) => <option key={a}>{a}</option>)}
          </select>
        </Field>
      </div>
      <div className="mt-4 grid gap-4">
        <Field label="Concept" hint="One or two sentences: what do they do, and what do they want?">
          <textarea className="field min-h-20" value={c.concept} onChange={(e) => patch((d) => { d.concept = e.target.value; })} />
        </Field>
        <Field label="Background" hint="Where they were born, raised and trained, and how they feel about the dark side of the Sixth World.">
          <textarea className="field min-h-36" value={c.background} onChange={(e) => patch((d) => { d.background = e.target.value; })} />
        </Field>
      </div>
      <RuleLink match={/^History$/i}>Read the history prompts in the rulebook</RuleLink>
    </div>
  );
}
