"use client";
import { useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { MAGIC_TYPE_LABEL, PRIORITY_TABLE, type MagicType } from "@/lib/sr6/data";
import { changeMagicType, derive } from "@/lib/sr6/derive";
import { sfxUi } from "@/lib/sound";
import { buzz } from "../wizard/fx";
import { MysticSplit, Tradition } from "../steps/MagicStep";
import { Note, RuleLink, type StepProps } from "../ui";

const BLURB: Record<MagicType, { line: string; gets: string[] }> = {
  mundane: { line: "No Magic or Resonance. Every point goes into flesh, skill and chrome.", gets: ["Full use of cyberware without losing anything magical"] },
  full: { line: "Spellcasting, summoning and enchanting, with astral perception and projection.", gets: ["Spells or rituals: priority Magic × 2", "Tradition decides drain"] },
  aspected: { line: "Mastery of one branch of magic: sorcery, conjuring or enchanting.", gets: ["Higher Magic than a full magician", "Sorcerers get spells: priority Magic × 2"] },
  mystic: { line: "Splits Magic between adept powers and spellcasting.", gets: ["Each priority Magic point: 1 Power Point or 2 spells", "Astral perception through a power only"] },
  adept: { line: "Magic turned inward: physical powers, no spellcasting.", gets: ["Power Points equal to Magic", "Powers bought on their own page"] },
  technomancer: { line: "Resonance instead of Magic: the Matrix without a deck.", gets: ["Complex forms: priority Resonance × 2", "Living persona and sprites"] },
};

const ASPECTS = [
  { id: "sorcery", name: "Sorcery", blurb: "Spellcasting, counterspelling and rituals. The only aspect that starts with spells." },
  { id: "conjuring", name: "Conjuring", blurb: "Summoning, binding and banishing spirits." },
  { id: "enchanting", name: "Enchanting", blurb: "Alchemy, artificing and disenchanting." },
] as const;

export function MagicRes({ c, patch }: StepProps) {
  const gp = c.priorities.magic;
  const row = gp ? PRIORITY_TABLE[gp] : null;
  const d = derive(c);
  const [pending, setPending] = useState<{ t: MagicType; lost: string[] } | null>(null);
  const choose = (t: MagicType) => {
    const ok = row ? row.magic[t] !== undefined || t === "mundane" : t === "mundane";
    if (!ok) { sfxUi("deny"); buzz(25); return; }
    if (t === c.magicType) { setPending(null); return; }
    const lost = changeMagicType(JSON.parse(JSON.stringify(c)), t);
    if (lost.length) setPending({ t, lost });
    else { setPending(null); patch((x) => { changeMagicType(x, t); }); sfxUi("add"); buzz(); }
  };

  return (
    <div>
      {!gp && <div className="mb-3"><Note tone="warn">Pick a Magic or Resonance priority to open these paths.</Note></div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(MAGIC_TYPE_LABEL) as MagicType[]).map((t, i) => {
          const rating = row?.magic[t];
          const ok = row ? rating !== undefined || t === "mundane" : t === "mundane";
          const on = c.magicType === t;
          return (
            <button key={t} type="button" aria-pressed={on} disabled={!ok} onClick={() => choose(t)} style={{ animationDelay: `${i * 45}ms` }}
              className={clsx("wz-rise group relative overflow-hidden border p-4 text-left transition-colors", on ? "border-accent bg-accent/[.08]" : "border-line hover:border-linehi", !ok && "cursor-not-allowed opacity-35")}>
              {on && <span className="absolute right-0 top-0 grid size-7 place-items-center bg-accent text-accentink" aria-hidden><Icon name="check" size={14} /></span>}
              <div className="flex items-baseline justify-between gap-3 pr-6">
                <span className={clsx("font-display text-xl font-bold", on && "text-accent")}>{MAGIC_TYPE_LABEL[t]}</span>
                {rating ? <span className="num text-sm text-dim">{t === "technomancer" ? "RES" : "MAG"} <b className="text-fg">{rating}</b></span> : null}
              </div>
              <p className="mt-1 text-sm text-dim">{BLURB[t].line}</p>
              <ul className="mt-2 space-y-0.5 text-xs text-faint">{BLURB[t].gets.map((g) => <li key={g}>› {g}</li>)}</ul>
              {!ok && gp && <p className="mt-2 text-xs text-danger">Not on offer at priority {gp}</p>}
            </button>
          );
        })}
      </div>

      {pending && (
        <div className="wz-rise mt-4 max-w-2xl" role="alertdialog" aria-label="Confirm magic type change">
          <Note tone="warn">
            <div className="font-semibold">Switch to {MAGIC_TYPE_LABEL[pending.t]}?</div>
            <p className="mt-1">A {MAGIC_TYPE_LABEL[pending.t].toLowerCase()} cannot keep these, so they go: {pending.lost.join(", ")}.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn small primary" onClick={() => { const t = pending.t; setPending(null); patch((x) => { changeMagicType(x, t); }); sfxUi("remove"); }}>Switch and remove them</button>
              <button className="btn small" onClick={() => setPending(null)}>Keep {MAGIC_TYPE_LABEL[c.magicType]}</button>
            </div>
          </Note>
        </div>
      )}

      {c.magicType === "aspected" && (
        <section className="mt-8">
          <h3 className="mb-1 text-xl font-semibold">Aspect</h3>
          <p className="mb-3 max-w-2xl text-sm text-dim">You use one of the three magic skills. The other two stay closed for this runner.</p>
          <div className="grid max-w-4xl gap-3 sm:grid-cols-3">
            {ASPECTS.map((a) => {
              const on = c.aspect === a.id;
              return (
                <button key={a.id} type="button" aria-pressed={on} onClick={() => { patch((x) => { x.aspect = a.id; }); sfxUi("add"); }}
                  className={clsx("border p-3 text-left transition-colors", on ? "border-accent bg-accent/10" : "border-line hover:border-linehi")}>
                  <div className={clsx("font-display text-lg font-semibold", on && "text-accent")}>{a.name}</div>
                  <p className="mt-1 text-sm text-dim">{a.blurb}</p>
                </button>
              );
            })}
          </div>
          {!c.aspect && <p className="mt-2 text-xs text-accent">Choose one before you buy magic skills.</p>}
        </section>
      )}

      {(c.magicType === "full" || c.magicType === "aspected" || c.magicType === "mystic") && <div className="mt-8"><Tradition c={c} patch={patch} /></div>}
      {c.magicType === "mystic" && <MysticSplit c={c} patch={patch} />}
      {c.magicType === "technomancer" && (
        <section className="mt-8 max-w-2xl">
          <h3 className="mb-1 text-xl font-semibold">Living persona</h3>
          <p className="text-sm text-dim">Your persona is built from your mental attributes and Resonance {d.resonance}; it appears on the sheet once you finish. Complex forms come on their own page.</p>
        </section>
      )}
      <div className="mt-6"><RuleLink match={/^Magic\/Resonance$/i} /></div>
    </div>
  );
}
