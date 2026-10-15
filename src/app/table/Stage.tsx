"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { CELL, rangeBand, type FogRegion, type Obj, type Scene, type Shape, type TableState, type Token } from "@/lib/vtt/types";
import { controls, seesBars, useVtt } from "@/lib/vtt/store";
import { vid } from "@/lib/vtt/ops";
import { useTableUi, type Cam } from "./ui";
import { TokenHud } from "./TokenHud";
import { DRAG_NPC, DRAG_RUNNER } from "./Sidebar";
import { placeNpc, placeRunner, baseToken } from "./act";
import { loadImage } from "@/lib/vtt/images";
import { BUILDS, PREMADES, fromBuild, fromPremade, portraitUrl } from "@/lib/sr6/premades";

type Pt = { x: number; y: number };
type Drag =
  | { mode: "move"; ids: string[]; start: Pt; moved: boolean }
  | { mode: "resize"; id: string; start: Pt; w0: number; h0: number }
  | { mode: "pan"; sx: number; sy: number; cam: Cam }
  | { mode: "marquee"; start: Pt }
  | { mode: "ruler"; start: Pt }
  | { mode: "draw"; start: Pt; pts: number[] }
  | { mode: "fog"; start: Pt }
  | null;

const LAYER_ORDER = { map: 0, token: 1, gm: 2 } as const;
const BAR_COLORS = { b1: "var(--danger)", b2: "var(--cyan)", b3: "var(--accent)" } as const;
const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
const snapTo = (v: number) => Math.round(v / CELL) * CELL;
const norm = (a: Pt, b: Pt) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

/** The fog mask: white is fogged, regions apply in order. */
function FogMask({ id, scene }: { id: string; scene: Scene }) {
  const W = scene.cols * CELL, H = scene.rows * CELL;
  return (
    <mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
      <rect x={0} y={0} width={W} height={H} fill="white" />
      {scene.fogRegions.map((r: FogRegion, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.mode === "reveal" ? "black" : "white"} />)}
    </mask>
  );
}

function TokenView({ t, state, sel, current, me, offset, zoom }: { t: Token; state: TableState; sel: boolean; current: boolean; me: ReturnType<typeof useVtt.getState>["me"]; offset: Pt; zoom: number }) {
  const ls = Math.min(2.2, Math.max(1, 1 / zoom));
  const img = t.img ? state.assets[t.img]?.data : undefined;
  const bars = seesBars(t, me) ? (["b1", "b2", "b3"] as const).filter((k) => t.bars[k] && t.bars[k]!.max > 0) : [];
  const x = t.x + offset.x, y = t.y + offset.y;
  const r = Math.min(t.w, t.h) / 2;
  const map = t.layer === "map";
  return (
    <g data-oid={t.id} transform={`translate(${x} ${y})`} className={clsx("vtt-obj", t.layer === "gm" && "vtt-gm")} style={{ cursor: controls(t, me) ? "grab" : "default" }}>
      {current && <rect x={-6} y={-6} width={t.w + 12} height={t.h + 12} rx={map ? 2 : 12} className="vtt-turn" />}
      <g transform={`rotate(${t.rot || 0} ${t.w / 2} ${t.h / 2})`}>
        {img ? (
          <>
            {!map && <rect width={t.w} height={t.h} rx={8} fill="var(--bg-2)" />}
            <image href={img} width={t.w} height={t.h} preserveAspectRatio={map ? "none" : "xMidYMid slice"} clipPath={map ? undefined : `inset(0 round 8px)`} style={map ? undefined : { clipPath: "inset(0 round 8px)" }} />
            {!map && <rect width={t.w} height={t.h} rx={8} fill="none" stroke={t.color} strokeWidth={3} />}
          </>
        ) : (
          <>
            <circle cx={t.w / 2} cy={t.h / 2} r={r - 3} fill={t.color} fillOpacity={0.85} stroke="var(--bg)" strokeWidth={3} />
            <text x={t.w / 2} y={t.h / 2} dy="0.36em" textAnchor="middle" fontSize={r * 0.75} fontWeight={700} fill="#fff" style={{ fontFamily: "var(--font-display)", pointerEvents: "none" }}>{initials(t.name)}</text>
          </>
        )}
      </g>
      {bars.map((k, i) => {
        const b = t.bars[k]!;
        const w = t.w - 8;
        return (
          <g key={k} transform={`translate(4 ${-10 - i * 8})`} pointerEvents="none">
            <rect width={w} height={6} rx={3} fill="rgba(0,0,0,.7)" />
            <rect width={Math.max(0, Math.min(1, b.cur / b.max)) * w} height={6} rx={3} fill={BAR_COLORS[k]} />
          </g>
        );
      })}
      {t.markers.length > 0 && (
        <g transform={`translate(${t.w - 2} 2)`} pointerEvents="none">
          {t.markers.slice(0, 6).map((m, i) => (
            <g key={m} transform={`translate(0 ${i * 15})`}>
              <circle r={7} fill="var(--panel-hi)" stroke="var(--accent-2, var(--accent))" strokeWidth={1.5} />
              <text dy="0.35em" textAnchor="middle" fontSize={7.5} fontWeight={700} fill="var(--fg)">{m.slice(0, 2)}</text>
            </g>
          ))}
        </g>
      )}
      {(t.showName || (me.gm && t.layer === "gm")) && t.name && (
        <g transform={`translate(${t.w / 2} ${t.h + 4 + 10 * ls}) scale(${ls})`} pointerEvents="none">
          <rect x={-Math.max(30, t.name.length * 3.6)} y={-10} width={Math.max(60, t.name.length * 7.2)} height={17} rx={4} fill="rgba(0,0,0,.72)" />
          <text dy="0.3em" textAnchor="middle" fontSize={11} fill="#fff" style={{ fontFamily: "var(--font-ui)" }}>{t.name}</text>
        </g>
      )}
      {sel && <rect x={-3} y={-3} width={t.w + 6} height={t.h + 6} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="6 4" pointerEvents="none" />}
      {sel && me.gm && <rect data-resize={t.id} x={t.w - 4} y={t.h - 4} width={12} height={12} fill="var(--accent)" stroke="var(--bg)" style={{ cursor: "nwse-resize" }} />}
    </g>
  );
}

function ShapeView({ s, sel, offset }: { s: Shape; sel: boolean; offset: Pt }) {
  const x = s.x + offset.x, y = s.y + offset.y;
  return (
    <g data-oid={s.id} transform={`translate(${x} ${y})`} className={clsx("vtt-obj", s.layer === "gm" && "vtt-gm")}>
      {s.kind === "path" && s.pts && <polyline points={s.pts.join(" ")} fill="none" stroke={s.stroke} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" />}
      {s.kind === "rect" && <rect width={s.w} height={s.h} fill={s.fill} stroke={s.stroke} strokeWidth={s.width} />}
      {s.kind === "ellipse" && <ellipse cx={s.w / 2} cy={s.h / 2} rx={s.w / 2} ry={s.h / 2} fill={s.fill} stroke={s.stroke} strokeWidth={s.width} />}
      {s.kind === "text" && <text y={s.size ?? 22} fontSize={s.size ?? 22} fill={s.stroke} style={{ fontFamily: "var(--font-display)" }}>{s.text}</text>}
      {/* a wide invisible stroke makes thin lines easy to grab */}
      {s.kind === "path" && s.pts && <polyline points={s.pts.join(" ")} fill="none" stroke="transparent" strokeWidth={Math.max(14, s.width + 10)} />}
      {s.kind === "text" && <rect width={s.w} height={s.h} fill="transparent" />}
      {sel && <rect x={-4} y={-4} width={s.w + 8} height={s.h + 8} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="6 4" pointerEvents="none" />}
    </g>
  );
}

export function bbox(o: Obj) {
  return { x: o.x, y: o.y, w: o.w, h: o.h };
}

export function Stage({ scene, state }: { scene: Scene; state: TableState }) {
  const me = useVtt((s) => s.me);
  const dispatch = useVtt((s) => s.dispatch);
  const sendFx = useVtt((s) => s.sendFx);
  const pings = useVtt((s) => s.pings);
  const rulers = useVtt((s) => s.rulers);
  const focus = useVtt((s) => s.focus);
  const ui = useTableUi();
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const drag = useRef<Drag>(null);
  const [offset, setOffset] = useState<Pt>({ x: 0, y: 0 });
  const [rubber, setRubber] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [ruler, setRuler] = useState<{ a: Pt; b: Pt } | null>(null);
  const [stroke, setStroke] = useState<{ start: Pt; pts: number[]; cur: Pt } | null>(null);
  const [resize, setResize] = useState<{ id: string; w: number; h: number } | null>(null);
  const touches = useRef(new Map<number, Pt>());
  const pinch = useRef<{ d: number; cam: Cam; mid: Pt } | null>(null);
  const lastRulerFx = useRef(0);
  const [now, setNow] = useState(0);

  const W = scene.cols * CELL, H = scene.rows * CELL;
  const cam: Cam = ui.cams[scene.id] ?? { x: -40, y: -40, z: Math.min(1, Math.max(0.6, Math.min(size.w / (W + 80), size.h / (H + 80)))) };
  const setCam = useCallback((c: Cam) => ui.setCam(scene.id, { ...c, z: Math.max(0.1, Math.min(4, c.z)) }), [scene.id, ui]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // pings fade on their own
  useEffect(() => {
    if (!pings.length) return;
    setNow(Date.now()); // eslint-disable-line react-hooks/set-state-in-effect
    const t = setInterval(() => setNow(Date.now()), 400);
    return () => clearInterval(t);
  }, [pings.length]);

  // GM focus pings and turn follow center the view
  useEffect(() => {
    if (!focus || focus.scene !== scene.id) return;
    setCam({ x: focus.x - size.w / 2 / cam.z, y: focus.y - size.h / 2 / cam.z, z: cam.z });
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  const toWorld = (cx: number, cy: number): Pt => {
    const r = svg.current!.getBoundingClientRect();
    return { x: cam.x + (cx - r.left) / cam.z, y: cam.y + (cy - r.top) / cam.z };
  };

  const objs = useMemo(() => Object.values(scene.objects).filter((o) => me.gm || o.layer !== "gm").sort((a, b) => LAYER_ORDER[a.layer] - LAYER_ORDER[b.layer] || a.z - b.z), [scene.objects, me.gm]);
  const currentToken = state.turn.on && state.turn.current ? state.turn.entries[state.turn.current]?.tokenId : undefined;
  const sel = new Set(ui.selected);

  const pickable = (o: Obj) => (me.gm ? o.layer === ui.layer || ui.layer === "token" && o.layer !== "map" ? true : o.layer === ui.layer : o.layer === "token");

  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.current.size === 2) {
        const [a, b] = [...touches.current.values()];
        drag.current = null;
        setRubber(null);
        pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), cam, mid: toWorld((a.x + b.x) / 2, (a.y + b.y) / 2) };
        return;
      }
    }
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toWorld(e.clientX, e.clientY);
    const target = (e.target as Element).closest?.("[data-oid],[data-resize]") as Element | null;
    const panLike = e.button === 1 || ui.tool === "pan" || (e.button === 0 && e.altKey && e.shiftKey);
    if (panLike) { drag.current = { mode: "pan", sx: e.clientX, sy: e.clientY, cam }; return; }
    if (e.button !== 0) return;
    if (ui.targeting) {
      const tid = target?.getAttribute("data-oid");
      const hit = tid ? scene.objects[tid] : undefined;
      if (hit?.kind === "token" && hit.id !== ui.targeting) ui.set({ dialog: { kind: "attack", attackerId: ui.targeting, targetId: hit.id }, targeting: null });
      return;
    }
    if (ui.tool === "ping") {
      sendFx({ kind: "ping", scene: scene.id, x: p.x, y: p.y, color: ui.color, focus: me.gm && e.shiftKey });
      return;
    }
    if (ui.tool === "ruler") { drag.current = { mode: "ruler", start: p }; setRuler({ a: p, b: p }); return; }
    if (ui.tool === "draw") {
      if (ui.draw === "text") {
        const text = prompt("Text");
        if (text?.trim()) {
          const id = vid("d");
          const size = 24;
          dispatch([{ k: "set", p: ["scenes", scene.id, "objects", id], v: { id, kind: "text", layer: me.gm ? ui.layer : "token", x: p.x, y: p.y, w: text.length * size * 0.6, h: size * 1.3, z: Date.now(), stroke: ui.color, fill: "none", width: 1, text: text.trim(), size, by: me.handle } }]);
        }
        return;
      }
      drag.current = { mode: "draw", start: p, pts: [0, 0] };
      setStroke({ start: p, pts: [0, 0], cur: p });
      return;
    }
    if (ui.tool === "fog" && me.gm) { drag.current = { mode: "fog", start: p }; setRubber({ x: p.x, y: p.y, w: 0, h: 0 }); return; }
    // select tool
    const rid = target?.getAttribute("data-resize");
    if (rid && me.gm) {
      const o = scene.objects[rid];
      if (o) { drag.current = { mode: "resize", id: rid, start: p, w0: o.w, h0: o.h }; setResize({ id: rid, w: o.w, h: o.h }); }
      return;
    }
    const oid = target?.getAttribute("data-oid");
    const o = oid ? scene.objects[oid] : undefined;
    if (o && controls(o, me) && pickable(o)) {
      let ids = ui.selected;
      if (e.shiftKey) ids = sel.has(o.id) ? ids.filter((x) => x !== o.id) : [...ids, o.id];
      else if (!sel.has(o.id)) ids = [o.id];
      ui.select(ids);
      drag.current = { mode: "move", ids: ids.filter((id) => controls(scene.objects[id], me) && !(scene.objects[id] as Token).locked), start: p, moved: false };
      return;
    }
    if (o && !controls(o, me)) { if (o.kind === "token") ui.select([o.id]); return; }
    if (e.pointerType === "touch") { drag.current = { mode: "pan", sx: e.clientX, sy: e.clientY, cam }; ui.select([]); return; }
    if (!e.shiftKey) ui.select([]);
    drag.current = { mode: "marquee", start: p };
    setRubber({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" && touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.current && touches.current.size >= 2) {
        const [a, b] = [...touches.current.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const z = Math.max(0.1, Math.min(4, pinch.current.cam.z * (d / pinch.current.d)));
        const r = svg.current!.getBoundingClientRect();
        const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
        setCam({ x: pinch.current.mid.x - mx / z, y: pinch.current.mid.y - my / z, z });
        return;
      }
    }
    const d = drag.current;
    if (!d) return;
    if (d.mode === "pan") { setCam({ x: d.cam.x - (e.clientX - d.sx) / d.cam.z, y: d.cam.y - (e.clientY - d.sy) / d.cam.z, z: d.cam.z }); return; }
    const p = toWorld(e.clientX, e.clientY);
    if (d.mode === "move") { d.moved = true; setOffset({ x: p.x - d.start.x, y: p.y - d.start.y }); return; }
    if (d.mode === "resize") { setResize({ id: d.id, w: Math.max(10, d.w0 + p.x - d.start.x), h: Math.max(10, d.h0 + p.y - d.start.y) }); return; }
    if (d.mode === "marquee" || d.mode === "fog") { setRubber(norm(d.start, p)); return; }
    if (d.mode === "ruler") {
      const a = ui.snap && !e.altKey ? { x: snapTo(d.start.x - CELL / 2) + CELL / 2, y: snapTo(d.start.y - CELL / 2) + CELL / 2 } : d.start;
      setRuler({ a, b: p });
      const now = Date.now();
      if (now - lastRulerFx.current > 90) {
        lastRulerFx.current = now;
        sendFx({ kind: "ruler", scene: scene.id, pts: [a.x, a.y, p.x, p.y], color: ui.color, label: measure(a, p, scene) });
      }
      return;
    }
    if (d.mode === "draw") {
      if (ui.draw === "path") d.pts.push(Math.round(p.x - d.start.x), Math.round(p.y - d.start.y));
      setStroke({ start: d.start, pts: [...d.pts], cur: p });
    }
  };

  const onUp = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") {
      touches.current.delete(e.pointerId);
      if (pinch.current) { if (touches.current.size < 2) pinch.current = null; return; }
    }
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const p = toWorld(e.clientX, e.clientY);
    if (d.mode === "move") {
      setOffset({ x: 0, y: 0 });
      if (!d.moved) return;
      const dx = p.x - d.start.x, dy = p.y - d.start.y;
      const ops = d.ids.map((id) => {
        const o = scene.objects[id];
        let x = o.x + dx, y = o.y + dy;
        if (ui.snap && !e.altKey && o.kind === "token") { x = snapTo(x); y = snapTo(y); }
        return { k: "merge" as const, p: ["scenes", scene.id, "objects", id], v: { x: Math.round(x), y: Math.round(y) } };
      });
      dispatch(ops);
      return;
    }
    if (d.mode === "resize") {
      const r = resize;
      setResize(null);
      if (!r) return;
      const snapW = ui.snap && !e.altKey ? Math.max(CELL, snapTo(r.w)) : Math.round(r.w);
      const snapH = ui.snap && !e.altKey ? Math.max(CELL, snapTo(r.h)) : Math.round(r.h);
      dispatch([{ k: "merge", p: ["scenes", scene.id, "objects", r.id], v: { w: snapW, h: snapH } }]);
      return;
    }
    if (d.mode === "marquee") {
      const r = norm(d.start, p);
      setRubber(null);
      if (r.w < 4 && r.h < 4) return;
      const hit = objs.filter((o) => controls(o, me) && pickable(o) && o.x < r.x + r.w && o.x + o.w > r.x && o.y < r.y + r.h && o.y + o.h > r.y).map((o) => o.id);
      ui.select(e.shiftKey ? [...new Set([...ui.selected, ...hit])] : hit);
      return;
    }
    if (d.mode === "fog") {
      const r = norm(d.start, p);
      setRubber(null);
      if (r.w < 6 || r.h < 6) return;
      const rr = ui.snap && !e.altKey ? { x: snapTo(r.x), y: snapTo(r.y), w: Math.max(CELL, snapTo(r.w)), h: Math.max(CELL, snapTo(r.h)) } : r;
      dispatch([{ k: "set", p: ["scenes", scene.id, "fogRegions"], v: [...scene.fogRegions, { ...rr, mode: ui.fogMode }] }]);
      return;
    }
    if (d.mode === "ruler") { setRuler(null); sendFx({ kind: "ruler-end" }); return; }
    if (d.mode === "draw") {
      setStroke(null);
      const id = vid("d");
      const layer = me.gm ? ui.layer : "token";
      const base = { id, layer, z: Date.now(), stroke: ui.color, fill: ui.fill ? `${ui.color}40` : "none", width: ui.width, by: me.handle };
      if (ui.draw === "path") {
        if (d.pts.length < 6) return;
        const xs = d.pts.filter((_, i) => i % 2 === 0), ys = d.pts.filter((_, i) => i % 2 === 1);
        const minX = Math.min(...xs), minY = Math.min(...ys);
        const pts = d.pts.map((v, i) => (i % 2 === 0 ? v - minX : v - minY));
        dispatch([{ k: "set", p: ["scenes", scene.id, "objects", id], v: { ...base, kind: "path", x: d.start.x + minX, y: d.start.y + minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY, pts } }]);
      } else {
        const r = norm(d.start, p);
        if (r.w < 4 && r.h < 4) return;
        dispatch([{ k: "set", p: ["scenes", scene.id, "objects", id], v: { ...base, kind: ui.draw, ...r } }]);
      }
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const wx = cam.x + mx / cam.z, wy = cam.y + my / cam.z;
    const z = Math.max(0.1, Math.min(4, cam.z * Math.exp(-e.deltaY * 0.0015)));
    setCam({ x: wx - mx / z, y: wy - my / z, z });
  };

  const onDouble = (e: React.MouseEvent) => {
    const t = (e.target as Element).closest?.("[data-oid]");
    const o = t ? scene.objects[t.getAttribute("data-oid")!] : undefined;
    if (o?.kind !== "token") return;
    if (o.runner && o.runner.owner === me.handle) ui.set({ dialog: { kind: "sheet", runnerId: o.runner.runnerId } });
    else ui.set({ dialog: { kind: "card", id: o.id } });
  };

  // keyboard: tools, delete, nudge
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input,textarea,select,[contenteditable]") || e.metaKey || e.ctrlKey) return;
      const u = useTableUi.getState();
      const tools: Record<string, typeof u.tool> = { v: "select", h: "pan", r: "ruler", p: "ping", d: "draw", f: "fog" };
      const key = e.key.toLowerCase();
      if (tools[key] && (key !== "f" || me.gm)) { u.set({ tool: tools[key] }); return; }
      if (e.key === "Escape") { u.select([]); u.set({ tool: "select", targeting: null }); return; }
      const mine = u.selected.map((id) => scene.objects[id]).filter((o) => o && controls(o, me));
      if ((e.key === "Delete" || e.key === "Backspace") && mine.length) {
        const ok = mine.filter((o) => me.gm || (o.kind === "token" ? o.owners.length === 1 && o.owners[0] === me.handle : o.by === me.handle));
        dispatch(ok.map((o) => ({ k: "del" as const, p: ["scenes", scene.id, "objects", o.id] })));
        u.select([]);
        e.preventDefault();
        return;
      }
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (arrows[e.key] && mine.length) {
        const step = e.shiftKey ? 7 : CELL;
        const [dx, dy] = arrows[e.key];
        dispatch(mine.filter((o) => !(o.kind === "token" && o.locked)).map((o) => ({ k: "merge" as const, p: ["scenes", scene.id, "objects", o.id], v: { x: o.x + dx * step, y: o.y + dy * step } })));
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [scene, me, dispatch]);

  const onDragOver = (e: React.DragEvent) => {
    const t = e.dataTransfer.types;
    if (t.includes(DRAG_RUNNER) || t.includes(DRAG_NPC) || t.includes("Files")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }
  };
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const p = toWorld(e.clientX, e.clientY);
    const x = p.x - CELL / 2, y = p.y - CELL / 2;
    const rid = e.dataTransfer.getData(DRAG_RUNNER);
    if (rid) { placeRunner(rid, scene, x, y); return; }
    const npc = e.dataTransfer.getData(DRAG_NPC);
    if (npc && me.gm) {
      const d = JSON.parse(npc) as { kind: string; id?: string };
      if (d.kind === "premade") { const pm = PREMADES.find((q) => q.alias === d.id); if (pm) placeNpc(scene, x, y, { name: pm.alias, char: fromPremade(pm), portrait: await dataUrl(portraitUrl(pm)) }); }
      else if (d.kind === "template") { const b = BUILDS.find((q) => q.id === d.id); if (b) placeNpc(scene, x, y, { name: b.archetype, char: fromBuild(b) }); }
      else placeNpc(scene, x, y);
      return;
    }
    const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/"));
    if (!f) return;
    const u = useTableUi.getState();
    if (me.gm && u.layer === "map" && !scene.bg) {
      const a = await loadImage(f, "map");
      const id = vid("a");
      dispatch([{ k: "set", p: ["assets", id], v: { id, ...a } }, { k: "merge", p: ["scenes", scene.id], v: { bg: id, cols: Math.max(4, Math.round(a.w / CELL)), rows: Math.max(4, Math.round(a.h / CELL)) } }]);
      return;
    }
    const big = me.gm && u.layer === "map";
    const a = await loadImage(f, big ? "map" : "token");
    const aid = vid("a");
    const layer = me.gm ? u.layer : "token";
    const t = baseToken(f.name.replace(/\.[^.]+$/, ""), x, y, layer, me.gm ? [] : [me.handle]);
    t.img = aid;
    t.showName = false;
    if (big) { t.w = Math.round(a.w / CELL) * CELL || CELL; t.h = Math.round(a.h / CELL) * CELL || CELL; }
    dispatch([{ k: "set", p: ["assets", aid], v: { id: aid, ...a } }, { k: "set", p: ["scenes", scene.id, "objects", t.id], v: t }]);
  };

  const myRuler = ruler ? { pts: [ruler.a.x, ruler.a.y, ruler.b.x, ruler.b.y], label: measure(ruler.a, ruler.b, scene), color: ui.color } : null;
  const otherRulers = Object.values(rulers).filter((r) => r.scene === scene.id && r.from !== me.handle);
  const single = ui.selected.length === 1 ? scene.objects[ui.selected[0]] : undefined;

  return (
    <div ref={wrap} className={clsx("vtt-stage relative size-full overflow-hidden select-none", ui.tool === "pan" && "cursor-grab", (ui.tool === "ruler" || ui.tool === "draw" || ui.tool === "fog") && "cursor-crosshair", ui.tool === "ping" && "cursor-cell", ui.targeting && "vtt-targeting")} style={{ background: "#05060a", touchAction: "none" }} onDragOver={onDragOver} onDrop={(e) => void onDrop(e)}>
      <svg
        ref={svg}
        width={size.w}
        height={size.h}
        viewBox={`${cam.x} ${cam.y} ${size.w / cam.z} ${size.h / cam.z}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
        onDoubleClick={onDouble}
        onContextMenu={(e) => e.preventDefault()}
        role="application"
        aria-label={`Map: ${scene.name}`}
      >
        <defs>
          <pattern id="vtt-grid" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
            <path d={`M${CELL} 0H0V${CELL}`} fill="none" stroke={scene.gridColor} strokeOpacity={scene.gridOpacity} strokeWidth={1 / Math.max(cam.z, 0.5)} />
          </pattern>
          {scene.fog && <FogMask id="vtt-fog" scene={scene} />}
        </defs>
        <rect x={0} y={0} width={W} height={H} fill={scene.bgColor} />
        {scene.bg && state.assets[scene.bg] && <image href={state.assets[scene.bg].data} x={0} y={0} width={W} height={H} preserveAspectRatio="xMidYMid slice" />}
        {objs.filter((o) => o.layer === "map").map((o) => (o.kind === "token" ? <TokenView key={o.id} t={resize?.id === o.id ? { ...o, w: resize.w, h: resize.h } : o} state={state} sel={sel.has(o.id)} current={false} me={me} zoom={cam.z} offset={sel.has(o.id) ? offset : { x: 0, y: 0 }} /> : <ShapeView key={o.id} s={o} sel={sel.has(o.id)} offset={sel.has(o.id) ? offset : { x: 0, y: 0 }} />))}
        {scene.grid && <rect x={0} y={0} width={W} height={H} fill="url(#vtt-grid)" pointerEvents="none" />}
        {objs.filter((o) => o.kind === "token" && o.aura && o.layer !== "map").map((o) => {
          const t = o as Token;
          const rad = (t.aura! / scene.scale) * CELL + Math.max(t.w, t.h) / 2;
          return <circle key={`aura-${t.id}`} cx={t.x + t.w / 2 + (sel.has(t.id) ? offset.x : 0)} cy={t.y + t.h / 2 + (sel.has(t.id) ? offset.y : 0)} r={rad} fill={t.auraColor ?? "#1fe3f0"} fillOpacity={0.12} stroke={t.auraColor ?? "#1fe3f0"} strokeOpacity={0.5} pointerEvents="none" />;
        })}
        {objs.filter((o) => o.layer !== "map").map((o) => (o.kind === "token"
          ? <TokenView key={o.id} t={resize?.id === o.id ? { ...o, w: resize.w, h: resize.h } : o} state={state} sel={sel.has(o.id)} current={o.id === currentToken} me={me} zoom={cam.z} offset={sel.has(o.id) ? offset : { x: 0, y: 0 }} />
          : <ShapeView key={o.id} s={o} sel={sel.has(o.id)} offset={sel.has(o.id) ? offset : { x: 0, y: 0 }} />))}
        {scene.fog && <rect x={0} y={0} width={W} height={H} fill="#03040a" fillOpacity={me.gm ? 0.5 : 1} mask="url(#vtt-fog)" pointerEvents="none" />}
        <rect x={0} y={0} width={W} height={H} fill="none" stroke="var(--line-hi)" strokeWidth={2 / cam.z} pointerEvents="none" />
        {stroke && ui.draw === "path" && <polyline transform={`translate(${stroke.start.x} ${stroke.start.y})`} points={stroke.pts.join(" ")} fill="none" stroke={ui.color} strokeWidth={ui.width} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />}
        {stroke && ui.draw === "rect" && (() => { const r = norm(stroke.start, stroke.cur); return <rect {...{ x: r.x, y: r.y, width: r.w, height: r.h }} fill={ui.fill ? `${ui.color}40` : "none"} stroke={ui.color} strokeWidth={ui.width} pointerEvents="none" />; })()}
        {stroke && ui.draw === "ellipse" && (() => { const r = norm(stroke.start, stroke.cur); return <ellipse cx={r.x + r.w / 2} cy={r.y + r.h / 2} rx={r.w / 2} ry={r.h / 2} fill={ui.fill ? `${ui.color}40` : "none"} stroke={ui.color} strokeWidth={ui.width} pointerEvents="none" />; })()}
        {rubber && <rect x={rubber.x} y={rubber.y} width={rubber.w} height={rubber.h} fill={ui.tool === "fog" ? (ui.fogMode === "reveal" ? "rgba(34,245,154,.15)" : "rgba(0,0,0,.5)") : "rgba(120,170,255,.12)"} stroke={ui.tool === "fog" ? "#22f59a" : "var(--accent-2, var(--accent))"} strokeDasharray="6 4" strokeWidth={1.5 / cam.z} pointerEvents="none" />}
        {[...otherRulers, ...(myRuler ? [myRuler] : [])].map((r, i) => (
          <g key={i} pointerEvents="none">
            <line x1={r.pts[0]} y1={r.pts[1]} x2={r.pts[2]} y2={r.pts[3]} stroke={r.color} strokeWidth={3 / cam.z} strokeDasharray={`${10 / cam.z} ${6 / cam.z}`} />
            <circle cx={r.pts[0]} cy={r.pts[1]} r={5 / cam.z} fill={r.color} />
            <g transform={`translate(${r.pts[2]} ${r.pts[3]}) scale(${1 / cam.z})`}>
              <rect x={12} y={-26} width={Math.max(120, r.label.length * 7.4)} height={26} rx={4} fill="rgba(0,0,0,.82)" stroke={r.color} />
              <text x={20} y={-9} fontSize={13} fill="#fff" style={{ fontFamily: "var(--font-mono)" }}>{r.label}</text>
            </g>
          </g>
        ))}
        {pings.filter((p) => p.scene === scene.id && now - p.at < 2400).map((p) => (
          <g key={p.id} transform={`translate(${p.x} ${p.y}) scale(${1 / cam.z})`} pointerEvents="none">
            <circle r={10} fill="none" stroke={p.color} strokeWidth={3} className="vtt-ping" />
            <circle r={10} fill="none" stroke={p.color} strokeWidth={3} className="vtt-ping" style={{ animationDelay: ".35s" }} />
            <circle r={5} fill={p.color} />
          </g>
        ))}
      </svg>
      {single && ui.tool === "select" && !ui.targeting && !offset.x && !offset.y && !resize && (
        <TokenHud o={single} scene={scene} cam={cam} />
      )}
    </div>
  );
}

/** "4.2 squares · 6.3 m · Near" */
export function measure(a: Pt, b: Pt, scene: Scene): string {
  const sq = Math.hypot(b.x - a.x, b.y - a.y) / CELL;
  const m = sq * scene.scale;
  return `${sq.toFixed(1)} sq · ${m.toFixed(1)} m · ${rangeBand(m)}`;
}

async function dataUrl(url: string | undefined | null): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob);
    const side = 300, c = document.createElement("canvas");
    const s = Math.min(bmp.width, bmp.height);
    c.width = side; c.height = side;
    c.getContext("2d")!.drawImage(bmp, (bmp.width - s) / 2, 0, s, s, 0, 0, side, side);
    return c.toDataURL("image/webp", 0.82);
  } catch { return undefined; }
}
