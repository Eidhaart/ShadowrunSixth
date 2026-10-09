import type { Character } from "@/lib/sr6/character";
import { derive } from "@/lib/sr6/derive";
import { ATTR_LABEL, SKILL_BY_ID, SKILLS, type AttrKey } from "@/lib/sr6/data";
import type { CheckSpec } from "@/lib/comms";

export const THRESHOLDS = [
  { v: 0, label: "Just roll", hint: "No target, the GM reads the hits" },
  { v: 1, label: "Simple", hint: "Threshold 1" },
  { v: 2, label: "Average", hint: "Threshold 2" },
  { v: 3, label: "Hard", hint: "Threshold 3" },
  { v: 4, label: "Very hard", hint: "Threshold 4" },
  { v: 5, label: "Extreme", hint: "Threshold 5" },
] as const;

/** Downtime and social checks a GM reaches for most. */
export const PRESETS: { id: string; label: string; spec: Omit<CheckSpec, "threshold" | "opposed" | "note"> }[] = [
  { id: "haggle", label: "Haggle", spec: { label: "Haggle", skill: "con", attr: "charisma" } },
  { id: "legwork", label: "Legwork", spec: { label: "Legwork", skill: "influence", attr: "charisma" } },
  { id: "persuade", label: "Persuade", spec: { label: "Persuade", skill: "influence", attr: "charisma" } },
  { id: "intimidate", label: "Intimidate", spec: { label: "Intimidate", skill: "influence", attr: "willpower" } },
  { id: "notice", label: "Notice", spec: { label: "Notice", skill: "perception", attr: "intuition" } },
  { id: "sneak", label: "Sneak", spec: { label: "Sneak", skill: "stealth", attr: "agility" } },
  { id: "search", label: "Search online", spec: { label: "Search online", skill: "electronics", attr: "intuition" } },
  { id: "composure", label: "Composure", spec: { label: "Composure", attr: "willpower", attr2: "charisma" } },
  { id: "judge", label: "Judge intentions", spec: { label: "Judge intentions", attr: "willpower", attr2: "intuition" } },
  { id: "memory", label: "Memory", spec: { label: "Recall", attr: "logic", attr2: "intuition" } },
  { id: "hack", label: "Hack on the fly", spec: { label: "Hack on the fly", skill: "cracking", attr: "logic" } },
  { id: "mperc", label: "Matrix perception", spec: { label: "Matrix perception", skill: "electronics", attr: "intuition" } },
  { id: "cast", label: "Spellcasting", spec: { label: "Spellcasting", skill: "sorcery", attr: "magic" } },
  { id: "astralp", label: "Astral perception", spec: { label: "Astral perception", skill: "astral", attr: "intuition" } },
  { id: "pilot", label: "Pilot", spec: { label: "Pilot", skill: "piloting", attr: "reaction" } },
  { id: "lift", label: "Lift and carry", spec: { label: "Lift and carry", attr: "body", attr2: "willpower" } },
];

export const ATTR_CHOICES: string[] = ["body", "agility", "reaction", "strength", "willpower", "logic", "intuition", "charisma", "magic", "resonance"];
export const attrName = (a: string) => (ATTR_LABEL as Record<string, string>)[a] ?? a;

export interface PoolInfo {
  pool: number;
  parts: string;
  /** Skill is not on the sheet: attribute only, minus 1 die. */
  untrained: boolean;
  /** Skill cannot be rolled untrained and the runner does not have it. */
  blocked: boolean;
  wound: number;
}

/** Build the dice pool for a check from a runner's sheet. */
export function checkPool(c: Character, spec: CheckSpec): PoolInfo {
  const d = derive(c);
  const val = (a: string) => (a === "magic" ? d.magic : a === "resonance" ? d.resonance : d.attrs[a as AttrKey] ?? 0);
  let base = 0;
  let parts = "";
  let untrained = false;
  let blocked = false;
  if (spec.skill) {
    const def = SKILL_BY_ID[spec.skill];
    const entry = c.skills[spec.skill];
    const rank = entry ? entry.pts + entry.kar : 0;
    const a = val(spec.attr);
    if (rank > 0) {
      base = rank + a;
      parts = `${def?.name ?? spec.skill} ${rank} + ${attrName(spec.attr)} ${a}`;
    } else {
      untrained = true;
      blocked = !(def?.untrained ?? true);
      base = Math.max(0, a - 1);
      parts = `${attrName(spec.attr)} ${a} − 1 untrained`;
    }
  } else {
    const a = val(spec.attr);
    const b = spec.attr2 ? val(spec.attr2) : 0;
    base = a + b;
    parts = spec.attr2 ? `${attrName(spec.attr)} ${a} + ${attrName(spec.attr2)} ${b}` : `${attrName(spec.attr)} ${a}`;
  }
  const wound = d.woundPenalty;
  const mod = c.poolMod;
  if (wound) parts += `, −${wound} wounds`;
  if (mod) parts += `, ${mod > 0 ? "+" : "−"}${Math.abs(mod)} modifier`;
  return { pool: Math.max(0, base - wound + mod), parts, untrained, blocked, wound };
}

export function describeCheck(c: CheckSpec): string {
  const how = c.skill ? `${SKILL_BY_ID[c.skill]?.name ?? c.skill} + ${attrName(c.attr)}` : c.attr2 ? `${attrName(c.attr)} + ${attrName(c.attr2)}` : attrName(c.attr);
  if (c.opposed) return `${how} against ${c.opposed.label} (${c.opposed.pool} dice)`;
  return c.threshold ? `${how}, threshold ${c.threshold}` : how;
}

export function sanitizeCheck(c: CheckSpec): CheckSpec {
  const out: CheckSpec = { label: c.label.trim().slice(0, 60) || "Check", attr: c.attr };
  if (c.skill && SKILLS.some((s) => s.id === c.skill)) out.skill = c.skill;
  if (!out.skill && c.attr2) out.attr2 = c.attr2;
  if (c.threshold && c.threshold > 0) out.threshold = Math.min(12, Math.floor(c.threshold));
  if (c.opposed && c.opposed.pool > 0) out.opposed = { label: c.opposed.label.trim().slice(0, 40) || "Opposition", pool: Math.min(30, Math.floor(c.opposed.pool)) };
  if (c.note?.trim()) out.note = c.note.trim().slice(0, 240);
  return out;
}
