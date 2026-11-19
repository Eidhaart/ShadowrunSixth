"use client";
import { useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { useRulebook } from "@/lib/store/rulebook";
import { metatypeSection } from "@/lib/sr6/bookLists";
import { ATTRIBUTES, ATTR_ABBR, METATYPES, METATYPE_ORDER, PRIORITY_TABLE, specialRacialAttrs, type MetatypeId } from "@/lib/sr6/data";
import { reconcile } from "@/lib/sr6/derive";
import { sfxUi } from "@/lib/sound";
import { BookText } from "../wizard/BookText";
import { buzz } from "../wizard/fx";
import { Note, type StepProps } from "../ui";

/** Average build from the metatype write-ups (pp. 54-57), used to prefill the Name page. */
export const META_AVERAGE: Record<MetatypeId, { height: string; weight: string }> = {
  human: { height: "1.75 m", weight: "78 kg" },
  elf: { height: "1.9 m", weight: "80 kg" },
  dwarf: { height: "1.2 m", weight: "54 kg" },
  ork: { height: "1.9 m", weight: "128 kg" },
  troll: { height: "2.5 m", weight: "300 kg" },
};

/** Which priorities make a metatype available, and the adjustment points each gives it. */
function offers(m: MetatypeId) {
  return (["A", "B", "C", "D", "E"] as const).filter((l) => PRIORITY_TABLE[l].metatypes.includes(m)).map((l) => ({ l, adj: PRIORITY_TABLE[l].adjustment }));
}

export function Metatype({ c, patch }: StepProps) {
  const book = useRulebook((s) => s.book);
  const mp = c.priorities.metatype;
  const allowed = mp ? PRIORITY_TABLE[mp].metatypes : METATYPE_ORDER;
  const [view, setView] = useState<MetatypeId>(c.metatype);
  const [sheet, setSheet] = useState(false);
  const def = METATYPES[view];
  const special = specialRacialAttrs(view);
  const pick = (m: MetatypeId) => {
    if (!allowed.includes(m)) { sfxUi("deny"); buzz(25); return; }
    if (m !== c.metatype) { patch((x) => { x.metatype = m; reconcile(x); }); sfxUi("add"); buzz(); }
  };
  const look = (m: MetatypeId) => { setView(m); if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches) setSheet(true); };

  const detail = (
    <div key={view} className="wz-rise">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-3xl font-bold">{def.name}</h3>
        {c.metatype === view ? <span className="chip on !py-0.5 text-xs"><Icon name="check" size={12} /> Your metatype</span>
          : <button className="btn primary small" disabled={!allowed.includes(view)} onClick={() => pick(view)}>Become {def.name.toLowerCase()}</button>}
      </div>
      {!allowed.includes(view) && mp && <p className="mt-2 border-l-2 border-danger bg-danger/10 px-3 py-2 text-sm">Not available at Metatype priority {mp}. Available at {offers(view).map((o) => o.l).join(", ")}.</p>}
      <div className="mt-4 grid grid-cols-3 gap-px border border-line bg-line sm:grid-cols-9">
        {[...ATTRIBUTES, "edge" as const].map((a) => {
          const [lo, hi] = def.ranges[a];
          const sp = a === "edge" ? hi !== 6 : special.includes(a) || hi < 6;
          return (
            <div key={a} className="bg-panel px-1 py-2 text-center">
              <div className="text-[10px] uppercase tracking-widest text-dim">{a === "edge" ? "EDG" : ATTR_ABBR[a]}</div>
              <div className={clsx("num font-bold", hi > 6 ? "text-cyan" : hi < 6 ? "text-danger/90" : "")}>{lo}–{hi}</div>
              {sp && <div className="sr-only">differs from human</div>}
            </div>
          );
        })}
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div><dt className="text-xs uppercase tracking-wider text-dim">Racial qualities</dt><dd>{def.racial.length ? def.racial.join(", ") : "None"}</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-dim">Adjustment points</dt><dd className="num">{offers(view).map((o) => `${o.l}: ${o.adj}`).join(" · ")}</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-dim">Average build</dt><dd>{META_AVERAGE[view].height}, {META_AVERAGE[view].weight}</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-dim">Special attributes</dt><dd>{special.length ? special.map((a) => ATTR_ABBR[a]).join(", ") : "Edge only"}</dd></div>
      </dl>
      <div className="mt-5 border-t border-line pt-4"><BookText section={metatypeSection(book, view)} /></div>
    </div>
  );

  return (
    <div>
      {!mp && <div className="mb-3"><Note tone="warn">Pick a Metatype priority first; it decides who is on offer.</Note></div>}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <ul className="sel-pane self-start" aria-label="Metatypes">
          <li className="sel-head"><span>Metatype</span><span className="num normal-case tracking-normal">{mp ? `Priority ${mp} · ${PRIORITY_TABLE[mp].adjustment} adj.` : ""}</span></li>
          {METATYPE_ORDER.map((m) => {
            const ok = allowed.includes(m);
            const on = c.metatype === m;
            return (
              <li key={m} className={clsx("sel-row items-center", !ok && "blocked")} aria-selected={view === m} tabIndex={0} onClick={() => look(m)}
                onDoubleClick={() => pick(m)} onKeyDown={(e) => { if (e.key === "Enter") pick(m); }}>
                <span className={clsx("grid size-5 shrink-0 place-items-center rounded-full border", on ? "border-accent bg-accent text-accentink" : "border-linehi")} aria-hidden>{on && <Icon name="check" size={11} />}</span>
                <div className="min-w-0 flex-1">
                  <div className="nm font-display text-lg font-semibold leading-tight">{METATYPES[m].name}</div>
                  <div className="text-xs text-dim">{ok ? (METATYPES[m].racial.join(", ") || "No racial qualities") : `Needs priority ${offers(m).map((o) => o.l).join("/")}`}</div>
                </div>
                <button className={clsx("btn small !min-h-8", on && "primary")} disabled={!ok} aria-pressed={on} onClick={(e) => { e.stopPropagation(); pick(m); }}>{on ? "Chosen" : "Choose"}</button>
              </li>
            );
          })}
        </ul>
        <section className="sel-pane sel-desc max-lg:hidden"><div className="sel-head"><span>Description</span></div><div className="p-5">{detail}</div></section>
      </div>
      {sheet && (
        <div className="fixed inset-0 z-[70] bg-black/60 lg:hidden" onClick={() => setSheet(false)} role="presentation">
          <div className="sel-sheet sel-desc absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto border-t border-accent bg-bg p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={def.name}>
            <button className="btn small ghost absolute right-2 top-2 z-10" onClick={() => setSheet(false)} aria-label="Close"><Icon name="x" size={16} /></button>
            {detail}
          </div>
        </div>
      )}
    </div>
  );
}
