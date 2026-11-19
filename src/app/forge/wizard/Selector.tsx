"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { sfxUi } from "@/lib/sound";
import { BookText } from "./BookText";
import { buzz } from "./fx";

/** Something on offer: a quality, spell, power, form or metamagic. */
export interface Avail {
  id: string;
  name: string;
  group?: string;
  cost?: React.ReactNode;
  tone?: "pos" | "neg" | "info";
  summary?: string;
  page?: number;
  sectionId?: string;
  /** Why it cannot be added right now. Shown, never silently hidden. */
  blocked?: string;
  /** Already chosen and cannot be taken twice. */
  taken?: boolean;
  /** Can be taken again (levels): the add button reads as a level up. */
  again?: boolean;
  badge?: string;
}

/** Something already chosen. */
export interface Chosen {
  key: string;
  name: string;
  cost?: React.ReactNode;
  tone?: "pos" | "neg" | "info";
  sub?: React.ReactNode;
  sectionId?: string;
  summary?: string;
  /** Inline controls: level, skill, note. */
  controls?: React.ReactNode;
  /** Cannot be removed here, and why (racial qualities, for instance). */
  locked?: string;
}

type Focus = { kind: "a"; id: string } | { kind: "s"; id: string } | null;

export interface SelectorProps {
  label: string;
  available: Avail[];
  selected: Chosen[];
  onAdd: (a: Avail) => void;
  onRemove: (key: string) => void;
  tabs?: { id: string; label: string }[];
  tab?: string;
  onTab?: (id: string) => void;
  /** Extra text for the description pane, above the rulebook entry. */
  detail?: (f: { avail?: Avail; chosen?: Chosen }) => React.ReactNode;
  emptyAvailable?: React.ReactNode;
  emptySelected?: React.ReactNode;
  /** Under the available list: add by hand, filters. */
  footer?: React.ReactNode;
  /** Above the selected list: a summary line or budget. */
  selectedHead?: React.ReactNode;
  addLabel?: string;
}

const toneClass = (t?: Avail["tone"]) => (t === "neg" ? "text-cyan" : t === "info" ? "text-dim" : "text-accent");

/**
 * Available, selected and description side by side, as a desktop wizard does it. On phones the two
 * lists become tabs and the description slides up from the bottom.
 */
export function Selector(p: SelectorProps) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [focus, setFocus] = useState<Focus>(null);
  const [mTab, setMTab] = useState<"a" | "s">("a");
  const [sheet, setSheet] = useState(false);
  const [deny, setDeny] = useState<{ id: string; n: number } | null>(null);
  const [pulse, setPulse] = useState<{ id: string; n: number } | null>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    if (!deny && !pulse) return;
    const t = setTimeout(() => { setDeny(null); setPulse(null); }, 700);
    return () => clearTimeout(t);
  }, [deny, pulse]);

  const groups = useMemo(() => Array.from(new Set(p.available.map((a) => a.group).filter(Boolean))) as string[], [p.available]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return p.available.filter((a) => (!group || a.group === group) && (!t || a.name.toLowerCase().includes(t) || (a.summary ?? "").toLowerCase().includes(t)));
  }, [p.available, q, group]);

  // new rows in the selected list materialize; the first render does not animate
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const keys = p.selected.map((s) => s.key).join("|");
  useEffect(() => {
    const now = new Set(p.selected.map((s) => s.key));
    if (seen.current) {
      const add = [...now].filter((k) => !seen.current!.has(k));
      if (add.length) {
        setFresh(new Set(add));
        const t = setTimeout(() => setFresh(new Set()), 800);
        seen.current = now;
        return () => clearTimeout(t);
      }
    }
    seen.current = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);

  const focusedAvail = focus?.kind === "a" ? p.available.find((a) => a.id === focus.id) : undefined;
  const focusedChosen = focus?.kind === "s" ? p.selected.find((s) => s.key === focus.id) : undefined;

  const tryAdd = (a: Avail) => {
    if (a.blocked || (a.taken && !a.again)) {
      setDeny({ id: a.id, n: Date.now() });
      setFocus({ kind: "a", id: a.id });
      sfxUi("deny");
      buzz(25);
      return;
    }
    p.onAdd(a);
    setPulse({ id: a.id, n: Date.now() });
    sfxUi("add");
    buzz();
  };
  const remove = (s: Chosen) => {
    if (s.locked) { sfxUi("deny"); return; }
    if (focus?.kind === "s" && focus.id === s.key) setFocus(null);
    p.onRemove(s.key);
    sfxUi("remove");
    buzz();
  };

  const openDetail = (f: Focus) => {
    setFocus(f);
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches) setSheet(true);
  };

  /** Up and down move through a list; Enter adds, Delete removes. */
  const keyNav = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const rows = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-row]"));
    const i = rows.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
      next?.focus();
      next?.click();
    }
  };

  const detailBody = (
    <DetailBody avail={focusedAvail} chosen={focusedChosen} extra={p.detail?.({ avail: focusedAvail, chosen: focusedChosen })}
      onAdd={focusedAvail ? () => tryAdd(focusedAvail) : undefined} onRemove={focusedChosen ? () => remove(focusedChosen) : undefined} addLabel={p.addLabel} />
  );

  const availPane = (
    <section className={clsx("sel-pane lg:h-[clamp(26rem,calc(100dvh-19rem),46rem)]", mTab !== "a" && "max-lg:hidden")} aria-label={`Available ${p.label}`}>
      <div className="sel-head"><span>Available</span><span className="num normal-case tracking-normal">{shown.length}</span></div>
      <div className="flex flex-wrap gap-2 border-b border-line p-2">
        {p.tabs && (
          <div className="inline-flex border border-line" role="tablist">
            {p.tabs.map((t) => (
              <button key={t.id} role="tab" aria-selected={p.tab === t.id} onClick={() => { p.onTab?.(t.id); setGroup(""); }}
                className={clsx("px-3 py-1.5 font-display text-sm", p.tab === t.id ? "bg-accent text-accentink" : "hover:text-accent")}>{t.label}</button>
            ))}
          </div>
        )}
        <div className="relative min-w-36 flex-1">
          <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input className="field !pl-8" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Search ${p.label}`} />
        </div>
        {groups.length > 1 && (
          <select className="field w-auto max-w-44" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Filter by type">
            <option value="">All types</option>
            {groups.map((g) => <option key={g}>{g}</option>)}
          </select>
        )}
      </div>
      <ul className="sel-list" role="listbox" aria-label={`Available ${p.label}`} onKeyDown={keyNav}>
        {shown.map((a) => {
          const on = focus?.kind === "a" && focus.id === a.id;
          return (
            <li key={a.id} data-row tabIndex={0} role="option" aria-selected={on}
              className={clsx("sel-row", a.blocked && "blocked", a.taken && !a.again && "taken", deny?.id === a.id && "sel-deny", pulse?.id === a.id && "sel-pulse")}
              draggable onDragStart={(e) => { e.dataTransfer.setData("text/x-sel", a.id); e.dataTransfer.effectAllowed = "copy"; }}
              onClick={() => openDetail({ kind: "a", id: a.id })} onDoubleClick={() => tryAdd(a)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); tryAdd(a); } }}>
              <div className="min-w-0 flex-1">
                <div className="nm flex flex-wrap items-baseline gap-x-2 font-display font-semibold leading-tight">
                  <span>{a.name}</span>
                  {a.cost != null && <span className={clsx("num text-xs font-normal", toneClass(a.tone))}>{a.cost}</span>}
                  {a.badge && <span className="text-[10px] font-normal uppercase tracking-wider text-ok">{a.badge}</span>}
                </div>
                {a.blocked ? <div className="mt-0.5 line-clamp-1 text-xs text-danger/80">{a.blocked}</div>
                  : a.summary ? <div className="mt-0.5 line-clamp-1 text-xs text-dim">{a.summary}</div> : null}
              </div>
              <button type="button" className={clsx("btn small !min-h-8 !px-2 shrink-0", (a.blocked || (a.taken && !a.again)) && "opacity-40")}
                aria-label={`${a.taken && a.again ? "Level up" : p.addLabel ?? "Add"}: ${a.name}`} title={a.blocked ?? (a.taken && !a.again ? "Already chosen" : undefined)}
                onClick={(e) => { e.stopPropagation(); tryAdd(a); }}>
                {a.taken && !a.again ? <Icon name="check" size={14} /> : <Icon name="plus" size={14} />}
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="p-4 text-sm text-dim">{p.available.length ? "Nothing matches." : p.emptyAvailable ?? "Nothing on offer."}</li>}
      </ul>
      {p.footer && <div className="border-t border-line p-2">{p.footer}</div>}
    </section>
  );

  const selPane = (
    <section className={clsx("sel-pane lg:h-[clamp(26rem,calc(100dvh-19rem),46rem)]", over && "sel-drop", mTab !== "s" && "max-lg:hidden")} aria-label={`Selected ${p.label}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("text/x-sel")) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { setOver(false); const id = e.dataTransfer.getData("text/x-sel"); const a = p.available.find((x) => x.id === id); if (a) { e.preventDefault(); tryAdd(a); } }}>
      <div className="sel-head"><span>Selected</span><span className="num normal-case tracking-normal">{p.selected.length}</span></div>
      {p.selectedHead && <div className="border-b border-line p-2">{p.selectedHead}</div>}
      <ul className="sel-list" role="listbox" aria-label={`Selected ${p.label}`} onKeyDown={keyNav}>
        {p.selected.map((s) => {
          const on = focus?.kind === "s" && focus.id === s.key;
          return (
            <li key={s.key} data-row tabIndex={0} role="option" aria-selected={on} className={clsx("sel-row flex-col !items-stretch", fresh.has(s.key) && "sel-in")}
              onClick={() => openDetail({ kind: "s", id: s.key })}
              onKeyDown={(e) => { if ((e.key === "Delete" || e.key === "Backspace") && e.target === e.currentTarget) { e.preventDefault(); remove(s); } }}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 font-display font-semibold leading-tight">
                    <span>{s.name}</span>
                    {s.cost != null && <span className={clsx("num text-xs font-normal", toneClass(s.tone))}>{s.cost}</span>}
                  </div>
                  {s.sub && <div className="mt-0.5 text-xs text-dim">{s.sub}</div>}
                </div>
                {s.locked ? <span className="shrink-0 text-[10px] uppercase tracking-wider text-faint" title={s.locked}>fixed</span> : (
                  <button type="button" className="btn small ghost !min-h-8 !px-2 shrink-0 hover:text-danger" aria-label={`Remove ${s.name}`} onClick={(e) => { e.stopPropagation(); remove(s); }}>
                    <Icon name="x" size={14} />
                  </button>
                )}
              </div>
              {s.controls && <div className="mt-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>{s.controls}</div>}
            </li>
          );
        })}
        {p.selected.length === 0 && <li className="p-4 text-sm text-dim">{p.emptySelected ?? "Nothing chosen yet."} <span className="max-lg:hidden">Drag from the left, double-click, or press +.</span></li>}
      </ul>
    </section>
  );

  return (
    <div>
      <div className="mb-2 inline-flex w-full border border-line lg:hidden" role="tablist" aria-label={p.label}>
        {(["a", "s"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={mTab === t} onClick={() => setMTab(t)}
            className={clsx("min-h-11 flex-1 font-display text-sm", mTab === t ? "bg-panelhi text-accent shadow-[inset_0_-2px_0_var(--accent)]" : "text-dim")}>
            {t === "a" ? "Available" : `Selected (${p.selected.length})`}
          </button>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)]">
        {availPane}
        {selPane}
        <aside className="sel-pane sel-desc max-lg:hidden lg:h-[clamp(26rem,calc(100dvh-19rem),46rem)]" aria-label="Description">
          <div className="sel-head"><span>Description</span></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{detailBody}</div>
        </aside>
      </div>
      {sheet && (focusedAvail || focusedChosen) && (
        <div className="fixed inset-0 z-[70] bg-black/60 lg:hidden" onClick={() => setSheet(false)} role="presentation">
          <div className="sel-sheet sel-desc absolute inset-x-0 bottom-0 max-h-[78dvh] overflow-y-auto border-t border-accent bg-bg p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Description">
            <div className="mx-auto mb-3 h-1 w-10 bg-linehi" aria-hidden />
            <button className="btn small ghost absolute right-2 top-2 z-10" onClick={() => setSheet(false)} aria-label="Close"><Icon name="x" size={16} /></button>
            {detailBody}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailBody({ avail, chosen, extra, onAdd, onRemove, addLabel }: {
  avail?: Avail; chosen?: Chosen; extra?: React.ReactNode; onAdd?: () => void; onRemove?: () => void; addLabel?: string;
}) {
  const it = avail ?? chosen;
  if (!it) {
    return (
      <div className="grid h-full place-items-center text-center text-sm text-faint">
        <div><Icon name="library" size={28} className="mx-auto mb-2 opacity-50" />Select an entry to read it.</div>
      </div>
    );
  }
  const blocked = avail?.blocked;
  return (
    <div key={avail ? `a${avail.id}` : `s${chosen!.key}`} className="wz-rise">
      <h3 className="font-display text-2xl font-bold leading-tight">{it.name}</h3>
      <div className="mt-1 flex flex-wrap gap-x-3 text-sm">
        {it.cost != null && <span className={clsx("num font-semibold", toneClass(it.tone))}>{it.cost}</span>}
        {avail?.group && <span className="text-dim">{avail.group}</span>}
        {avail?.page && <span className="text-faint">p. {avail.page}</span>}
      </div>
      {blocked && <p className="mt-3 border-l-2 border-danger bg-danger/10 px-3 py-2 text-sm">{blocked}</p>}
      {avail?.taken && !avail.again && <p className="mt-3 text-sm text-ok">Already chosen.</p>}
      {chosen?.locked && <p className="mt-3 text-sm text-dim">{chosen.locked}</p>}
      <div className="mt-3 flex gap-2">
        {onAdd && <button className="btn primary" disabled={!!blocked || (avail?.taken && !avail.again)} onClick={onAdd}><Icon name="plus" size={15} /> {avail?.taken && avail.again ? "Level up" : addLabel ?? "Add"}</button>}
        {onRemove && !chosen?.locked && <button className="btn danger" onClick={onRemove}><Icon name="x" size={15} /> Remove</button>}
      </div>
      {extra && <div className="mt-4">{extra}</div>}
      <div className="mt-5 border-t border-line pt-4"><BookText id={it.sectionId} fallback={it.summary} /></div>
    </div>
  );
}
