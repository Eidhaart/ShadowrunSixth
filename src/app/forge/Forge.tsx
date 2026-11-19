"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { useRunners } from "@/lib/store/characters";
import { budget, derive, validate } from "@/lib/sr6/derive";
import { sfxUi } from "@/lib/sound";
import { Readout } from "./Readout";
import { Paths } from "./Paths";
import { RuleLink } from "./ui";
import { Meter } from "./wizard/fx";
import { GoContext, PAGES, issuePage, pageState, type PageState } from "./wizard/pages";

const yen = (n: number) => `${Math.round(n).toLocaleString("en-US")}¥`;
const STATE_ICON: Record<PageState, string> = { done: "check", warn: "!", error: "×", todo: "" };

/**
 * The Forge: a page-by-page generator in the order a priority build is made, with the budgets that
 * matter riding along at the top of every page.
 */
export function Forge() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("edit");
  const draft = useRunners((s) => s.draft);
  const runners = useRunners((s) => s.runners);
  const { startDraft, patchDraft, discardDraft, finishDraft } = useRunners();
  const [pageId, setPageId] = useState("method");
  const [hydrated, setHydrated] = useState(false);
  const [saveAnyway, setSaveAnyway] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);

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

  const pages = useMemo(() => (draft ? PAGES.filter((p) => !p.show || p.show(draft)) : PAGES), [draft]);
  const idx = Math.max(0, pages.findIndex((p) => p.id === pageId));
  const page = pages[idx];

  const go = useCallback((id: string) => {
    if (!pages.some((p) => p.id === id)) return;
    setPageId(id);
    setListOpen(false);
    setDrawer(false);
    sfxUi("page");
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pages]);

  // Alt + arrows walk the pages, as a desktop wizard's Next and Back do
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
      const t = e.target as HTMLElement | null;
      if (t && /input|textarea|select/i.test(t.tagName)) return;
      e.preventDefault();
      const n = idx + (e.key === "ArrowRight" ? 1 : -1);
      if (pages[n]) go(pages[n].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, pages, go]);

  if (!hydrated) return <div className="wz-code p-8 text-sm text-dim wz-caret">JACKING IN</div>;
  if (!draft) return <Paths onStarted={() => { setPageId("method"); window.scrollTo({ top: 0 }); }} onTaken={(id) => router.push(`/runners/${id}`)} />;

  const b = budget(draft);
  const d = derive(draft);
  const issues = validate(draft);
  const blockers = issues.filter((i) => i.level === "error");
  const states = pages.map((p) => pageState(p, draft, issues, b, d));
  const isLast = idx === pages.length - 1;
  const Comp = page.Comp;
  const own = page.pools?.(draft, b, d) ?? [];
  const ownLabels = new Set(own.map((p) => p.label));
  const common = [
    { label: "Karma", value: b.karma.left, total: b.karma.base + b.karma.negativeBonus, zeroIsDone: false },
    { label: "Nuyen", value: b.nuyen.left, fmt: yen, zeroIsDone: false },
    ...(d.essence < 6 ? [{ label: "Essence", value: d.essence, zeroIsDone: false }] : []),
  ].filter((m) => !ownLabels.has(m.label));
  const focusCommon = page.id === "gear" || page.id === "sins" || page.id === "lifestyle" ? "Nuyen" : page.id === "qualities" || page.id === "attributes" || page.id === "skills" || page.id === "initiation" ? "Karma" : "";

  const finish = () => {
    const done = finishDraft();
    if (done) { sfxUi("done"); router.push(`/runners/${done.id}`); }
  };
  const discard = () => { if (confirm("Throw away this unfinished runner?")) { discardDraft(); router.push("/forge"); } };
  const code = String(idx + 1).padStart(2, "0");

  return (
    <GoContext.Provider value={go}>
      {/* back headers: the budgets ride along on every page */}
      <div className="no-print wz-hud sticky top-12 z-30 border-b border-line backdrop-blur">
        <div className="mx-auto flex max-w-[1700px] flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 md:flex-nowrap md:px-6">
          <button className="flex min-h-9 min-w-0 flex-1 items-center gap-2 text-left md:flex-none lg:pointer-events-none" aria-expanded={listOpen} onClick={() => setListOpen(!listOpen)}>
            <span className="wz-code shrink-0 text-xs text-accent">{code}<span className="text-faint">/{String(pages.length).padStart(2, "0")}</span></span>
            <span className="truncate font-display font-semibold">{page.label}</span>
            <Icon name="chev" size={14} className="shrink-0 lg:hidden" />
          </button>
          <div className="order-3 flex w-full min-w-0 gap-1.5 overflow-x-auto [scrollbar-width:none] md:order-none md:ml-auto md:w-auto">
            {own.map((m) => <Meter key={m.label} {...m} focus onClick={() => setDrawer(true)} />)}
            {common.map((m) => <Meter key={m.label} {...m} focus={m.label === focusCommon} onClick={() => setDrawer(true)} />)}
          </div>
          <button className="btn small shrink-0 2xl:hidden" onClick={() => setDrawer(true)} aria-label="Runner summary">
            <Icon name="runners" size={15} />{blockers.length > 0 && <span className="num text-danger">{blockers.length}</span>}
          </button>
        </div>
        <div className="mx-auto flex max-w-[1700px] gap-[3px] px-3 pb-1.5 md:px-6" role="list" aria-label="Progress">
          {pages.map((p, i) => (
            <button key={p.id} role="listitem" title={p.label} aria-label={`${p.label}: ${states[i]}`} onClick={() => go(p.id)}
              className={clsx("wz-seg", i === idx ? "on" : states[i] !== "todo" && states[i])} />
          ))}
        </div>
        {listOpen && (
          <ol className="absolute inset-x-0 top-full max-h-[70dvh] overflow-y-auto border-b border-line bg-bg2 shadow-2xl lg:hidden">
            {pages.map((p, i) => (
              <li key={p.id}>
                <button onClick={() => go(p.id)} aria-current={i === idx ? "step" : undefined}
                  className={clsx("flex min-h-12 w-full items-center gap-3 border-l-2 px-4 text-left font-display", i === idx ? "border-accent bg-panelhi text-accent" : "border-transparent text-dim")}>
                  <StateDot n={i + 1} s={states[i]} on={i === idx} />
                  <span className="flex-1">{p.label}</span>
                  <span className="text-[10px] uppercase tracking-widest text-faint">{p.group}</span>
                </button>
              </li>
            ))}
            <li className="border-t border-line p-2"><button className="btn small ghost danger w-full" onClick={discard}><Icon name="trash" size={14} /> Discard build</button></li>
          </ol>
        )}
      </div>

      <div className="mx-auto grid max-w-[1700px] grid-cols-1 gap-6 px-3 py-5 md:px-6 lg:grid-cols-[13rem_minmax(0,1fr)] 2xl:grid-cols-[13rem_minmax(0,1fr)_19rem]">
        <nav aria-label="Forge pages" className="no-print hidden lg:sticky lg:top-32 lg:block lg:h-fit">
          <ol>
            {pages.map((p, i) => (
              <li key={p.id}>
                {(i === 0 || pages[i - 1].group !== p.group) && <div className="wz-code mb-1 mt-3 px-3 text-[10px] uppercase text-faint first:mt-0">{p.group}</div>}
                <button onClick={() => go(p.id)} aria-current={i === idx ? "step" : undefined}
                  className={clsx("flex w-full items-center gap-2.5 border-l-2 px-3 py-1.5 text-left font-display text-sm transition-colors", i === idx ? "border-accent bg-panelhi text-accent" : "border-line text-dim hover:text-fg")}>
                  <StateDot n={i + 1} s={states[i]} on={i === idx} />
                  <span className="truncate">{p.label}</span>
                </button>
              </li>
            ))}
          </ol>
          <button className="btn small ghost mt-4" onClick={discard}><Icon name="trash" size={14} /> Discard build</button>
          <p className="mt-3 px-1 text-[11px] text-faint">Alt + ← → to move between pages.</p>
        </nav>

        <main className="min-w-0">
          <header key={`h-${page.id}`} className="wz-in mb-5">
            <div className="wz-code text-[11px] uppercase text-accent">{code} {"//"} {page.group}</div>
            <h1 className="mt-1 text-3xl font-bold md:text-4xl">{page.label}</h1>
            <p className="mt-1 max-w-3xl text-dim">{page.lead}</p>
            {page.rule && <RuleLink match={page.rule} />}
          </header>
          <div key={page.id} className="wz-rise"><Comp c={draft} patch={patchDraft} /></div>

          <div className="max-md:h-24" aria-hidden />
          <div className="no-print mt-10 flex items-center justify-between gap-3 border-t border-line pt-4 max-md:fixed max-md:inset-x-0 max-md:bottom-[calc(3.5rem+env(safe-area-inset-bottom))] max-md:z-30 max-md:mt-0 max-md:bg-bg2/95 max-md:px-3 max-md:py-2 max-md:backdrop-blur">
            <button className="btn max-md:min-w-0 max-md:flex-1" disabled={idx === 0} onClick={() => go(pages[idx - 1].id)} aria-label="Previous page">
              <Icon name="back" size={16} /> <span className="max-md:sr-only">{idx > 0 ? pages[idx - 1].label : "Back"}</span>
            </button>
            {isLast ? (
              <div className="flex flex-wrap items-center justify-end gap-3 max-md:min-w-0 max-md:flex-[2] max-md:gap-2">
                {blockers.length > 0 && <label className="flex items-center gap-2 text-sm text-dim max-md:text-xs"><input type="checkbox" className="accent-[var(--accent)]" checked={saveAnyway} onChange={(e) => setSaveAnyway(e.target.checked)} /> Save with open problems</label>}
                <button className="btn primary" disabled={blockers.length > 0 && !saveAnyway} onClick={finish}><Icon name="check" size={16} /> Finish and open sheet</button>
              </div>
            ) : (
              <button className="btn primary max-md:min-w-0 max-md:flex-[2]" onClick={() => go(pages[idx + 1].id)}>
                <span className="max-md:truncate">{pages[idx + 1].label}</span> <Icon name="chev" size={16} />
              </button>
            )}
          </div>
        </main>

        <aside className="no-print hidden min-w-0 2xl:sticky 2xl:top-32 2xl:block 2xl:h-fit"><Readout c={draft} onGo={(w) => go(issuePage({ level: "warn", where: w, text: "" }))} /></aside>
      </div>

      {drawer && (
        <div className="no-print fixed inset-0 z-[60] bg-black/60 2xl:hidden" onClick={() => setDrawer(false)} role="presentation">
          <div className="sel-sheet absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto border-t border-accent bg-bg p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[24rem] md:border-l md:border-t-0"
            onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Runner summary">
            <div className="mb-2 flex items-center justify-between"><span className="font-display font-semibold">Your runner so far</span><button className="btn small ghost" onClick={() => setDrawer(false)} aria-label="Close"><Icon name="x" size={16} /></button></div>
            <Readout c={draft} onGo={(w) => go(issuePage({ level: "warn", where: w, text: "" }))} />
          </div>
        </div>
      )}
    </GoContext.Provider>
  );
}

function StateDot({ n, s, on }: { n: number; s: PageState; on: boolean }) {
  return (
    <span className={clsx("grid size-5 shrink-0 place-items-center border text-[11px]",
      s === "done" ? "border-ok bg-ok text-bg" : s === "error" ? "border-danger bg-danger text-bg" : s === "warn" ? "border-accent text-accent" : on ? "border-accent" : "border-linehi")}>
      {s === "done" ? <Icon name="check" size={11} /> : STATE_ICON[s] || n}
    </span>
  );
}
