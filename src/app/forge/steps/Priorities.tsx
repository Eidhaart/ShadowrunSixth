"use client";
import clsx from "clsx";
import { PRIORITY_COLUMNS, PRIORITY_LEVELS, PRIORITY_TABLE, METATYPES, type PriorityColumn, type PriorityLevel } from "@/lib/sr6/data";
import { reconcile } from "@/lib/sr6/derive";
import { Note, StepHeader, type StepProps } from "../ui";

const PRESETS: { name: string; blurb: string; set: Record<PriorityColumn, PriorityLevel> }[] = [
  { name: "Mage", blurb: "Book example: Magic A, Attributes B, Skills C", set: { magic: "A", attributes: "B", skills: "C", metatype: "D", resources: "E" } },
  { name: "Street samurai", blurb: "Book example: Skills A, Resources B, Attributes C", set: { skills: "A", resources: "B", attributes: "C", metatype: "D", magic: "E" } },
  { name: "Decker", blurb: "Attributes A, Resources B, Skills C", set: { attributes: "A", resources: "B", skills: "C", metatype: "D", magic: "E" } },
  { name: "Rigger", blurb: "Resources A, Skills B, Attributes C", set: { resources: "A", skills: "B", attributes: "C", metatype: "D", magic: "E" } },
];

function cellText(col: PriorityColumn, lvl: PriorityLevel): { main: string; sub?: string } {
  const row = PRIORITY_TABLE[lvl];
  switch (col) {
    case "metatype":
      return { main: `${row.adjustment} points`, sub: row.metatypes.length === 5 ? "Any metatype" : row.metatypes.map((m) => METATYPES[m].name).join(", ") };
    case "attributes":
      return { main: `${row.attributes} points` };
    case "skills":
      return { main: `${row.skills} points` };
    case "magic": {
      if (row.magic.mundane !== undefined) return { main: "Mundane" };
      return { main: `Magic ${row.magic.full}`, sub: `Aspected ${row.magic.aspected}, Resonance ${row.magic.technomancer}` };
    }
    case "resources":
      return { main: `${row.resources.toLocaleString("en-US")}¥` };
  }
}

export function Priorities({ c, patch }: StepProps) {
  const assign = (col: PriorityColumn, lvl: PriorityLevel) =>
    patch((d) => {
      const prev = d.priorities[col];
      const holder = (Object.keys(d.priorities) as PriorityColumn[]).find((k) => k !== col && d.priorities[k] === lvl);
      if (holder) {
        if (prev) d.priorities[holder] = prev;
        else delete d.priorities[holder];
      }
      d.priorities[col] = lvl;
      reconcile(d);
    });

  const clear = () => patch((d) => { d.priorities = {}; });

  return (
    <div>
      <StepHeader
        title="Set your priorities"
        lead="Give each of the five categories one letter, A to E, and use every letter once. Picking a letter someone else holds swaps the two. Nothing is final: change it any time before you finish."
        rule={/^Select Character Priorities$/i}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-dim">Start from:</span>
        {PRESETS.map((p) => (
          <button key={p.name} className="chip hover:border-accent" title={p.blurb} onClick={() => patch((d) => { d.priorities = { ...p.set }; reconcile(d); })}>{p.name}</button>
        ))}
        <button className="chip" onClick={clear}>Clear</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-1.5" aria-label="Priority table">
          <thead>
            <tr>
              <th className="w-12" />
              {PRIORITY_COLUMNS.map((col) => (
                <th key={col.key} className="px-2 pb-1 text-left align-bottom">
                  <div className="font-display text-base font-semibold">{col.label}</div>
                  <div className="text-xs font-normal text-faint">{col.blurb}</div>
                  <div className="mt-1 text-xs">Chosen: <b className={clsx("num", c.priorities[col.key] ? "text-accent" : "text-faint")}>{c.priorities[col.key] ?? "none"}</b></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRIORITY_LEVELS.map((lvl) => (
              <tr key={lvl}>
                <th scope="row" className="font-display text-3xl text-dim">{lvl}</th>
                {PRIORITY_COLUMNS.map((col) => {
                  const on = c.priorities[col.key] === lvl;
                  const held = !on && (Object.keys(c.priorities) as PriorityColumn[]).some((k) => c.priorities[k] === lvl);
                  const t = cellText(col.key, lvl);
                  return (
                    <td key={col.key} className="p-0 align-top">
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => assign(col.key, lvl)}
                        className={clsx(
                          "h-full min-h-[4.5rem] w-full border px-3 py-2 text-left transition-colors",
                          on ? "border-accent bg-accent/15 text-fg shadow-[0_0_18px_-6px_var(--accent)]" : "border-line bg-panel hover:border-linehi",
                          held && "opacity-60",
                        )}
                      >
                        <div className={clsx("font-display font-semibold", on && "text-accent")}>{t.main}</div>
                        {t.sub && <div className="mt-0.5 text-xs text-dim">{t.sub}</div>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Note>Lower runner? Take values from one row lower than your pick. Prime runner? Double the customization Karma from 50 to 100 in the Karma step.</Note>
        <Note tone="warn">Humans cannot take Metatype A or B, and elves cannot take Metatype A. Magic or Resonance at E means mundane.</Note>
      </div>
    </div>
  );
}
