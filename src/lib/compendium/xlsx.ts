import { unzipSync, strFromU8 } from "fflate";

/** A minimal .xlsx reader: returns every sheet as rows of plain cell values. Enough for data tables;
 *  formulas come through as their cached values, styles and merged cells are ignored. */
export type Cell = string | number | boolean | null;
export type Sheets = Record<string, Cell[][]>;

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unescape = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] ?? m);
const texts = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescape(m[1])).join("");
const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function readXlsx(data: Uint8Array): Sheets {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(data); } catch { throw new Error("That file is not a valid .xlsx workbook."); }
  const read = (p: string) => (files[p] ? strFromU8(files[p]) : "");
  const wb = read("xl/workbook.xml");
  if (!wb) throw new Error("That file is not a valid .xlsx workbook.");
  const rels = read("xl/_rels/workbook.xml.rels");
  const target: Record<string, string> = {};
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], "Id"), t = attr(m[0], "Target");
    if (id && t) target[id] = t.startsWith("/") ? t.slice(1) : `xl/${t.replace(/^\.\//, "")}`;
  }
  const shared = [...read("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));
  const out: Sheets = {};
  for (const m of wb.matchAll(/<sheet\b[^>]*\/?>/g)) {
    const name = unescape(attr(m[0], "name") ?? "");
    const rid = attr(m[0], "r:id");
    const xml = rid && target[rid] ? read(target[rid]) : "";
    const rows: Cell[][] = [];
    for (const r of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const rn = Number(attr(r[0], "r") ?? rows.length + 1) - 1;
      const row: Cell[] = [];
      for (const c of r[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const head = `<c${c[1]}>`;
        const ref = attr(head, "r");
        const t = attr(head, "t");
        const body = c[2] ?? "";
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        let val: Cell = null;
        if (t === "s") val = v != null ? shared[Number(v)] ?? null : null;
        else if (t === "inlineStr") val = texts(body);
        else if (t === "b") val = v === "1";
        else if (t === "str" || t === "e") val = v != null ? unescape(v) : null;
        else if (v != null) val = Number(v);
        row[ref ? colIndex(ref) : row.length] = val;
      }
      for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = null;
      rows[rn] = row;
    }
    for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
    out[name] = rows;
  }
  return out;
}
