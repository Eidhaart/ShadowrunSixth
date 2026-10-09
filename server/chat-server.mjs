#!/usr/bin/env node
/**
 * SixthDeck chat relay. One small WebSocket server, rooms by name.
 *   node server/chat-server.mjs            (PORT=8787 by default)
 * Clients (the web app and the Foundry bridge) send {type:"hello",room,handle,source}
 * first, then chat / roll / init messages. The last 200 messages per room are replayed
 * to newcomers and kept in data/chat-history.json across restarts.
 */
import { WebSocketServer } from "ws";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const PORT = Number(process.env.PORT || 8787);
const HISTORY = Number(process.env.HISTORY || 200);
const FILE = process.env.CHAT_FILE || "data/chat-history.json";
const MAX_LEN = 4000;

/** @type {Map<string, {clients:Set<any>, log:any[]}>} */
const rooms = new Map();
try {
  const saved = JSON.parse(readFileSync(FILE, "utf8"));
  for (const [name, log] of Object.entries(saved)) rooms.set(name, { clients: new Set(), log });
} catch { /* first run */ }

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
  const users = [...r.clients].map((c) => ({ handle: c.handle, source: c.source }));
  for (const c of r.clients) send(c, { type: "presence", users });
};
const sys = (r, text) => {
  const m = { type: "system", id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: Date.now(), text };
  for (const c of r.clients) send(c, m); // presence notes are live-only, not replayed
};
const clean = (s, n) => String(s ?? "").slice(0, n);

const wss = new WebSocketServer({ port: PORT, maxPayload: 64 * 1024 });
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
      clearTimeout(timer);
      joined.clients.add(ws);
      send(ws, { type: "history", messages: joined.log });
      sys(joined, `${ws.handle} jacked in${ws.source === "foundry" ? " from Foundry" : ""}`);
      presence(joined);
      return;
    }
    if (!["chat", "roll", "init"].includes(m?.type) || typeof m.id !== "string") return;
    if (m.type === "chat") m.text = clean(m.text, MAX_LEN);
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
console.log(`SixthDeck chat relay listening on ws://0.0.0.0:${PORT}`);
