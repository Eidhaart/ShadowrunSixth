"use client";

import type { Character } from "@/lib/sr6/character";
import type { Derived } from "@/lib/sr6/derive";
import { ATTR_ABBR, LIFESTYLES, METATYPES, SKILL_BY_ID } from "@/lib/sr6/data";
import { getExt } from "@/lib/sr6/ext";
import { idbGet, idbSet } from "@/lib/idb";

/**
 * The official two-page character sheet is embedded in the user's own Sixth
 * World rulebook. Do not ship or check in the artwork: cache only the two
 * locally rendered pages after the user selects their personal PDF.
 *
 * The Seattle City Edition book has the sheet on PDF pages 320 and 321.
 * Detect by heading, not hard-coded page number, to support other editions
 * and standalone two-page copies.
 */
const KEY = "sixthdeck.official-character-sheet.v1";

interface TemplatePage {
  width: number;
  height: number;
  image: Blob;
}
interface StoredTemplate {
  version: 1;
  pages: [TemplatePage, TemplatePage];
}

export async function officialSheetReady(): Promise<boolean> {
  const saved = await idbGet<StoredTemplate>(KEY);
  return saved?.version === 1 && saved.pages?.length === 2
    && saved.pages.every((p) => p.image instanceof Blob && p.width > 0 && p.height > 0);
}

function readPageText(items: { str?: string }[]): string {
  return items.map((x) => x.str ?? "").join(" ").replace(/\s+/g, " ").toLowerCase();
}

export async function rememberOfficialSheet(file: File): Promise<void> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url,
  ).toString();

  // The bytes and the extracted images never leave the visitor's browser.
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    let first = 0;
    const start = Math.max(1, pdf.numPages - 85);
    for (let n = start; n < pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      const text = readPageText(content.items as { str?: string }[]);
      if (text.includes("personal data") && text.includes("core combat info")
          && text.includes("attributes")) {
        const second = await pdf.getPage(n + 1);
        const next = readPageText((await second.getTextContent()).items as { str?: string }[]);
        if (next.includes("ranged weapons") && next.includes("adept powers")) {
          first = n;
          break;
        }
      }
    }
    if (!first) {
      throw new Error("Couldn't find the two official character-sheet pages in this PDF. Choose the Sixth World core rulebook (Seattle City Edition) or its two-page sheet.");
    }

    const render = async (number: number): Promise<TemplatePage> => {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 3.4 }); // Approx. 245 dpi.
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("Canvas printing is not available in this browser.");
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const image = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Couldn't prepare the sheet image.")), "image/png"));
      return { width: viewport.width / 3.4, height: viewport.height / 3.4, image };
    };
    const pages = [await render(first), await render(first + 1)] as [TemplatePage, TemplatePage];
    await idbSet(KEY, { version: 1, pages } satisfies StoredTemplate);
  } finally {
    await pdf.destroy();
  }
}

async function backgroundCanvas(page: TemplatePage): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(page.image);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas printing is not available in this browser.");
    ctx.drawImage(image, 0, 0);
    ctx.scale(canvas.width / page.width, canvas.height / page.height);
    ctx.fillStyle = "#17121b";
    ctx.textBaseline = "top";
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function put(ctx: CanvasRenderingContext2D, value: unknown, x: number, y: number, width: number, size = 7, bold = false): void {
  let s = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!s) return;
  const weight = bold ? "bold " : "";
  let fontSize = size;
  ctx.font = weight + fontSize + "px Arial, Helvetica, sans-serif";
  while (fontSize > 5 && ctx.measureText(s).width > width) {
    fontSize = Math.max(5, fontSize - 0.25);
    ctx.font = weight + fontSize + "px Arial, Helvetica, sans-serif";
  }
  if (ctx.measureText(s).width > width) {
    while (s.length > 2 && ctx.measureText(s + "...").width > width) s = s.slice(0, -1);
    s += "...";
  }
  ctx.fillText(s, x, y);
}

function rows(ctx: CanvasRenderingContext2D, values: string[], x: number, y: number, width: number, step: number, limit: number, size = 7): void {
  const shown = values.length > limit ? limit - 1 : limit;
  values.slice(0, shown).forEach((s, i) => put(ctx, s, x, y + step * i, width, size));
  if (values.length > limit) put(ctx, "+" + (values.length - shown) + " more (see digital sheet)", x, y + step * shown, width, 5);
}

function markTrack(ctx: CanvasRenderingContext2D, x: number, y: number, total: number, filled: number, rowCount: number): void {
  // Official sheet: three boxes per row, each 32.9pt square.
  const cols = 3;
  const cell = 32.9;
  for (let i = 0; i < cols * rowCount; i++) {
    if (i >= total || i < filled) {
      const cx = x + (i % cols) * cell + cell / 2;
      const cy = y + Math.floor(i / cols) * cell + cell / 2;
      ctx.save();
      ctx.strokeStyle = i >= total ? "#929292" : "#202020";
      ctx.lineWidth = i >= total ? 0.9 : 1.7;
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy - 4); ctx.lineTo(cx + 4, cy + 4);
      ctx.moveTo(cx + 4, cy - 4); ctx.lineTo(cx - 4, cy + 4);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function fillFirst(ctx: CanvasRenderingContext2D, c: Character, d: Derived): void {
  const who = c.alias || c.name || "Runner";
  const armors = c.gear.filter((g) => g.category === "armor");
  const weapons = c.gear.filter((g) => g.category === "weapon");
  const ranged = weapons.find((w) => (w.ar ?? []).slice(1).some((a) => a != null));
  const melee = weapons.find((w) => !ranged || w.id !== ranged.id) ?? weapons[0];
  const armor = armors.find((a) => a.worn !== false) ?? armors[0];
  const bestRange = (g: typeof weapons[number] | undefined) => (g?.ar ?? []).map((a) => a ?? "-");

  put(ctx, c.name || who, 411, 50, 144, 7);
  put(ctx, c.player, 411, 62, 144, 7);
  put(ctx, c.concept, 410, 74, 146, 6);

  put(ctx, c.name && c.alias ? c.name + " / " + c.alias : who, 135, 121, 157, 7.2, true);
  put(ctx, METATYPES[c.metatype].name, 103, 135, 57);
  put(ctx, c.magicType === "mystic" ? "Mystic Adept" : c.magicType, 210, 169, 79, 6);
  put(ctx, String(c.karmaEarned - c.karmaSpent), 91, 169, 24);
  put(ctx, c.karmaEarned, 155, 169, 32);

  const left = ["body", "agility", "reaction", "strength", "willpower", "logic", "intuition", "charisma"] as const;
  left.forEach((a, i) => put(ctx, d.attrs[a], 102, 210 + i * 11.85, 55, 7.3, true));
  const right: [number, string][] = [
    [210, String(d.essence)], [222, d.magic ? String(d.magic) : String(d.resonance)],
    [234, String(d.initiative.rank) + "+" + d.initiative.dice + "D6"],
    [246, "-"], [258, String(d.initiative.astralRank) + "+" + d.initiative.astralDice + "D6"],
    [270, String(d.composure)], [282, String(d.judgeIntentions)], [294, String(d.memory)],
    [305, String(d.liftCarry)], [317, String(d.movement.walk) + "/" + d.movement.sprint + "m"],
    [328, String(d.defenseRating)],
  ];
  right.forEach(([y, v]) => put(ctx, v, 229, y, 62, 7));
  put(ctx, d.edge, 102, 304, 34, 7, true);
  // Fill the official seven Edge hexagons instead of printing text over them.
  ctx.save();
  for (let i = 0; i < Math.min(7, c.edgeCurrent); i++) {
    ctx.beginPath(); ctx.arc(111.5 + i * 8, 321.5, 2.05, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  put(ctx, d.unarmedAR, 103, 328, 57, 7);

  const skills = Object.entries(c.skills)
    .filter(([, s]) => s.pts + s.kar > 0)
    .map(([id, s]) => ({ id, rank: s.pts + s.kar, spec: s.spec, name: SKILL_BY_ID[id]?.name ?? id, attr: SKILL_BY_ID[id]?.attr ?? "" }))
    .sort((a, b) => b.rank - a.rank);
  const split = 14;
  skills.slice(0, split * 2).forEach((s, i) => {
    const col = i >= split ? 1 : 0;
    const row = i % split;
    const dx = col * 118;
    const top = 384 + row * 14.4;
    put(ctx, s.name + (s.spec ? "*" : ""), 65 + dx, top, 44, 6.6);
    put(ctx, s.rank, 113 + dx, top, 14, 7);
    put(ctx, (ATTR_ABBR as Record<string, string>)[s.attr] ?? s.attr.slice(0, 3).toUpperCase(), 134 + dx, top, 20, 6);
    put(ctx, "A", 155 + dx, top, 12, 6);
  });
  put(ctx, armor?.name, 374, 123, 109, 6.6);
  put(ctx, armor?.armor, 505, 123, 45, 7);
  put(ctx, ranged?.name, 402, 135, 150, 6.5);
  if (ranged) {
    put(ctx, ranged.dv, 329, 153, 25, 6);
    bestRange(ranged).forEach((v, i) => put(ctx, v, 389 + i * 28.7, 153, 20, 6));
  }
  put(ctx, melee?.name, 402, 161, 146, 6.5);
  put(ctx, melee?.dv, 330, 179, 26, 6.2);
  put(ctx, melee?.ar?.[0], 385, 179, 25, 6.2);

  markTrack(ctx, 333, 232, d.condition.physical, c.damage.physical, 6);
  markTrack(ctx, 454, 232, d.condition.stun, c.damage.stun, 4);

  rows(ctx, c.qualities.map((q) => q.name + (q.level > 1 ? " " + q.level : "")), 328, 487, 119, 13, 8, 6.6);
  rows(ctx, c.qualities.map((q) => q.note ?? ""), 453, 487, 80, 13, 8, 6.2);
  rows(ctx, c.qualities.map((q) => q.kind === "positive" ? "+" : "-"), 542, 487, 20, 13, 8, 6.7);

  put(ctx, LIFESTYLES.find((l) => l.id === c.lifestyle)?.name, 122, 618, 163, 7);
  put(ctx, c.nuyen + " nuyen", 91, 630, 93, 7);
  rows(ctx, c.gear.filter((g) => /sin|license|credstick/i.test(g.name)).map((g) => g.name),
    70, 650, 212, 11, 4, 6.3);

  c.contacts.slice(0, 6).forEach((ct, i) => {
    const y = 629 + i * 12;
    put(ctx, ct.name, 334, y, 91, 6.5);
    put(ctx, ct.loyalty, 439, y, 18, 7);
    put(ctx, ct.connection, 478, y, 19, 7);
  });
}

function fillSecond(ctx: CanvasRenderingContext2D, c: Character, d: Derived): void {
  const who = c.alias || c.name || "Runner";
  put(ctx, c.name || who, 404, 50, 146);
  put(ctx, c.player, 404, 62, 146);
  put(ctx, c.concept, 404, 74, 147, 6);

  const weapons = c.gear.filter((g) => g.category === "weapon");
  const ranged = weapons.filter((g) => (g.ar ?? []).slice(1).some((a) => a != null));
  const melee = weapons.filter((g) => !ranged.includes(g));
  ranged.slice(0, 4).forEach((g, i) => {
    const y = 137 + i * 14;
    put(ctx, g.name, 53, y, 43, 6.2);
    put(ctx, g.dv, 99, y, 17, 6.3);
    (g.ar ?? []).forEach((v, j) => put(ctx, v ?? "-", 141 + j * 23, y, 20, 6.2));
  });
  melee.slice(0, 4).forEach((g, i) => {
    const y = 137 + i * 14;
    put(ctx, g.name, 328, y, 120, 6.4);
    put(ctx, g.dv, 452, y, 41, 6.5);
    put(ctx, g.ar?.[0], 508, y, 39, 6.5);
  });

  c.gear.filter((g) => g.category === "armor").slice(0, 6).forEach((g, i) => {
    const y = 232 + i * 14;
    put(ctx, g.name, 63, y, 97, 6.5);
    put(ctx, g.armor, 171, y, 38, 7);
    put(ctx, g.notes, 214, y, 70, 5.5);
  });
  c.gear.filter((g) => g.category === "cyberware" || g.category === "bioware").slice(0, 6).forEach((g, i) => {
    const y = 360 + i * 13;
    put(ctx, g.name, 63, y, 75, 6.3);
    put(ctx, g.qty, 145, y, 18, 6.3);
    put(ctx, g.notes, 192, y, 47, 5.5);
    put(ctx, g.essence, 248, y, 32, 6.3);
  });

  const other = c.gear.filter((g) => !["weapon", "armor", "cyberware", "bioware"].includes(g.category));
  other.slice(0, other.length > 14 ? 13 : 14).forEach((g, i) => {
    const y = 485 + i * 14.2;
    put(ctx, g.name, 63, y, 192, 7);
    put(ctx, g.qty > 1 ? "x" + g.qty : "-", 266, y, 20, 7);
  });
  if (other.length > 14) put(ctx, "+" + (other.length - 13) + " more (see digital sheet)", 63, 485 + 13 * 14.2, 192, 6);

  const ext = getExt(c);
  if (ext.matrix.link || ext.matrix.deck) {
    const link = ext.matrix.link;
    put(ctx, ext.matrix.deck?.a ?? "-", 352, 220, 22);
    put(ctx, ext.matrix.deck?.s ?? "-", 406, 220, 22);
    put(ctx, link?.d ?? "-", 470, 220, 19);
    put(ctx, link?.f ?? "-", 521, 220, 23);
    put(ctx, link?.name ?? ext.matrix.deck?.name, 365, 236, 181, 6.5);
    rows(ctx, ext.matrix.programs.map((p) => p.name), 365, 250, 179, 12, 3, 6);
  }
  const vehicle = ext.vehicles[0];
  if (vehicle) {
    put(ctx, vehicle.name, 359, 350, 63);
    put(ctx, vehicle.handlingOn + "/" + vehicle.handlingOff, 458, 350, 77);
    put(ctx, vehicle.accel, 371, 362, 46);
    put(ctx, vehicle.speedInterval, 454, 362, 67);
    put(ctx, vehicle.topSpeed, 363, 374, 50);
    put(ctx, vehicle.body, 452, 374, 40);
    put(ctx, vehicle.armor, 353, 386, 53);
    put(ctx, vehicle.pilot, 457, 386, 44);
    put(ctx, vehicle.sensor, 353, 398, 45);
    put(ctx, vehicle.seats, 456, 398, 45);
    put(ctx, vehicle.note, 350, 410, 192, 5.6);
  }

  c.spells.slice(0, 7).forEach((s, i) => {
    const y = 480 + i * 13;
    put(ctx, s, 327, y, 99, 6.6);
    put(ctx, "S", 420, y, 16, 6.5);
  });
  c.adeptPowers.slice(0, 7).forEach((p, i) => {
    const y = 608 + i * 13;
    put(ctx, p.name, 327, y, 107, 6.6);
    put(ctx, p.level ?? 1, 443, y, 36, 6.4);
    put(ctx, p.cost + " PP", 500, y, 40, 6.2);
  });
  // Record overflow without silently claiming the printed sheet is exhaustive.
  if (c.spells.length > 7) put(ctx, "+" + (c.spells.length - 7) + " spells on digital sheet", 327, 572, 208, 5.5);
  if (c.adeptPowers.length > 7) put(ctx, "+" + (c.adeptPowers.length - 7) + " powers on digital sheet", 327, 700, 208, 5.5);
  void d;
}

/** Opens the browser print dialog for two populated copies of the user's sheet.
 * "Save as PDF" in that dialog produces a printable, two-page PDF.
 */
export async function printOfficialSheet(c: Character, d: Derived): Promise<void> {
  const template = await idbGet<StoredTemplate>(KEY);
  if (!template || template.version !== 1 || template.pages?.length !== 2)
    throw new Error("Select your Sixth World rulebook PDF first.");

  const canvases = await Promise.all(template.pages.map(backgroundCanvas));
  const ctx1 = canvases[0].getContext("2d");
  const ctx2 = canvases[1].getContext("2d");
  if (!ctx1 || !ctx2) throw new Error("Canvas printing is not available in this browser.");
  fillFirst(ctx1, c, d);
  fillSecond(ctx2, c, d);

  const images = await Promise.all(canvases.map((canvas) => new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Couldn't render the sheet.")), "image/png"))));
  const urls = images.map((b) => URL.createObjectURL(b));
  const frame = document.createElement("iframe");
  frame.title = "Official Shadowrun character sheet";
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
  document.body.appendChild(frame);
  const release = () => { frame.remove(); urls.forEach((u) => URL.revokeObjectURL(u)); };
  const page = template.pages[0];
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) {
    release(); throw new Error("This browser cannot open the print frame.");
  }
  try {
    doc.open();
    doc.write('<!doctype html><html><head><title>' +
      String(c.alias || c.name || "Runner").replace(/[<>&"]/g, "") +
      ' - Shadowrun sheet</title><style>@page{size:' + page.width + 'pt ' + page.height +
      'pt;margin:0}html,body{padding:0;margin:0;background:white}img{display:block;width:' +
      page.width + 'pt;height:' + page.height + 'pt;page-break-after:always;break-after:page}' +
      'img:last-child{page-break-after:auto;break-after:auto}</style></head><body>' +
      urls.map((u) => '<img src="' + u + '" alt="Filled character sheet">').join("") +
      '</body></html>');
    doc.close();
    await Promise.all(Array.from(doc.images, (img) => img.decode()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    frame.contentWindow.addEventListener("afterprint", release, { once: true });
    frame.contentWindow.focus();
    frame.contentWindow.print();
    // afterprint isn't fired on every mobile browser.
    setTimeout(release, 120000);
  } catch (error) {
    release();
    throw error;
  }
}
