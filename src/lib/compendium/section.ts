import type { CompItem } from "./types";

export type Sec = { id: string; title: string; text: string; page: number; chapter?: string; parent?: string };

/**
 * The rulebook section that describes this item. Its own heading first, then a section that names
 * it near the printed page, then its type's heading ("Small Drones"), and only then the page itself.
 */
export function sectionFor(sections: Sec[], item: CompItem): Sec | undefined {
  const norm = (x: string) => x.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  // "Power foci" and "Cyberlimbs" are headings for "Power focus" and "Cyberlimb"
  const one = (x: string) => norm(x).replace(/\bfoci\b/g, "focus").replace(/(\w{3})s\b/g, "$1");
  // table and stat-block headings list many items; they are a last resort
  const listing = (x: Sec) => /\b(table|stats|list)\b/i.test(x.title);
  // "Dermal plating, rating 2" and "Cyberarm, obvious" are described under their base name
  const base = norm(item.name.split(",")[0].replace(/\(.*?\)/g, "")).replace(/ \d+$/, "");
  const near = (x: Sec) => !item.page || Math.abs(x.page - item.page) <= 12;
  const gear = sections.filter((x) => x.chapter === "Gear" || near(x));
  const byTitle = gear.find((x) => one(x.title) === one(base)) ?? gear.find((x) => near(x) && !listing(x) && base.length > 3 && one(x.title).includes(one(base)));
  if (byTitle) return byTitle;
  const group = one(item.group);
  // implants are described under their kind ("cyber implant weapons", "Cyberlimbs"), not one by one
  if ((item.cat === "cyberware" || item.cat === "bioware") && group.length > 2) {
    const g = gear.find((x) => near(x) && !listing(x) && (one(x.title) === group || one(x.title).includes(group) || group.includes(one(x.title)) && one(x.title).length > 6));
    if (g) return g;
  }
  const byText = gear.filter((x) => x.chapter === "Gear" && near(x) && !listing(x) && base.length > 3 && norm(x.text).includes(base)).sort((a, b) => Math.abs(a.page - (item.page ?? a.page)) - Math.abs(b.page - (item.page ?? b.page)))[0];
  if (byText) return byText;
  const byGroup = group.length > 2 ? gear.find((x) => near(x) && one(x.title) === group) : undefined;
  if (byGroup) return byGroup;
  return item.page ? sections.find((x) => x.page === item.page && x.chapter === "Gear") ?? sections.find((x) => x.page === item.page) : undefined;
}

