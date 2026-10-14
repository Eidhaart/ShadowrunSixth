"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { useComms } from "@/lib/store/comms";
import { useSettings } from "@/lib/store/settings";
import { useRunners } from "@/lib/store/characters";
import { LAYERS, type Scene, type Token } from "@/lib/vtt/types";
import { newScene, vid } from "@/lib/vtt/ops";
import { useVtt } from "@/lib/vtt/store";
import { barsFor, cardFor } from "@/lib/vtt/runner";
import { Stage } from "./Stage";
import { Sidebar } from "./Sidebar";
import { TurnOrder } from "./TurnOrder";
import { Dialogs } from "./Dialogs";
import { DRAW_COLORS, useTableUi, type Tool } from "./ui";
import { assetOps } from "./act";

const TOOLS: { id: Tool; icon: string; label: string; key: string; gm?: boolean }[] = [
  { id: "select", icon: "M5 3l14 8-6 2-3 6z", label: "Select and move", key: "V" },
  { id: "pan", icon: "M8 11V5a1.5 1.5 0 013 0v5M11 10V4a1.5 1.5 0 013 0v6M14 10V5.500a1.500 1.500 0 013 0V14a6 6 0 01-6 6h-1a6 6 0 01-5-2.700L3 13.500a1.500 1.500 0 012.500-1.700L8 14", label: "Pan the map", key: "H" },
  { id: "ruler", icon: "M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2", label: "Measure distance and range", key: "R" },
  { id: "ping", icon: "M12 21s-7-6.500-7-12a7 7 0 0114 0c0 5.500-7 12-7 12zM12 11.500a2.500 2.500 0 100-5 2.500 2.500 0 000 5z", label: "Ping (GM: shift-click pulls everyone's view)", key: "P" },
  { id: "draw", icon: "M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3", label: "Draw", key: "D" },
  { id: "fog", icon: "M3 10h13a3 3 0 100-6M3 14h17a3 3 0 110 6M3 18h8", label: "Fog of war", key: "F", gm: true },
];

function Glyph({ d }: { d: string }) {
  return <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

function Toolbar() {
  const ui = useTableUi();
  const me = useVtt((s) => s.me);
  const viewing = useVtt((s) => s.viewing);
  const cam = viewing ? ui.cams[viewing] : undefined;
  const zoom = (f: number) => { if (viewing && cam) ui.setCam(viewing, { ...cam, z: Math.max(0.1, Math.min(4, cam.z * f)) }); };
  return (
    <div className="vtt-toolbar absolute left-2 top-2 z-20 flex flex-col gap-1 p-1">
      {TOOLS.filter((t) => !t.gm || me.gm).map((t) => (
        <div key={t.id} className="relative">
          <button className={clsx("vtt-tool", ui.tool === t.id && "on")} onClick={() => ui.set({ tool: t.id })} title={`${t.label} (${t.key})`} aria-label={t.label} aria-pressed={ui.tool === t.id}><Glyph d={t.icon} /></button>
          {ui.tool === t.id && t.id === "draw" && (
            <div className="vtt-flyout absolute left-full top-0 ml-1.5 w-52 space-y-2 p-2">
              <div className="grid grid-cols-4 gap-1">
                {(["path", "rect", "ellipse", "text"] as const).map((k) => <button key={k} className={clsx("btn small !px-1 capitalize", ui.draw === k && "primary")} onClick={() => ui.set({ draw: k })}>{k === "path" ? "Free" : k === "ellipse" ? "Oval" : k}</button>)}
              </div>
              <div className="flex flex-wrap gap-1">{DRAW_COLORS.map((c) => <button key={c} className={clsx("size-5 rounded-full border", ui.color === c ? "border-fg ring-2 ring-accent" : "border-line")} style={{ background: c }} onClick={() => ui.set({ color: c })} aria-label={`Color ${c}`} />)}</div>
              <label className="flex items-center gap-2 text-xs text-dim">Width <input type="range" min={1} max={24} value={ui.width} onChange={(e) => ui.set({ width: Number(e.target.value) })} className="flex-1" /></label>
              <label className="flex items-center gap-1.5 text-xs text-dim"><input type="checkbox" checked={ui.fill} onChange={(e) => ui.set({ fill: e.target.checked })} /> Fill shapes</label>
            </div>
          )}
          {ui.tool === t.id && t.id === "fog" && (
            <div className="vtt-flyout absolute left-full top-0 ml-1.5 w-44 space-y-1.5 p-2">
              <div className="grid grid-cols-2 gap-1">
                <button className={clsx("btn small", ui.fogMode === "reveal" && "primary")} onClick={() => ui.set({ fogMode: "reveal" })}>Reveal</button>
                <button className={clsx("btn small", ui.fogMode === "hide" && "primary")} onClick={() => ui.set({ fogMode: "hide" })}>Hide</button>
              </div>
              <p className="text-[11px] text-faint">Drag a box on the map. Turn fog on in the Scene tab.</p>
            </div>
          )}
        </div>
      ))}
      <span className="my-0.5 h-px bg-line" />
      <button className="vtt-tool" onClick={() => zoom(1.25)} title="Zoom in" aria-label="Zoom in"><Icon name="plus" size={16} /></button>
      <button className="vtt-tool" onClick={() => zoom(0.8)} title="Zoom out" aria-label="Zoom out"><Icon name="minus" size={16} /></button>
      <button className={clsx("vtt-tool text-[10px] font-bold", ui.snap && "on")} onClick={() => ui.set({ snap: !ui.snap })} title="Snap to grid (hold Alt to place freely)" aria-pressed={ui.snap}>#</button>
      <button className={clsx("vtt-tool", ui.turnOpen && "on")} onClick={() => ui.set({ turnOpen: !ui.turnOpen })} title="Turn order" aria-pressed={ui.turnOpen}><Icon name="bolt" size={16} /></button>
    </div>
  );
}

function SceneBar({ viewing }: { viewing: Scene | undefined }) {
  const state = useVtt((s) => s.state)!;
  const me = useVtt((s) => s.me);
  const dispatch = useVtt((s) => s.dispatch);
  const view = useVtt((s) => s.view);
  const ui = useTableUi();
  const comms = useComms();
  const add = () => {
    const id = vid("sc");
    dispatch([{ k: "set", p: ["scenes", id], v: newScene(id, `Scene ${state.order.length + 1}`) }, { k: "set", p: ["order"], v: [...state.order, id] }]);
    view(id);
    ui.set({ panel: "scene" });
  };
  const status = comms.status === "online" ? `${comms.room} · ${comms.users.length} here` : comms.status === "local" ? "this device only" : comms.status === "connecting" ? "linking…" : "solo prep";
  return (
    <div className="vtt-scenebar flex items-center gap-1.5 overflow-x-auto border-b border-line bg-panel px-2 py-1.5">
      {me.gm ? (
        <>
          {state.order.map((id) => {
            const s = state.scenes[id];
            if (!s) return null;
            const players = state.playerScene === id;
            return (
              <button key={id} className={clsx("vtt-scene-chip shrink-0", viewing?.id === id && "on")} onClick={() => view(id)} title={players ? "The players are here" : "Only you are looking at this"}>
                {players && <span className="vtt-ribbon" aria-label="Players here" />}
                {s.name}
              </button>
            );
          })}
          <button className="btn small ghost shrink-0 !px-2" onClick={add} title="New scene"><Icon name="plus" size={15} /></button>
          {viewing && state.playerScene !== viewing.id && (
            <button className="btn small primary shrink-0" onClick={() => { dispatch([{ k: "set", p: ["playerScene"], v: viewing.id }]); ui.select([]); }}>Move players here</button>
          )}
          <span className="mx-1 h-5 w-px shrink-0 bg-line" />
          <div className="flex shrink-0 overflow-hidden border border-line" role="radiogroup" aria-label="Active layer">
            {LAYERS.map((l) => (
              <button key={l.id} role="radio" aria-checked={ui.layer === l.id} className={clsx("px-2 py-1 text-xs", ui.layer === l.id ? "bg-accent text-bg" : "text-dim hover:text-fg")} onClick={() => { ui.set({ layer: l.id }); ui.select([]); }} title={l.blurb}>{l.name}</button>
            ))}
          </div>
        </>
      ) : (
        <span className="shrink-0 font-display font-semibold">{viewing?.name ?? "Waiting for the GM"}</span>
      )}
      <span className={clsx("vtt-conn ml-auto shrink-0", comms.status === "online" && "on")}>{me.gm ? "GM · " : ""}{status}</span>
    </div>
  );
}

/** Keeps my runners' tokens in step with their sheets, and GM edits to bars flow back to the sheet. */
function useRunnerSync() {
  const state = useVtt((s) => s.state);
  const me = useVtt((s) => s.me);
  const runners = useRunners((s) => s.runners);
  const last = useRef(new Map<string, string>());
  useEffect(() => {
    if (!state) return;
    const scene = state.scenes[state.playerScene ?? ""];
    if (!scene) return;
    const mine = Object.values(scene.objects).filter((o): o is Token => o.kind === "token" && o.runner?.owner === me.handle);
    const ops: Parameters<ReturnType<typeof useVtt.getState>["dispatch"]>[0] = [];
    for (const t of mine) {
      const r = runners[t.runner!.runnerId];
      if (!r) continue;
      const key = t.id;
      const prev = last.current.get(key);
      const tokenBars = JSON.stringify(t.bars);
      // someone else changed the bars since we last published: write damage and Edge back to the sheet
      if (prev && prev !== tokenBars && t.bars.b1 && t.bars.b2) {
        const b = t.bars;
        useRunners.getState().update(r.id, (x) => {
          x.damage.physical = Math.max(0, b.b1!.max - b.b1!.cur);
          x.damage.stun = Math.max(0, b.b2!.max - b.b2!.cur);
          if (b.b3) x.edgeCurrent = Math.max(0, b.b3.cur);
        });
        last.current.set(key, tokenBars);
        continue;
      }
      const bars = barsFor(r), card = cardFor(r);
      const want: Record<string, unknown> = {};
      if (JSON.stringify(bars) !== tokenBars) want.bars = bars;
      if (JSON.stringify(card) !== JSON.stringify(t.card)) want.card = card;
      if (r.portrait && !(t.img && state.assets[t.img]?.data === r.portrait)) {
        const a = assetOps(state, r.portrait);
        if (a.id) { ops.push(...a.ops); want.img = a.id; }
      }
      last.current.set(key, JSON.stringify(want.bars ?? t.bars));
      if (Object.keys(want).length) ops.push({ k: "merge", p: ["scenes", scene.id, "objects", t.id], v: want });
    }
    if (ops.length) useVtt.getState().dispatch(ops);
  }, [state, runners, me.handle]);
}

function JoinCard() {
  const s = useSettings();
  const c = useComms();
  const [handle, setHandle] = useState(s.handle);
  const [room, setRoom] = useState(s.room || "table-1");
  const join = (role: "gm" | "player") => {
    s.set({ handle: handle.trim(), room: room.trim() || "table-1", role });
    c.connect({ url: s.chatUrl.trim(), room: room.trim() || "table-1", handle: handle.trim() || "runner", role });
  };
  return (
    <div className="vtt-join absolute bottom-3 left-1/2 z-20 w-[min(34rem,calc(100%-1.5rem))] -translate-x-1/2 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-28 flex-1 text-xs text-dim">Handle<input className="field" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Your name" /></label>
        <label className="min-w-28 flex-1 text-xs text-dim">Room<input className="field" value={room} onChange={(e) => setRoom(e.target.value)} /></label>
        <button className="btn primary" onClick={() => join("player")} disabled={!handle.trim()}>Join as player</button>
        <button className="btn" onClick={() => join("gm")} disabled={!handle.trim()}>Run as GM</button>
      </div>
      <p className="mt-1.5 text-xs text-faint">You are prepping solo. Everything is saved on this device; join a room to play with your table. <Link className="underline" href="/comms">Relay settings</Link></p>
    </div>
  );
}

export function Table() {
  const start = useVtt((s) => s.start);
  const state = useVtt((s) => s.state);
  const loaded = useVtt((s) => s.loaded);
  const viewing = useVtt((s) => s.viewing);
  const me = useVtt((s) => s.me);
  const newerLocal = useVtt((s) => s.newerLocal);
  const notice = useVtt((s) => s.notice);
  const status = useComms((s) => s.status);
  const role = useComms((s) => s.role);
  const handle = useComms((s) => s.handle);
  const ui = useTableUi();

  useEffect(() => { void start(); }, [start, status, role, handle]);
  // small screens start with the map, not the sidebar
  useEffect(() => { if (window.innerWidth < 1024) useTableUi.getState().set({ panel: null }); }, []);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => useVtt.getState().setNotice(null), 4000); return () => clearTimeout(t); }, [notice]);
  useRunnerSync();
  // open the turn order when combat starts
  const entryCount = state ? Object.keys(state.turn.entries).length : 0;
  const prevCount = useRef(entryCount);
  useEffect(() => {
    if (entryCount > prevCount.current) useTableUi.getState().set({ turnOpen: true });
    prevCount.current = entryCount;
  }, [entryCount]);

  const sceneId = me.gm ? viewing ?? state?.playerScene : state?.playerScene;
  const scene = state && sceneId ? state.scenes[sceneId] : undefined;

  return (
    <div className="vtt flex h-[calc(100dvh-3rem)] min-h-[24rem] flex-col max-md:h-[calc(100dvh-7rem-env(safe-area-inset-bottom))]">
      {state && <SceneBar viewing={scene} />}
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          {!loaded && <div className="grid size-full place-items-center text-dim">Loading the table…</div>}
          {loaded && !state && <div className="grid size-full place-items-center p-6 text-center text-dim">The GM has not opened the table yet. It appears here the moment they do.</div>}
          {state && !scene && <div className="grid size-full place-items-center p-6 text-center text-dim">No scene to show.</div>}
          {state && scene && <Stage key={scene.id} scene={scene} state={state} />}
          {state && scene && <Toolbar />}
          {state && ui.turnOpen && (
            <div className="absolute right-2 top-2 z-10 max-sm:left-14 max-sm:right-auto"><TurnOrder /></div>
          )}
          {status === "off" && loaded && <JoinCard />}
          {newerLocal && me.gm && (
            <div className="vtt-join absolute bottom-3 left-1/2 z-30 flex w-[min(34rem,calc(100%-1.5rem))] -translate-x-1/2 flex-wrap items-center gap-2 p-3 text-sm">
              <span className="flex-1">This device has a newer copy of the table than the relay.</span>
              <button className="btn small primary" onClick={() => useVtt.getState().useLocalCopy()}>Use my copy</button>
              <button className="btn small ghost" onClick={() => useVtt.getState().dismissLocal()}>Keep the relay&apos;s</button>
            </div>
          )}
          {notice && <div role="status" className="vtt-join absolute left-1/2 top-3 z-30 -translate-x-1/2 px-3 py-2 text-sm">{notice}</div>}
        </div>
        {state && <Sidebar scene={scene} />}
      </div>
      <Dialogs />
    </div>
  );
}
