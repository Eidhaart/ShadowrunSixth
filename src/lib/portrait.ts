/** Runner portraits are stored as small JPEG data URLs inside the character, so they ride along in
 *  localStorage, JSON export and the Foundry file without any server. */
export const PORTRAIT_W = 360;
export const PORTRAIT_H = 450; // 4:5, a head-and-shoulders crop
const MAX_INPUT = 25 * 1024 * 1024;
const MAX_STORED = 220_000; // characters of data URL

export function isPortrait(s: unknown): s is string {
  return typeof s === "string" && s.length <= MAX_STORED && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s);
}

async function decode(file: File): Promise<{ src: CanvasImageSource; w: number; h: number; done: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { src: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close() };
    } catch { /* fall back to <img> */ }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error("decode")); img.src = url; });
  return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}

/** Crop to 4:5 (biased toward the top, where faces are), shrink, and encode as JPEG.
 *  `zoom` ≥ 1 crops tighter; `fx` / `fy` (0..1) choose where the crop sits. */
export async function processPortrait(file: File, opts: { zoom?: number; fx?: number; fy?: number } = {}): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("That file is not an image.");
  if (file.size > MAX_INPUT) throw new Error("That image is over 25 MB. Pick a smaller one.");
  let img;
  try { img = await decode(file); } catch { throw new Error("This browser could not read that image. Try a JPEG or PNG."); }
  try {
    const { w, h } = img;
    if (!w || !h) throw new Error("That image has no pixels.");
    const zoom = Math.max(1, opts.zoom ?? 1);
    const ratio = PORTRAIT_W / PORTRAIT_H;
    let cw = w, ch = w / ratio;
    if (ch > h) { ch = h; cw = h * ratio; }
    cw /= zoom; ch /= zoom;
    const sx = (w - cw) * (opts.fx ?? 0.5);
    const sy = (h - ch) * (opts.fy ?? 0.3);
    const cv = document.createElement("canvas");
    cv.width = PORTRAIT_W; cv.height = PORTRAIT_H;
    const g = cv.getContext("2d");
    if (!g) throw new Error("Canvas is unavailable in this browser.");
    g.fillStyle = "#111"; g.fillRect(0, 0, cv.width, cv.height);
    g.imageSmoothingQuality = "high";
    g.drawImage(img.src, sx, sy, cw, ch, 0, 0, PORTRAIT_W, PORTRAIT_H);
    for (const q of [0.86, 0.74, 0.6]) {
      const url = cv.toDataURL("image/jpeg", q);
      if (isPortrait(url)) return url;
    }
    throw new Error("Could not compress that image enough.");
  } finally { img.done(); }
}
