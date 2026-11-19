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
    .map((s) => ({ id: s.id, name: s.title.replace(/\s*\(.*\)$/, ""), page: s.page, group: "Complex form", summary: brief(s.text.replace(/^\s*FADE VALUE\s+DURATION\s+\S+\s+[ISP]\s+/i, "")) }));
}

export function adeptPowerList(book: Rulebook | null): BookEntry[] {
  if (!book) return [];
  const out: BookEntry[] = [];
  for (const s of book.sections) {
    if (s.level !== 3 || s.parent !== "Adept Powers" || JUNK.test(s.title)) continue;
    // Improved Ability prices combat skills and other skills differently: offer both (p. 157)
    const split = /Combat skill:\s*([\d.]+)\s*PP per level;\s*other skills\s*([\d.]+)\s*PP per level/i.exec(s.text.replace(/\s+/g, " "));
    if (split) {
      const base = s.title.replace(/\s*\(.*\)$/, "");
      const summary = brief(s.text.replace(/\s+/g, " ").replace(/Cost:.*?Activation:\s*\w+/i, ""));
      out.push({ id: `${s.id}-combat`, name: `${base} (combat skill)`, page: s.page, group: "Adept power", pp: Number(split[1]), perLevel: true, maxLevel: 6, summary });
      out.push({ id: s.id, name: base, page: s.page, group: "Adept power", pp: Number(split[2]), perLevel: true, maxLevel: 6, summary });
      continue;
    }
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

/** Rituals: the second-level entries under "Rituals" (pp. 145-147). They count as starting spells. */
export function ritualList(book: Rulebook | null): BookEntry[] {
  if (!book) return [];
  return book.sections
    .filter((s) => s.level === 2 && s.parent === "Rituals" && /^[A-Z]/.test(s.title) && !JUNK.test(s.title))
    .map((s) => {
      const tags = /^\(([^)]+)\)/.exec(s.text.trim());
      return { id: s.id, name: s.title, page: s.page, group: tags ? tags[1].replace(/\s+/g, " ") : "Ritual", summary: brief(s.text.replace(/^\([^)]+\)\s*Threshold:\s*\d+\s*/, "")) };
    });
}

const META_SECTION: Record<string, RegExp> = {
  human: /^Humans \(/, elf: /^Elves \(/, dwarf: /^Dwarfs \(/, ork: /^Orks \(/, troll: /^Trolls \(/,
};

/** The metatype's write-up in Character Metatypes (pp. 54-57). */
export function metatypeSection(book: Rulebook | null, id: string) {
  const re = META_SECTION[id];
  return re ? book?.sections.find((s) => s.parent === "Character Metatypes" && re.test(s.title)) : undefined;
}

/** A section by exact title, optionally under a given parent. */
export function sectionByTitle(book: Rulebook | null, title: string, parent?: string | RegExp) {
  const t = title.trim().toLowerCase();
  return book?.sections.find((s) => s.title.trim().toLowerCase() === t && (parent == null || (typeof parent === "string" ? s.parent === parent : parent.test(s.parent ?? ""))));
}
