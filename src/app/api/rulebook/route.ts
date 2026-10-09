import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Convenience for local use: if you ran `npm run import:rules`, the extracted
 * rulebook is served to your own browser. It is disabled in production builds
 * unless SIXTHDECK_SERVE_RULEBOOK=1, so a public deployment never redistributes
 * book text. Each visitor imports their own PDF in the browser instead.
 */
export async function GET() {
  const allowed = process.env.NODE_ENV !== "production" || process.env.SIXTHDECK_SERVE_RULEBOOK === "1";
  if (!allowed) return new Response("Not available", { status: 404 });
  try {
    const file = path.join(process.cwd(), "data", "rulebook.local.json");
    const body = await readFile(file, "utf8");
    return new Response(body, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch {
    return new Response("No local rulebook", { status: 404 });
  }
}
