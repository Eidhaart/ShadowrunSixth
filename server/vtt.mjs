/**
 * Virtual tabletop authority for the relay. Each room holds one table state. Clients send path
 * operations; the GM may change anything, players only what they control. Players never receive
 * GM-layer objects, unshared handouts, scene notes or scenes other than the one they are on.
 */

const TOKEN_KEYS = new Set(["x", "y", "rot", "bars", "markers", "card", "img", "runner"]);
const SHAPE_KEYS = new Set(["x", "y"]);
const TURN_KEYS = new Set(["score", "base", "dice", "minors", "acted", "delayed", "tie", "name"]);
const MAX_ASSET = 700_000;
// what the defender writes onto an attack record
const DEFENSE_KEYS = new Set(["defense", "outcome", "net", "soak", "damage", "status"]);

export function emptyTable() {
  return { stamp: Date.now(), scenes: {}, order: [], playerScene: null, handouts: {}, turn: { on: false, round: 1, current: null, entries: {} }, assets: {}, combat: {} };
}

const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);

/** Mutating apply, used on the server's own copy. */
export function apply(state, op) {
  let node = state;
  for (let i = 0; i < op.p.length - 1; i++) {
    const k = op.p[i];
    if (!isObj(node[k])) { if (op.k === "del") return; node[k] = {}; }
    node = node[k];
  }
  const last = op.p[op.p.length - 1];
  if (op.k === "del") delete node[last];
  else if (op.k === "set") node[last] = op.v;
  else if (op.k === "merge") node[last] = { ...(isObj(node[last]) ? node[last] : {}), ...op.v };
}

const validOp = (op) =>
  isObj(op) && ["set", "del", "merge"].includes(op.k) && Array.isArray(op.p) && op.p.length > 0 && op.p.length < 8 &&
  op.p.every((k) => typeof k === "string" && k.length < 80 && k !== "__proto__" && k !== "constructor" && k !== "prototype") &&
  (op.k !== "merge" || isObj(op.v));

const controls = (obj, handle) => obj?.kind === "token" && (obj.owners?.includes("*") || obj.owners?.includes(handle) || obj.runner?.owner === handle);

/** May this player apply this op? The GM may apply anything valid. */
export function permitted(state, op, handle, gm) {
  if (!validOp(op)) return false;
  if (gm) return true;
  const [p0, p1, p2, p3] = op.p;
  if (p0 === "scenes" && p1 === state.playerScene && p2 === "objects" && p3 && op.p.length === 4) {
    const cur = state.scenes[p1]?.objects?.[p3];
    if (op.k === "merge") {
      if (!cur) return false;
      const keys = Object.keys(op.v);
      if (cur.kind === "token") return controls(cur, handle) && !cur.locked && keys.every((k) => TOKEN_KEYS.has(k)) && (!("runner" in op.v) || op.v.runner === null || op.v.runner?.owner === handle);
      return cur.by === handle && keys.every((k) => SHAPE_KEYS.has(k));
    }
    if (op.k === "set") {
      if (cur || !isObj(op.v) || op.v.layer !== "token") return false;
      if (op.v.kind === "token") return Array.isArray(op.v.owners) && op.v.owners.length === 1 && op.v.owners[0] === handle && (!op.v.runner || op.v.runner.owner === handle);
      return ["path", "rect", "ellipse", "text"].includes(op.v.kind) && op.v.by === handle && (!op.v.pts || op.v.pts.length < 6000);
    }
    if (op.k === "del") return !!cur && (cur.by === handle || (cur.kind === "token" && cur.owners?.length === 1 && cur.owners[0] === handle));
  }
  if (p0 === "turn" && p1 === "entries" && p2 && op.p.length === 3) {
    const cur = state.turn?.entries?.[p2];
    if (op.k === "set") return !cur && isObj(op.v) && op.v.owner === handle;
    if (op.k === "merge") return cur?.owner === handle && Object.keys(op.v).every((k) => TURN_KEYS.has(k));
    if (op.k === "del") return cur?.owner === handle;
  }
  // attacks: a player attacks from a token they control at a visible token in the players' scene;
  // whoever controls the target rolls defense and damage resistance
  if (p0 === "combat" && p1 && op.p.length === 2) {
    const cur = state.combat?.[p1];
    if (op.k === "set") {
      const v = op.v;
      if (cur || !isObj(v) || v.by !== handle || v.scene !== state.playerScene || !isObj(v.attacker) || !isObj(v.target)) return false;
      const objs = state.scenes[v.scene]?.objects ?? {};
      const a = objs[v.attacker.tokenId], t = objs[v.target.tokenId];
      return !!a && !!t && t.layer !== "gm" && controls(a, handle) && (v.status === "defend" || v.status === "done");
    }
    if (op.k === "merge" && cur) {
      const keys = Object.keys(op.v);
      const t = state.scenes[cur.scene]?.objects?.[cur.target?.tokenId];
      if (t && controls(t, handle) && keys.every((k) => DEFENSE_KEYS.has(k))) return true;
      return cur.by === handle && cur.status === "defend" && keys.length === 1 && op.v.status === "cancelled";
    }
    return false;
  }
  // a player whose turn it is may hand it on
  if (p0 === "turn" && op.p.length === 1 && op.k === "merge") {
    const cur = state.turn?.current ? state.turn.entries?.[state.turn.current] : null;
    return !!cur && cur.owner === handle && Object.keys(op.v).every((k) => k === "current") && (op.v.current === null || !!state.turn.entries?.[op.v.current]);
  }
  if (p0 === "assets" && p1 && op.p.length === 2 && op.k === "set") return !state.assets[p1] && typeof op.v?.data === "string" && op.v.data.length < MAX_ASSET;
  return false;
}

// ───────────────────────── what a player may see ─────────────────────────

function visibleScene(scene) {
  const objects = {};
  for (const [id, o] of Object.entries(scene.objects ?? {})) if (o.layer !== "gm") objects[id] = o;
  return { ...scene, objects, notes: "" };
}

function hiddenTokenIds(state) {
  const ids = new Set();
  for (const s of Object.values(state.scenes)) for (const [id, o] of Object.entries(s.objects ?? {})) if (o.layer === "gm") ids.add(id);
  return ids;
}

function playerTurn(state) {
  const hidden = hiddenTokenIds(state);
  const entries = {};
  for (const [id, e] of Object.entries(state.turn?.entries ?? {})) if (!e.tokenId || !hidden.has(e.tokenId)) entries[id] = e;
  return { ...state.turn, entries };
}

/** An attack as a player sees it: never at hidden targets, and hidden attackers stay unnamed. */
function combatView(state, rec) {
  if (!rec) return null;
  const objs = state.scenes[rec.scene]?.objects ?? {};
  if (objs[rec.target?.tokenId]?.layer === "gm") return null;
  if (rec.attacker?.tokenId && objs[rec.attacker.tokenId]?.layer === "gm") return { ...rec, attacker: { name: "Unseen attacker" } };
  return rec;
}

function playerCombat(state) {
  const out = {};
  for (const [id, rec] of Object.entries(state.combat ?? {})) { const v = combatView(state, rec); if (v) out[id] = v; }
  return out;
}

/** House rules as players see them: secret notes stay with the GM. */
const publicRules = (r) => (r && typeof r === "object" ? { ...r, notes: (r.notes ?? []).filter((n) => !n.secret) } : null);

function assetsIn(scene, handouts) {
  const ids = new Set();
  if (scene?.bg) ids.add(scene.bg);
  for (const o of Object.values(scene?.objects ?? {})) if (o.img) ids.add(o.img);
  for (const h of handouts) if (h.img) ids.add(h.img);
  return ids;
}

/** The snapshot a client receives. Records which assets a player now holds. */
export function viewFor(state, client) {
  if (client.role === "gm") return state;
  const sc = state.playerScene ? state.scenes[state.playerScene] : null;
  const handouts = Object.fromEntries(Object.entries(state.handouts).filter(([, h]) => h.shared));
  const scene = sc ? visibleScene(sc) : null;
  const ids = assetsIn(scene, Object.values(handouts));
  const assets = {};
  for (const id of ids) if (state.assets[id]) assets[id] = state.assets[id];
  client.assetsSent = new Set(ids);
  return {
    stamp: state.stamp,
    scenes: scene ? { [scene.id]: scene } : {},
    order: scene ? [scene.id] : [],
    playerScene: state.playerScene,
    handouts,
    turn: playerTurn(state),
    assets,
    combat: playerCombat(state),
    rules: publicRules(state.rules),
  };
}

/** Rewrite an op batch for a player, given the state before and after. Returns null to resend a snapshot. */
export function opsForPlayer(before, after, ops, client) {
  const out = [];
  const withAsset = (id) => {
    if (!id || client.assetsSent?.has(id) || !after.assets[id]) return;
    client.assetsSent?.add(id);
    out.push({ k: "set", p: ["assets", id], v: after.assets[id] });
  };
  const ps = after.playerScene;
  for (const op of ops) {
    const [p0, p1, p2, p3] = op.p;
    if (p0 === "playerScene") return null;
    if (p0 === "scenes") {
      if (p1 !== ps) continue;
      if (op.p.length <= 2) return null;
      if (p2 === "notes") continue;
      if (p2 === "objects" && p3) {
        const was = before.scenes[p1]?.objects?.[p3];
        const now = after.scenes[p1]?.objects?.[p3];
        if (now && now.layer !== "gm") { withAsset(now.img); out.push({ k: "set", p: ["scenes", p1, "objects", p3], v: now }); }
        else if (was && was.layer !== "gm") out.push({ k: "del", p: ["scenes", p1, "objects", p3] });
        continue;
      }
      if (p2 === "bg") withAsset(after.scenes[p1]?.bg);
      out.push(op);
      continue;
    }
    if (p0 === "handouts" && p1) {
      const h = after.handouts[p1];
      if (h?.shared) { withAsset(h.img); out.push({ k: "set", p: ["handouts", p1], v: h }); }
      else out.push({ k: "del", p: ["handouts", p1] });
      continue;
    }
    if (p0 === "turn") {
      if (p1 === "entries" && p2) {
        const e = after.turn.entries[p2];
        const hidden = e?.tokenId && Object.values(after.scenes).some((s) => s.objects?.[e.tokenId]?.layer === "gm");
        out.push(e && !hidden ? { k: "set", p: ["turn", "entries", p2], v: e } : { k: "del", p: ["turn", "entries", p2] });
        continue;
      }
      if (op.p.length === 1) { out.push({ k: "set", p: ["turn"], v: playerTurn(after) }); continue; }
      out.push(op);
      continue;
    }
    if (p0 === "combat" && p1) {
      const v = combatView(after, after.combat?.[p1]);
      out.push(v ? { k: "set", p: ["combat", p1], v } : { k: "del", p: ["combat", p1] });
      continue;
    }
    if (p0 === "combat") { out.push({ k: "set", p: ["combat"], v: playerCombat(after) }); continue; }
    if (p0 === "rules") { out.push({ k: "set", p: ["rules"], v: publicRules(after.rules) }); continue; }
    if (p0 === "order" || p0 === "assets") continue;
    if (p0 === "stamp") out.push(op);
  }
  return out;
}

/** True when a token moved between the GM layer and a visible one, which also changes the turn list. */
export function touchesHiddenTokens(before, after, ops) {
  return ops.some((op) => {
    if (op.p[0] !== "scenes" || op.p[2] !== "objects" || !op.p[3]) return false;
    const was = before.scenes[op.p[1]]?.objects?.[op.p[3]];
    const now = after.scenes[op.p[1]]?.objects?.[op.p[3]];
    return (was?.layer === "gm") !== (now?.layer === "gm");
  });
}
