#!/usr/bin/env node
/**
 * SixthDeck chat relay. One small WebSocket server, rooms by name.
 *   node server/chat-server.mjs            (PORT=8787 by default)
 * Clients (the web app and the Foundry bridge) send {type:"hello",room,handle,source}
 * first, then chat / roll / init messages. The last 200 messages per room are replayed
 * to newcomers and kept in data/chat-history.json across restarts.
 */
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { apply, emptyTable, opsForPlayer, permitted, touchesHiddenTokens, viewFor } from "./vtt.mjs";

const PORT = Number(process.env.PORT || 8787);
const HISTORY = Number(process.env.HISTORY || 200);
const FILE = process.env.CHAT_FILE || "data/chat-history.json";
const MAX_LEN = 4000;
const VTT_FILE = process.env.VTT_FILE || "data/vtt.json";

/** @type {Map<string, {clients:Set<any>, log:any[]}>} */
const rooms = new Map();
try {
  const saved = JSON.parse(readFileSync(FILE, "utf8"));
  for (const [name, log] of Object.entries(saved)) rooms.set(name, { clients: new Set(), log });
} catch { /* first run */ }

/** Table state per room, separate from the chat log because it can hold map images. */
const tables = new Map();
try {
  for (const [name, t] of Object.entries(JSON.parse(readFileSync(VTT_FILE, "utf8")))) tables.set(name, t);
} catch { /* first run */ }
let vttDirty = false;
setInterval(() => {
  if (!vttDirty) return;
  vttDirty = false;
  try {
    mkdirSync(dirname(VTT_FILE), { recursive: true });
    writeFileSync(VTT_FILE, JSON.stringify(Object.fromEntries(tables)));
  } catch (e) { console.error("vtt persist failed", e.message); }
}, 5000).unref();

let dirty = false;
setInterval(() => {
  if (!dirty) return;
  dirty = false;
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(Object.fromEntries([...rooms].map(([k, v]) => [k, v.log]))));
  } catch (e) { console.error("persist failed", e.message); }
}, 3000).unref();

const room = (name) => {
  if (!rooms.has(name)) rooms.set(name, { clients: new Set(), log: [] });
  return rooms.get(name);
};
const send = (ws, m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
const presence = (r) => {
  const users = [...r.clients].map((c) => ({ handle: c.handle, source: c.source, role: c.role }));
  for (const c of r.clients) send(c, { type: "presence", users });
};
const sys = (r, text) => {
  const m = { type: "system", id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: Date.now(), text };
  for (const c of r.clients) send(c, m); // presence notes are live-only, not replayed
};
const clean = (s, n) => String(s ?? "").slice(0, n);

const http = createServer((_req, res) => { res.writeHead(200, { "content-type": "text/plain" }); res.end("sixthdeck relay ok\n"); });
const wss = new WebSocketServer({ server: http, maxPayload: 16 * 1024 * 1024 });

const snapshot = (name, c) => {
  const t = tables.get(name);
  send(c, { type: "vtt_snap", state: t ? viewFor(t, c) : null });
};

function handleVtt(name, r, ws, m) {
  if (m.type === "vtt_req") { snapshot(name, ws); return; }
  if (m.type === "vtt_restore") {
    if (ws.role !== "gm" || !m.state || typeof m.state !== "object") return;
    tables.set(name, m.state);
    vttDirty = true;
    for (const c of r.clients) snapshot(name, c);
    return;
  }
  if (m.type === "vtt_fx") {
    if (!m.fx || typeof m.fx !== "object") return;
    if (m.fx.focus && ws.role !== "gm") delete m.fx.focus;
    for (const c of r.clients) if (c !== ws) send(c, { type: "vtt_fx", fx: m.fx, from: ws.handle });
    return;
  }
  if (m.type !== "vtt_op" || !Array.isArray(m.ops) || !m.ops.length || m.ops.length > 400) return;
  if (!tables.has(name)) tables.set(name, emptyTable());
  const t = tables.get(name);
  if (!m.ops.every((op) => permitted(t, op, ws.handle, ws.role === "gm"))) {
    send(ws, { type: "vtt_err", text: "The table refused that change.", id: m.id });
    snapshot(name, ws);
    return;
  }
  const before = structuredClone(t);
  for (const op of m.ops) apply(t, op);
  t.stamp = Date.now();
  vttDirty = true;
  const hiddenMove = touchesHiddenTokens(before, t, m.ops);
  for (const c of r.clients) {
    if (c === ws) continue;
    if (c.role === "gm") { send(c, { type: "vtt_op", ops: m.ops, from: ws.handle, id: m.id }); continue; }
    const ops = opsForPlayer(before, t, m.ops, c);
    if (ops === null) { snapshot(name, c); continue; }
    if (hiddenMove) { const v = viewFor(t, { role: "player" }); ops.push({ k: "set", p: ["turn"], v: v.turn }, { k: "set", p: ["combat"], v: v.combat }); }
    if (ops.length) send(c, { type: "vtt_op", ops, from: ws.handle, id: m.id });
  }
}
http.listen(PORT, () => console.log(`SixthDeck chat relay listening on :${PORT}`));
wss.on("connection", (ws) => {
  let joined = null;
  const timer = setTimeout(() => !joined && ws.close(), 10000);
  ws.on("message", (raw) => {
    let m;
    try { m = JSON.parse(String(raw)); } catch { return; }
    if (!joined) {
      if (m?.type !== "hello") return;
      const name = clean(m.room, 40).trim() || "lobby";
      ws.handle = clean(m.handle, 32).trim() || "runner";
      ws.source = m.source === "foundry" ? "foundry" : "deck";
      joined = room(name);
      // One GM seat per room. A second claimant (other than a reconnect under the same handle) plays instead.
      const seated = [...joined.clients].find((c) => c.role === "gm" && c.handle !== ws.handle);
      ws.role = m.role === "gm" && !seated ? "gm" : "player";
      if (m.role === "gm" && seated) send(ws, { type: "system", id: `s${Date.now().toString(36)}g`, at: Date.now(), text: `${seated.handle} already holds the GM seat, so you joined as a player` });
      clearTimeout(timer);
      joined.clients.add(ws);
      send(ws, { type: "history", messages: joined.log });
      ws.roomName = name;
      snapshot(name, ws);
      sys(joined, `${ws.handle} jacked in${ws.source === "foundry" ? " from Foundry" : ""}`);
      presence(joined);
      return;
    }
    if (typeof m?.type === "string" && m.type.startsWith("vtt_")) { handleVtt(ws.roomName, joined, ws, m); return; }
    // authors remove their own chat lines; the GM may remove any. Rolls stay on the record.
    if (m?.type === "unsay" && typeof m.msgId === "string") {
      const i = joined.log.findIndex((x) => x.id === m.msgId);
      const target = joined.log[i];
      if (!target || target.type !== "chat" || (target.from !== ws.handle && ws.role !== "gm")) return;
      joined.log.splice(i, 1);
      dirty = true;
      for (const c of joined.clients) send(c, { type: "unsay", msgId: m.msgId });
      return;
    }
    if (!["chat", "roll", "init", "call", "decline", "withdraw"].includes(m?.type) || typeof m.id !== "string") return;
    if ((m.type === "call" || m.type === "withdraw") && ws.role !== "gm") return;
    if (m.type === "chat") { m.text = clean(m.text, MAX_LEN); m.as = m.as ? clean(m.as, 40) : undefined; }
    if (m.type === "roll" || m.type === "decline") m.as = m.as ? clean(m.as, 40) : undefined;
    if (m.type === "call") {
      if (!m.check || typeof m.check !== "object") return;
      m.to = Array.isArray(m.to) ? m.to.slice(0, 16).map((x) => clean(x, 32)) : [];
      m.check.label = clean(m.check.label, 60);
      m.check.note = m.check.note ? clean(m.check.note, 240) : undefined;
    }
    if (m.type === "chat" || m.type === "roll" || m.type === "call") m.gm = ws.role === "gm";
    m.from = ws.handle;
    m.at = Date.now();
    if (joined.log.some((x) => x.id === m.id)) return;
    joined.log.push(m);
    joined.log = joined.log.slice(-HISTORY);
    dirty = true;
    for (const c of joined.clients) if (c !== ws) send(c, m);
  });
  ws.on("close", () => {
    clearTimeout(timer);
    if (!joined) return;
    joined.clients.delete(ws);
    sys(joined, `${ws.handle} jacked out`);
    presence(joined);
  });
  ws.on("error", () => ws.close());
});
