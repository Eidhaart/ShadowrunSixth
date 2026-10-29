"use client";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { openScreenWindow } from "@/lib/sync";
import { GRID, PRESET_SCREENS, WIDGETS, useScreens, type Panel, type WidgetType } from "@/lib/gm/screen";
import { DiceWidget, EntryWidget, HouseWidget, MusicWidget, NamesWidget, NotesWidget, NpcsWidget, PartyWidget, RulesWidget, TimerWidget, TurnWidget, type WidgetProps } from "./widgets";

const BODY: Record<WidgetType, (p: WidgetProps) => React.ReactNode> = {
  notes: NotesWidget, dice: DiceWidget, turn: TurnWidget, party: PartyWidget, rules: RulesWidget, music: MusicWidget,
  house: HouseWidget, entry: EntryWidget, npcs: NpcsWidget, timer: TimerWidget, names: NamesWidget,
};

const snap = (v: number) => Math.round(v / GRID) * GRID;
type Box = { x: number; y: number; w: number; h: number };

/** One panel: drag it by its title bar, resize from its edges, fold it up or close it. */
function PanelView({ screen, p, stacked }: { screen: string; p: Panel; stacked: boolean }) {
  const s = useScreens();
  const [live, setLive] = useState<Box | null>(null);
  const [rename, setRename] = useState(false);
  const drag = useRef<{ mode: "move" | "e" | "s" | "se"; sx: number; sy: number; box: Box } | null>(null);
  const w = WIDGETS[p.type];
  const box = live ?? p;
  const Body = BODY[p.type];

  const down = (ev: React.PointerEvent<HTMLElement>) => {
    const mode = (ev.currentTarget.dataset.mode ?? "move") as "move" | "e" | "s" | "se";
    if (stacked || ev.button !== 0) return;
    if (mode === "move" && (ev.target as HTMLElement).closest("button,input")) return;
    ev.preventDefault();
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    s.front(screen, p.id);
    drag.current = { mode, sx: ev.clientX, sy: ev.clientY, box: { x: p.x, y: p.y, w: p.w, h: p.h } };
  };
  const move = (ev: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dx = ev.clientX - d.sx, dy = ev.clientY - d.sy;
    if (d.mode === "move") setLive({ ...d.box, x: Math.max(0, d.box.x + dx), y: Math.max(0, d.box.y + dy) });
    else setLive({ ...d.box, w: d.mode === "s" ? d.box.w : Math.max(200, d.box.w + dx), h: d.mode === "e" ? d.box.h : Math.max(120, d.box.h + dy) });
  };
  const up = () => {
    const d = drag.current; drag.current = null;
    if (!d || !live) { setLive(null); return; }
    s.updatePanel(screen, p.id, { x: snap(live.x), y: snap(live.y), w: snap(live.w), h: snap(live.h) });
    setLive(null);
  };

  const style: React.CSSProperties = stacked ? {} : { left: box.x, top: box.y, width: box.w, height: p.collapsed ? 38 : box.h, zIndex: live ? 999 : p.z };
  return (
    <section className={clsx("screen-panel flex flex-col", !stacked && "absolute", live && "dragging")} style={style} onPointerDown={() => !stacked && s.front(screen, p.id)} aria-label={p.title ?? w.name}>
      <header className="screen-head flex shrink-0 items-center gap-1.5 px-2" data-mode="move" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDoubleClick={() => setRename(true)}>
        <Icon name={w.icon} size={14} className="shrink-0 text-accent" />
        {rename ? (
          <input className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" autoFocus defaultValue={p.title ?? w.name}
            onBlur={(e) => { s.updatePanel(screen, p.id, { title: e.target.value.trim() || undefined }); setRename(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRename(false); }} aria-label="Panel title" />
        ) : <span className="min-w-0 flex-1 truncate text-sm font-semibold" title="Drag to move, double-click to rename">{p.title ?? w.name}</span>}
        <button className="screen-btn" onClick={() => s.updatePanel(screen, p.id, { collapsed: !p.collapsed })} aria-label={p.collapsed ? "Unfold" : "Fold"} title={p.collapsed ? "Unfold" : "Fold"}><Icon name="chev" size={13} className={clsx("transition-transform", p.collapsed ? "" : "rotate-90")} /></button>
        <button className="screen-btn" onClick={() => s.removePanel(screen, p.id)} aria-label="Close panel" title="Close"><Icon name="x" size={13} /></button>
      </header>
      {!p.collapsed && (
        <div className={clsx("min-h-0 flex-1 overflow-auto", stacked && "max-h-[70vh]")}>
          <Body panel={p} setData={(data) => s.updatePanel(screen, p.id, { data })} />
        </div>
      )}
      {!stacked && !p.collapsed && (
        <>
          <span className="screen-grip e" data-mode="e" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
          <span className="screen-grip s" data-mode="s" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
          <span className="screen-grip se" data-mode="se" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-hidden="true" />
        </>
      )}
    </section>
  );
}

/** The GM screen: boards of panels, one per situation. */
export function ScreenBoard({ popped }: { popped?: boolean } = {}) {
  const s = useScreens();
  const [ready, setReady] = useState(false);
  const [menu, setMenu] = useState<"add" | "new" | null>(null);
  const [stacked, setStacked] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    void Promise.resolve(useScreens.persist.rehydrate()).then(() => {
      if (!useScreens.getState().screens.length) useScreens.getState().addScreen("run");
      setReady(true);
    });
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setStacked(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const cur = s.screens.find((x) => x.id === s.active) ?? s.screens[0];
  if (!ready || !cur) return <p className="p-6 text-dim">Setting up your screen…</p>;
  const bottom = cur.panels.reduce((m, p) => Math.max(m, p.y + (p.collapsed ? 40 : p.h)), 0);
  const right = cur.panels.reduce((m, p) => Math.max(m, p.x + p.w), 0);
  const panels = stacked ? [...cur.panels].sort((a, b) => a.y - b.y || a.x - b.x) : cur.panels;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <nav className="flex flex-wrap gap-1" role="tablist" aria-label="Screens">
          {s.screens.map((sc) => (
            <button key={sc.id} role="tab" aria-selected={sc.id === cur.id} className={clsx("vtt-scene-chip", sc.id === cur.id && "on")} onClick={() => s.setActive(sc.id)} onDoubleClick={() => setRenaming(true)}>
              {renaming && sc.id === cur.id ? (
                <input className="w-28 bg-transparent outline-none" autoFocus defaultValue={sc.name} onBlur={(e) => { s.renameScreen(sc.id, e.target.value.trim() || sc.name); setRenaming(false); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} aria-label="Screen name" />
              ) : sc.name}
            </button>
          ))}
        </nav>
        <div className="relative">
          <button className="btn small ghost !px-2" onClick={() => setMenu(menu === "new" ? null : "new")} aria-expanded={menu === "new"} title="New screen"><Icon name="plus" size={15} /></button>
          {menu === "new" && (
            <div className="vtt-flyout absolute left-0 top-full z-[1000] mt-1 w-64 p-1.5" onPointerLeave={() => setMenu(null)}>
              {[...PRESET_SCREENS, { id: "blank", name: "Blank screen", blurb: "Start empty and add your own panels" }].map((p) => (
                <button key={p.id} className="block w-full px-2.5 py-2 text-left hover:bg-panelhi" onClick={() => { s.addScreen(p.id, p.id === "blank" ? "My screen" : undefined); setMenu(null); }}>
                  <b className="block text-sm">{p.name}</b><span className="text-xs text-dim">{p.blurb}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <div className="relative">
            <button className="btn small primary" onClick={() => setMenu(menu === "add" ? null : "add")} aria-expanded={menu === "add"}><Icon name="plus" size={14} /> Add panel</button>
            {menu === "add" && (
              <div className="vtt-flyout absolute right-0 top-full z-[1000] mt-1 grid w-[min(32rem,90vw)] gap-0.5 p-1.5 sm:grid-cols-2" onPointerLeave={() => setMenu(null)}>
                {(Object.keys(WIDGETS) as WidgetType[]).map((t) => (
                  <button key={t} className="flex gap-2 px-2.5 py-2 text-left hover:bg-panelhi" onClick={() => { s.addPanel(cur.id, t); setMenu(null); }}>
                    <Icon name={WIDGETS[t].icon} size={16} className="mt-0.5 shrink-0 text-accent" />
                    <span><b className="block text-sm">{WIDGETS[t].name}</b><span className="text-xs text-dim">{WIDGETS[t].blurb}</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {!popped && (
            <button className="btn small" onClick={() => { if (!openScreenWindow()) setBlocked(true); }} title="Open the GM screen in its own window, for a second monitor">
              <Icon name="copy" size={14} /> Pop out
            </button>
          )}
          <button className="btn small ghost" onClick={() => setRenaming(true)} title="Rename this screen"><Icon name="forge" size={14} /></button>
          {s.screens.length > 1 && <button className="btn small ghost text-danger" onClick={() => { if (confirm(`Delete the screen "${cur.name}"?`)) s.removeScreen(cur.id); }} title="Delete this screen"><Icon name="trash" size={14} /></button>}
        </div>
      </div>
      {stacked ? (
        <div className="space-y-3">{panels.map((p) => <PanelView key={p.id} screen={cur.id} p={p} stacked />)}</div>
      ) : (
        <div className="screen-board relative overflow-x-auto" style={{ minHeight: Math.max(520, bottom + GRID * 8) }}>
          <div className="relative" style={{ width: Math.max(right + GRID, 100) + "px", minWidth: "100%", height: Math.max(520, bottom + GRID * 8) }}>
            {panels.map((p) => <PanelView key={p.id} screen={cur.id} p={p} stacked={false} />)}
            {!panels.length && <p className="absolute inset-x-0 top-24 text-center text-dim">An empty screen. Add the panels you want within reach.</p>}
          </div>
        </div>
      )}
      {blocked && <p role="alert" className="text-sm text-danger">Your browser blocked the new window. Allow pop-ups for this site, or open <a className="underline" href="/screen" target="_blank">the GM screen</a> in a new tab.</p>}
      <p className="text-xs text-faint">Drag panels by their title, resize from the right and bottom edges, double-click a title to rename it. Each screen keeps its own layout on this device.</p>
    </div>
  );
}
