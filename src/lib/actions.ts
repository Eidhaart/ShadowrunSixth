"use client";
import { roll, rollInitiative, type InitiativeResult, type RollResult, type RollSpec } from "@/lib/sr6/dice";
import { useRolls } from "@/lib/store/rolls";
import { useSettings } from "@/lib/store/settings";
import { useComms } from "@/lib/store/comms";
import { useUi } from "@/lib/store/ui";
import { sfxResult, sfxRoll } from "@/lib/sound";
import type { CheckSpec, WireMsg } from "@/lib/comms";
import { useRunners } from "@/lib/store/characters";
import { checkPool } from "@/lib/checks";
import { derive } from "@/lib/sr6/derive";
import type { Character } from "@/lib/sr6/character";

export function rollToWire(who: string, r: RollResult): WireMsg {
  return {
    type: "roll",
    id: r.id,
    from: who,
    at: r.at,
    label: r.spec.label,
    pool: r.baseCount,
    dice: r.dice.map((d) => ({ v: d.value, hit: d.hit, boom: d.exploded, gone: d.rerolled })),
    hits: r.totalHits,
    glitch: r.glitch,
    critGlitch: r.critGlitch,
    edgeSpent: r.edgeSpent,
    threshold: r.spec.threshold,
    success: r.success,
    source: "deck",
  };
}

export function whoAmI(fallback = "Runner"): string {
  return useSettings.getState().handle.trim() || fallback;
}

export function doRoll(spec: RollSpec, edge = 0, who = whoAmI(), share = true): RollResult {
  const r = roll(spec, edge);
  useRolls.getState().push({ kind: "roll", who, result: r });
  useUi.getState().setTray(true);
  sfxRoll(r.dice.length);
  sfxResult(r.critGlitch ? "crit" : r.glitch ? "glitch" : r.totalHits > 0 ? "hit" : "miss");
  if (share && useComms.getState().status !== "off") {
    const wire = rollToWire(who, r);
    // a roll made as yourself carries the runner you are currently speaking as
    if (wire.type === "roll" && who === whoAmI()) { wire.as = currentVoice().as; wire.gm = useComms.getState().role === "gm"; }
    useComms.getState().send(wire);
  }
  return r;
}

export function doInitiative(label: string, base: number, dice: number, bonus = 0, who = whoAmI()): InitiativeResult {
  const r = rollInitiative(label, base, dice, bonus);
  useRolls.getState().push({ kind: "init", who, result: r });
  useUi.getState().setTray(true);
  sfxRoll(dice);
  if (useComms.getState().status !== "off")
    useComms.getState().send({ type: "init", id: r.id, from: who, at: r.at, label, base: base + bonus, dice: r.dice, score: r.score, source: "deck" });
  return r;
}

/** Re-share a roll after an Edge boost changed it. */
export function reshare(who: string, r: RollResult) {
  const wire = rollToWire(who, r);
  if (wire.type !== "roll") return;
  wire.id = `${r.id}-${r.edgeSpent}`;
  wire.label = `${r.spec.label} (Edge boost)`;
  if (useComms.getState().status !== "off") useComms.getState().send(wire);
}

const mid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const runnerName = (c: Character) => c.alias || c.name || "Runner";

/** Who the chat speaks as right now: a runner, the GM's NPC voice, or just the player. */
export function currentVoice(): { as?: string; runner?: Character } {
  const s = useSettings.getState();
  if (s.speakAs === "npc") return { as: s.npcName.trim() || "Narrator" };
  const runner = s.speakAs ? useRunners.getState().runners[s.speakAs] : undefined;
  return runner ? { as: runnerName(runner), runner } : {};
}

export function sendChat(text: string, ooc = false) {
  const comms = useComms.getState();
  const s = useSettings.getState();
  const v = ooc ? {} : currentVoice();
  comms.send({ type: "chat", id: mid("c"), from: s.handle.trim() || "runner", text, at: Date.now(), source: "deck", as: v.as, gm: comms.role === "gm", ooc });
}

export function sendCall(check: CheckSpec, to: string[]) {
  const comms = useComms.getState();
  comms.send({ type: "call", id: mid("k"), from: useSettings.getState().handle.trim() || "GM", at: Date.now(), to, check, gm: true });
}

export function withdrawCall(callId: string) {
  useComms.getState().send({ type: "withdraw", id: mid("w"), callId, from: useSettings.getState().handle.trim() || "GM", at: Date.now() });
}

export function declineCall(callId: string, as?: string) {
  useComms.getState().send({ type: "decline", id: mid("d"), callId, from: useSettings.getState().handle.trim() || "runner", as, at: Date.now() });
}

/** Roll a GM check for a runner (or a manual pool) and share the result in the chat. */
export function answerCall(callId: string, check: CheckSpec, o: { runnerId?: string; manualPool?: number; push?: boolean }): RollResult {
  const runner = o.runnerId ? useRunners.getState().runners[o.runnerId] : undefined;
  const handle = useSettings.getState().handle.trim() || "runner";
  const info = runner ? checkPool(runner, check) : { pool: Math.max(0, o.manualPool ?? 0), parts: `${o.manualPool ?? 0} dice` };
  const d = runner ? derive(runner) : null;
  const push = !!(o.push && runner && runner.edgeCurrent >= 4);
  if (push && runner) useRunners.getState().update(runner.id, (x) => { x.edgeCurrent -= 4; });
  const r = roll({ label: check.label, pool: info.pool, explode: push, glitchOn2: d?.glitchOn2, threshold: check.threshold }, push && d ? d.edge : 0);
  const who = runner ? runnerName(runner) : handle;
  useRolls.getState().push({ kind: "roll", who, result: r });
  sfxRoll(r.dice.length);
  sfxResult(r.critGlitch ? "crit" : r.glitch ? "glitch" : r.totalHits > 0 ? "hit" : "miss");
  const wire = rollToWire(handle, r);
  if (wire.type === "roll") {
    wire.as = runner ? runnerName(runner) : undefined;
    wire.callId = callId;
    wire.breakdown = push ? `${info.parts}, Push the Limit` : info.parts;
    wire.gm = false;
    if (check.opposed) {
      const o2 = roll({ label: check.opposed.label, pool: check.opposed.pool });
      wire.opposed = { label: check.opposed.label, pool: check.opposed.pool, dice: o2.dice.map((x) => ({ v: x.value, hit: x.hit, boom: x.exploded })), hits: o2.totalHits };
      wire.success = r.totalHits > o2.totalHits;
    }
  }
  useComms.getState().send(wire);
  return r;
}
