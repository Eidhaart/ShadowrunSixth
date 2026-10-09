import type { Rulebook } from "@/lib/rules/types";
import type { QualityEffect } from "./character";

export interface BookEntry {
  id: string;
  name: string;
  page: number;
  group: string;
  /** PP cost per level for adept powers */
  pp?: number;
  perLevel?: boolean;
  maxLevel?: number;
  effect?: QualityEffect;
  summary: string;
}

const SPELL_PARENTS = /^(Spell Descriptions|Detection Spells|Health Spells|Illusion Spells|Manipulation Spells)$/;
const JUNK = /(table|example|reference|sustained|indirect spellcasting|^combat spells$)/i;

function brief(text: string): string {
  return text.replace(/\s+/g, " ").replace(/- (?=[a-z])/g, "").slice(0, 220);
}

export function spellList(book: Rulebook | null): BookEntry[] {
  if (!book) return [];
  return book.sections
    .filter((s) => s.level === 3 && SPELL_PARENTS.test(s.parent ?? "") && !JUNK.test(s.title) && /^[A-Z]/.test(s.title))
    .map((s) => ({ id: s.id, name: s.title, page: s.page, group: s.parent!.replace(" Descriptions", "").replace(" Spells", ""), summary: brief(s.text) }));
}

export function complexFormList(book: Rulebook | null): BookEntry[] {
  if (!book) return [];
  return book.sections
    .filter((s) => s.level === 3 && s.parent === "Complex Forms" && /^[A-Z]/.test(s.title) && !JUNK.test(s.title))
    .map((s) => ({ id: s.id, name: s.title.replace(/\s*\(.*\)$/, ""), page: s.page, group: "Complex form", summary: brief(s.text) }));
}

export function adeptPowerList(book: Rulebook | null): BookEntry[] {
  if (!book) return [];
  const out: BookEntry[] = [];
  for (const s of book.sections) {
    if (s.level !== 3 || s.parent !== "Adept Powers" || JUNK.test(s.title)) continue;
    const m = /Cost:\s*([\d.]+)\s*PP(\s*per level)?/i.exec(s.text);
    if (!m) continue;
    const name = s.title.replace(/\s*\(.*\)$/, "");
    const max = /maximum level[^.]*?(\d)/i.exec(s.text);
    const entry: BookEntry = {
      id: s.id, name, page: s.page, group: "Adept power",
      pp: Number(m[1]), perLevel: !!m[2], maxLevel: max ? Number(max[1]) : m[2] ? 4 : 1,
      summary: brief(s.text.replace(/Cost:.*?Activation:\s*\w+/i, "")),
    };
    if (name === "Improved Reflexes") entry.effect = { attr: { reaction: 1 }, initiativeDice: 1 };
    out.push(entry);
  }
  return out;
}
