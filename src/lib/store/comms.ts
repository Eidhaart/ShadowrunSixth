"use client";
import { create } from "zustand";
import type { ClientHello, ServerMsg, WireMsg } from "@/lib/comms";

type Status = "off" | "connecting" | "online" | "local";

interface CommsState {
  status: Status;
  url: string;
  room: string;
  handle: string;
  messages: WireMsg[];
  users: { handle: string; source: string; role?: "gm" | "player" }[];
  /** Messages that arrived live (not from history), so the UI can tumble their dice once. */
  fresh: Record<string, true>;
  role: "gm" | "player";
  unread: number;
  connect: (o: { url: string; room: string; handle: string; role?: "gm" | "player" }) => void;
  disconnect: () => void;
  send: (m: WireMsg) => void;
  markRead: () => void;
}

let ws: WebSocket | null = null;
let bc: BroadcastChannel | null = null;
let retry = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let wanted = false;

const seen = new Set<string>();
const cap = (arr: WireMsg[]) => arr.slice(-300);

export const useComms = create<CommsState>((set, get) => {
  const ingest = (m: WireMsg, fromSelf = false, live = true) => {
    if (seen.has(m.id)) return;
    seen.add(m.id);
    set((s) => ({
      messages: cap([...s.messages, m]),
      unread: fromSelf ? s.unread : s.unread + 1,
      fresh: live ? { ...s.fresh, [m.id]: true } : s.fresh,
    }));
  };

  const closeAll = () => {
    wanted = false;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    if (ws) { ws.onclose = null; ws.close(); ws = null; }
    if (bc) { bc.close(); bc = null; }
  };

  const openLocal = (room: string) => {
    if (typeof BroadcastChannel === "undefined") { set({ status: "off" }); return; }
    bc = new BroadcastChannel(`sixthdeck:${room}`);
    bc.onmessage = (e) => ingest(e.data as WireMsg);
    set({ status: "local", users: [{ handle: get().handle || "you", source: "this device" }] });
  };

  const openSocket = (url: string, room: string, handle: string, role: "gm" | "player") => {
    set({ status: "connecting" });
    let sock: WebSocket;
    try { sock = new WebSocket(url); } catch { set({ status: "off" }); return; }
    ws = sock;
    sock.onopen = () => {
      retry = 0;
      const hello: ClientHello = { type: "hello", room, handle, source: "deck", role };
      sock.send(JSON.stringify(hello));
      set({ status: "online" });
    };
    sock.onmessage = (e) => {
      let m: ServerMsg;
      try { m = JSON.parse(String(e.data)); } catch { return; }
      if (m.type === "history") m.messages.forEach((x) => ingest(x, true, false));
      else if (m.type === "presence") set({ users: m.users });
      else ingest(m);
    };
    sock.onclose = () => {
      ws = null;
      if (!wanted) return;
      set({ status: "connecting" });
      retry = Math.min(retry + 1, 6);
      retryTimer = setTimeout(() => wanted && openSocket(url, room, handle, role), 800 * 2 ** retry);
    };
    sock.onerror = () => sock.close();
  };

  return {
    status: "off",
    url: "",
    room: "",
    handle: "",
    messages: [],
    users: [],
    fresh: {},
    role: "player",
    unread: 0,
    connect: ({ url, room, handle, role = "player" }) => {
      closeAll();
      seen.clear();
      wanted = true;
      set({ url, room, handle, role, messages: [], users: [], fresh: {}, unread: 0 });
      if (url.trim()) openSocket(url.trim(), room, handle || "runner", role);
      else openLocal(room);
    },
    disconnect: () => {
      closeAll();
      set({ status: "off", users: [] });
    },
    send: (m) => {
      ingest(m, true);
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
      else if (bc) bc.postMessage(m);
    },
    markRead: () => set({ unread: 0 }),
  };
});
