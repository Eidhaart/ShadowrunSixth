"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { Roller } from "@/components/Dice";
import { ChatMessage } from "@/components/comms/ChatMessage";
import { GearBrowser } from "@/components/compendium/GearBrowser";
import { ItemMaker } from "@/components/compendium/ItemMaker";
import { useComms } from "@/lib/store/comms";
import { useSettings } from "@/lib/store/settings";
import { useRunners } from "@/lib/store/characters";
import { useRulebook } from "@/lib/store/rulebook";
import { addToRunner, type AddResult } from "@/lib/compendium/catalog";
import type { CompItem } from "@/lib/compendium/types";
import { runnerName, sendChat, whoAmI } from "@/lib/actions";
import { PREMADES, TEMPLATES, portraitUrl } from "@/lib/sr6/premades";
import { useVtt } from "@/lib/vtt/store";
import { loadImage } from "@/lib/vtt/images";
import { vid } from "@/lib/vtt/ops";
import type { Handout, Scene, Token } from "@/lib/vtt/types";
import { placeMap } from "./act";
import { useTableUi, type Panel } from "./ui";
import { useHouse } from "@/lib/house/store";
import { useBinder } from "@/lib/gm/binder";
import { BOOK, diffs, show } from "@/lib/house/rules";

export const DRAG_RUNNER = "application/x-sixthdeck-runner";
export const DRAG_NPC = "application/x-sixthdeck-npc";

const TABS: { id: Panel; label: string; icon: string; gm?: boolean; full?: string }[] = [
  { id: "chat", label: "Chat", icon: "comms" },
  { id: "journal", label: "Journal", icon: "runners" },
  { id: "compendium", label: "Gear", full: "Compendium: gear and rules", icon: "crate" },
  { id: "house", label: "House", icon: "gavel" },
  { id: "scene", label: "Scene", icon: "settings", gm: true },
];

function ChatPanel() {
  const c = useComms();
  const s = useSettings();
  const runnersMap = useRunners((r) => r.runners);
  const runners = useMemo(() => Object.values(runnersMap), [runnersMap]);
  const [text, setText] = useState("");
  const [dice, setDice] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const me = c.handle || whoAmI("");
  const live = c.status === "online" || c.status === "local";
  const callIds = useMemo(() => new Set(c.messages.filter((m) => m.type === "call").map((m) => m.id)), [c.messages]);
  useEffect(() => { c.markRead(); end.current?.scrollIntoView({ block: "end" }); }, [c.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = () => {
    const t = text.trim();
    if (!t) return;
    // "/r 12" or "/roll 12 Perception" rolls a pool from the chat line
    const m = /^\/r(?:oll)?\s+(\d{1,2})\s*(.*)$/i.exec(t);
    if (m) import("@/lib/actions").then(({ doRoll }) => doRoll({ label: m[2] || "Roll", pool: Number(m[1]) }));
    else sendChat(t.replace(/^\/ooc\s+/i, ""), /^\/ooc\s+/i.test(t));
    setText("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-2.5" aria-live="polite">
        {c.messages.length === 0 && <p className="p-4 text-center text-sm text-dim">{live ? "Rolls and table talk land here. Voice stays on Discord." : "Join a room to share chat and rolls."}</p>}
        {c.messages.map((m) => <ChatMessage key={m.id} m={m} hasCall={(id) => callIds.has(id)} mine={m.type !== "system" && m.from === me} />)}
        <div ref={end} />
      </div>
      {dice && <div className="border-t border-line p-2"><Roller compact /></div>}
      <form className="space-y-1.5 border-t border-line p-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <div className="flex gap-1.5">
          <select className="field !min-h-0 flex-1 !py-1 text-sm" value={s.speakAs} onChange={(e) => s.set({ speakAs: e.target.value })} aria-label="Speak as">
            <option value="">Yourself ({s.handle || "handle"})</option>
            {runners.map((r) => <option key={r.id} value={r.id}>{runnerName(r)}</option>)}
            {c.role === "gm" && <option value="npc">Narrator / NPC</option>}
          </select>
          <button type="button" className={clsx("btn small", dice && "primary")} onClick={() => setDice(!dice)} aria-pressed={dice} title="Dice roller"><Icon name="dice" size={15} /></button>
        </div>
        <div className="flex gap-1.5">
          <input className="field flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder={live ? "Say something, /r 12 to roll" : "/r 8 rolls dice"} aria-label="Message" />
          <button className="btn primary" disabled={!text.trim()}>Send</button>
        </div>
      </form>
    </div>
  );
}

function JournalPanel() {
  const state = useVtt((s) => s.state)!;
  const me = useVtt((s) => s.me);
  const dispatch = useVtt((s) => s.dispatch);
  const ui = useTableUi();
  const runnersMap = useRunners((r) => r.runners);
  const runners = useMemo(() => Object.values(runnersMap).sort((a, b) => b.updatedAt - a.updatedAt), [runnersMap]);
  const handouts = Object.values(state.handouts);
  const entries = useBinder((b) => b.entries);
  const binderNpcs = useMemo(() => Object.values(entries).filter((e) => e.kind === "npc").sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || a.title.localeCompare(b.title)), [entries]);

  const newHandout = async (f?: File) => {
    const id = vid("h");
    const ops = [];
    let img: string | undefined;
    if (f) {
      const a = await loadImage(f, "handout");
      img = vid("a");
      ops.push({ k: "set" as const, p: ["assets", img], v: { id: img, ...a } });
    }
    const h: Handout = { id, title: f?.name.replace(/\.[^.]+$/, "") || "New handout", img, text: "", shared: false };
    dispatch([...ops, { k: "set", p: ["handouts", id], v: h }]);
  };

  const drag = (type: string, data: string) => (e: React.DragEvent) => { e.dataTransfer.setData(type, data); e.dataTransfer.effectAllowed = "copy"; };

  return (
    <div className="h-full space-y-5 overflow-y-auto p-3">
      <section>
        <h3 className="mb-1 text-sm font-semibold">My runners</h3>
        <p className="mb-2 text-xs text-dim">Drag onto the map. The token stays in sync with your sheet.</p>
        {runners.length === 0 && <Link className="btn small" href="/forge"><Icon name="forge" size={14} /> Build a runner</Link>}
        <ul className="space-y-1">
          {runners.map((r) => (
            <li key={r.id} draggable onDragStart={drag(DRAG_RUNNER, r.id)} className="vtt-drag flex cursor-grab items-center gap-2 border border-line bg-bg2 p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {r.portrait ? <img src={r.portrait} alt="" className="size-8 object-cover" /> : <span className="grid size-8 place-items-center bg-panel-hi text-xs">{runnerName(r).slice(0, 2)}</span>}
              <span className="min-w-0 flex-1 truncate text-sm">{runnerName(r)}</span>
              <button className="btn small ghost !px-1.5" onClick={() => ui.set({ dialog: { kind: "sheet", runnerId: r.id } })} title="Open sheet"><Icon name="chev" size={14} /></button>
            </li>
          ))}
        </ul>
      </section>

      {me.gm && (
        <section>
          <h3 className="mb-1 text-sm font-semibold">NPCs</h3>
          <p className="mb-2 text-xs text-dim">Drag onto the map. New NPCs go on the GM layer when it is active, so players never see them arrive. Your binder NPCs come first.</p>
          <div className="grid grid-cols-2 gap-1">
            {binderNpcs.map((e) => (
              <div key={e.id} draggable onDragStart={drag(DRAG_NPC, JSON.stringify({ kind: "binder", id: e.id }))} className="vtt-drag flex cursor-grab items-center gap-1.5 border border-accent/40 bg-bg2 p-1 text-sm" title={e.sub || "From your binder"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {e.img ? <img src={e.img} alt="" className="size-7 object-cover object-top" /> : <span className="grid size-7 place-items-center bg-panel-hi"><Icon name="star" size={12} /></span>}
                <span className="truncate">{e.title}</span>
              </div>
            ))}
            <div draggable onDragStart={drag(DRAG_NPC, JSON.stringify({ kind: "blank" }))} className="vtt-drag cursor-grab border border-dashed border-line p-1.5 text-sm">+ Blank grunt</div>
            {PREMADES.map((p) => (
              <div key={p.alias} draggable onDragStart={drag(DRAG_NPC, JSON.stringify({ kind: "premade", id: p.alias }))} className="vtt-drag flex cursor-grab items-center gap-1.5 border border-line bg-bg2 p-1 text-sm" title={p.concept}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {portraitUrl(p) ? <img src={portraitUrl(p)!} alt="" className="size-7 object-cover object-top" /> : <span className="size-7 bg-panel-hi" />}
                <span className="truncate">{p.alias}</span>
              </div>
            ))}
            {TEMPLATES.map((b) => (
              <div key={b.id} draggable onDragStart={drag(DRAG_NPC, JSON.stringify({ kind: "template", id: b.id }))} className="vtt-drag cursor-grab truncate border border-line p-1.5 text-sm text-dim" title={b.role}>{b.archetype}</div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Handouts</h3>
          {me.gm && (
            <div className="flex gap-1">
              <button className="btn small" onClick={() => void newHandout()}><Icon name="plus" size={14} /> Text</button>
              <label className="btn small cursor-pointer"><Icon name="upload" size={14} /> Image<input type="file" accept="image/*" className="sr-only" onChange={(e) => void newHandout(e.target.files?.[0])} /></label>
            </div>
          )}
        </div>
        {handouts.length === 0 && <p className="text-xs text-dim">{me.gm ? "Maps, clues and briefings you can reveal to the players." : "Nothing shared yet."}</p>}
        <ul className="space-y-1.5">
          {handouts.map((h) => (
            <li key={h.id} className="border border-line bg-bg2 p-2">
              {me.gm ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input className="field !min-h-0 flex-1 !py-1 text-sm" value={h.title} onChange={(e) => dispatch([{ k: "merge", p: ["handouts", h.id], v: { title: e.target.value } }])} aria-label="Title" />
                    <button className={clsx("btn small", h.shared && "primary")} onClick={() => dispatch([{ k: "merge", p: ["handouts", h.id], v: { shared: !h.shared } }])} title={h.shared ? "Players can read it" : "Only you can see it"}><Icon name="eye" size={14} /> {h.shared ? "Shared" : "Share"}</button>
                    <button className="btn small ghost !px-1.5" onClick={() => { if (confirm(`Delete ${h.title}?`)) dispatch([{ k: "del", p: ["handouts", h.id] }]); }} aria-label="Delete"><Icon name="trash" size={14} /></button>
                  </div>
                  <textarea className="field min-h-14 text-sm" value={h.text} onChange={(e) => dispatch([{ k: "merge", p: ["handouts", h.id], v: { text: e.target.value } }])} placeholder="What the players read" />
                  <button className="text-xs text-accent underline" onClick={() => ui.set({ dialog: { kind: "handout", id: h.id } })}>Preview</button>
                </div>
              ) : (
                <button className="w-full text-left text-sm" onClick={() => ui.set({ dialog: { kind: "handout", id: h.id } })}>{h.title}</button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const NO_NOTES: { id: string; title: string; text: string; tags: string[]; secret?: boolean }[] = [];

function RulesSearch() {
  const rb = useRulebook();
  const [q, setQ] = useState("");
  useEffect(() => { void rb.init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const hits = q.trim().length > 1 && rb.status === "ready" ? rb.search(q, [], 6) : [];
  const houseNotes = useVtt((s) => s.state?.rules?.notes) ?? NO_NOTES;
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const houseHits = words.length ? houseNotes.filter((n) => words.every((w) => `${n.title} ${n.text} ${n.tags.join(" ")}`.toLowerCase().includes(w))).slice(0, 4) : [];
  return (
    <div className="space-y-1.5">
      <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder={rb.status === "ready" ? "Search the rules: cover, drain, called shot" : houseNotes.length ? "Search house rules" : "Import the core rulebook in the Library to search it"} disabled={rb.status !== "ready" && !houseNotes.length} aria-label="Search rules" />
      {houseHits.map((n) => (
        <details key={n.id} className="border border-astral/40 bg-bg2 p-2 text-sm" open={houseHits.length === 1}>
          <summary className="cursor-pointer"><b>{n.title}</b> <span className="house-badge">House</span></summary>
          <p className="mt-1 max-h-60 overflow-y-auto whitespace-pre-wrap text-xs text-dim">{n.text}</p>
        </details>
      ))}
      {hits.map((h) => (
        <details key={h.section.id} className="border border-line bg-bg2 p-2 text-sm">
          <summary className="cursor-pointer"><b>{h.section.title}</b> <span className="text-xs text-faint">p. {h.section.page}</span></summary>
          <p className="mt-1 max-h-60 overflow-y-auto whitespace-pre-wrap text-xs text-dim">{h.section.text.slice(0, 2400)}</p>
          <Link className="text-xs text-accent underline" href={`/rules?s=${encodeURIComponent(h.section.id)}`} target="_blank">Open in the library</Link>
        </details>
      ))}
    </div>
  );
}

function CompendiumPanel() {
  const map = useRunners((s) => s.runners);
  const update = useRunners((s) => s.update);
  const list = useMemo(() => Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt), [map]);
  const [picked, setPicked] = useState("");
  const r = map[picked] ?? list[0];
  const [last, setLast] = useState<AddResult | null>(null);
  const [maker, setMaker] = useState(false);
  const add = (i: CompItem, qty: number) => {
    if (!r) return;
    const res = addToRunner(JSON.parse(JSON.stringify(r)), i, { pay: true, qty });
    if (res.ok) update(r.id, (x) => { addToRunner(x, i, { pay: true, qty }); });
    setLast(res);
  };
  return (
    <div className="h-full space-y-4 overflow-y-auto p-3">
      <RulesSearch />
      {list.length > 0 && (
        <label className="block text-xs text-dim">Buy for
          <select className="field mt-0.5" value={r?.id ?? ""} onChange={(e) => setPicked(e.target.value)}>
            {list.map((x) => <option key={x.id} value={x.id}>{runnerName(x)} ({x.nuyen.toLocaleString()}¥)</option>)}
          </select>
        </label>
      )}
      {last && <p className={clsx("text-xs", last.ok ? "text-ok" : "text-danger")}>{last.msg}</p>}
      <button className="btn small w-full" onClick={() => setMaker(true)}><Icon name="plus" size={14} /> Make your own item</button>
      {maker && <ItemMaker onClose={() => setMaker(false)} runnerId={r?.id} />}
      <GearBrowser compact onAdd={r ? add : undefined} addLabel={r ? `Buy for ${runnerName(r)}` : "Add"} nuyen={r?.nuyen} />
    </div>
  );
}

function ScenePanel({ scene }: { scene: Scene }) {
  const state = useVtt((s) => s.state)!;
  const dispatch = useVtt((s) => s.dispatch);
  const replaceAll = useVtt((s) => s.replaceAll);
  const view = useVtt((s) => s.view);
  const p = ["scenes", scene.id];
  const merge = (v: Partial<Scene>) => dispatch([{ k: "merge", p, v }]);
  const [busy, setBusy] = useState(false);
  const ui = useTableUi();
  const maps = Object.values(scene.objects).filter((o): o is Token => o.kind === "token" && o.layer === "map" && !!o.img);

  const bg = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const a = await loadImage(f, "map");
      const id = vid("a");
      placeMap(scene, { id, w: a.w, h: a.h }, undefined, f.name.replace(/\.[^.]+$/, ""), [{ k: "set", p: ["assets", id], v: { id, ...a } }]);
    } finally { setBusy(false); }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sixthdeck-table-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importJson = async (f?: File) => {
    if (!f) return;
    try {
      const s = JSON.parse(await f.text());
      if (!s?.scenes || !Array.isArray(s.order)) throw new Error("not a table");
      if (confirm("Replace the whole table with this file?")) replaceAll({ ...s, stamp: Date.now() });
    } catch { alert("That file is not a SixthDeck table export."); }
  };

  const dupe = () => {
    const id = vid("sc");
    const copy: Scene = JSON.parse(JSON.stringify({ ...scene, id, name: `${scene.name} copy` }));
    dispatch([{ k: "set", p: ["scenes", id], v: copy }, { k: "set", p: ["order"], v: [...state.order, id] }]);
    view(id);
  };
  const remove = () => {
    if (state.order.length < 2) { alert("A table needs at least one scene."); return; }
    if (!confirm(`Delete ${scene.name} and everything on it?`)) return;
    const order = state.order.filter((x) => x !== scene.id);
    const ops: { k: "del" | "set"; p: string[]; v?: unknown }[] = [{ k: "set", p: ["order"], v: order }];
    if (state.playerScene === scene.id) ops.push({ k: "set", p: ["playerScene"], v: order[0] });
    ops.push({ k: "del", p });
    dispatch(ops as never);
    view(order[0]);
  };

  return (
    <div className="h-full space-y-4 overflow-y-auto p-3 text-sm">
      <label className="block">Name<input className="field" value={scene.name} onChange={(e) => merge({ name: e.target.value })} /></label>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-dim">Columns<input className="field num" type="number" min={4} max={200} value={scene.cols} onChange={(e) => merge({ cols: Math.max(4, Math.min(200, Number(e.target.value) || 4)) })} /></label>
        <label className="text-xs text-dim">Rows<input className="field num" type="number" min={4} max={200} value={scene.rows} onChange={(e) => merge({ rows: Math.max(4, Math.min(200, Number(e.target.value) || 4)) })} /></label>
        <label className="text-xs text-dim">Meters / square<input className="field num" type="number" min={0.5} step={0.5} value={scene.scale} onChange={(e) => merge({ scale: Math.max(0.1, Number(e.target.value) || 1.5) })} /></label>
      </div>
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={scene.grid} onChange={(e) => merge({ grid: e.target.checked })} /> Grid</label>
          <label className="flex items-center gap-1.5 text-xs text-dim">Color <input type="color" value={scene.gridColor} onChange={(e) => merge({ gridColor: e.target.value })} /></label>
          <label className="flex flex-1 items-center gap-1.5 text-xs text-dim">Opacity <input className="flex-1" type="range" min={0.02} max={0.8} step={0.02} value={scene.gridOpacity} onChange={(e) => merge({ gridOpacity: Number(e.target.value) })} /></label>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="font-semibold">Map image</div>
        <div className="flex flex-wrap gap-1.5">
          <label className="btn small cursor-pointer"><Icon name="upload" size={14} /> {busy ? "Loading…" : "Add a map image"}<input type="file" accept="image/*" className="sr-only" onChange={(e) => { void bg(e.target.files?.[0]); e.target.value = ""; }} /></label>
          <label className="flex items-center gap-1.5 text-xs text-dim">Backdrop <input type="color" value={scene.bgColor} onChange={(e) => merge({ bgColor: e.target.value })} /></label>
        </div>
        {maps.length > 0 && (
          <ul className="space-y-1">
            {maps.map((m) => (
              <li key={m.id} className="flex items-center gap-2 border border-line bg-bg2 p-1.5">
                <span className="min-w-0 flex-1 truncate">{m.name || "Map"}</span>
                <span className="num text-xs text-faint">{+(m.w / 70).toFixed(1)}×{+(m.h / 70).toFixed(1)} sq</span>
                <button className="btn small ghost !px-2" onClick={() => { ui.set({ layer: "map", tool: "select" }); ui.select([m.id]); }}>Adjust</button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-faint">Maps sit on the Map layer. Select one there to drag it, pull its handles to resize (they snap to the grid; hold Shift to stretch, Alt to place freely) or line its grid up with the table&apos;s. You can also drop image files on the map with the Map layer active.</p>
      </div>
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 font-semibold"><input type="checkbox" checked={scene.fog} onChange={(e) => merge({ fog: e.target.checked })} /> Fog of war</label>
        {scene.fog && (
          <div className="flex flex-wrap gap-1.5">
            <button className="btn small" onClick={() => merge({ fogRegions: [{ x: 0, y: 0, w: scene.cols * 70, h: scene.rows * 70, mode: "reveal" }] })}>Reveal all</button>
            <button className="btn small" onClick={() => merge({ fogRegions: [] })}>Hide all</button>
            <button className="btn small ghost" disabled={!scene.fogRegions.length} onClick={() => merge({ fogRegions: scene.fogRegions.slice(0, -1) })}><Icon name="undo" size={14} /> Undo last</button>
          </div>
        )}
        {scene.fog && <p className="text-xs text-faint">Use the fog tool on the left to drag reveal or hide boxes.</p>}
      </div>
      <label className="block">GM notes<textarea className="field min-h-24" value={scene.notes} onChange={(e) => merge({ notes: e.target.value })} placeholder="Read-aloud text, opposition, what happens if the alarm trips" /></label>
      <div className="flex flex-wrap gap-1.5 border-t border-line pt-3">
        <button className="btn small" onClick={dupe}><Icon name="copy" size={14} /> Duplicate</button>
        <button className="btn small ghost text-danger" onClick={remove}><Icon name="trash" size={14} /> Delete scene</button>
      </div>
      <div className="space-y-1.5 border-t border-line pt-3">
        <div className="font-semibold">Backup</div>
        <p className="text-xs text-faint">The table is saved on this device and on the relay. The free relay forgets when it sleeps; your device copy brings it back. Export to move it to another machine.</p>
        <div className="flex flex-wrap gap-1.5">
          <button className="btn small" onClick={exportJson}><Icon name="download" size={14} /> Export table</button>
          <label className="btn small cursor-pointer"><Icon name="upload" size={14} /> Import<input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void importJson(e.target.files?.[0])} /></label>
        </div>
      </div>
    </div>
  );
}

/** The rules in force at this table: what differs from the book, house rules and statuses. */
function HousePanel() {
  const rs = useVtt((s) => s.state?.rules ?? null);
  const me = useVtt((s) => s.me);
  const h = useHouse();
  const sets = Object.values(h.sets).sort((a, b) => b.updatedAt - a.updatedAt);
  const changed = rs ? diffs(rs.mech) : [];
  return (
    <div className="h-full space-y-4 overflow-y-auto p-3 text-sm">
      {me.gm && (
        <label className="block text-xs text-dim">Rules at this table
          <select className="field mt-1" value={h.activeId ?? ""} onChange={(e) => h.setActive(e.target.value || null)}>
            <option value="">By the book</option>
            {sets.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
      )}
      <div>
        <h3 className="font-display text-lg font-semibold">{rs?.name ?? "By the book"}</h3>
        {rs?.blurb && <p className="text-dim">{rs.blurb}</p>}
      </div>
      <section>
        <h4 className="mb-1 font-semibold">{changed.length ? `${changed.length} change${changed.length === 1 ? "" : "s"} from the book` : "No changes to the mechanics"}</h4>
        <ul className="space-y-1">
          {changed.map((f) => (
            <li key={f.key} className="border-l-2 border-accent pl-2">
              <span className="text-dim">{f.label}:</span> <b>{show(f, { ...BOOK, ...rs!.mech }[f.key])}</b> <span className="text-xs text-faint">(book {show(f, BOOK[f.key])})</span>
            </li>
          ))}
        </ul>
      </section>
      {rs && rs.notes.length > 0 && (
        <section className="space-y-1">
          <h4 className="font-semibold">House rules</h4>
          {rs.notes.map((n) => (
            <details key={n.id} className="border border-line bg-bg2 p-2">
              <summary className="cursor-pointer">{n.title}{n.secret && <span className="ml-1 text-xs text-astral">GM only</span>}</summary>
              <p className="mt-1 whitespace-pre-wrap text-xs text-dim">{n.text}</p>
            </details>
          ))}
        </section>
      )}
      {rs && rs.statuses.length > 0 && (
        <section>
          <h4 className="mb-1 font-semibold">Statuses</h4>
          <ul className="space-y-0.5">{rs.statuses.map((s) => <li key={s.id}><b>{s.name}</b> <span className="text-dim">{s.text}</span></li>)}</ul>
        </section>
      )}
      {rs && rs.items.length > 0 && <p className="text-dim">{rs.items.length} house item{rs.items.length === 1 ? "" : "s"} in the Compendium tab.</p>}
      {me.gm && <Link className="btn small" href="/gm?tab=house" target="_blank"><Icon name="gavel" size={14} /> Edit house rules</Link>}
    </div>
  );
}

export function Sidebar({ scene }: { scene: Scene | undefined }) {
  const ui = useTableUi();
  const me = useVtt((s) => s.me);
  const unread = useComms((s) => s.unread);
  const tabs = TABS.filter((t) => !t.gm || me.gm);
  const panel = ui.panel && tabs.some((t) => t.id === ui.panel) ? ui.panel : null;
  return (
    <aside className={clsx("vtt-side flex min-h-0 flex-col border-l border-line bg-panel", panel ? "w-[22rem] max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-30 max-lg:w-[min(22rem,100%)] max-lg:shadow-2xl" : "w-auto")}>
      <nav className={clsx("flex border-b border-line", !panel && "flex-col border-b-0")} role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={panel === t.id} className={clsx("vtt-tab relative flex items-center justify-center", panel ? "min-w-0 flex-1 flex-col gap-0.5 px-1 py-1.5 text-[11px] leading-tight" : "px-2 py-2.5", panel === t.id && "on")} onClick={() => ui.set({ panel: panel === t.id ? null : t.id })} title={t.full ?? t.label} aria-label={t.full ?? t.label}>
            <Icon name={t.icon} size={16} />
            {panel && <span className="block max-w-full truncate">{t.label}</span>}
            {t.id === "chat" && unread > 0 && panel !== "chat" && <span className="absolute right-1 top-1 size-2 rounded-full bg-accent" />}
          </button>
        ))}
      </nav>
      {panel && (
        <div className="min-h-0 flex-1">
          {panel === "chat" && <ChatPanel />}
          {panel === "journal" && <JournalPanel />}
          {panel === "compendium" && <CompendiumPanel />}
          {panel === "house" && <HousePanel />}
          {panel === "scene" && scene && <ScenePanel key={scene.id} scene={scene} />}
        </div>
      )}
    </aside>
  );
}
