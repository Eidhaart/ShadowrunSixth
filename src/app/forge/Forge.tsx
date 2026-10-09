"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { useRunners } from "@/lib/store/characters";
import { budget, validate } from "@/lib/sr6/derive";
import type { Character } from "@/lib/sr6/character";
import { Readout } from "./Readout";
import { Concept } from "./steps/Concept";
import { Priorities } from "./steps/Priorities";
import { Origin } from "./steps/Origin";
import { Attributes } from "./steps/Attributes";
import { Skills } from "./steps/Skills";
import { MagicStep } from "./steps/MagicStep";
import { Qualities } from "./steps/Qualities";
import { KarmaStep } from "./steps/KarmaStep";
import { GearStep } from "./steps/GearStep";
import { Review } from "./steps/Review";

interface StepDef {
  id: string;
  label: string;
  show?: (c: Character) => boolean;
  done: (c: Character) => boolean;
  Comp: React.ComponentType<{ c: Character; patch: (fn: (c: Character) => void) => void }>;
}

const STEPS: StepDef[] = [
  { id: "concept", label: "Concept", done: (c) => !!(c.name || c.alias), Comp: Concept },
  { id: "priorities", label: "Priorities", done: (c) => Object.keys(c.priorities).length === 5, Comp: Priorities },
  { id: "origin", label: "Metatype and magic", done: (c) => budget(c).adjustment.left === 0 && Object.keys(c.priorities).length === 5, Comp: Origin },
  { id: "attributes", label: "Attributes", done: (c) => budget(c).attributes.left === 0 && budget(c).attributes.total > 0, Comp: Attributes },
  { id: "skills", label: "Skills", done: (c) => budget(c).skills.left === 0 && budget(c).skills.total > 0, Comp: Skills },
  { id: "magic", label: "Spells and powers", show: (c) => c.magicType !== "mundane", done: (c) => c.spells.length + c.complexForms.length + c.adeptPowers.length > 0, Comp: MagicStep },
  { id: "qualities", label: "Qualities", done: (c) => c.qualities.length > 0, Comp: Qualities },
  { id: "karma", label: "Karma", done: (c) => { const k = budget(c).karma.left; return k >= 0 && k <= 5; }, Comp: KarmaStep },
  { id: "gear", label: "Gear and lifestyle", done: (c) => { const n = budget(c).nuyen.left; return n >= 0 && n <= 5000 && c.gear.length > 0; }, Comp: GearStep },
  { id: "review", label: "Review", done: (c) => validate(c).every((i) => i.level !== "error"), Comp: Review },
];

export function Forge() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("edit");
  const draft = useRunners((s) => s.draft);
  const runners = useRunners((s) => s.runners);
  const { startDraft, patchDraft, discardDraft, finishDraft } = useRunners();
  const [stepId, setStepId] = useState("concept");
  const [hydrated, setHydrated] = useState(false);
  const [saveAnyway, setSaveAnyway] = useState(false);

  useEffect(() => {
    useRunners.persist.rehydrate();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !editId) return;
    const existing = runners[editId];
    if (existing && useRunners.getState().draft?.id !== editId) startDraft(existing);
  }, [hydrated, editId, runners, startDraft]);

  const steps = useMemo(() => (draft ? STEPS.filter((s) => !s.show || s.show(draft)) : STEPS), [draft]);
  const idx = Math.max(0, steps.findIndex((s) => s.id === stepId));
  const step = steps[idx];

  if (!hydrated) return <div className="p-8 text-dim">Warming up the forge</div>;

  if (!draft) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
        <h1 className="text-4xl font-bold">The Forge</h1>
        <p className="mt-3 max-w-xl text-dim">Build a runner step by step. The Forge applies the Priority System, checks every limit as you go, and leaves you with a fully automated sheet.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn primary" onClick={() => { startDraft(); setStepId("concept"); }}><Icon name="forge" size={18} /> Start a new runner</button>
        </div>
      </div>
    );
  }

  const issues = validate(draft);
  const blockers = issues.filter((i) => i.level === "error");
  const isLast = idx === steps.length - 1;
  const Comp = step.Comp;

  const finish = () => {
    const done = finishDraft();
    if (done) router.push(`/runners/${done.id}`);
  };

  return (
    <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-6 md:px-8 lg:grid-cols-[210px_minmax(0,1fr)_300px]">
      {/* step rail */}
      <nav aria-label="Forge steps" className="lg:sticky lg:top-16 lg:h-fit">
        <ol className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {steps.map((s, i) => {
            const on = s.id === step.id;
            const done = s.done(draft);
            return (
              <li key={s.id} className="shrink-0">
                <button
                  onClick={() => setStepId(s.id)}
                  aria-current={on ? "step" : undefined}
                  className={clsx("flex w-full items-center gap-2.5 border-l-2 px-3 py-2 text-left font-display text-sm transition-colors", on ? "border-accent bg-panelhi text-accent" : "border-line text-dim hover:text-fg")}
                >
                  <span className={clsx("grid h-5 w-5 shrink-0 place-items-center border text-[11px]", done ? "border-ok bg-ok text-bg" : on ? "border-accent" : "border-linehi")}>
                    {done ? <Icon name="check" size={12} /> : i + 1}
                  </span>
                  <span className="whitespace-nowrap">{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <button className="btn small ghost mt-4 hidden lg:inline-flex" onClick={() => { if (confirm("Throw away this unfinished runner?")) { discardDraft(); router.push("/forge"); } }}>
          <Icon name="trash" size={14} /> Discard build
        </button>
      </nav>

      {/* step body */}
      <div className="min-w-0">
        <div key={step.id}><Comp c={draft} patch={patchDraft} /></div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <button className="btn" disabled={idx === 0} onClick={() => setStepId(steps[idx - 1].id)}><Icon name="back" size={16} /> {idx > 0 ? steps[idx - 1].label : "Back"}</button>
          {isLast ? (
            <div className="flex flex-wrap items-center gap-3">
              {blockers.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-dim"><input type="checkbox" className="accent-[var(--accent)]" checked={saveAnyway} onChange={(e) => setSaveAnyway(e.target.checked)} /> Save with open problems</label>
              )}
              <button className="btn primary" disabled={blockers.length > 0 && !saveAnyway} onClick={finish}><Icon name="check" size={16} /> Finish and open sheet</button>
            </div>
          ) : (
            <button className="btn primary" onClick={() => setStepId(steps[idx + 1].id)}>{steps[idx + 1].label} <Icon name="chev" size={16} /></button>
          )}
        </div>
      </div>

      <div className="lg:sticky lg:top-16 lg:h-fit"><Readout c={draft} /></div>
    </div>
  );
}
