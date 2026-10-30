import type { Character } from "@/lib/sr6/character";
import { derive } from "@/lib/sr6/derive";
import { withAdv } from "@/lib/sr6/advance";
import { ATTRIBUTES, ATTR_ABBR, METATYPES, SKILL_BY_ID } from "@/lib/sr6/data";
import type { Bar, BarKey, Card, Npc, Weapon } from "./types";
import { parseDv } from "./combat";

/** Condition monitors and Edge as token bars: current is boxes left. */
export function barsFor(raw: Character): Record<BarKey, Bar> {
  const c = withAdv(raw);
  const d = derive(c);
  return {
    b1: { cur: Math.max(0, d.condition.physical - c.damage.physical), max: d.condition.physical },
    b2: { cur: Math.max(0, d.condition.stun - c.damage.stun), max: d.condition.stun },
    b3: { cur: c.edgeCurrent, max: Math.max(d.edge, c.edgeCurrent) },
  };
}

function pools(c: Character) {
  const d = derive(c);
  const out: { label: string; dice: number }[] = [];
  for (const w of c.gear.filter((g) => g.category === "weapon").slice(0, 3)) {
    const sk = w.skill ?? "firearms";
    const def = SKILL_BY_ID[sk];
    const e = c.skills[sk];
    const rank = e ? e.pts + e.kar : 0;
    const attr = def?.attr === "magic" ? d.magic : def?.attr === "resonance" ? d.resonance : d.attrs[(def?.attr ?? "agility") as keyof typeof d.attrs] ?? 0;
    out.push({ label: `${w.name}${w.dv ? ` (${w.dv})` : ""}`, dice: Math.max(0, attr + (rank > 0 ? rank : -1)) });
  }
  for (const s of [...d.skills].sort((a, b) => b.pool - a.pool).slice(0, 8)) out.push({ label: s.name, dice: s.pool });
  out.push({ label: "Defend (REA + INT)", dice: d.attrs.reaction + d.attrs.intuition });
  out.push({ label: "Soak (BOD)", dice: d.attrs.body });
  return out;
}

/** Weapons with their attack pools, plus an unarmed strike. */
export function weaponsFor(raw: Character): Weapon[] {
  const c = withAdv(raw);
  const d = derive(c);
  const poolFor = (sk: string) => {
    const def = SKILL_BY_ID[sk];
    const e = c.skills[sk];
    const rank = e ? e.pts + e.kar : 0;
    const attr = def?.attr === "magic" ? d.magic : def?.attr === "resonance" ? d.resonance : d.attrs[(def?.attr ?? "agility") as keyof typeof d.attrs] ?? 0;
    return Math.max(0, attr + (rank > 0 ? rank : -1));
  };
  const out: Weapon[] = c.gear.filter((g) => g.category === "weapon").map((w) => {
    const { dv, type } = parseDv(w.dv);
    return { name: w.name, pool: poolFor(w.skill ?? "firearms"), dv, type, ar: (w.ar ?? [null, null, null, null, null]).map((v) => (v == null ? null : v)) };
  });
  // Unarmed: base DV 2S (Close Combat, p. 94); AR is Reaction + Strength, Close only.
  // Half Strength is the damage for the grapple option, not for a strike. Dermal Deposits makes it Physical.
  out.push({ name: "Unarmed strike", pool: poolFor("close-combat"), dv: 2, type: d.unarmedPhysical ? "P" : "S", ar: [d.attrs.reaction + d.attrs.strength, null, null, null, null] });
  return out;
}

/** What a runner's owner shares with the table. */
export function cardFor(raw: Character): Card {
  const c = withAdv(raw);
  const d = derive(c);
  return {
    sub: [METATYPES[c.metatype].name, c.archetype].filter(Boolean).join(" · "),
    attrs: [...ATTRIBUTES.map((a) => [ATTR_ABBR[a], d.attrs[a]] as [string, number]), ["EDG", d.edge]],
    init: { base: d.initiative.rank, dice: d.initiative.dice },
    dr: d.defenseRating,
    pools: pools(c),
    weapons: weaponsFor(c),
    defend: d.attrs.reaction + d.attrs.intuition,
    soak: d.attrs.body,
    armor: d.armor,
  };
}

/** A GM-run copy of a character, as a stat block on a token. */
export function npcFor(raw: Character): { npc: Npc; bars: Record<BarKey, Bar> } {
  const c = withAdv(raw);
  const d = derive(c);
  return {
    npc: { init: { base: d.initiative.rank, dice: d.initiative.dice }, dr: d.defenseRating, pools: pools(c), notes: c.concept || "", weapons: weaponsFor(c), defend: d.attrs.reaction + d.attrs.intuition, soak: d.attrs.body, armor: d.armor },
    bars: { b1: { cur: d.condition.physical, max: d.condition.physical }, b2: { cur: d.condition.stun, max: d.condition.stun }, b3: { cur: d.edge, max: d.edge } },
  };
}

/** A plain grunt, before the GM tunes it. */
export function blankNpc(): { npc: Npc; bars: Record<BarKey, Bar> } {
  return {
    npc: {
      init: { base: 8, dice: 1 }, dr: 6, notes: "", defend: 7, soak: 4,
      pools: [{ label: "Perception", dice: 6 }, { label: "Athletics", dice: 6 }],
      weapons: [
        { name: "Heavy pistol", pool: 8, dv: 3, type: "P", ar: [10, 10, 8, null, null] },
        { name: "Stun baton", pool: 7, dv: 5, type: "S", ar: [6, null, null, null, null] },
      ],
    },
    bars: { b1: { cur: 10, max: 10 }, b2: { cur: 10, max: 10 }, b3: { cur: 2, max: 2 } },
  };
}
