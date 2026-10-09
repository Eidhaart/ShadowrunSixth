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
  const [stepsOpen, setStepsOpen] = useState(false);
  const [sheet, setSheet] = useState(false);

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

  const bud = budget(draft);
  const issues = validate(draft);
  const blockers = issues.filter((i) => i.level === "error");
  const goTo = (where: string) => {
    const map: Record<string, string> = { Concept: "concept", Priorities: "priorities", Metatype: "origin", Adjustment: "origin", Attributes: "attributes", Skills: "skills", Magic: "magic", Qualities: "qualities", Karma: "karma", Gear: "gear" };
    const id = map[where];
    if (id && steps.some((x) => x.id === id)) { setStepId(id); setSheet(false); window.scrollTo({ top: 0 }); }
  };
  const isLast = idx === steps.length - 1;
  const Comp = step.Comp;

  const finish = () => {
    const done = finishDraft();
    if (done) router.push(`/runners/${done.id}`);
  };

  return (
    <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-6 px-4 py-4 md:px-8 md:py-6 lg:grid-cols-[210px_minmax(0,1fr)_300px]">
      {/* phone header: where you are, what is left, and a step list */}
      <div className="no-print sticky top-12 z-20 -mx-4 border-b border-line bg-bg/95 px-4 pb-2 pt-2 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <button className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={stepsOpen} onClick={() => { setStepsOpen(!stepsOpen); setSheet(false); }}>
            <span className="num shrink-0 text-xs text-dim">{idx + 1}/{steps.length}</span>
            <span className="truncate font-display font-semibold text-accent">{step.label}</span>
            <Icon name="chev" size={14} />
          </button>
          <button className="btn small" onClick={() => { setSheet(true); setStepsOpen(false); }}>Runner</button>
        </div>
        <div className="mt-1 h-1 bg-line" aria-hidden><div className="h-full bg-accent transition-[width]" style={{ width: `${((idx + 1) / steps.length) * 100}%` }} /></div>
        <button className="mt-1.5 flex w-full gap-1.5 overflow-x-auto text-left" onClick={() => { setSheet(true); setStepsOpen(false); }} aria-label="Open the runner summary">
          {[["Attr", bud.attributes.left], ["Adj", bud.adjustment.left], ["Skills", bud.skills.left], ["Karma", bud.karma.left]].map(([l, v]) => (
            <span key={l as string} className={clsx("chip shrink-0 !py-0.5 text-xs", (v as number) < 0 && "!border-danger text-danger", v === 0 && "!border-ok text-ok")}>{l} <b className="num">{v}</b></span>
          ))}
          <span className={clsx("chip shrink-0 !py-0.5 text-xs", bud.nuyen.left < 0 && "!border-danger text-danger")}>¥ <b className="num">{bud.nuyen.left.toLocaleString("en-US")}</b></span>
          {blockers.length > 0 && <span className="chip shrink-0 !border-danger !py-0.5 text-xs text-danger">{blockers.length} issue{blockers.length === 1 ? "" : "s"}</span>}
        </button>
        {stepsOpen && (
          <ol className="absolute inset-x-0 top-full max-h-[60dvh] overflow-y-auto border-b border-line bg-bg2 shadow-2xl">
            {steps.map((x, i) => {
              const done = x.done(draft);
              return (
                <li key={x.id}>
                  <button onClick={() => { setStepId(x.id); setStepsOpen(false); window.scrollTo({ top: 0 }); }} aria-current={x.id === step.id ? "step" : undefined}
                    className={clsx("flex min-h-12 w-full items-center gap-3 border-l-2 px-4 text-left font-display", x.id === step.id ? "border-accent bg-panelhi text-accent" : "border-transparent text-dim")}>
                    <span className={clsx("grid h-6 w-6 shrink-0 place-items-center border text-xs", done ? "border-ok bg-ok text-bg" : "border-linehi")}>{done ? <Icon name="check" size={12} /> : i + 1}</span>
                    {x.label}
                  </button>
                </li>
              );
            })}
            <li className="border-t border-line p-2"><button className="btn small ghost danger w-full" onClick={() => { if (confirm("Throw away this unfinished runner?")) { discardDraft(); router.push("/forge"); } }}><Icon name="trash" size={14} /> Discard build</button></li>
          </ol>
        )}
      </div>
      {sheet && (
        <div className="no-print fixed inset-0 z-[60] bg-black/60 md:hidden" onClick={() => setSheet(false)} role="presentation">
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto border-t border-accent bg-bg p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Runner summary">
            <div className="mb-2 flex items-center justify-between"><span className="font-display font-semibold">Your runner so far</span><button className="btn small ghost" onClick={() => setSheet(false)} aria-label="Close"><Icon name="x" size={16} /></button></div>
            <Readout c={draft} onGo={goTo} />
          </div>
        </div>
      )}

      {/* step rail */}
      <nav aria-label="Forge steps" className="hidden min-w-0 md:block lg:sticky lg:top-16 lg:h-fit">
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
        <div className="max-md:h-24" aria-hidden />
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 max-md:fixed max-md:inset-x-0 max-md:bottom-[calc(3.5rem+env(safe-area-inset-bottom))] max-md:z-30 max-md:mt-0 max-md:flex-nowrap max-md:bg-bg2/95 max-md:px-3 max-md:py-2 max-md:backdrop-blur">
          <button className="btn max-md:min-w-0 max-md:flex-1" aria-label="Previous step" disabled={idx === 0} onClick={() => { setStepId(steps[idx - 1].id); window.scrollTo({ top: 0 }); }}><Icon name="back" size={16} /> <span className="max-md:sr-only">{idx > 0 ? steps[idx - 1].label : "Back"}</span></button>
          {isLast ? (
            <div className="flex flex-wrap items-center gap-3 max-md:min-w-0 max-md:flex-[2] max-md:justify-end max-md:gap-2">
              {blockers.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-dim max-md:text-xs"><input type="checkbox" className="accent-[var(--accent)]" checked={saveAnyway} onChange={(e) => setSaveAnyway(e.target.checked)} /> Save with open problems</label>
              )}
              <button className="btn primary" disabled={blockers.length > 0 && !saveAnyway} onClick={finish}><Icon name="check" size={16} /> Finish and open sheet</button>
            </div>
          ) : (
            <button className="btn primary max-md:min-w-0 max-md:flex-[2]" onClick={() => { setStepId(steps[idx + 1].id); window.scrollTo({ top: 0 }); }}><span className="max-md:truncate">{steps[idx + 1].label}</span> <Icon name="chev" size={16} /></button>
          )}
        </div>
      </div>

      <div className="hidden min-w-0 md:block lg:sticky lg:top-16 lg:h-fit"><Readout c={draft} onGo={goTo} /></div>
    </div>
  );
}
