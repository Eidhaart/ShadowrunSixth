"use client";
import { roll, rollInitiative, type InitiativeResult, type RollResult, type RollSpec } from "@/lib/sr6/dice";
import { useRolls } from "@/lib/store/rolls";
import { useSettings } from "@/lib/store/settings";
import { useComms } from "@/lib/store/comms";
import { useUi } from "@/lib/store/ui";
import { sfxResult, sfxRoll } from "@/lib/sound";
import type { WireMsg } from "@/lib/comms";

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
  if (share && useComms.getState().status !== "off") useComms.getState().send(rollToWire(who, r));
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
