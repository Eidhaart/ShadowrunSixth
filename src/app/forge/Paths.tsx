"use client";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { useRunners } from "@/lib/store/characters";
import { BUILDS, PREMADES, TEMPLATES, fromBuild, fromPremade, portraitUrl, type Build, type Premade } from "@/lib/sr6/premades";
import { isPortrait } from "@/lib/portrait";
import { derive } from "@/lib/sr6/derive";
import { ATTRIBUTES, ATTR_ABBR, MAGIC_TYPE_LABEL, METATYPES, SKILL_BY_ID } from "@/lib/sr6/data";
import { ArchetypeIcon, BlankArt, Bust, PremadeArt, TemplateArt } from "./PathArt";

type View = "choose" | "premade" | "template";

/** One of the three tall choice cards. */
function PathCard({ label, title, lead, count, art, onPick, delay }: { label: string; title: string; lead: string; count?: string; art: React.ReactNode; onPick: () => void; delay: number }) {
  return (
    <div className="path-in flex min-w-0 flex-col" style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-2 text-center font-ui text-sm font-semibold tracking-[.18em] text-accent">{label}</div>
      <button onClick={onPick} className="path-card group relative flex aspect-[3/4.2] w-full flex-col overflow-hidden text-left max-md:aspect-[4/3]">
        <span className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.04]">{art}</span>
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-bg via-bg/80 to-transparent" />
        <span className="relative mt-auto block p-4">
          <span className="block font-display text-2xl font-bold leading-tight">{title}</span>
          <span className="mt-1 block text-sm text-dim">{lead}</span>
          {count && <span className="num mt-2 inline-block text-xs text-[color:var(--accent-2,var(--accent))]">{count}</span>}
        </span>
        <span className="path-ticks" aria-hidden="true" />
      </button>
    </div>
  );
}

function PriorityRow({ b }: { b: Build }) {
  const cols = [["metatype", "Meta"], ["attributes", "Attr"], ["skills", "Skill"], ["magic", "Magic"], ["resources", "¥"]] as const;
  return (
    <div className="grid grid-cols-5 gap-1 text-center">
      {cols.map(([k, l]) => (
        <div key={k} className="border border-line py-1">
          <div className="text-[10px] text-faint">{l}</div>
          <div className={clsx("num font-semibold", b.priorities[k] === "A" ? "text-accent" : b.priorities[k] === "B" ? "text-[color:var(--accent-2,var(--accent))]" : "")}>{b.priorities[k]}</div>
        </div>
      ))}
    </div>
  );
}

function TopSkills({ c }: { c: ReturnType<typeof fromBuild> }) {
  const top = Object.entries(c.skills).sort((a, b) => b[1].pts + b[1].kar - (a[1].pts + a[1].kar)).slice(0, 4);
  return (
    <div className="flex flex-wrap gap-1">
      {top.map(([id, e]) => <span key={id} className="chip">{SKILL_BY_ID[id]?.name} <b className="num text-fg">{e.pts + e.kar}</b></span>)}
    </div>
  );
}

function AttrStrip({ c }: { c: ReturnType<typeof fromBuild> }) {
  const d = derive(c);
  return (
    <div className="grid grid-cols-8 gap-0.5 text-center">
      {ATTRIBUTES.map((a) => (
        <div key={a} className="border border-line py-0.5">
          <div className="text-[9px] text-faint">{ATTR_ABBR[a]}</div>
          <div className="num text-sm font-semibold">{d.attrs[a]}</div>
        </div>
      ))}
    </div>
  );
}

function PremadeCard({ p, onTake, onEdit }: { p: Premade; onTake: () => void; onEdit: () => void }) {
  const c = useMemo(() => fromPremade(p), [p]);
  const d = derive(c);
  const b = BUILDS.find((x) => x.id === p.build)!;
  const url = portraitUrl(p);
  return (
    <article className="panel flex flex-col overflow-hidden">
      <div className="relative -mb-10 h-64 overflow-hidden border-b border-line bg-bg2">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`${p.alias}, ${b.archetype}`} className="size-full object-cover object-[50%_20%]" loading="lazy" />
        ) : (
          <Bust seed={p.alias} className="mx-auto h-full" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-panel via-panel/70 to-transparent" />
      </div>
      <div className="relative flex flex-1 flex-col px-4 pb-4">
        <div className="flex items-center gap-1.5 text-xs text-[color:var(--accent-2,var(--accent))]"><ArchetypeIcon id={b.id} size={14} /> {b.archetype}</div>
        <h3 className="font-display text-2xl font-bold leading-tight">{p.alias}</h3>
        <div className="text-xs text-dim">{p.name} · {METATYPES[c.metatype].name}{b.magicType !== "mundane" ? ` · ${MAGIC_TYPE_LABEL[b.magicType]}` : ""}</div>
      <p className="mt-3 text-sm italic text-dim">{p.concept}</p>
      <div className="mt-3"><AttrStrip c={c} /></div>
      <div className="num mt-2 flex flex-wrap gap-x-3 text-xs text-dim">
        <span>Init <b className="text-fg">{d.initiative.rank}+{d.initiative.dice}D6</b></span>
        <span>DR <b className="text-fg">{d.defenseRating}</b></span>
        <span>Edge <b className="text-fg">{d.edge}</b></span>
        {c.magicType !== "mundane" && <span>{c.magicType === "technomancer" ? "RES" : "MAG"} <b className="text-fg">{c.magicType === "technomancer" ? d.resonance : d.magic}</b></span>}
        <span>Ess <b className="text-fg">{d.essence}</b></span>
      </div>
      <div className="mt-2"><TopSkills c={c} /></div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs text-dim">Story and kit</summary>
        <p className="mt-1 text-dim">{p.background}</p>
        <p className="mt-2 text-xs text-faint">{c.gear.map((g) => g.name).join(", ")}</p>
      </details>
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <button className="btn primary flex-1" onClick={onTake}><Icon name="check" size={15} /> Take {p.alias}</button>
        <button className="btn" onClick={onEdit}><Icon name="forge" size={15} /> Tweak in the Forge</button>
      </div>
      </div>
    </article>
  );
}

function TemplateCard({ b, onUse }: { b: Build; onUse: () => void }) {
  const c = useMemo(() => fromBuild(b), [b]);
  return (
    <article className="panel flex flex-col p-4">
      <div className="flex items-center gap-2 text-[color:var(--accent-2,var(--accent))]"><ArchetypeIcon id={b.id} /><span className="text-xs">{METATYPES[b.metatype].name}{b.magicType !== "mundane" ? ` · ${MAGIC_TYPE_LABEL[b.magicType]}` : ""}</span></div>
      <h3 className="mt-1 font-display text-2xl font-bold leading-tight">{b.archetype}</h3>
      <p className="mt-1 text-sm text-dim">{b.role}</p>
      <div className="mt-3"><PriorityRow b={b} /></div>
      <div className="mt-2"><AttrStrip c={c} /></div>
      <div className="mt-2"><TopSkills c={c} /></div>
      {(b.spells?.length || b.forms?.length) ? <p className="mt-2 text-xs text-faint">{(b.spells ?? b.forms)!.join(", ")}</p> : null}
      <div className="mt-auto pt-4">
        <button className="btn primary w-full" onClick={onUse}><Icon name="forge" size={15} /> Start from this template</button>
      </div>
    </article>
  );
}

/** The Forge's front door: a ready runner, a template, or a blank build. */
/** The premade as a character, with its portrait copied in as a data URL so it travels with exports. */
async function premadeWithPortrait(p: Premade) {
  const c = fromPremade(p);
  const url = portraitUrl(p);
  if (!url) return c;
  try {
    const blob = await (await fetch(url)).blob();
    const data = await new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = bad; r.readAsDataURL(blob); });
    if (isPortrait(data)) c.portrait = data;
  } catch { /* offline: the runner just has no picture */ }
  return c;
}

export function Paths({ onStarted, onTaken }: { onStarted: () => void; onTaken: (id: string) => void }) {
  const { startDraft, finishDraft } = useRunners();
  const [view, setView] = useState<View>("choose");

  if (view === "premade" || view === "template") {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
        <button className="btn small ghost mb-3" onClick={() => setView("choose")}><Icon name="back" size={14} /> All three paths</button>
        <h1 className="text-3xl font-bold md:text-4xl">{view === "premade" ? "Ready to run" : "Start from a template"}</h1>
        <p className="mt-1 max-w-2xl text-dim">
          {view === "premade"
            ? "Finished runners with a story, gear and contacts. Take one straight to the table, or open it in the Forge and make it yours."
            : "The numbers are done: priorities, metatype, attributes, skills and magic. You walk through the Forge, name them, change anything, and buy your own gear."}
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {view === "premade"
            ? [...PREMADES].sort((a, b) => Number(!!b.portrait) - Number(!!a.portrait)).map((p) => (
                <PremadeCard key={p.alias} p={p}
                  onTake={async () => { startDraft(await premadeWithPortrait(p)); const done = finishDraft(); if (done) onTaken(done.id); }}
                  onEdit={async () => { startDraft(await premadeWithPortrait(p)); onStarted(); }} />
              ))
            : TEMPLATES.map((b) => <TemplateCard key={b.id} b={b} onUse={() => { startDraft(fromBuild(b)); onStarted(); }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
      <div className="mb-8 text-center">
        <h1 className="mx-auto text-4xl font-bold md:text-5xl">Choose your path</h1>
        <p className="mx-auto mt-2 max-w-xl text-dim">Every runner comes out of the Forge. How much of the work do you want done for you?</p>
      </div>
      <div className="grid gap-5 md:grid-cols-3 md:gap-6">
        <PathCard delay={0} label="PREMADE" title="Ready to run" lead="A finished runner with a story, gear and contacts." count={`${PREMADES.length} runners`} art={<PremadeArt />} onPick={() => setView("premade")} />
        <PathCard delay={90} label="TEMPLATE" title="Start from a template" lead="Archetype numbers filled in. You name them and finish the build." count={`${TEMPLATES.length} archetypes`} art={<TemplateArt />} onPick={() => setView("template")} />
        <PathCard delay={180} label="FORGE" title="From scratch" lead="A blank runner. Every choice is yours, step by step." art={<BlankArt />} onPick={() => { startDraft(); onStarted(); }} />
      </div>
    </div>
  );
}
