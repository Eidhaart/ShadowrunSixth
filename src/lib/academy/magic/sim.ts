/**
 * "Night Job at Halcyon Biolab": a short turn-based magic mission.
 * Pure engine, no React. Dice come from an injectable roller so tests can script them.
 * Rules follow the core book: Sorcery + Magic, drain resisted with Willpower + tradition attribute,
 * Stun drain turns Physical above your Magic, sustained spells cost 2 dice each, summoning and
 * banishing against Force x 2, mana barriers, Attack Rating vs Defense Rating for Edge.
 * Simplifications: guards share one set of numbers, spirits are generic, one barrier on the lab door.
 */
import { applyPostBoost, canPostBoost, BOOST_COST, type PostBoost, type RollResult } from "@/lib/sr6/dice";
import { defaultRoller, fixedRoll, type Roller } from "../matrix/sim";
import { opposedOdds, atLeast } from "../stats";
import { SPELL, type SpellDef } from "./data";

export { defaultRoller, fixedRoll };
export type { Roller };

export type Trad = "hermetic" | "shaman";
export const HERO = { magic: 6, sorcery: 5, conjuring: 4, astral: 4, will: 5, tradAttr: 5, intuition: 4, logic: 4, reaction: 3, body: 3, edge: 3 };
export const STUN_MAX = 8 + Math.ceil(HERO.will / 2);
export const PHYS_MAX = 8 + Math.ceil(HERO.body / 2);
export const FORCE_CAP = HERO.magic * 3;
export const BARRIER = 3;
const GUARD = { will: 3, int: 3, rea: 3, body: 3, dr: 7, track: 10 };
const SPIRIT_FOE = { force: 4, will: 4, int: 4, rea: 3, body: 8, services: 3, cm: 10 };

export const KNOWN_CHOICES = ["stunbolt", "stunball", "manabolt", "powerbolt", "clout", "fireball", "invisibility", "improvedinvis", "sensorsneak"] as const;
export const DEFAULT_KNOWN = ["stunbolt", "manabolt", "fireball", "improvedinvis", "sensorsneak"];
export const MAX_KNOWN = 5;

export type Tone = "info" | "good" | "bad" | "drain" | "sys";
export interface Ev { id: number; tone: Tone; text: string; a?: RollResult; b?: RollResult; aLabel?: string; bLabel?: string }

export interface Foe {
  id: number;
  name: string;
  kind: "guard" | "spirit" | "camera";
  will: number; int: number; rea: number; body: number;
  stun: number; phys: number; max: number;
  down: boolean; aware: boolean; distracted: boolean;
  force?: number; services?: number;
}

export interface Sustained { id: string; hits: number }
export interface Friend { id: number; force: number; services: number; hp: number }

export type SceneId = "outside" | "dock" | "corridor" | "lab";
export const SCENES: Record<SceneId, { title: string; text: string }> = {
  outside: { title: "Outside the fence", text: "Halcyon Biolab is a grey block behind a chain fence. Your team waits in the van. You have one night, five spells and a clock that is your own head." },
  dock: { title: "The loading dock", text: "Two guards share a vending machine under a camera. They are not expecting anyone." },
  corridor: { title: "The service corridor", text: "A long hallway ends in a heavy door. Something big stands in front of it." },
  lab: { title: "The cold room", text: "Racks, hum and a bench with one sealed sample case. The door behind you carries a faint shimmer on the astral." },
};
const SCENE_ORDER: SceneId[] = ["outside", "dock", "corridor", "lab"];

export type PendingKind = "spell" | "summon" | "banish" | "command" | "assense";
export interface Pending {
  kind: PendingKind;
  phase: "cast" | "drain";
  spell?: string;
  amp: number;
  area: number;
  targets: number[];
  force?: number;
  cast: RollResult;
  opp: RollResult | null;
  drain: RollResult | null;
  dv: number;
  penalty: number;
  label: string;
  oppLabel: string;
  note?: string;
  commandKind?: "distract" | "attack";
}

export type EndKind = "delivered" | "knockout" | "dead" | "retreat";

export interface MState {
  trad: Trad;
  known: string[];
  scene: SceneId;
  step: number;
  stun: number; phys: number;
  edge: number;
  sustained: Sustained[];
  friends: Friend[];
  foes: Foe[];
  alarm: boolean;
  intel: { dock: boolean; spirit: boolean; barrier: boolean; reinforcements: boolean };
  assensed: boolean;
  camSeen: boolean;
  sample: boolean;
  pending: Pending | null;
  log: Ev[];
  seq: number;
  status: "play" | "won" | "lost";
  end?: EndKind;
  stats: { drainTaken: number; edgeSpent: number; casts: number; alarmScene: SceneId | null; summoned: number; banished: number; barrierLost: number };
}

export const clone = <T,>(x: T): T => structuredClone(x);
const say = (s: MState, tone: Tone, text: string, extra?: Partial<Ev>) => s.log.push({ id: s.seq++, tone, text, ...extra });

export const sustainPenalty = (s: MState) => s.sustained.length * 2;
const foeOf = (s: MState, id: number) => s.foes.find((f) => f.id === id);
const mkGuard = (s: MState, name: string): Foe => ({ id: s.seq++, name, kind: "guard", will: GUARD.will, int: GUARD.int, rea: GUARD.rea, body: GUARD.body, stun: 0, phys: 0, max: GUARD.track, down: false, aware: false, distracted: false });

export function newSim(trad: Trad, known: string[] = DEFAULT_KNOWN): MState {
  const s: MState = {
    trad, known: known.slice(0, MAX_KNOWN), scene: "outside", step: 0, stun: 0, phys: 0, edge: HERO.edge, sustained: [], friends: [], foes: [], alarm: false,
    intel: { dock: false, spirit: false, barrier: false, reinforcements: false }, assensed: false, camSeen: false, sample: false, pending: null, log: [], seq: 1, status: "play",
    stats: { drainTaken: 0, edgeSpent: 0, casts: 0, alarmScene: null, summoned: 0, banished: 0, barrierLost: 0 },
  };
  say(s, "sys", SCENES.outside.text);
  return s;
}

/* ───────────── previews (what the UI shows before you commit) ───────────── */

export interface SpellParams { spell: string; amp: number; area: number; targets: number[] }
export interface Preview {
  ok: boolean;
  why?: string;
  pool: number;
  theirs: number | null;
  odds: number | null;
  dv: number;
  drainPool: number;
  noDrain: number;
  note?: string;
  edgeGain?: boolean;
}

const castPool = (s: MState) => Math.max(0, HERO.sorcery + HERO.magic - sustainPenalty(s));
const drainPool = (s: MState) => Math.max(0, HERO.will + HERO.tradAttr - sustainPenalty(s));
const oppPool = (sp: SpellDef, foes: Foe[]) => Math.max(0, ...foes.map((f) => (sp.kind === "direct" ? f.will + f.int : f.rea + f.will)));
const foeDR = (f: Foe) => (f.kind === "guard" ? GUARD.dr : f.kind === "spirit" ? (f.force ?? 4) + 4 : 4);

export function liveTargets(s: MState): Foe[] { return s.foes.filter((f) => !f.down); }

export function previewSpell(s: MState, p: SpellParams): Preview {
  const sp: SpellDef | undefined = SPELL[p.spell];
  const base = { pool: castPool(s), theirs: null as number | null, odds: null as number | null, dv: 0, drainPool: drainPool(s), noDrain: 0 };
  if (!sp || !s.known.includes(p.spell)) return { ok: false, why: "You do not know that spell.", ...base };
  const amp = sp.kind !== "utility" ? p.amp : 0;
  const area = sp.area ? p.area : 0;
  const dv = sp.dv + 2 * amp + area;
  const out: Preview = { ok: true, ...base, dv, noDrain: atLeast(base.drainPool, dv) };
  if (sp.kind === "utility") {
    if (s.sustained.some((x) => x.id === sp.id)) return { ...out, ok: false, why: "Already running." };
    return out;
  }
  const targets = p.targets.map((t) => foeOf(s, t)).filter((f): f is Foe => !!f && !f.down);
  if (!targets.length) return { ...out, ok: false, why: "Nothing to aim at here yet." };
  if (!sp.area && targets.length > 1) return { ...out, ok: false, why: "That spell hits one target." };
  if (sp.type === "M" && targets.some((t) => t.kind === "camera")) return { ...out, ok: false, why: "A mana spell does nothing to a machine. Use a Physical spell." };
  const pool = oppPool(sp, targets.filter((t) => t.kind !== "camera"));
  const theirs = targets.some((t) => t.kind === "camera") && !targets.some((t) => t.kind !== "camera") ? 4 : pool;
  const o = opposedOdds(base.pool, theirs);
  return { ...out, theirs, odds: Math.max(0, o.win), edgeGain: HERO.magic + HERO.tradAttr - Math.max(...targets.map(foeDR)) >= 4, note: sp.area && targets.length < s.foes.filter((f) => !f.down && f.kind === "guard").length ? "Only hits the guards you picked. Increase Area to reach more." : undefined };
}

export function previewSummon(s: MState, force: number): Preview {
  const used = s.friends.reduce((a, f) => a + f.force, 0);
  const pool = Math.max(0, HERO.conjuring + HERO.magic - sustainPenalty(s));
  const o = opposedOdds(pool, force * 2);
  return { ok: used + force <= FORCE_CAP, why: used + force > FORCE_CAP ? `Your spirits would pass Force ${FORCE_CAP} (Magic x 3).` : undefined, pool, theirs: force * 2, odds: o.win, dv: 0, drainPool: drainPool(s), noDrain: 0 };
}

export function previewBanish(s: MState): Preview {
  const sp = s.foes.find((f) => f.kind === "spirit" && !f.down);
  const pool = Math.max(0, HERO.conjuring + HERO.magic - sustainPenalty(s));
  if (!sp) return { ok: false, why: "No spirit to banish.", pool, theirs: null, odds: null, dv: 0, drainPool: drainPool(s), noDrain: 0 };
  const o = opposedOdds(pool, (sp.force ?? 4) * 2);
  return { ok: true, pool, theirs: (sp.force ?? 4) * 2, odds: o.win, dv: 0, drainPool: drainPool(s), noDrain: 0, note: s.intel.spirit ? undefined : "You have not seen its Force yet. Astral perception would tell you." };
}

/* ───────────── begin / boost / step ───────────── */

export type BeginArgs =
  | ({ kind: "spell" } & SpellParams)
  | { kind: "summon"; force: number }
  | { kind: "banish" }
  | { kind: "assense" }
  | { kind: "command"; command: "distract" | "attack"; target: number };

export function begin(s0: MState, a: BeginArgs, roller: Roller = defaultRoller): MState {
  if (s0.status !== "play" || s0.pending) return s0;
  const s = clone(s0);
  const pen = sustainPenalty(s);
  switch (a.kind) {
    case "spell": {
      const pv = previewSpell(s, a);
      if (!pv.ok) return s0;
      const sp = SPELL[a.spell];
      const amp = sp.kind !== "utility" ? a.amp : 0;
      const area = sp.area ? a.area : 0;
      const real = sp.kind === "utility" ? [] : sp.area && area >= 1 ? liveTargets(s).filter((f) => f.kind !== "camera").map((f) => f.id) : a.targets.slice(0, 1);
      s.pending = {
        kind: "spell", phase: "cast", spell: a.spell, amp, area, targets: real,
        cast: roller(pv.pool, sp.name), opp: sp.kind === "utility" || pv.theirs === null ? null : roller(pv.theirs, "Defender"),
        drain: null, dv: pv.dv, penalty: pen, label: sp.name, oppLabel: sp.kind === "direct" ? "Willpower + Intuition" : "Reaction + Willpower",
      };
      return s;
    }
    case "summon": {
      const pv = previewSummon(s, a.force);
      if (!pv.ok) return s0;
      s.pending = { kind: "summon", phase: "cast", amp: 0, area: 0, targets: [], force: a.force, cast: roller(pv.pool, "Conjuring + Magic"), opp: roller(a.force * 2, "Spirit"), drain: null, dv: 0, penalty: pen, label: `Summon a Force ${a.force} spirit`, oppLabel: "Spirit (Force x 2)" };
      return s;
    }
    case "banish": {
      const pv = previewBanish(s);
      const sp = s.foes.find((f) => f.kind === "spirit" && !f.down);
      if (!pv.ok || !sp) return s0;
      s.pending = { kind: "banish", phase: "cast", amp: 0, area: 0, targets: [sp.id], cast: roller(pv.pool, "Conjuring + Magic"), opp: roller((sp.force ?? 4) * 2, "Spirit"), drain: null, dv: 0, penalty: pen, label: "Banish the spirit", oppLabel: "Spirit (Force x 2)" };
      return s;
    }
    case "assense": {
      if (s.assensed) return s0;
      s.pending = { kind: "assense", phase: "cast", amp: 0, area: 0, targets: [], cast: roller(Math.max(0, HERO.astral + HERO.intuition - pen), "Astral + Intuition"), opp: null, drain: null, dv: 0, penalty: pen, label: "Look with astral perception", oppLabel: "" };
      return s;
    }
    case "command": {
      const fr = s.friends.find((f) => f.services > 0);
      const foe = foeOf(s, a.target);
      if (!fr || !foe || foe.down) return s0;
      if (a.command === "distract") {
        s.pending = { kind: "command", phase: "cast", amp: 0, area: 0, targets: [foe.id], cast: roller(0, "Distract"), opp: null, drain: null, dv: 0, penalty: pen, label: `Spirit distracts the ${foe.name}`, oppLabel: "", commandKind: "distract" };
      } else {
        s.pending = { kind: "command", phase: "cast", amp: 0, area: 0, targets: [foe.id], cast: roller(fr.force * 2, "Spirit attack"), opp: roller(foe.rea + foe.int, "Defender"), drain: null, dv: 0, penalty: pen, label: `Spirit attacks the ${foe.name}`, oppLabel: "Reaction + Intuition", commandKind: "attack" };
      }
      return s;
    }
  }
}

/** Dropping a sustained spell is free and can be done at any time. */
export function drop(s0: MState, id: string): MState {
  if (!s0.sustained.some((x) => x.id === id)) return s0;
  const s = clone(s0);
  s.sustained = s.sustained.filter((x) => x.id !== id);
  say(s, "info", `You let ${SPELL[id].name} go. Your dice come back.`);
  return s;
}

export function canBoost(s: MState, b: PostBoost): boolean {
  if (!s.pending) return false;
  const r = s.pending.phase === "cast" ? s.pending.cast : s.pending.drain;
  return !!r && s.edge >= BOOST_COST[b] && canPostBoost(r, b);
}

export function boost(s0: MState, b: PostBoost): MState {
  if (!canBoost(s0, b)) return s0;
  const s = clone(s0);
  const p = s.pending!;
  if (p.phase === "cast") p.cast = applyPostBoost(p.cast, b); else p.drain = applyPostBoost(p.drain!, b);
  s.edge -= BOOST_COST[b];
  s.stats.edgeSpent += BOOST_COST[b];
  return s;
}

function addDamage(s: MState, dmg: number, why: string) {
  if (dmg <= 0) return;
  const phys = dmg > HERO.magic;
  if (phys) s.phys += dmg; else s.stun += dmg;
  s.stats.drainTaken += dmg;
  say(s, "drain", `${why}: ${dmg} ${phys ? "Physical" : "Stun"} damage${phys ? " (more than your Magic, so it goes Physical)" : ""}. Stun ${s.stun}/${STUN_MAX}, Physical ${s.phys}/${PHYS_MAX}.`);
}

function applyToFoe(f: Foe, dmg: number, type: "S" | "P") {
  if (f.kind === "camera") { if (dmg > 0) { f.down = true; } return; }
  if (f.kind === "spirit") { f.stun += dmg; if (f.stun >= f.max) f.down = true; return; }
  if (type === "S") f.stun += dmg; else f.phys += dmg;
  if (f.stun >= f.max || f.phys >= f.max) f.down = true;
}

/** Resolve the roll in front of you, in two stages (cast, then drain). */
export function step(s0: MState, roller: Roller = defaultRoller): MState {
  if (!s0.pending) return s0;
  const s = clone(s0);
  const p = s.pending!;
  if (p.phase === "cast") {
    resolveCast(s, p, roller);
    if (s.status !== "play") return s;
    // Moving into the drain phase, or ending the action with no drain
    if (p.kind === "assense" || p.kind === "command") return finishAction(s, roller);
    if (p.kind === "summon" && (!p.opp || p.cast.totalHits <= p.opp.totalHits)) return finishAction(s, roller);
    if (p.kind === "summon" || p.kind === "banish") {
      const sp = p.opp!.totalHits;
      p.dv = p.kind === "banish" ? sp * 2 : sp;
    }
    if (p.dv <= 0 && p.kind !== "spell") return finishAction(s, roller);
    p.phase = "drain";
    p.drain = roller(drainPool(s) - 0, "Drain resistance");
    return s;
  }
  // drain phase
  const hits = p.drain!.totalHits;
  const dmg = Math.max(0, p.dv - hits);
  if (dmg === 0) say(s, "good", `Drain ${p.dv}: you roll ${hits} hit${hits === 1 ? "" : "s"} and shrug it off.`, { a: p.drain!, aLabel: "Your drain resistance" });
  else addDamage(s, dmg, `Drain ${p.dv}, you resist ${hits}`);
  return finishAction(s, roller);
}

function resolveCast(s: MState, p: Pending, roller: Roller) {
  const yh = p.cast.totalHits;
  const th = p.opp ? p.opp.totalHits : 0;
  const ev = { a: p.cast, b: p.opp ?? undefined, aLabel: `${p.label}${p.penalty ? ` (−${p.penalty} dice from sustaining)` : ""}`, bLabel: p.oppLabel };
  s.stats.casts++;
  switch (p.kind) {
    case "assense": {
      s.assensed = true;
      s.intel.dock = yh >= 1;
      s.intel.barrier = yh >= 2;
      s.intel.spirit = yh >= 2;
      s.intel.reinforcements = yh >= 3;
      const lines = ["You see: nothing useful."];
      if (yh >= 1) lines[0] = "You see two guards and a camera at the dock.";
      if (yh >= 2) lines.push("A mana barrier of rating 3 shimmers on the lab door, and a Force 4 earth spirit with 3 services stands in the corridor.");
      if (yh >= 3) lines.push("An alarm will bring three more guards to the lab.");
      say(s, yh >= 2 ? "good" : "info", `Astral perception, ${yh} hit${yh === 1 ? "" : "s"}. ${lines.join(" ")}`, { a: p.cast, aLabel: "Astral + Intuition" });
      return;
    }
    case "spell": {
      const sp = SPELL[p.spell!];
      if (sp.kind === "utility") {
        if (yh >= 1) {
          s.sustained.push({ id: sp.id, hits: yh });
          say(s, "good", `${sp.name} works with ${yh} hit${yh === 1 ? "" : "s"}. It is sustained: −2 dice on everything you do until you drop it.${sp.id.includes("invis") || sp.id === "sensorsneak" ? ` Anyone trying to see you needs ${yh} hits.` : ""}`, ev);
        } else say(s, "bad", `${sp.name} fails (0 hits).`, ev);
        return;
      }
      if (sp.loud && !s.alarm) raiseAlarm(s, `${sp.name} lights up the room.`);
      const targets = p.targets.map((id) => foeOf(s, id)).filter((f): f is Foe => !!f);
      const net = Math.max(0, yh - th);
      if (HERO.magic + HERO.tradAttr - Math.max(0, ...targets.map(foeDR)) >= 4) { s.edge = Math.min(7, s.edge + 1); say(s, "good", `Your Attack Rating (${HERO.magic + HERO.tradAttr}) beats their Defense Rating by 4 or more: +1 Edge.`); }
      if (net === 0) { say(s, "bad", `${sp.name} fizzles against the defender (${yh} v ${th}).`, ev); }
      else {
        for (const f of targets) {
          if (f.kind === "camera") { f.down = true; say(s, "good", "The camera pops and goes dark.", ev); continue; }
          let dmg = 0;
          if (sp.kind === "direct") dmg = net + p.amp;
          else {
            const soak = roller(f.body, "Body soak").totalHits;
            dmg = Math.max(0, Math.ceil(HERO.magic / 2) + net + p.amp - soak);
          }
          applyToFoe(f, dmg, sp.dmg ?? "P");
          f.aware = true;
          say(s, "good", `${sp.name} hits the ${f.name} (${yh} v ${th}): ${dmg} ${sp.dmg === "S" ? "Stun" : "Physical"}${f.down ? ", and it goes down" : ""}.`, ev);
        }
      }
      return;
    }
    case "summon": {
      const f = p.force!;
      if (yh > th) {
        const net = yh - th;
        s.friends.push({ id: s.seq++, force: f, services: net, hp: Math.ceil(f / 2) + 8 });
        s.stats.summoned++;
        say(s, "good", `A Force ${f} spirit answers (${yh} v ${th}). ${net} service${net === 1 ? "" : "s"}. Drain Value is the spirit's hits: ${th}.`, ev);
      } else say(s, "bad", `The spirit does not come (${yh} v ${th}). You need at least 1 net hit.`, ev);
      return;
    }
    case "banish": {
      const f = foeOf(s, p.targets[0])!;
      const net = Math.max(0, yh - th);
      f.services = Math.max(0, (f.services ?? 0) - net);
      if (f.services === 0) { f.down = true; s.stats.banished++; say(s, "good", `Banished (${yh} v ${th}). The ${f.name} goes home. Drain Value is twice its hits: ${th * 2}.`, ev); }
      else if (net > 0) say(s, "good", `${net} net hit${net === 1 ? "" : "s"} strip ${net} service${net === 1 ? "" : "s"}. It has ${f.services} left. Drain Value ${th * 2}.`, ev);
      else say(s, "bad", `The spirit holds (${yh} v ${th}). Drain Value ${th * 2}.`, ev);
      return;
    }
    case "command": {
      const fr = s.friends.find((x) => x.services > 0)!;
      const foe = foeOf(s, p.targets[0])!;
      fr.services--;
      if (p.commandKind === "distract") { foe.distracted = true; say(s, "good", `Your spirit keeps the ${foe.name} busy. It will not bother you this scene. ${fr.services} service${fr.services === 1 ? "" : "s"} left.`); return; }
      const net = Math.max(0, yh - th);
      if (net > 0) {
        const soak = roller(foe.body, "Body soak").totalHits;
        const dmg = Math.max(0, Math.ceil(fr.force / 2) + net - soak);
        applyToFoe(foe, dmg, "P");
        foe.aware = true;
        say(s, "good", `Your spirit hits the ${foe.name} (${yh} v ${th}) for ${dmg}${foe.down ? " and drops it" : ""}.`, ev);
      } else say(s, "bad", `Your spirit misses (${yh} v ${th}).`, ev);
      return;
    }
  }
}

function raiseAlarm(s: MState, why: string) {
  if (s.alarm) return;
  s.alarm = true;
  s.stats.alarmScene = s.scene;
  say(s, "bad", `ALARM: ${why}`);
}

/* ───────────── after your action: foes, checks, scene flow ───────────── */

function finishAction(s: MState, roller: Roller): MState {
  s.pending = null;
  foePhase(s, roller);
  checkEnd(s);
  return s;
}

function foePhase(s: MState, roller: Roller) {
  if (s.status !== "play") return;
  const pen = sustainPenalty(s);
  for (const f of s.foes) {
    if (f.down || !f.aware || f.distracted || f.kind === "camera") continue;
    if (!s.alarm && f.kind === "guard") raiseAlarm(s, "a guard shouts for help.");
    const atk = f.kind === "spirit" ? (f.force ?? 4) * 2 : 8;
    const mine = Math.max(0, HERO.reaction + HERO.intuition - pen);
    const a = roller(atk, `${f.name} attack`);
    const d = roller(mine, "Reaction + Intuition");
    const net = a.totalHits - d.totalHits;
    const ev = { a: d, b: a, aLabel: "Your defense", bLabel: `${f.name} attack` };
    if (net <= 0) { say(s, "info", `The ${f.name} attacks and misses (${a.totalHits} v ${d.totalHits}).`, ev); continue; }
    const dv = (f.kind === "spirit" ? f.force ?? 4 : 3) + net;
    const soak = roller(HERO.body, "Body soak").totalHits;
    const taken = Math.max(0, dv - soak);
    s.phys += taken;
    say(s, "bad", `The ${f.name} hits you (${a.totalHits} v ${d.totalHits}): ${dv} damage, you soak ${soak}, ${taken} Physical. Physical ${s.phys}/${PHYS_MAX}.`, ev);
    if (s.phys >= PHYS_MAX) break;
  }
}

function checkEnd(s: MState) {
  if (s.status !== "play") return;
  if (s.phys >= PHYS_MAX) { s.status = "lost"; s.end = "dead"; say(s, "bad", "Your body gives out. The job is over."); return; }
  if (s.stun >= STUN_MAX) { s.status = "lost"; s.end = "knockout"; say(s, "bad", "The drain hits you like a truck. You pass out on the dock and the guards find you."); }
}

/* ───────────── moving between scenes ───────────── */

export interface Move { id: string; label: string; enabled: boolean; why?: string; blurb: string }

export function sceneClear(s: MState): boolean {
  const hostile = s.foes.filter((f) => f.kind !== "camera");
  return hostile.every((f) => f.down || f.distracted);
}

const living = (s: MState) => s.sustained.filter((x) => x.id === "invisibility" || x.id === "improvedinvis");
const tech = (s: MState) => s.sustained.filter((x) => x.id === "improvedinvis" || x.id === "sensorsneak");
export const livingThreshold = (s: MState) => Math.max(0, ...living(s).map((x) => x.hits));
export const techThreshold = (s: MState) => Math.max(0, ...tech(s).map((x) => x.hits));

export function moves(s: MState): Move[] {
  const out: Move[] = [];
  const idx = SCENE_ORDER.indexOf(s.scene);
  const nextTitle = SCENE_ORDER[idx + 1] ? SCENES[SCENE_ORDER[idx + 1]].title : "";
  if (s.scene === "lab") {
    out.push({ id: "grab", label: "Grab the sample and leave", enabled: sceneClear(s), why: "There are still awake guards in the room. Deal with them or slip past.", blurb: "Take the case and walk out the way you came." });
  } else {
    out.push({ id: "enter", label: `Go on to: ${nextTitle}`, enabled: s.scene === "outside" || sceneClear(s), why: "Guards stand in the way. Take them out, hide from them or have a spirit keep them busy.", blurb: s.scene === "outside" ? "Cross the fence." : "Move on to the next room." });
  }
  const watchers = s.foes.filter((f) => !f.down && !f.distracted);
  if (s.scene !== "outside" && watchers.length > 0) out.push({ id: "sneak", label: "Sneak past", enabled: livingThreshold(s) > 0 || techThreshold(s) > 0, why: "You have nothing running that hides you.", blurb: "Everyone who can see you rolls Intuition + Logic. They need as many hits as your spell had." });
  out.push({ id: "abort", label: "Call it off", enabled: true, blurb: "Walk away. Safe, but the job fails." });
  return out;
}

function crossBarrier(s: MState, roller: Roller) {
  say(s, "sys", `You step through the rating ${BARRIER} mana barrier. Each sustained spell and spirit that crosses must beat it: Magic or Force x 2 against ${BARRIER * 2} dice. Whoever loses is disrupted.`);
  const keep: Sustained[] = [];
  for (const sp of s.sustained) {
    const a = roller(HERO.magic * 2, `${SPELL[sp.id].name} vs barrier`);
    const b = roller(BARRIER * 2, "Mana barrier");
    if (a.totalHits > b.totalHits) { keep.push(sp); say(s, "good", `${SPELL[sp.id].name} holds (${a.totalHits} v ${b.totalHits}).`, { a, b, aLabel: SPELL[sp.id].name, bLabel: "Barrier" }); }
    else { s.stats.barrierLost++; say(s, "bad", `${SPELL[sp.id].name} is disrupted by the barrier (${a.totalHits} v ${b.totalHits}). A tie loses too. It is gone.`, { a, b, aLabel: SPELL[sp.id].name, bLabel: "Barrier" }); }
  }
  s.sustained = keep;
  const fr: Friend[] = [];
  for (const f of s.friends) {
    const a = roller(f.force * 2, "Spirit vs barrier");
    const b = roller(BARRIER * 2, "Mana barrier");
    if (a.totalHits > b.totalHits) { fr.push(f); say(s, "good", `Your Force ${f.force} spirit pushes through (${a.totalHits} v ${b.totalHits}).`); }
    else { s.stats.barrierLost++; say(s, "bad", `Your Force ${f.force} spirit is thrown back home by the barrier (${a.totalHits} v ${b.totalHits}).`); }
  }
  s.friends = fr;
}

export function move(s0: MState, id: string, roller: Roller = defaultRoller): MState {
  if (s0.status !== "play" || s0.pending) return s0;
  const m = moves(s0).find((x) => x.id === id);
  if (!m || !m.enabled) return s0;
  const s = clone(s0);
  if (id === "abort") { s.status = "lost"; s.end = "retreat"; say(s, "info", "You walk back to the van. Nobody got hurt. Nobody got paid."); return s; }
  if (id === "sneak") {
    const lt = livingThreshold(s), tt = techThreshold(s);
    let seen = false;
    for (const f of s.foes) {
      if (f.down || f.distracted) continue;
      const need = f.kind === "camera" ? tt : lt;
      const pool = f.kind === "camera" ? 6 : f.int + 3;
      if (need <= 0) { seen = true; say(s, "bad", `The ${f.name} sees you plainly. Nothing you are running hides you from it.`); f.aware = true; continue; }
      const r = roller(pool, `${f.name} Perception`);
      if (r.totalHits >= need) { seen = true; f.aware = true; say(s, "bad", `The ${f.name} spots you (${r.totalHits} hits, needed ${need}).`, { a: r, aLabel: `${f.name} Perception` }); }
      else say(s, "good", `The ${f.name} looks right through you (${r.totalHits} hits, needed ${need}).`, { a: r, aLabel: `${f.name} Perception` });
    }
    if (seen) { foePhase(s, roller); checkEnd(s); return s; }
    say(s, "good", "You walk past. Nobody notices.");
    s.foes.forEach((f) => { if (f.kind !== "camera") f.distracted = true; });
    return s;
  }
  if (id === "grab") {
    say(s, "good", "You lift the sample case and walk out the way you came. The van door slides open.");
    s.sample = true;
    const hold = s.foes.some((f) => !f.down && f.aware && !f.distracted);
    if (hold) foePhase(s, roller);
    checkEnd(s);
    if (s.status === "play") { s.status = "won"; s.end = "delivered"; }
    return s;
  }
  // enter next scene
  if (s.scene === "dock" && s.foes.some((f) => f.kind === "camera" && !f.down) && techThreshold(s) === 0) {
    raiseAlarm(s, "the dock camera caught you on video. Somebody is watching the feed.");
  } else if (s.scene === "dock" && s.foes.some((f) => f.kind === "camera" && !f.down)) {
    say(s, "info", "The camera never notices you.");
  }
  const idx = SCENE_ORDER.indexOf(s.scene);
  s.scene = SCENE_ORDER[idx + 1];
  s.foes = [];
  const sc = SCENES[s.scene];
  say(s, "sys", sc.text);
  if (s.scene === "dock") {
    s.foes = [mkGuard(s, "guard"), mkGuard(s, "other guard"), { id: s.seq++, name: "camera", kind: "camera", will: 2, int: 2, rea: 2, body: 2, stun: 0, phys: 0, max: 1, down: false, aware: false, distracted: false }];
    s.foes[0].name = "first guard";
    s.foes[1].name = "second guard";
  }
  if (s.scene === "corridor") {
    s.foes = [{ id: s.seq++, name: "earth spirit", kind: "spirit", will: SPIRIT_FOE.will, int: SPIRIT_FOE.int, rea: SPIRIT_FOE.rea, body: SPIRIT_FOE.body, stun: 0, phys: 0, max: SPIRIT_FOE.cm, down: false, aware: false, distracted: false, force: SPIRIT_FOE.force, services: SPIRIT_FOE.services }];
  }
  if (s.scene === "lab") {
    crossBarrier(s, roller);
    const n = s.alarm ? 3 : 1;
    s.foes = Array.from({ length: n }, (_, i) => { const g = mkGuard(s, n > 1 ? `guard ${i + 1}` : "lab guard"); g.aware = s.alarm; return g; });
    say(s, "info", s.alarm ? "The alarm has pulled three guards into the room. They are awake and angry." : "A single guard dozes at the bench.");
  }
  return s;
}

/* ───────────── debrief ───────────── */

export interface Debrief { stars: number; goals: { ok: boolean; text: string }[]; notes: string[]; headline: string }

export function debrief(s: MState): Debrief {
  const won = s.status === "won";
  const used = s.stun + s.phys;
  const goals = [
    { ok: won, text: "Deliver the sample" },
    { ok: won && used <= 5, text: "Finish with 5 or less damage in total" },
    { ok: won && !s.alarm, text: "Never raise the alarm" },
  ];
  const stars = goals.filter((g) => g.ok).length;
  const notes: string[] = [];
  if (s.alarm) notes.push("The alarm went off. Fire and lightning are loud, cameras record, and a guard who is still standing will call for help. Stun spells and hiding keep the building asleep.");
  if (s.stats.barrierLost > 0) notes.push("The mana barrier on the lab door disrupted something you had running. Spells and spirits that cross a barrier must beat its rating. Cast sustained spells again after the door, or leave them for last.");
  if (!s.assensed) notes.push("You never looked on the astral. One roll would have shown the barrier and the spirit before you were standing in front of them.");
  if (s.stats.drainTaken >= 6) notes.push(`You took ${s.stats.drainTaken} drain in total. That is most of a Stun track. Cheaper spells, no Amp Up, and fewer sustained spells save you real boxes.`);
  if (s.sustained.length >= 2) notes.push("Holding two sustained spells costs 4 dice on everything. Improved Invisibility alone does what Invisibility plus Sensor Sneak does, for one spell's penalty.");
  if (s.stats.summoned === 0 && s.stats.banished === 0 && s.scene !== "lab" && !won) notes.push("You never used conjuring. A spirit can hold a guard's attention for a whole scene for the price of one summon.");
  if (s.end === "knockout") notes.push("Drain knocked you out. Stun damage adds up quietly. Count your boxes before you cast.");
  if (s.end === "dead") notes.push("Guards and spirits shoot real bullets. When your Physical track is half gone, stop and leave.");
  if (s.end === "retreat") notes.push("You walked away. It is a sane choice, but the job pays on delivery.");
  if (won && s.stats.edgeSpent === 0 && used > 5) notes.push("You finished with Edge unspent. A reroll on a bad drain roll is what it is for.");
  const headline = won ? (stars === 3 ? "Nobody ever knew you were there." : stars === 2 ? "Job done, with a scratch or two." : "You got the sample out, barely.") : s.end === "retreat" ? "You walked away with nothing." : "The night won.";
  return { stars, goals, notes: notes.slice(0, 4), headline };
}
