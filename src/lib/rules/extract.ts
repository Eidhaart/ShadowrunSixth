/**
 * Rulebook extractor. Works in the browser and in Node on a pdf.js document.
 * It reads the text layer of a Shadowrun: Sixth World core book PDF, rebuilds the
 * two-column reading order and splits the book into headed sections.
 *
 * The result is private to whoever imported it (IndexedDB in the browser, a local
 * JSON file from the CLI). No book text is shipped with the app.
 */
import type {
  RuleCategory,
  RuleSection,
  Rulebook,
  RulebookChapter,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type PdfDoc = any;

interface Run {
  str: string;
  x: number;
  top: number;
  size: number;
  w: number;
}

interface Line {
  text: string;
  x: number;
  top: number;
  size: number;
}

const HEADING_MIN = 12.5;

/** Pages that are not rules content (contents, credits, index, back matter). */
const SKIP_CHAPTERS = new Set([
  "Contents & Credits",
  "Index",
  "Back Cover",
  "Seattle Gatefolds",
]);

function chapterTags(chapter: string): RuleCategory[] {
  switch (chapter) {
    case "Game Concepts":
      return ["core"];
    case "Character Creation":
    case "Archetypes":
      return ["creation"];
    case "Skills":
      return ["skills"];
    case "Combat":
      return ["combat"];
    case "Magic":
      return ["magic"];
    case "Matrix":
      return ["hacking"];
    case "Rigging":
      return ["rigging"];
    case "Wild Life":
      return ["critters"];
    case "Running the Game":
      return ["gm"];
    case "Gear":
      return ["gear"];
    case "Tables":
      return ["tables"];
    case "Introduction":
    case "Four Square":
    case "Four Square (Fiction)":
    case "The Life You Have Left":
    case "The Way Up (Fiction)":
    case "Seattle City Data":
      return ["setting"];
    default:
      return [];
  }
}

/** Cross-cutting tags derived from the heading text, so lenses overlap sensibly. */
function titleTags(title: string, parent?: string): RuleCategory[] {
  const t = `${title} ${parent ?? ""}`.toLowerCase();
  const out: RuleCategory[] = [];
  if (/\b(drain|spell|summon|spirit|astral|adept|foci|focus|ritual|enchant|magic|banish|conjur|sorcer)/.test(t))
    out.push("magic");
  if (/\b(matrix|hack|decker|technomancer|resonance|ic\b|host|sprite|cyberdeck|commlink|cracking|vr\b|ar\b)/.test(t))
    out.push("hacking");
  if (/\b(drone|vehicle|rigger|rigging|autosoft|jump into|control rig)/.test(t))
    out.push("rigging");
  if (/\b(attack|damage|defen[cs]e|initiative|weapon|firearm|melee|grenade|armor|armour|combat|wound|stun|edge action)/.test(t))
    out.push("combat");
  if (/\b(contact|lifestyle|social|etiquette|negotiat|con\b|influence|reputation|street cred|notoriety)/.test(t))
    out.push("core");
  return out;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function dehyphenJoin(parts: string[]): string {
  let out = "";
  for (const raw of parts) {
    const p = raw.trim();
    if (!p) continue;
    if (!out) {
      out = p;
      continue;
    }
    if (/[a-z]-$/.test(out) && /^[a-z]/.test(p)) {
      out = out.slice(0, -1) + p; // soft line-break hyphen
    } else {
      out += " " + p;
    }
  }
  return out;
}

async function getChapters(pdf: PdfDoc): Promise<RulebookChapter[]> {
  const outline = await pdf.getOutline();
  const raw: { title: string; page: number }[] = [];
  if (outline) {
    for (const o of outline) {
      try {
        let dest = o.dest;
        if (typeof dest === "string") dest = await pdf.getDestination(dest);
        if (!dest) continue;
        const idx = await pdf.getPageIndex(dest[0]);
        raw.push({ title: String(o.title).trim(), page: idx + 1 });
      } catch {
        /* ignore broken bookmark */
      }
    }
  }
  raw.sort((a, b) => a.page - b.page);
  const chapters: RulebookChapter[] = [];
  for (let i = 0; i < raw.length; i++) {
    const next = raw[i + 1];
    chapters.push({
      title: raw[i].title,
      pageStart: raw[i].page,
      pageEnd: next ? Math.max(raw[i].page, next.page - 1) : pdf.numPages,
    });
  }
  // The first bookmark is the whole book title and covers page 1-2.
  return chapters;
}

async function readPageLines(page: any): Promise<{ lines: Line[]; printed?: number }> {
  const viewport = page.getViewport({ scale: 1 });
  const H = viewport.height;
  const content = await page.getTextContent();
  const runs: Run[] = [];
  let numX: number | undefined;
  let printed: number | undefined;

  for (const it of content.items as any[]) {
    if (!("str" in it) || !it.str || !it.str.trim()) continue;
    const [a, b, , , e, f] = it.transform as number[];
    const size = Math.hypot(a, b);
    const top = H - f;
    // vertical side labels ("SHADOWRUN: SIXTH WORLD") are rotated
    if (Math.abs(b) > 0.1 * Math.abs(a)) continue;
    // running footer
    if (top > 733) continue;
    // printed page number: a lone integer in the top corner at 15pt
    if (size > 14 && top < 100 && /^\d{1,3}$/.test(it.str.trim()) && (e < 45 || e > 560)) {
      numX = e;
      printed = parseInt(it.str.trim(), 10);
      continue;
    }
    runs.push({ str: it.str, x: e, top, size, w: typeof it.width === "number" ? it.width : it.str.length * size * 0.45 });
  }

  // column boundary depends on which side the printed page number sits
  const boundary = numX !== undefined && numX < 100 ? 329 : 292;

  const withCol = runs.map((r) => ({ ...r, col: r.x < boundary ? 0 : 1 }));
  withCol.sort((p, q) => p.col - q.col || p.top - q.top || p.x - q.x);

  const lines: Line[] = [];
  let cur: (typeof withCol)[number][] = [];
  const flush = () => {
    if (!cur.length) return;
    cur.sort((p, q) => p.x - q.x);
    let text = "";
    let lastEnd = -1;
    for (const r of cur) {
      // pdf.js splits words into runs; add a space only when there is a gap or none
      if (text && !/\s$/.test(text) && !/^\s/.test(r.str) && r.x - lastEnd > r.size * 0.14) text += " ";
      text += r.str;
      lastEnd = r.x + r.w;
    }
    lines.push({
      text: text.replace(/\s+/g, " ").replace(/\s+([,.;:!?)])/g, "$1").replace(/\(\s+/g, "(").trim(),
      x: cur[0].x,
      top: cur[0].top,
      size: Math.max(...cur.map((r) => r.size)),
    });
    cur = [];
  };
  let lastCol = -1;
  let lastTop = -999;
  for (const r of withCol) {
    if (cur.length && (r.col !== lastCol || Math.abs(r.top - lastTop) > 2.5)) flush();
    cur.push(r);
    lastCol = r.col;
    lastTop = r.top;
  }
  flush();
  return { lines: lines.filter((l) => l.text), printed };
}

export interface ExtractProgress {
  page: number;
  total: number;
}

export async function extractRulebook(
  pdf: PdfDoc,
  opts: { title?: string; onProgress?: (p: ExtractProgress) => void } = {},
): Promise<Rulebook> {
  const chapters = await getChapters(pdf);
  const chapterOf = (page: number) =>
    [...chapters].reverse().find((c) => page >= c.pageStart)?.title ?? "Introduction";

  const sections: RuleSection[] = [];
  const usedIds = new Set<string>();
  let current: RuleSection | null = null;
  let parentL1: string | undefined;
  let parentL2: string | undefined;
  let paraBuf: string[] = [];
  let bodyParas: string[] = [];

  const closeCurrent = () => {
    if (!current) return;
    if (paraBuf.length) bodyParas.push(dehyphenJoin(paraBuf));
    paraBuf = [];
    current.text = bodyParas.join("\n\n").trim();
    bodyParas = [];
    if (current.text.length > 0 || current.level < 3) sections.push(current);
    current = null;
  };

  const open = (
    chapter: string,
    level: 1 | 2 | 3,
    title: string,
    page: number,
  ): RuleSection => {
    let id = `${slug(chapter)}--${slug(title)}`;
    let n = 2;
    while (usedIds.has(id)) id = `${slug(chapter)}--${slug(title)}-${n++}`;
    usedIds.add(id);
    const parent = level === 3 ? (parentL2 ?? parentL1) : level === 2 ? parentL1 : undefined;
    const tags = Array.from(
      new Set<RuleCategory>([...chapterTags(chapter), ...titleTags(title, parent)]),
    );
    return { id, chapter, level, title, parent, page, pageEnd: page, text: "", tags };
  };

  const total = pdf.numPages as number;
  for (let p = 1; p <= total; p++) {
    opts.onProgress?.({ page: p, total });
    const chapter = chapterOf(p);
    if (SKIP_CHAPTERS.has(chapter) || chapter.startsWith("Shadowrun")) {
      continue;
    }
    const page = await pdf.getPage(p);
    const { lines } = await readPageLines(page);
    page.cleanup?.();

    let prev: Line | null = null;
    let headBuf: { size: number; parts: string[]; lastTop: number } | null = null;

    const flushHeading = () => {
      if (!headBuf) return;
      const title = dehyphenJoin(headBuf.parts).replace(/\s+/g, " ").trim();
      const level: 1 | 2 | 3 = headBuf.size >= 19 ? 1 : headBuf.size >= 14 ? 2 : 3;
      headBuf = null;
      if (title.length < 2 || /^\d+$/.test(title)) return;
      closeCurrent();
      if (level === 1) {
        parentL1 = title;
        parentL2 = undefined;
      } else if (level === 2) {
        parentL2 = title;
      }
      current = open(chapter, level, title, p);
    };

    for (const line of lines) {
      const isHeading = line.size >= HEADING_MIN;
      if (isHeading) {
        if (
          headBuf &&
          Math.abs(headBuf.size - line.size) < 0.6 &&
          line.top - headBuf.lastTop < line.size * 1.6 &&
          line.top >= headBuf.lastTop
        ) {
          headBuf.parts.push(line.text);
          headBuf.lastTop = line.top;
        } else {
          flushHeading();
          headBuf = { size: line.size, parts: [line.text], lastTop: line.top };
        }
        prev = null;
        continue;
      }
      flushHeading();
      if (!current) {
        current = open(chapter, 1, chapter, p);
        parentL1 = chapter;
      }
      // paragraph detection: vertical gap or first-line indent
      const gap = prev ? line.top - prev.top : 0;
      const newPara =
        !prev || gap > line.size * 1.75 || gap < 0 || (prev && line.x - prev.x > 6 && gap > 0 && gap < line.size * 1.75);
      if (newPara && paraBuf.length) {
        bodyParas.push(dehyphenJoin(paraBuf));
        paraBuf = [];
      }
      paraBuf.push(line.text);
      current.pageEnd = p;
      prev = line;
    }
    flushHeading();
  }
  closeCurrent();

  // merge near-empty headings into their successors' context and drop dupes
  const cleaned = sections.filter((s) => s.text.length > 0 || s.level === 1);
  return {
    version: 1,
    source: {
      title: opts.title ?? "Shadowrun: Sixth World",
      pages: total,
      importedAt: new Date().toISOString(),
    },
    chapters: chapters.filter((c) => !SKIP_CHAPTERS.has(c.title) && !c.title.startsWith("Shadowrun")),
    sections: cleaned,
  };
}
