/** Rebuild src/data/gear-core.json from a copy of the community 6th World Gear List.
 *  Usage: npx tsx scripts/build-gear.ts path/to/6th_World_Gear_List.xlsx
 *  Only game statistics are bundled; wireless bonus and note text stay with whoever imports the file. */
import { readFileSync, writeFileSync } from "node:fs";
import { readXlsx } from "../src/lib/compendium/xlsx";
import { normalize } from "../src/lib/compendium/normalize";

const file = process.argv[2];
if (!file) { console.error("Pass the .xlsx path."); process.exit(1); }
const items = normalize(readXlsx(new Uint8Array(readFileSync(file))), "built-in").map((i) => {
  const { wireless, note, ...rest } = i;
  return { ...rest, hasText: Boolean(wireless || note) };
});
writeFileSync(new URL("../src/data/gear-core.json", import.meta.url), JSON.stringify(items));
const by: Record<string, number> = {};
for (const i of items) by[i.cat] = (by[i.cat] ?? 0) + 1;
console.log(items.length, "items", by);
