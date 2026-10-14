"use client";
import { create } from "zustand";
import { idbGet, idbSet } from "@/lib/idb";
import { setVttHandler, useComms } from "@/lib/store/comms";
import { useSettings } from "@/lib/store/settings";
import { applyOps, emptyTable, newScene, vid } from "./ops";
import type { Fx, Obj, Op, TableState, Token } from "./types";

/**
 * Client side of the table. Offline it is a private prep space saved on this device. In a room the
 * relay holds the shared copy: changes are applied here at once and sent as small operations. The GM
 * also keeps a copy on the device, because the free relay forgets everything when it sleeps.
 */

export interface Ping { id: string; x: number; y: number; color: string; scene: string; at: number }
export interface Ruler { from: string; pts: number[]; color: string; label: string; scene: string }

type Me = { handle: string; gm: boolean; online: boolean };

interface VttState {
  state: TableState | null;
  loaded: boolean;
  me: Me;
  /** Scene the GM is looking at; players always see the players' scene. */
  viewing: string | null;
  pings: Ping[];
  rulers: Record<string, Ruler>;
  /** Set when the GM's saved copy is newer than the room's table. */
  newerLocal: TableState | null;
  notice: string | null;
  /** Ask the stage to center on a point (GM focus pings, turn follow). */
  focus: { x: number; y: number; scene: string; at: number } | null;
  start: () => Promise<void>;
  dispatch: (ops: Op[]) => void;
  sendFx: (fx: Fx) => void;
  view: (sceneId: string) => void;
  useLocalCopy: () => void;
  dismissLocal: () => void;
  replaceAll: (s: TableState) => void;
  setNotice: (n: string | null) => void;
}

const keyFor = () => `vtt:${(useSettings.getState().room || "table-1").trim()}`;

function meNow(): Me {
  const c = useComms.getState();
  const online = c.status === "online" || c.status === "local";
  return { handle: (c.handle || useSettings.getState().handle || "runner").trim(), gm: !online || c.role === "gm", online };
}

/** A starter table so a new GM sees a working scene straight away. */
export function starterTable(): TableState {
  const t = emptyTable();
  const id = vid("sc");
  t.scenes[id] = newScene(id, "Scene 1");
  t.order = [id];
  t.playerScene = id;
  return t;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useVtt = create<VttState>((set, get) => {
  const persist = () => {
    const { state, me } = get();
    if (!state || !me.gm) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { void idbSet(keyFor(), get().state).catch(() => undefined); }, 800);
  };

  const transmit = (m: { type: string; [k: string]: unknown }) => useComms.getState().sendRaw(m);

  const receive = (m: { type: string; [k: string]: unknown }) => {
    const me = meNow();
    set({ me });
    if (m.type === "vtt_snap") {
      const snap = (m.state as TableState | null) ?? null;
      void (async () => {
        const local = me.gm ? await idbGet<TableState>(keyFor()).catch(() => undefined) : undefined;
        if (!snap) {
          if (me.gm) {
            const t = local && Object.keys(local.scenes).length ? local : starterTable();
            transmit({ type: "vtt_restore", state: t });
            set({ state: t, loaded: true, viewing: t.playerScene });
            persist();
          } else set({ state: null, loaded: true });
          return;
        }
        set((s) => ({
          state: snap,
          loaded: true,
          newerLocal: me.gm && local && local.stamp > snap.stamp + 1000 && Object.keys(local.scenes).length ? local : null,
          viewing: s.viewing && snap.scenes[s.viewing] ? s.viewing : snap.playerScene ?? snap.order[0] ?? null,
        }));
        persist();
      })();
      return;
    }
    if (m.type === "vtt_op") {
      const ops = m.ops as Op[];
      set((s) => {
        if (!s.state) return {};
        const next = applyOps(s.state, ops);
        const viewing = me.gm ? (s.viewing && next.scenes[s.viewing] ? s.viewing : next.playerScene) : next.playerScene;
        return { state: next, viewing };
      });
      persist();
      return;
    }
    if (m.type === "vtt_err") {
      set({ notice: String(m.text ?? "The table refused that change.") });
      return;
    }
    if (m.type === "vtt_fx") {
      const fx = m.fx as Fx;
      const from = String(m.from ?? "?");
      if (fx.kind === "ping") {
        const p: Ping = { id: vid("p"), x: fx.x, y: fx.y, color: fx.color, scene: fx.scene, at: Date.now() };
        set((s) => ({ pings: [...s.pings.slice(-12), p], focus: fx.focus ? { x: fx.x, y: fx.y, scene: fx.scene, at: Date.now() } : s.focus }));
      } else if (fx.kind === "ruler") set((s) => ({ rulers: { ...s.rulers, [from]: { from, pts: fx.pts, color: fx.color, label: fx.label, scene: fx.scene } } }));
      else if (fx.kind === "ruler-end") set((s) => { const r = { ...s.rulers }; delete r[from]; return { rulers: r }; });
    }
  };

  return {
    state: null,
    loaded: false,
    me: { handle: "runner", gm: true, online: false },
    viewing: null,
    pings: [],
    rulers: {},
    newerLocal: null,
    notice: null,
    focus: null,
    start: async () => {
      setVttHandler(receive);
      const me = meNow();
      set({ me });
      if (me.online) {
        // The relay sends a snapshot on join; ask again in case we joined before opening the table.
        if (!transmit({ type: "vtt_req" })) set({ loaded: true });
        // Local tabs on one device have no relay: load the shared copy from the device.
        if (useComms.getState().status === "local") {
          const local = await idbGet<TableState>(keyFor()).catch(() => undefined);
          const t = local ?? starterTable();
          set({ state: t, loaded: true, viewing: t.playerScene });
        }
        return;
      }
      const local = await idbGet<TableState>(keyFor()).catch(() => undefined);
      const t = local && Object.keys(local.scenes).length ? local : starterTable();
      set({ state: t, loaded: true, viewing: get().viewing && t.scenes[get().viewing!] ? get().viewing : t.playerScene ?? t.order[0] ?? null });
      if (!local) persist();
    },
    dispatch: (ops) => {
      if (!ops.length) return;
      const me = meNow();
      set((s) => {
        if (!s.state) return {};
        const next = applyOps(s.state, [...ops, { k: "set", p: ["stamp"], v: Date.now() }]);
        return { state: next, me, viewing: me.gm ? s.viewing : next.playerScene };
      });
      if (me.online) transmit({ type: "vtt_op", id: vid("o"), ops });
      persist();
    },
    sendFx: (fx) => {
      if (meNow().online) transmit({ type: "vtt_fx", fx });
      const me = meNow();
      if (fx.kind === "ping") set((s) => ({ pings: [...s.pings.slice(-12), { id: vid("p"), x: fx.x, y: fx.y, color: fx.color, scene: fx.scene, at: Date.now() }] }));
      else if (fx.kind === "ruler") set((s) => ({ rulers: { ...s.rulers, [me.handle]: { from: me.handle, pts: fx.pts, color: fx.color, label: fx.label, scene: fx.scene } } }));
      else set((s) => { const r = { ...s.rulers }; delete r[me.handle]; return { rulers: r }; });
    },
    view: (sceneId) => set({ viewing: sceneId }),
    useLocalCopy: () => {
      const local = get().newerLocal;
      if (!local) return;
      transmit({ type: "vtt_restore", state: local });
      set({ state: local, newerLocal: null, viewing: local.playerScene });
      persist();
    },
    dismissLocal: () => set({ newerLocal: null }),
    replaceAll: (s) => {
      const me = meNow();
      if (!me.gm) return;
      if (me.online) transmit({ type: "vtt_restore", state: s });
      set({ state: s, viewing: s.playerScene ?? s.order[0] ?? null });
      persist();
    },
    setNotice: (n) => set({ notice: n }),
  };
});

// ───────────────────────── permission helpers for the UI ─────────────────────────

export function controls(o: Obj | undefined, me: Me): boolean {
  if (!o) return false;
  if (me.gm) return true;
  if (o.kind !== "token") return o.by === me.handle;
  return !o.locked && (o.owners.includes("*") || o.owners.includes(me.handle) || o.runner?.owner === me.handle);
}

export function seesBars(t: Token, me: Me): boolean {
  return me.gm || t.barsPublic || t.owners.includes(me.handle) || t.owners.includes("*") || t.runner?.owner === me.handle;
}
