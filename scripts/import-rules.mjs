// Usage: npx tsx scripts/import-rules.mjs <path-to-rulebook.pdf>
// Writes data/rulebook.local.json (gitignored). The dev server serves it at /api/rulebook.
import fs from "node:fs";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractRulebook } from "../src/lib/rules/extract.ts";

const file = process.argv[2];
if (!file) {
  console.error("usage: import-rules <rulebook.pdf>");
  process.exit(1);
}
const data = new Uint8Array(fs.readFileSync(file));
const pdf = await getDocument({ data, useSystemFonts: true, verbosity: 0 }).promise;
let last = 0;
const book = await extractRulebook(pdf, {
  title: path.basename(file),
  onProgress: ({ page, total }) => {
    if (page - last >= 25 || page === total) {
      process.stdout.write(`\rpage ${page}/${total}`);
      last = page;
    }
  },
});
fs.mkdirSync("data", { recursive: true });
fs.writeFileSync("data/rulebook.local.json", JSON.stringify(book));
console.log(`\n${book.sections.length} sections, ${book.chapters.length} chapters -> data/rulebook.local.json`);
