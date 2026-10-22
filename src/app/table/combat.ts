"use client";
import { rules } from "@/lib/house/rules";
import { doRoll } from "@/lib/actions";
import { useComms } from "@/lib/store/comms";
import { useSettings } from "@/lib/store/settings";
import { useRunners } from "@/lib/store/characters";
import { derive } from "@/lib/sr6/derive";
import { withAdv } from "@/lib/sr6/advance";
import { vid } from "@/lib/vtt/ops";
import { useVtt } from "@/lib/vtt/store";
import { BAR_META, type Attack, type Op, type Scene, type Token, type Weapon } from "@/lib/vtt/types";
import { BANDS, bandIndex, controllerOf, damageAfter, damageBars, defensePools, distanceMeters, edgeFromRatings, outcomeOf, statsOf, woundPenalty } from "@/lib/vtt/combat";
import { useTableUi } from "./ui";

/** Find a token anywhere on the table. */
export function tokenById(id: string | undefined): { t: Token; scene: Scene } | null {
  const st = useVtt.getState().state;
  if (!st || !id) return null;
  for (const s of Object.values(st.scenes)) { const o = s.objects[id]; if (o?.kind === "token") return { t: o, scene: s }; }
  return null;
}

const myRunner = (t: Token) => {
  const me = useVtt.getState().me;
  return t.runner?.owner === me.handle ? useRunners.getState().runners[t.runner.runnerId] : undefined;
};

/** Wound penalty and sheet modifier: from the sheet for my own runner, from the bars otherwise. */
export function penaltyFor(t: Token): number {
  const r = myRunner(t);
  if (r) { const c = withAdv(r); return derive(c).woundPenalty - (c.poolMod || 0); }
  return woundPenalty(t.bars);
}

/** May I roll for this token? Its controller may; the GM may for anyone. */
export function rollsFor(t: Token): boolean {
  const me = useVtt.getState().me;
  return me.gm || controllerOf(t) === me.handle;
}

/** The GM is expected to roll for tokens no single player controls. */
export const gmRolls = (t: Token) => controllerOf(t) === null;

function say(text: string) {
  const c = useComms.getState();
  if (c.status === "off") return;
  c.send({ type: "chat", id: vid("c"), from: useSettings.getState().handle.trim() || "runner", text, at: Date.now(), source: "deck", gm: c.role === "gm", ooc: false });
}

const secretFor = (t: Token) => useVtt.getState().me.gm && !!t.npc && useTableUi.getState().secret;

/** Edge from AR against DR (house rules set how much and the cap) on a token: on my own runner's sheet, or on the token's Edge bar. */
function gainEdge(t: Token, scene: Scene): Op[] {
  const r = myRunner(t);
  const { edgeGain, maxEdge } = rules();
  if (edgeGain <= 0) return [];
  if (r) { useRunners.getState().update(r.id, (x) => { x.edgeCurrent = Math.min(maxEdge, x.edgeCurrent + edgeGain); }); return []; }
  const b = t.bars.b3;
  if (!b) return [];
  const cur = Math.min(maxEdge, b.cur + edgeGain);
  return [{ k: "merge", p: ["scenes", scene.id, "objects", t.id], v: { bars: { ...t.bars, b3: { cur, max: Math.max(b.max, cur) } } } }];
}

export interface AttackPlan { weapon: Weapon; meters: number; band: string; ar: number | null; dr: number; edgeTo: Attack["edgeTo"]; pool: number }

export function plan(attacker: Token, target: Token, scene: Scene, weapon: Weapon, mod: number): AttackPlan {
  const meters = distanceMeters(attacker, target, scene);
  const i = bandIndex(meters);
  const ar = weapon.ar[i] ?? null;
  const dr = statsOf(target)?.dr ?? 0;
  return { weapon, meters, band: BANDS[i], ar, dr, edgeTo: ar == null ? null : edgeFromRatings(ar, dr), pool: Math.max(0, weapon.pool - penaltyFor(attacker) + mod) };
}

/** Roll the attack and open the defense step for whoever controls the target. */
export function attack(attacker: Token, target: Token, scene: Scene, weapon: Weapon, mod: number) {
  const { me, dispatch } = useVtt.getState();
  const p = plan(attacker, target, scene, weapon, mod);
  if (p.ar == null) return;
  const r = doRoll({ label: `${weapon.name} at ${target.name}`, pool: p.pool }, 0, attacker.name, !secretFor(attacker));
  const ops: Op[] = p.edgeTo === "attacker" ? gainEdge(attacker, scene) : [];
  const res = { pool: p.pool, hits: r.totalHits, glitch: r.glitch, crit: r.critGlitch };
  const miss = r.totalHits <= 0;
  const rec: Attack = {
    id: vid("x"), scene: scene.id, at: Date.now(), by: me.handle,
    attacker: { tokenId: attacker.id, name: attacker.name }, target: { tokenId: target.id, name: target.name },
    weapon: { name: weapon.name, dv: weapon.dv, type: weapon.type }, band: p.band, meters: Math.round(p.meters * 10) / 10,
    ar: p.ar, dr: p.dr, edgeTo: p.edgeTo, attack: res,
    ...(miss ? { outcome: "miss" as const, net: 0, status: "done" as const } : { status: "defend" as const }),
  };
  dispatch([...ops, { k: "set", p: ["combat", rec.id], v: rec }]);
  if (miss) say(`${attacker.name} misses ${target.name} with ${weapon.name} (no hits).`);
}

/** Defense test: Reaction + Intuition, less wound modifiers. */
export function defend(rec: Attack, mod = 0) {
  const { dispatch } = useVtt.getState();
  const f = tokenById(rec.target.tokenId);
  if (!f || rec.status !== "defend") return;
  const { t, scene } = f;
  const pool = Math.max(0, defensePools(t).defend - penaltyFor(t) + mod);
  const r = doRoll({ label: `Defense vs ${rec.weapon.name}`, pool }, 0, t.name, !secretFor(t));
  const ops: Op[] = rec.edgeTo === "defender" ? gainEdge(t, scene) : [];
  const { outcome, net } = outcomeOf(rec.attack.hits, r.totalHits);
  const defense = { pool, hits: r.totalHits, glitch: r.glitch, crit: r.critGlitch };
  if (outcome === "hit") ops.push({ k: "merge", p: ["combat", rec.id], v: { defense, outcome, net, status: "soak" } });
  else ops.push({ k: "merge", p: ["combat", rec.id], v: { defense, outcome, net, damage: 0, status: "done" } });
  dispatch(ops);
  if (outcome === "miss") say(`${t.name} avoids ${rec.attacker.name}'s ${rec.weapon.name} (${rec.attack.hits} v ${r.totalHits}).`);
  if (outcome === "graze") say(`${rec.attacker.name}'s ${rec.weapon.name} grazes ${t.name}: a tie, so no damage (${rec.attack.hits} v ${r.totalHits}).`);
}

/** Damage resistance: Body. Wound modifiers do not apply. Then the boxes land on the target. */
export function soak(rec: Attack, mod = 0) {
  const { dispatch } = useVtt.getState();
  const f = tokenById(rec.target.tokenId);
  if (!f || rec.status !== "soak") return;
  const { t, scene } = f;
  const dv = rec.weapon.dv + (rec.net ?? 0);
  const pool = Math.max(0, defensePools(t).soak + mod);
  const r = doRoll({ label: `Soak ${dv}${rec.weapon.type} from ${rec.weapon.name}`, pool }, 0, t.name, !secretFor(t));
  const boxes = damageAfter(rec.weapon.dv, rec.net ?? 0, r.totalHits);
  const ops: Op[] = [{ k: "merge", p: ["combat", rec.id], v: { soak: { pool, hits: r.totalHits }, damage: boxes, status: "done" } }];
  const tp = ["scenes", scene.id, "objects", t.id];
  let note = "";
  const runner = myRunner(t);
  if (runner && boxes > 0) {
    // my own runner: the sheet takes it, with overflow, and the token follows the sheet
    const d = derive(withAdv(runner));
    useRunners.getState().update(runner.id, (x) => {
      let phys = x.damage.physical, stun = x.damage.stun, over = x.damage.overflow;
      if (rec.weapon.type === "S") { const fit = Math.min(boxes, Math.max(0, d.condition.stun - stun)); stun += fit; phys += Math.floor((boxes - fit) / Math.max(1, rules().stunSpill)); } else phys += boxes;
      if (phys > d.condition.physical) { over += phys - d.condition.physical; phys = d.condition.physical; }
      x.damage = { physical: phys, stun, overflow: Math.min(over, d.condition.overflow) };
      note = over >= d.condition.overflow ? " Overflow is full: dead." : over > 0 ? ` ${over} overflow.` : phys >= d.condition.physical || stun >= d.condition.stun ? " Down." : "";
      if (phys >= d.condition.physical || stun >= d.condition.stun) ops.push({ k: "merge", p: tp, v: { markers: [...new Set([...t.markers, "Down"])] } });
    });
  } else if (boxes > 0) {
    const out = damageBars(t.bars, boxes, rec.weapon.type);
    const v: Partial<Token> = { bars: out.bars };
    if (out.down) v.markers = [...new Set([...t.markers, "Down"])];
    ops.push({ k: "merge", p: tp, v: v as Record<string, unknown> });
    note = out.overflow > 0 ? ` ${out.overflow} overflow.` : out.down ? " Down." : "";
  }
  dispatch(ops);
  const left = (k: "b1" | "b2") => (t.bars[k] ? `${BAR_META[k].name}` : "");
  say(boxes > 0
    ? `${rec.attacker.name} hits ${t.name} with ${rec.weapon.name}: ${dv}${rec.weapon.type}, ${r.totalHits} soaked, ${boxes}${rec.weapon.type} taken (${left(rec.weapon.type === "S" ? "b2" : "b1")}).${note}`
    : `${t.name} soaks all ${dv}${rec.weapon.type} from ${rec.attacker.name}'s ${rec.weapon.name}.`);
}

export function cancel(rec: Attack) {
  useVtt.getState().dispatch([{ k: "merge", p: ["combat", rec.id], v: { status: "cancelled" } }]);
}
