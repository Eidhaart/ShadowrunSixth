/**
 * "Ledger Lift at Corvid Freight": a small turn-based Matrix mission.
 * Pure engine, no React. Randomness comes from an injectable roller so tests can script dice.
 * It uses the real SR6 rules the lessons teach (hits on 5/6, Attack/Sleaze penalties, Overwatch Score,
 * IC, link-lock, dumpshock, Edge boosts) with a few clearly marked simplifications:
 *  - Probe is one roll (not a long extended test) and takes one minute.
 *  - The host has one fixed set of attributes and a short IC list.
 *  - A link-lock holds until you win a Jack Out test or destroy the Tar Baby.
 */
import { roll, d6, applyPostBoost, canPostBoost, BOOST_COST, tally, type Die, type PostBoost, type RollResult } from "@/lib/sr6/dice";
import { opposedOdds } from "../stats";

export type Roller = (pool: number, label: string) => RollResult;
export const defaultRoller: Roller = (pool, label) => roll({ label, pool });

/** Build a result with exact hits, for tests and scripted scenes. */
export function fixedRoll(pool: number, hits: number, label = "test"): RollResult {
  const dice: Die[] = Array.from({ length: pool }, (_, i) => {
    const value = i < hits ? 5 : 3;
    return { value, hit: value >= 5 };
  });
  return tally(dice, { label, pool }, pool, 0, 0);
}

export type Build = "sledge" | "ghost" | "tank" | "balanced";
export const BUILDS: Record<Build, { name: string; blurb: string; a: number; s: number; d: number; f: number }> = {
  sledge: { name: "Sledgehammer", blurb: "Attack 5, Sleaze 2. Brute Force and Data Spike are strong; Probe and Backdoor Entry cost you 3 dice.", a: 5, s: 2, d: 4, f: 3 },
  ghost: { name: "Ghost", blurb: "Sleaze 5, Attack 2. Quiet entry and hard to spot; Brute Force and Data Spike cost you 3 dice.", a: 2, s: 5, d: 3, f: 4 },
  tank: { name: "Tank", blurb: "Firewall 5, Data Processing 4. Soaks IC well, but you are weak at both entering and fighting.", a: 3, s: 2, d: 4, f: 5 },
  balanced: { name: "Balanced", blurb: "Attack 4, Sleaze 3, Firewall 5. No penalty on either entry style.", a: 4, s: 3, d: 2, f: 5 },
};

export type Mode = "ar" | "cold" | "hot";
export const MODE_INFO: Record<Mode, { name: string; init: string; dump: string }> = {
  ar: { name: "AR", init: "Reaction + Intuition + 1D6", dump: "No dumpshock, immune to biofeedback" },
  cold: { name: "Cold-sim VR", init: "Intuition + Data Processing + 2D6", dump: "Dumpshock 3 Stun, biofeedback hits Stun" },
  hot: { name: "Hot-sim VR", init: "Intuition + Data Processing + 3D6", dump: "Dumpshock 3 Physical, biofeedback hits Physical" },
};

export const HERO = { cracking: 6, electronics: 5, logic: 6, intuition: 4, reaction: 3, willpower: 4, edge: 3 };
export const HOST = { name: "Corvid Freight", rating: 4, attack: 5, sleaze: 7, dp: 4, fw: 6 };
const ICPOOL = HOST.rating * 2;
const ENC = 3;
const BOMB = 3;
export const OS_LIMIT = 40;
const DECK_RATING = 5;
export const DECK_MAX = Math.ceil(DECK_RATING / 2) + 8;
export const STUN_MAX = 8 + Math.ceil(HERO.willpower / 2);
export const PHYS_MAX = 8 + 2;

export type Access = "outsider" | "user" | "admin";
export type IcKind = "killer" | "tarbaby" | "acid" | "sparky" | "blaster";
export const IC_NAME: Record<IcKind, string> = { killer: "Killer", tarbaby: "Tar Baby", acid: "Acid", sparky: "Sparky", blaster: "Blaster" };
export const IC_DEF: Record<IcKind, "intuition" | "logic" | "willpower"> = { killer: "intuition", tarbaby: "logic", acid: "willpower", sparky: "intuition", blaster: "logic" };

export interface IcInst { id: number; kind: IcKind; hp: number }
export type Tone = "info" | "good" | "bad" | "os" | "ic" | "sys";
export interface Ev {
  id: number;
  tone: Tone;
  text: string;
  you?: RollResult;
  them?: RollResult;
  youLabel?: string;
  themLabel?: string;
}

export type ActionId = "perceive" | "probe" | "backdoor" | "bruteUser" | "bruteAdmin" | "search" | "crack" | "disarm" | "copy" | "spike" | "defend" | "jackout";

export interface Pending {
  action: ActionId;
  you: RollResult;
  them: RollResult | null;
  yourLabel: string;
  theirLabel: string;
  penalty: number;
  target?: number;
}

export type EndKind = "delivered" | "convergence" | "bricked" | "knockout" | "dead" | "retreat";

export interface SimState {
  build: Build;
  mode: Mode;
  round: number;
  seconds: number;
  first: "you" | "host";
  os: number;
  access: Access;
  /** Held access came from Brute Force, so it counts as illegal access. */
  illegal: boolean;
  backdoor: number | null;
  alert: boolean;
  ic: IcInst[];
  launched: number;
  deck: number;
  stun: number;
  phys: number;
  edge: number;
  hostEdge: number;
  fwLoss: number;
  linkLock: boolean;
  defending: boolean;
  knowsFile: boolean;
  cracked: boolean;
  bombSeen: boolean;
  bombArmed: boolean;
  copied: boolean;
  log: Ev[];
  pending: Pending | null;
  status: "play" | "won" | "lost";
  end?: EndKind;
  seq: number;
  stats: { illegal: number; legal: number; peakOs: number; edgeSpent: number; hitsTaken: number; alertedAt: number | null; usedBrute: boolean; usedProbe: boolean; perceived: boolean };
}

export const clone = <T,>(x: T): T => structuredClone(x);

const stat = (s: SimState) => {
  const b = BUILDS[s.build];
  return { a: b.a, s: b.s, d: b.d, f: Math.max(0, b.f - s.fwLoss) };
};

export const hostAR = HOST.attack + HOST.sleaze;
export const hostDR = HOST.dp + HOST.fw;

function say(s: SimState, tone: Tone, text: string, extra?: Partial<Ev>) {
  s.log.push({ id: s.seq++, tone, text, ...extra });
}

/** P(you meet the test): at least 1 hit and at least as many hits as them. */
export function successOdds(you: number, them: number): number {
  const o = opposedOdds(you, them);
  return Math.max(0, o.win + o.tie - (2 / 3) ** (Math.max(0, you) + Math.max(0, them)));
}

/* ───────────── actions ───────────── */

export interface ActionInfo {
  id: ActionId;
  label: string;
  legal: boolean;
  test: string;
  /** Dice you roll, after the Attack/Sleaze penalty. */
  pool: number;
  penalty: number;
  theirs: number | null;
  odds: number | null;
  seconds: number;
  enabled: boolean;
  why?: string;
  blurb: string;
}

const brutePenalty = (s: SimState) => { const t = stat(s); return t.s > t.a ? t.s - t.a : 0; };
const probePenalty = (s: SimState) => { const t = stat(s); return t.a > t.s ? t.a - t.s : 0; };
const crackPool = HERO.cracking + HERO.logic;

function spikeTarget(s: SimState): IcInst | undefined {
  if (s.linkLock) { const t = s.ic.find((i) => i.kind === "tarbaby" || i.kind === "blaster"); if (t) return t; }
  return s.ic[0];
}

export function actions(s: SimState): ActionInfo[] {
  const t = stat(s);
  const has = s.access !== "outsider";
  const base = (id: ActionId, label: string, legal: boolean, test: string, pool: number, penalty: number, theirs: number | null, seconds: number, blurb: string, enabled = true, why?: string): ActionInfo => ({
    id, label, legal, test, pool: Math.max(0, pool - penalty), penalty, theirs,
    odds: theirs === null ? null : successOdds(Math.max(0, pool - penalty), theirs),
    seconds, enabled, why, blurb,
  });
  const defHack = HOST.rating + t.f + 0;
  const tgt = spikeTarget(s);
  const list: ActionInfo[] = [
    base("perceive", "Matrix Perception", true, "Electronics + Intuition vs host", HERO.electronics + HERO.intuition, 0, HOST.rating * 2, 3, "Look around. Tells you how the host defends and what the file is wired with. Legal, so it costs no Overwatch Score."),
    base("probe", "Probe", false, "Cracking + Logic vs Willpower + Firewall", crackPool, probePenalty(s), defHack + (HOST.fw - t.f), 60, "Slow and quiet. A success plants a backdoor and every net hit becomes a bonus die later.", s.access === "outsider" && s.backdoor === null, s.backdoor !== null ? "You already have a backdoor." : "You are already inside."),
    base("backdoor", "Backdoor Entry", false, "Cracking + Logic + Probe net hits vs Willpower + Firewall", crackPool + (s.backdoor ?? 0), probePenalty(s), HOST.rating + HOST.fw, 3, "Walk in through your backdoor. Admin access that does not count as illegal.", s.backdoor !== null && s.access === "outsider", "You need a backdoor from a successful Probe first."),
    base("bruteUser", "Brute Force to User", false, "Cracking + Logic vs Willpower + Firewall", crackPool, brutePenalty(s), HOST.rating + HOST.fw, 3, "Fast, loud, always alerts the host. You get User access that counts as illegal.", s.access === "outsider", "You are already inside."),
    base("bruteAdmin", "Brute Force to Admin", false, "Cracking + Logic vs Willpower + Firewall + 2", crackPool, brutePenalty(s), HOST.rating + HOST.fw + 2, 3, "Straight to Admin. The defender gets bonus dice. Costs 3 Overwatch Score every round you stay.", s.access === "outsider", "You are already inside."),
    base("search", "Matrix Search", true, "Electronics + Intuition, threshold 2", HERO.electronics + HERO.intuition, 0, null, 60, "Find where the ledger lives. Takes about a minute.", has && !s.knowsFile, !has ? "You need User or Admin access." : "You already found it."),
    base("crack", "Crack File", false, "Cracking + Logic vs Encryption x 2", crackPool, 0, ENC * 2, 3, "Strip the encryption off the ledger.", has && s.knowsFile && !s.cracked, !s.knowsFile ? "Find the ledger first." : s.cracked ? "Already cracked." : "You need access."),
    base("disarm", "Disarm Data Bomb", true, "Cracking + Logic vs Bomb Rating x 2", crackPool, 0, BOMB * 2, 3, "Defuse the booby trap you spotted. A failure with zero net hits sets it off.", s.bombSeen && s.bombArmed && has, !s.bombSeen ? "You have not spotted a bomb. Try Matrix Perception after finding the file." : "Nothing to disarm."),
    base("copy", "Edit File: copy the ledger", true, "Electronics + Logic vs host", HERO.electronics + HERO.logic, 0, HOST.rating * 2, 3, "Copy the cracked ledger into your deck. If a Data Bomb is still armed, it goes off.", has && s.cracked && !s.copied, !s.cracked ? "Find and crack the ledger first." : "Already copied."),
    base("spike", tgt ? `Data Spike the ${IC_NAME[tgt.kind]}` : "Data Spike", false, "Cracking + Logic vs IC", crackPool, brutePenalty(s), ICPOOL, 3, "Hit an IC for half your Attack plus net hits. Destroying a Tar Baby breaks the link-lock.", !!tgt, "No IC around."),
    base("defend", "Full Matrix Defense", true, "Add Firewall to your defense", 0, 0, null, 3, "Hunker down: Firewall is added to every defense roll until the end of the round. Only helps if the host still has to act this round.", true),
    base("jackout", s.linkLock ? "Jack Out (link-locked)" : "Jack Out", true, s.linkLock ? "Electronics + Willpower vs Attack + Data Processing" : "Electronics + Willpower vs host", HERO.electronics + HERO.willpower, 0, s.linkLock ? HOST.attack + HOST.dp : HOST.rating * 2, 3, s.copied ? "You have the ledger. Walk out." : "Leave without the ledger. Safe, but the job fails.", true),
  ];
  return list;
}

/* ───────────── flow ───────────── */

export function newSim(build: Build, mode: Mode, roller: Roller = defaultRoller): SimState {
  const s: SimState = {
    build, mode, round: 0, seconds: 0, first: "you", os: 0, access: "outsider", illegal: false, backdoor: null,
    alert: false, ic: [], launched: 0, deck: 0, stun: 0, phys: 0, edge: HERO.edge, hostEdge: 0, fwLoss: 0,
    linkLock: false, defending: false, knowsFile: false, cracked: false, bombSeen: false, bombArmed: true, copied: false,
    log: [], pending: null, status: "play", seq: 1,
    stats: { illegal: 0, legal: 0, peakOs: 0, edgeSpent: 0, hitsTaken: 0, alertedAt: null, usedBrute: false, usedProbe: false, perceived: false },
  };
  say(s, "sys", `You are parked outside the Corvid Freight depot with a ${BUILDS[build].name} deck in your lap, running ${MODE_INFO[mode].name}. Mission: copy the Q3 shipping ledger and get out clean.`);
  startRound(s, roller);
  return s;
}

function initiative(s: SimState) {
  const t = stat(s);
  const dice = s.mode === "ar" ? 1 : s.mode === "cold" ? 2 : 3;
  const base = s.mode === "ar" ? HERO.reaction + HERO.intuition : HERO.intuition + t.d;
  const you = base + Array.from({ length: dice }, () => d6()).reduce((x, y) => x + y, 0);
  const host = 8 + d6() + d6();
  return { you, host };
}

function startRound(s: SimState, roller: Roller) {
  s.round++;
  s.defending = false;
  const t = stat(s);
  // Rating gap: a lead of 4 or more earns 1 bonus Edge (max 2 per round, we only ever give 1).
  if (s.round > 1) {
    if (t.a + t.s - hostDR >= 4) { s.edge++; say(s, "good", "Your Attack Rating beats their Defense Rating by 4 or more: +1 bonus Edge."); }
    if (hostAR - (t.d + t.f) >= 4 && s.hostEdge < 2) { s.hostEdge++; say(s, "bad", `Their Attack Rating (${hostAR}) beats your Defense Rating (${t.d + t.f}) by 4 or more: the host banks 1 Edge.`); }
  }
  const i = initiative(s);
  s.first = i.you >= i.host ? "you" : "host";
  say(s, "sys", `Round ${s.round}. Initiative: you ${i.you}, host ${i.host}. ${s.first === "you" ? "You act first." : "The host acts first."}`);
  if (s.first === "host") hostPhase(s, roller);
  checkEnd(s);
}

function addOs(s: SimState, n: number, why: string) {
  if (n <= 0) return;
  s.os += n;
  s.stats.peakOs = Math.max(s.stats.peakOs, s.os);
  say(s, "os", `Overwatch Score +${n} (${why}). Now ${s.os}/${OS_LIMIT}.`);
}

function raiseAlert(s: SimState, why: string) {
  if (s.alert) return;
  s.alert = true;
  s.stats.alertedAt = s.round;
  say(s, "bad", `ALERT: ${why} Corvid's security wakes up and starts launching IC.`);
}

export function begin(s0: SimState, id: ActionId, roller: Roller = defaultRoller): SimState {
  const s = clone(s0);
  if (s.status !== "play" || s.pending) return s0;
  const info = actions(s).find((a) => a.id === id);
  if (!info || !info.enabled) return s0;
  if (id === "defend") {
    s.defending = true;
    say(s, "info", "You hunker down. Your Firewall is added to every defense roll until the round ends.");
    return endTurn(s, roller);
  }
  const you = roller(info.pool, info.label);
  const them = info.theirs === null ? null : roller(info.theirs, "Defender");
  s.pending = { action: id, you, them, yourLabel: info.label, theirLabel: theirLabel(id), penalty: info.penalty, target: id === "spike" ? spikeTarget(s)?.id : undefined };
  return s;
}

function theirLabel(id: ActionId): string {
  switch (id) {
    case "probe": case "backdoor": case "bruteUser": case "bruteAdmin": return "Host defense (Willpower + Firewall)";
    case "crack": return "Encryption x 2";
    case "disarm": return "Bomb Rating x 2";
    case "spike": return "IC defense";
    case "jackout": return "Link-lock / host";
    default: return "Host";
  }
}

export function boostCost(s: SimState, b: PostBoost): number { return BOOST_COST[b]; }
export function canBoost(s: SimState, b: PostBoost): boolean {
  return !!s.pending && s.edge >= BOOST_COST[b] && canPostBoost(s.pending.you, b);
}
export function boost(s0: SimState, b: PostBoost): SimState {
  if (!canBoost(s0, b)) return s0;
  const s = clone(s0);
  const p = s.pending!;
  p.you = applyPostBoost(p.you, b);
  s.edge -= BOOST_COST[b];
  s.stats.edgeSpent += BOOST_COST[b];
  return s;
}

function endTurn(s: SimState, roller: Roller): SimState {
  if (s.status !== "play") return s;
  checkEnd(s);
  if (s.status !== "play") return s;
  if (s.first === "you") hostPhase(s, roller);
  if (s.status !== "play") return s;
  // upkeep: holding illegal access costs Overwatch Score
  if (s.illegal && s.access === "user") addOs(s, 1, "holding illegal User access");
  if (s.illegal && s.access === "admin") addOs(s, 3, "holding illegal Admin access");
  checkEnd(s);
  if (s.status !== "play") return s;
  startRound(s, roller);
  return s;
}

/** Spend the action: apply the pending roll. */
export function commit(s0: SimState, roller: Roller = defaultRoller): SimState {
  if (!s0.pending) return s0;
  const s = clone(s0);
  const p = s.pending!;
  s.pending = null;
  const a = actions(s0).find((x) => x.id === p.action)!;
  const yh = p.you.totalHits;
  const th = p.them ? p.them.totalHits : 0;
  const ok = p.them ? yh >= th && yh >= 1 : true;
  const net = Math.max(0, yh - th);
  const ev = { you: p.you, them: p.them ?? undefined, youLabel: `${p.yourLabel}${p.penalty ? ` (−${p.penalty} dice from the ${p.action === "probe" || p.action === "backdoor" ? "Attack" : "Sleaze"} gap)` : ""}`, themLabel: p.theirLabel };
  const illegal = !a.legal;
  if (illegal) { s.stats.illegal++; if (th > 0) addOsAfter(s, th, `the defender rolled ${th} hit${th === 1 ? "" : "s"} against your illegal action`); } else s.stats.legal++;
  const fx = ev;

  switch (p.action) {
    case "perceive": {
      s.stats.perceived = true;
      if (ok) {
        say(s, "good", `Matrix Perception works (${yh} v ${th}). Corvid Freight: rating ${HOST.rating}, Attack ${HOST.attack}, Sleaze ${HOST.sleaze}, Data Processing ${HOST.dp}, Firewall ${HOST.fw}. A Patrol IC sweeps once a minute.${s.knowsFile ? " The ledger carries a Data Bomb rated 3." : ""}`, fx);
        if (s.knowsFile) s.bombSeen = true;
      } else say(s, "bad", `Matrix Perception fails (${yh} v ${th}). You learn nothing new.`, fx);
      break;
    }
    case "probe": {
      s.stats.usedProbe = true;
      if (ok) { s.backdoor = net; say(s, "good", `Probe succeeds (${yh} v ${th}). A backdoor opens with ${net} net hit${net === 1 ? "" : "s"}: that is ${net} bonus dice on Backdoor Entry.`, fx); }
      else say(s, "bad", `Probe finds nothing (${yh} v ${th}). Roll it again, or switch tactic.`, fx);
      if (p.you.glitch) raiseAlert(s, p.you.critGlitch ? "critical glitch on your Probe." : "your Probe glitched.");
      break;
    }
    case "backdoor": {
      if (ok) { s.access = "admin"; s.illegal = false; s.backdoor = null; say(s, "good", `Backdoor Entry works (${yh} v ${th}). You are in with Admin access that does not count as illegal Admin. No upkeep cost.`, fx); }
      else { s.backdoor = null; say(s, "bad", `Backdoor Entry fails (${yh} v ${th}). The backdoor is found and closed. Probe again.`, fx); }
      if (p.you.glitch) raiseAlert(s, "your Backdoor Entry glitched.");
      break;
    }
    case "bruteUser":
    case "bruteAdmin": {
      s.stats.usedBrute = true;
      raiseAlert(s, "Brute Force is never quiet.");
      if (ok) {
        const adm = p.action === "bruteAdmin";
        s.access = adm ? "admin" : "user"; s.illegal = true;
        say(s, "good", `Brute Force works (${yh} v ${th}). You have ${adm ? "Admin" : "User"} access, and it is illegal: ${adm ? "3" : "1"} Overwatch Score every round you hold it.`, fx);
      } else say(s, "bad", `Brute Force bounces off (${yh} v ${th}). They know you are here and you are still outside.`, fx);
      break;
    }
    case "search": {
      const need = 2;
      if (yh >= need) { s.knowsFile = true; say(s, "good", `Search turns up /accounting/q3_shipping_ledger.enc (${yh} hits, needed ${need}). It is encrypted at rating ${ENC}.`, { you: p.you, youLabel: p.yourLabel }); }
      else say(s, "bad", `Search finds only noise (${yh} hit${yh === 1 ? "" : "s"}, needed ${need}). Try again.`, { you: p.you, youLabel: p.yourLabel });
      if (p.you.glitch) raiseAlert(s, "your search glitched and pinged a monitor.");
      break;
    }
    case "crack": {
      if (ok) { s.cracked = true; say(s, "good", `Crack File works (${yh} v ${th}). The ledger is readable.`, fx); }
      else say(s, "bad", `Crack File fails (${yh} v ${th}).`, fx);
      if (p.you.glitch) raiseAlert(s, "your cracking glitched.");
      break;
    }
    case "disarm": {
      if (ok) { s.bombArmed = false; say(s, "good", `Disarm works (${yh} v ${th}). The bomb is dead.`, fx); }
      else if (net === 0 && yh <= th) { s.bombArmed = false; bombBlast(s, "The bomb goes off in your face."); say(s, "bad", `Disarm fails (${yh} v ${th}).`, fx); }
      else say(s, "bad", `Disarm fails (${yh} v ${th}).`, fx);
      break;
    }
    case "copy": {
      if (s.bombArmed && s.bombSeen === false && ok) {
        // You never looked. The bomb was there anyway.
        bombBlast(s, "You copied a file you never inspected. It was booby-trapped.");
        s.bombArmed = false;
      } else if (s.bombArmed && ok) {
        bombBlast(s, "You copied the ledger without disarming the Data Bomb.");
        s.bombArmed = false;
      }
      if (ok) { s.copied = true; say(s, "good", `Copy works (${yh} v ${th}). The ledger is in your deck. Now get out.`, fx); }
      else say(s, "bad", `Copy fails (${yh} v ${th}).`, fx);
      if (p.you.glitch) raiseAlert(s, "your edit glitched.");
      break;
    }
    case "spike": {
      const ic = s.ic.find((i) => i.id === p.target);
      if (!ic) break;
      if (ok) {
        const dmg = Math.ceil(stat(s).a / 2) + net;
        ic.hp -= dmg;
        say(s, "good", `Data Spike hits the ${IC_NAME[ic.kind]} for ${dmg} (${yh} v ${th}).${ic.hp <= 0 ? ` It is destroyed.` : ` ${Math.max(0, ic.hp)} left.`}`, fx);
        if (ic.hp <= 0) {
          s.ic = s.ic.filter((i) => i.id !== ic.id);
          if (ic.kind === "tarbaby" || ic.kind === "blaster") { if (!s.ic.some((i) => i.kind === "tarbaby" || i.kind === "blaster")) { s.linkLock = false; say(s, "good", "The link-lock breaks."); } }
        }
      } else say(s, "bad", `Data Spike glances off (${yh} v ${th}).`, fx);
      break;
    }
    case "jackout": {
      if (!s.linkLock || ok) {
        say(s, "good", s.linkLock ? `You tear free of the link-lock (${yh} v ${th}).` : "You jack out.", s.linkLock ? fx : { you: p.you, youLabel: p.yourLabel });
        s.linkLock = false;
        exitMatrix(s);
        s.status = s.copied ? "won" : "lost";
        s.end = s.copied ? "delivered" : "retreat";
        return s;
      }
      say(s, "bad", `The link-lock holds (${yh} v ${th}). You are still on the grid.`, fx);
      break;
    }
    default: break;
  }
  s.seconds += a.seconds;
  // Patrol checks, once per minute
  const before = Math.floor((s.seconds - a.seconds) / 60);
  const after = Math.floor(s.seconds / 60);
  for (let m = before; m < after; m++) patrolCheck(s, roller);
  return endTurn(s, roller);
}

function addOsAfter(s: SimState, n: number, why: string) { addOs(s, n, why); }

function bombBlast(s: SimState, why: string) {
  const dmg = BOMB * 2;
  const t = stat(s);
  const soak = roll({ label: "Firewall soak", pool: t.f }).totalHits;
  const taken = Math.max(0, dmg - soak);
  s.deck += taken;
  say(s, "bad", `${why} ${dmg} Matrix damage, you soak ${soak}: ${taken} boxes on your deck.`);
}

function patrolCheck(s: SimState, roller: Roller) {
  if (s.alert || s.status !== "play") return;
  // Staff-looking Admin from a backdoor does not draw a Patrol's attention.
  if (s.access === "admin" && !s.illegal) { say(s, "info", "A Patrol IC drifts past. You look like staff and it ignores you."); return; }
  const mine = HERO.willpower + stat(s).s;
  const you = roller(mine, "Willpower + Sleaze");
  const them = roller(6, "Patrol Matrix Perception");
  if (them.totalHits > you.totalHits) raiseAlert(s, `a Patrol IC spotted you (${them.totalHits} v ${you.totalHits}).`);
  else say(s, "info", `A Patrol IC sweeps by (${them.totalHits} v ${you.totalHits}). It does not see you.`, { you, them, youLabel: "Your Willpower + Sleaze", themLabel: "Patrol IC" });
}

function launchIc(s: SimState) {
  if (!s.alert || s.launched >= HOST.rating) return;
  const order: IcKind[] = s.launched === 0 ? ["tarbaby", "killer"] : s.launched === 1 ? ["killer", "acid"] : ["sparky", "blaster", "killer", "acid"];
  const kind = order[Math.floor(Math.random() * order.length)];
  s.launched++;
  s.ic.push({ id: s.seq++, kind, hp: HOST.rating * 2 });
  say(s, "ic", `The host launches a ${IC_NAME[kind]}.`);
}

function soakDump(s: SimState) {
  if (s.mode === "ar") return;
  const soak = roll({ label: "Willpower", pool: HERO.willpower }).totalHits;
  const dmg = Math.max(0, 3 - soak);
  if (s.mode === "cold") s.stun += dmg; else s.phys += dmg;
  say(s, "bad", `Dumpshock: ${dmg} ${s.mode === "cold" ? "Stun" : "Physical"} damage after you resist ${soak}. No Edge for a while.`);
}

function exitMatrix(s: SimState) {
  s.fwLoss = 0;
  soakDump(s);
}

function hostPhase(s: SimState, roller: Roller) {
  if (s.status !== "play") return;
  const t = stat(s);
  const attackers = [...s.ic];
  launchIc(s);
  for (const ic of attackers) {
    if (s.status !== "play") return;
    const stat1 = IC_DEF[ic.kind];
    const pool = ICPOOL + (s.hostEdge > 0 ? 2 : 0);
    if (s.hostEdge > 0) { s.hostEdge--; }
    const f = t.f + (s.defending ? t.f : 0);
    const mine = (stat1 === "logic" ? HERO.logic : stat1 === "willpower" ? HERO.willpower : HERO.intuition) + f;
    const it = roller(pool, `${IC_NAME[ic.kind]} attack`);
    const me = roller(mine, `${stat1[0].toUpperCase() + stat1.slice(1)} + Firewall`);
    const net = it.totalHits - me.totalHits;
    const ev = { you: me, them: it, youLabel: `Your defense${s.defending ? " (Full Defense)" : ""}`, themLabel: `${IC_NAME[ic.kind]} attack` };
    if (net <= 0) { say(s, "info", `${IC_NAME[ic.kind]} attacks and misses (${it.totalHits} v ${me.totalHits}).`, ev); continue; }
    s.stats.hitsTaken++;
    switch (ic.kind) {
      case "killer":
      case "blaster": {
        const dmg = HOST.rating + (ic.kind === "killer" ? net : 0);
        const soak = roll({ label: "Firewall soak", pool: f }).totalHits;
        const taken = Math.max(0, dmg - soak);
        s.deck += taken;
        say(s, "ic", `${IC_NAME[ic.kind]} hits (${it.totalHits} v ${me.totalHits}): ${dmg} Matrix damage, you soak ${soak}, ${taken} boxes on your deck (${s.deck}/${DECK_MAX}).`, ev);
        if (ic.kind === "blaster" && !s.linkLock) { s.linkLock = true; say(s, "ic", "Blaster link-locks you. You cannot just log off."); }
        break;
      }
      case "tarbaby":
        s.linkLock = true;
        say(s, "ic", `Tar Baby latches on (${it.totalHits} v ${me.totalHits}). You are link-locked: a plain Jack Out will not work.`, ev);
        break;
      case "acid": {
        const loss = Math.min(net, stat(s).f);
        s.fwLoss += loss;
        say(s, "ic", `Acid eats your Firewall by ${loss}. It is now ${stat(s).f}.`, ev);
        break;
      }
      case "sparky": {
        if (s.mode === "ar") { say(s, "info", `Sparky hits (${it.totalHits} v ${me.totalHits}) but you are in AR: the biofeedback has nowhere to go.`, ev); break; }
        const dmg = HOST.rating + net;
        const soak = roll({ label: "Willpower soak", pool: HERO.willpower }).totalHits;
        const taken = Math.max(0, dmg - soak);
        if (s.mode === "cold") s.stun += taken; else s.phys += taken;
        say(s, "ic", `Sparky fries you (${it.totalHits} v ${me.totalHits}): ${dmg} biofeedback, you resist ${soak}, ${taken} ${s.mode === "cold" ? "Stun" : "Physical"} damage to your real body.`, ev);
        break;
      }
    }
    checkEnd(s);
  }
  if (s.status === "play") {
    // patrol-free alert loops; an alert host stays alert
  }
}

function checkEnd(s: SimState) {
  if (s.status !== "play") return;
  const lose = (end: EndKind, text: string) => { s.status = "lost"; s.end = end; say(s, "bad", text); };
  if (s.os >= OS_LIMIT) { exitMatrix(s); lose("convergence", "CONVERGENCE. GOD bricks your deck, dumps you and reports where you are sitting."); return; }
  if (s.deck >= DECK_MAX) { exitMatrix(s); lose("bricked", "Your deck is bricked. You are dumped out of the Matrix and the ledger is gone."); return; }
  if (s.phys >= PHYS_MAX) { lose("dead", "Biofeedback stops your heart. Flatline."); return; }
  if (s.stun >= STUN_MAX) { lose("knockout", "Biofeedback knocks you out cold. The job is over."); return; }
}

/* ───────────── debrief ───────────── */

export interface Debrief { stars: number; goals: { ok: boolean; text: string }[]; notes: string[]; headline: string }

export function debrief(s: SimState): Debrief {
  const won = s.status === "won";
  const goals = [
    { ok: won, text: "Deliver the ledger" },
    { ok: won && s.os < 20, text: "Finish with Overwatch Score under 20" },
    { ok: won && !s.alert, text: "Never trigger the alarm" },
  ];
  const stars = goals.filter((g) => g.ok).length;
  const notes: string[] = [];
  if (s.stats.usedBrute) notes.push("Brute Force alarms the host every time. It is great when speed matters, but expect IC next round. If you want stealth, Probe then Backdoor Entry.");
  if (s.stats.usedProbe && !s.stats.usedBrute && won) notes.push("Probe then Backdoor Entry gave you Admin without the 3-per-round illegal Admin cost. That is why quiet jobs finish with low Overwatch Score.");
  if (!s.stats.perceived) notes.push("You never used Matrix Perception. It is legal, costs no Overwatch Score and would have shown the Data Bomb on the file.");
  if (s.stats.peakOs >= 30) notes.push(`Your Overwatch Score peaked at ${s.stats.peakOs}. Every hit the defender rolls on an illegal action adds to it, and holding illegal access adds more every round. Lingering is what kills runs.`);
  if (s.end === "convergence") notes.push("Convergence is the Matrix's hard stop. Check your Overwatch Score before each illegal action and leave by 30.");
  if (s.end === "bricked") notes.push("IC hurts a deck fast. Firewall soaks damage, Full Matrix Defense only helps if the host still has to act after you, and Jack Out beats waiting.");
  if (s.stats.edgeSpent === 0 && !won) notes.push("You ended with Edge unspent. A reroll on the one roll that mattered is what Edge is for.");
  if (s.end === "retreat") notes.push("You left without the ledger. That is a sane choice when things go bad, but the job pays on delivery.");
  if (s.end === "knockout" || s.end === "dead") notes.push("Biofeedback bypasses your deck and hits your body. AR is immune to it; VR is faster but one Sparky away from a bad day.");
  if (s.linkLock && !won) notes.push("A link-lock means a plain Jack Out will not work. Kill the Tar Baby with Data Spike or win the lock test.");
  const headline = won ? (stars === 3 ? "Ghost-clean. Nobody knew you were there." : stars === 2 ? "Job done, with a few scratches." : "You got it out, barely.") : s.end === "retreat" ? "You walked away with nothing." : "The Matrix won this one.";
  return { stars, goals, notes: notes.slice(0, 4), headline };
}
