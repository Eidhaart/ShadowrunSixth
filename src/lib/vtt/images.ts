/** Shrink an uploaded picture for the table: maps keep detail, tokens stay small. Transparency survives on tokens. */
export async function loadImage(file: File, kind: "map" | "token" | "handout"): Promise<{ data: string; w: number; h: number }> {
  if (!file.type.startsWith("image/")) throw new Error("That file is not an image.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error("This browser could not read that image.")); img.src = url; });
    const max = kind === "map" ? 2600 : kind === "handout" ? 1400 : 300;
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k));
    const h = Math.max(1, Math.round(img.naturalHeight * k));
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const g = cv.getContext("2d");
    if (!g) throw new Error("Canvas is unavailable.");
    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, w, h);
    let data = kind === "token" ? cv.toDataURL("image/webp", 0.85) : cv.toDataURL("image/jpeg", 0.82);
    if (kind === "token" && !data.startsWith("data:image/webp")) data = cv.toDataURL("image/png");
    if (data.length > 6_000_000) data = cv.toDataURL("image/jpeg", 0.6);
    return { data, w: img.naturalWidth, h: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}
