import type { Rulebook } from "@/lib/rules/types";
import type { QualityEffect } from "./character";

export interface QualityDef {
  id: string;
  name: string;
  kind: "positive" | "negative";
  /** Karma cost (positive) or bonus (negative) per level. */
  karma: number;
  perLevel: boolean;
  minLevel: number;
  maxLevel: number;
  needs: "skill" | "attribute" | "text" | null;
  needsLabel?: string;
  page: number;
  sectionId: string;
  blurb: string;
  effectText: string;
  effect?: QualityEffect;
}

/** Quality effects the sheet can apply automatically. Keys are lowercase base names. */
export const QUALITY_EFFECTS: Record<string, QualityEffect> = {
  "built tough": { physicalBoxes: 1 },
  "will to live": { overflowBoxes: 2 },
  "glass jaw": { stunBoxes: -1 },
  "dermal deposits": { defense: 1 },
  "high pain tolerance": { woundReduce: 1 },
  "low pain tolerance": { woundDouble: true },
  "exceptional": { maxMod: 1 },
  "impaired": { maxMod: -1 },
  "in debt": { nuyenPerKarma: 5000 },
  "sensitive system": { essenceMult: 2 },
  "bad luck": { glitchOn2: true },
};

function clean(s: string): string {
  return s.replace(/\s+/g, " ").replace(/- (?=[a-z])/g, "").trim();
}

export function parseQualities(book: Rulebook | null): QualityDef[] {
  if (!book) return [];
  const out: QualityDef[] = [];
  for (const s of book.sections) {
    if (s.level !== 3 || !/^(Positive|Negative) Qualities$/.test(s.parent ?? "")) continue;
    const costM = /(Cost|Bonus):\s*(\d+)\s*Karma(\s*per\s*level)?/i.exec(s.text);
    if (!costM) continue; // tables and sub-notes
    const kind = s.parent!.startsWith("Positive") ? "positive" : "negative";
    const title = s.title.replace(/\s+/g, " ").trim();
    const range = /(\d)\s*to\s*(\d)/.exec(title);
    let name = title.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
    if (!name) name = title.replace(/[()]/g, "");
    let needs: QualityDef["needs"] = null;
    let needsLabel: string | undefined;
    const paren = /\(([^)]*)\)/.exec(title)?.[1] ?? "";
    if (/skill/i.test(paren)) { needs = "skill"; needsLabel = "Skill"; }
    else if (/attribute/i.test(paren)) { needs = "attribute"; needsLabel = "Attribute"; }
    else if (/[a-z]/i.test(paren.replace(/\d\s*to\s*\d/, "").replace(/[,\s]/g, ""))) {
      needs = "text";
      needsLabel = paren.replace(/,?\s*\d\s*to\s*\d/, "").replace(/select\s*/i, "").trim() || "Details";
    }
    if (/^\(?\s*elemental\s*\)?\s*resistance/i.test(title)) { name = "Elemental Resistance"; needs = "text"; needsLabel = "Element"; }
    const [effectHead, effectBody] = s.text.split(/Game Effect:/);
    const blurb = clean(effectHead.replace(/[•]?\s*(Cost|Bonus):[\s\S]*$/i, ""));
    const effect = QUALITY_EFFECTS[name.toLowerCase()];
    out.push({
      id: s.id,
      name,
      kind,
      karma: Number(costM[2]),
      perLevel: !!costM[3] || !!range,
      minLevel: range ? Number(range[1]) : 1,
      maxLevel: range ? Number(range[2]) : costM[3] ? 3 : 1,
      needs,
      needsLabel,
      page: s.page,
      sectionId: s.id,
      blurb,
      effectText: clean(effectBody ?? ""),
      effect,
    });
  }
  return out;
}
