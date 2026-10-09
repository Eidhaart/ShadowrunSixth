/**
 * SixthDeck Bridge for Foundry VTT (v12 and v13).
 *  - Chat messages typed in Foundry appear in the SixthDeck room, and the other way round.
 *  - Dice rolls made in Foundry are shown in SixthDeck as d6 hit counts (5 and 6 are hits).
 *  - Actors tab gets an "Import SixthDeck runner" button that creates an actor from an exported JSON.
 *
 * Wire format matches src/lib/comms.ts in the app. Not yet tested against a live Foundry install.
 */
const ID = "sixthdeck-bridge";
let ws = null;
let timer = null;
let tries = 0;
const seen = new Set();

const cfg = (k) => game.settings.get(ID, k);
const uid = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const esc = (s) => foundry.utils.escapeHTML ? foundry.utils.escapeHTML(String(s)) : String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

function send(m) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
}

function connect() {
  clearTimeout(timer);
  if (ws) { ws.onclose = null; ws.close(); ws = null; }
  const url = String(cfg("url") || "").trim();
  if (!url) return;
  try { ws = new WebSocket(url); } catch (e) { console.warn(ID, e); return; }
  ws.onopen = () => {
    tries = 0;
    ws.send(JSON.stringify({ type: "hello", room: cfg("room") || "lobby", handle: cfg("handle") || game.user.name, source: "foundry" }));
    ui.notifications?.info(game.i18n.localize("SIXTHDECK.Online"));
  };
  ws.onmessage = (e) => {
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    if (m.type === "history" || m.type === "presence") return;
    // only one GM client posts incoming messages, so the world gets each once
    if (!game.user.isActiveGM) return;
    if (!m.id || seen.has(m.id)) return;
    seen.add(m.id);
    incoming(m);
  };
  ws.onclose = () => {
    ws = null;
    tries = Math.min(tries + 1, 6);
    timer = setTimeout(connect, 1000 * 2 ** tries);
  };
  ws.onerror = () => ws && ws.close();
}

function incoming(m) {
  const flags = { [ID]: { relayed: true } };
  if (m.type === "chat") {
    ChatMessage.create({ content: `<b>${esc(m.from)}</b> <em>(SixthDeck)</em><br>${esc(m.text)}`, speaker: { alias: m.from }, flags });
  } else if (m.type === "roll") {
    const dice = m.dice.map((d) => `<span style="display:inline-block;min-width:1.6em;text-align:center;margin:1px;border:1px solid;border-radius:4px;${d.hit ? "font-weight:bold;" : "opacity:.6;"}${d.gone ? "text-decoration:line-through;" : ""}">${d.v}</span>`).join("");
    const tail = m.threshold !== undefined ? ` — ${m.success ? "success" : "failed"} (needs ${m.threshold})` : "";
    const g = m.critGlitch ? " <b>CRITICAL GLITCH</b>" : m.glitch ? " <b>GLITCH</b>" : "";
    ChatMessage.create({ content: `<b>${esc(m.from)}</b> rolls ${esc(m.label)} (pool ${m.pool})<br>${dice}<br><b>${m.hits}</b> hits${tail}${g}`, speaker: { alias: m.from }, flags });
  } else if (m.type === "init") {
    ChatMessage.create({ content: `<b>${esc(m.from)}</b> initiative: ${m.base} + [${m.dice.join(", ")}] = <b>${m.score}</b>`, speaker: { alias: m.from }, flags });
  }
}

Hooks.once("init", () => {
  const reg = (k, data) => game.settings.register(ID, k, { scope: "world", config: true, ...data });
  reg("url", { name: "SIXTHDECK.Url", hint: "SIXTHDECK.UrlHint", type: String, default: "", onChange: connect, requiresReload: false });
  reg("room", { name: "SIXTHDECK.Room", type: String, default: "lobby", onChange: connect });
  reg("handle", { name: "SIXTHDECK.Handle", type: String, default: "Foundry", onChange: connect });
  reg("rolls", { name: "SIXTHDECK.Rolls", hint: "SIXTHDECK.RollsHint", type: Boolean, default: true });
});

Hooks.once("ready", connect);

// Foundry -> SixthDeck
Hooks.on("createChatMessage", (msg, _opts, userId) => {
  if (userId !== game.user.id || msg.getFlag(ID, "relayed")) return;
  const from = msg.alias || msg.author?.name || "Foundry";
  const rolls = msg.rolls ?? [];
  if (rolls.length && cfg("rolls")) {
    for (const r of rolls) {
      const vals = [];
      for (const t of r.terms ?? []) if (t.faces === 6 && t.results) for (const x of t.results) vals.push({ v: x.result, hit: x.result >= 5, gone: x.active === false });
      if (!vals.length) continue;
      const live = vals.filter((d) => !d.gone);
      const hits = live.filter((d) => d.hit).length;
      const ones = live.filter((d) => d.v === 1).length;
      const glitch = ones > live.length / 2;
      send({ type: "roll", id: uid(), from, at: Date.now(), label: msg.flavor || r.formula, pool: live.length, dice: vals, hits, glitch, critGlitch: glitch && hits === 0, edgeSpent: 0, source: "foundry" });
    }
    return;
  }
  const text = String(msg.content || "").replace(/<[^>]*>/g, "").trim();
  if (text) send({ type: "chat", id: uid(), from, text, at: Date.now(), source: "foundry" });
});

// Import button
async function importFile(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { data = null; }
  const sd = data?.flags?.sixthdeck;
  if (!sd?.character) return ui.notifications.error(game.i18n.localize("SIXTHDECK.BadFile"));
  const types = game.system.documentTypes?.Actor ?? Object.keys(CONFIG.Actor.dataModels ?? {});
  const type = types.includes("character") ? "character" : types.find((t) => t !== "base") ?? types[0];
  const items = Array.isArray(data.items) ? data.items : [];
  const actor = await Actor.create({ name: data.name, type, img: data.img, flags: data.flags, system: {} });
  // Only generic notes go on the actor; the full build stays in flags.sixthdeck for system adapters.
  const html = data.system?.biography?.value;
  if (html) await actor.setFlag(ID, "biography", html);
  const itemTypes = game.system.documentTypes?.Item ?? [];
  const mapped = items.map((i) => ({ name: i.name, type: itemTypes.includes(i.type) ? i.type : itemTypes.find((t) => t !== "base"), flags: { [ID]: i.system } })).filter((i) => i.type);
  if (mapped.length) await actor.createEmbeddedDocuments("Item", mapped);
  ui.notifications.info(game.i18n.format("SIXTHDECK.Imported", { name: actor.name }));
}

Hooks.on("renderActorDirectory", (_app, html) => {
  const root = html instanceof HTMLElement ? html : html[0];
  if (!root || !game.user.can("ACTOR_CREATE") || root.querySelector(".sixthdeck-import")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "sixthdeck-import";
  btn.innerHTML = `<i class="fas fa-file-import"></i> ${game.i18n.localize("SIXTHDECK.Import")}`;
  btn.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => input.files[0] && importFile(input.files[0]);
    input.click();
  });
  (root.querySelector(".header-actions") ?? root.querySelector("header") ?? root).append(btn);
});
