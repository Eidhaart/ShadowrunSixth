import type { GearItem } from "@/lib/sr6/character";
import type { Cell, Sheets } from "./xlsx";
import type { CompCat, CompItem } from "./types";

/** Turns the community "6th World Gear List" workbook into compendium items. Sheets that are still empty
 *  templates simply produce nothing, so a fuller version of the list imports without code changes. */

const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const str = (v: Cell | undefined) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const num = (v: Cell | undefined): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v.replace(/[,¥]/g, "")))) return Number(v.replace(/[,¥]/g, ""));
  return null;
};
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)));

function bookOf(v: Cell | undefined): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  const m = /\(([^)]+)\)\s*(.*)$/.exec(s);
  const short = m?.[1];
  return short === "SWC" ? "Core" : short === "FS" ? "Firing Squad" : m?.[2] || s;
}

/** "4", "2(L)", "3L", "4I" plus an optional legality column → number and legality letter. */
function availOf(availStr: Cell | undefined, availNum?: Cell, legality?: Cell): { avail?: number; legal?: "L" | "I" } {
  const s = str(availStr) || str(availNum);
  const m = /^(\d+)\s*\(?\s*([LIli])?\s*\)?$/.exec(s);
  const avail = m ? Number(m[1]) : num(availNum) ?? undefined;
  let legal = m?.[2]?.toUpperCase() as "L" | "I" | undefined;
  const l = str(legality).toLowerCase();
  if (!legal && l.startsWith("lic")) legal = "L";
  if (!legal && (l.startsWith("il") || l.startsWith("ill"))) legal = "I";
  return { avail: avail ?? undefined, legal };
}

function skillOf(s: string): string | undefined {
  const k = s.toLowerCase();
  if (k.startsWith("close")) return "close-combat";
  if (k.startsWith("firearm")) return "firearms";
  if (k.startsWith("exotic")) return "exotic-weapons";
  if (k.startsWith("athletic")) return "athletics";
  return undefined;
}

function arOf(s: string): (number | null)[] | undefined {
  const parts = s.split("/").map((p) => p.trim());
  if (parts.length !== 5) return undefined;
  return parts.map((p) => (/^\d+$/.test(p) ? Number(p) : null));
}

const dvOf = (s: string) => s.replace(/\s+/g, "").toUpperCase() || undefined;

// ───────────────────────── table sheets ─────────────────────────

interface SheetSpec { cat: CompCat; gear: GearItem["category"]; group?: string }
const SHEETS: Record<string, SheetSpec> = {
  "Melee": { cat: "weapons", gear: "weapon" },
  "Firearms": { cat: "weapons", gear: "weapon" },
  "Throwing  Projectiles": { cat: "weapons", gear: "weapon" },
  "Throwing Projectiles": { cat: "weapons", gear: "weapon" },
  "Explosives": { cat: "weapons", gear: "misc", group: "Explosive" },
  "Weapon Accessories": { cat: "weapons", gear: "misc", group: "Accessory" },
  "Weapon Mods": { cat: "weapons", gear: "misc", group: "Weapon mod" },
  "Armor": { cat: "armor", gear: "armor" },
  "Armor Mods": { cat: "armor", gear: "misc", group: "Armor mod" },
  "Commlinks": { cat: "matrix", gear: "commlink", group: "Commlink" },
  "Cyberdecks": { cat: "matrix", gear: "commlink", group: "Cyberdeck" },
  "Softwares": { cat: "matrix", gear: "misc", group: "Software" },
  "Optical and Image Devices": { cat: "electronics", gear: "misc", group: "Optical device" },
  "Eletronic Accessories": { cat: "electronics", gear: "misc", group: "Accessory" },
  "Visual Enhancements": { cat: "electronics", gear: "misc", group: "Vision enhancement" },
  "Auditory Devices": { cat: "electronics", gear: "misc", group: "Audio device" },
  "Audio Enhancements": { cat: "electronics", gear: "misc", group: "Audio enhancement" },
  "Communication & Countermeasures": { cat: "electronics", gear: "misc", group: "Communications" },
  "Security & Restraints": { cat: "tools", gear: "misc", group: "Security and restraints" },
  "Chemicals": { cat: "tools", gear: "misc", group: "Chemicals" },
  "Breaking & Entering": { cat: "tools", gear: "misc", group: "Breaking and entering" },
  "Survival": { cat: "tools", gear: "misc", group: "Survival" },
  "Biotech": { cat: "tools", gear: "misc", group: "Biotech" },
  "Augmentations": { cat: "augmentations", gear: "cyberware" },
  "Cyberlimbs": { cat: "augmentations", gear: "cyberware", group: "Cyberlimb" },
  "Implant Weapons": { cat: "augmentations", gear: "cyberware", group: "Implant weapon" },
  "Cyberlimb Acessories": { cat: "augmentations", gear: "cyberware", group: "Cyberlimb accessory" },
  "Vehicles": { cat: "vehicles", gear: "vehicle", group: "Vehicle" },
  "Drones": { cat: "vehicles", gear: "vehicle", group: "Drone" },
  "Vehicles Accessories": { cat: "vehicles", gear: "misc", group: "Vehicle accessory" },
  "Vehicles Mods": { cat: "vehicles", gear: "misc", group: "Vehicle mod" },
};

/** Header → stat chip label, for columns that are plain numbers worth showing. */
const STAT_COLS: [string, string][] = [
  ["Device Rating", "Rating"], ["Rating", "Rating"], ["Attack", "Attack"], ["Sleaze", "Sleaze"], ["Data Processing", "Data Proc."], ["Firewall", "Firewall"],
  ["Active Programs Slots", "Programs"], ["DR", "Defense"], ["Social Modifier", "Social"], ["Capacity", "Capacity"], ["Essence", "Essence"],
  ["On Road Handling", "Handling"], ["Off Road Handling", "Off road"], ["Accel", "Accel"], ["Speed Interval", "Speed int."], ["Top Speed", "Top speed"],
  ["Body", "Body"], ["Armor", "Armor"], ["Pilot", "Pilot"], ["Sensor", "Sensor"], ["Seat", "Seats"], ["Mods Slots", "Slots"], ["Blast", "Blast"],
];

function tableSheet(name: string, rows: Cell[][], spec: SheetSpec, source: CompItem["source"]): CompItem[] {
  const hi = rows.findIndex((r) => str(r[0]) === "N");
  if (hi < 0) return [];
  const H = rows[hi].map((h) => str(h));
  const col = (h: string) => H.indexOf(h);
  const get = (r: Cell[], h: string) => (col(h) >= 0 ? r[col(h)] : null);
  const out: CompItem[] = [];
  for (const r of rows.slice(hi + 1)) {
    const nm = str(r[1]);
    const cost = num(get(r, "Cost"));
    if (!nm || cost == null) continue; // template rows without data
    const type = str(get(r, "Type"));
    const group = spec.group && !type ? spec.group : type.replace(/^\(Exotic\)\s*/, "") || spec.group || name;
    const { avail, legal } = availOf(get(r, "Avaibility String"), get(r, "Availability"), get(r, "Legality"));
    const stats: [string, string][] = [];
    const gear: Omit<GearItem, "id"> = { name: nm, category: spec.gear, cost, qty: 1 };
    const item: CompItem = { id: slug(`${spec.cat}-${nm}`), name: nm, cat: spec.cat, group, cost, avail, legal, stats, gear, source };

    if (spec.gear === "weapon") {
      const rawDv = dvOf(str(get(r, "Damage String")) || `${fmt(num(get(r, "DV")) ?? 0)}${str(get(r, "Damage Type"))[1] ?? "P"}`);
      const dv = rawDv && !/^0[A-Z]*$/.test(rawDv) ? rawDv : undefined; // launchers: damage comes from the ammo
      const ar = arOf(str(get(r, "Attack Rating String")));
      const skill = skillOf(str(get(r, "Skill")));
      const modes = str(get(r, "Firing Mode String"));
      const ammo = str(get(r, "Capacity String Final"));
      const elems = ["Eletrical", "Cold", "Chemical", "Fire"].filter((e) => get(r, e) === true).map((e) => (e === "Eletrical" ? "Electrical" : e));
      item.dv = dv; item.ar = ar; item.skill = skill;
      stats.push(["DV", dv ? dv + (elems.length ? ` ${elems.join(", ").toLowerCase()}` : "") : "by ammo"]);
      if (ar) stats.push(["AR", ar.map((v) => (v == null ? "–" : v)).join("/")]);
      if (modes) stats.push(["Modes", modes]);
      if (ammo) stats.push(["Ammo", ammo]);
      if (get(r, "Smartgun") === true) stats.push(["Smartgun", "yes"]);
      Object.assign(gear, { dv, ar: ar as GearItem["ar"], skill: skill ?? "firearms" });
      const lim = [str(get(r, "Case Limitation")), str(get(r, "Ammo Limitation"))].filter(Boolean).join(" ");
      if (modes || ammo || lim) gear.notes = [modes, ammo && `Ammo ${ammo}`, lim && `${lim} only`].filter(Boolean).join(" · ");
    }
    for (const [h, label] of STAT_COLS) {
      if (spec.gear === "weapon" || col(h) < 0) continue;
      const v = get(r, h);
      if (v == null || v === false || v === "" || v === " ") continue;
      stats.push([label, typeof v === "number" ? fmt(v) : str(v)]);
    }
    const ess = num(get(r, "Essence"));
    if (ess != null) { item.essence = ess; gear.essence = ess; }
    if (spec.gear === "armor") { const dr = num(get(r, "DR")); if (dr != null) { gear.armor = dr; gear.worn = true; } }
    item.book = bookOf(get(r, "Book"));
    item.page = num(get(r, "Page")) ?? undefined;
    item.wireless = str(get(r, "Wireless Bonus")) || undefined;
    item.note = str(get(r, "Note")) || undefined;
    out.push(item);
  }
  return out;
}

// ───────────────────────── chart sheets ─────────────────────────
// "Limited Gear Charts" and "Specific Augmentations" hold several small tables side by side. Each starts
// with a title cell, then a header row whose second column begins with "Cost".

interface ChartSpec { cat: CompCat; gear: GearItem["category"]; group: string; name: (row: string) => string; per?: string }
const CHARTS: Record<string, ChartSpec> = {
  "RFID Tags": { cat: "electronics", gear: "misc", group: "RFID tag", name: (r) => `RFID tags, ${r.toLowerCase()}`, per: "per 10" },
  "Tools": { cat: "tools", gear: "misc", group: "Tools", name: (r) => `Tool ${r.toLowerCase()}` },
  "Credsticks": { cat: "identity", gear: "misc", group: "Credstick", name: (r) => `Credstick, ${r.toLowerCase()}` },
  "Fake Sin and Fake License": { cat: "identity", gear: "misc", group: "Fake ID", name: (r) => r.replace(/Sin\b/, "SIN"), per: "per rating" },
  "Sensor Housings": { cat: "electronics", gear: "misc", group: "Sensor housing", name: (r) => `Sensor housing, ${r.toLowerCase()}` },
  "Grapple Gun": { cat: "tools", gear: "misc", group: "Climbing", name: (r) => r },
  "Sensors": { cat: "electronics", gear: "misc", group: "Sensor", name: (r) => r, per: "per rating" },
  "DocWagon Contracts": { cat: "identity", gear: "misc", group: "DocWagon", name: (r) => `DocWagon ${r.replace(/ (Month|Year)$/, "").toLowerCase()} contract, 1 ${/Year$/.test(r) ? "year" : "month"}` },
  "Magical Supplies": { cat: "magic", gear: "magic", group: "Supplies", name: (r) => r.replace(/,\s*per dram/i, "") },
  "Ammos": { cat: "ammo", gear: "ammo", group: "Regular ammo", name: (r) => `${r} rounds`, per: "per 10" },
  "Cyberjacks": { cat: "augmentations", gear: "cyberware", group: "Headware", name: (r) => `Cyberjack ${r.replace(/^Rating\s*/i, "")}` },
  "Bone Lacing": { cat: "augmentations", gear: "cyberware", group: "Bodyware", name: (r) => `Bone lacing, ${r.toLowerCase().replace("alumiun", "aluminum")}` },
  "Bone Density": { cat: "augmentations", gear: "bioware", group: "Bioware", name: (r) => `Bone density augmentation, rating ${r}` },
};

const CHART_STATS: Record<string, string> = {
  "Device Rating": "Rating", "Max Value": "Holds", "Max Capacity": "Capacity", "Max Rating": "Max rating", "Data Processing": "Data Proc.",
  "Firewall": "Firewall", "VR Matrix Bonus": "VR init dice", "Essence": "Essence", "Body": "Body", "Defense": "Defense", "Unarmed DV": "Unarmed DV",
  "Unarmed AR": "Unarmed AR", "DV": "Unarmed DV", "AR": "Unarmed AR",
};

function chartSheet(rows: Cell[][], source: CompItem["source"]): CompItem[] {
  const out: CompItem[] = [];
  for (let r = 0; r + 1 < rows.length; r++) {
    const head = rows[r + 1] ?? [];
    for (let c = 0; c < head.length; c++) {
      if (!/^Cost/i.test(str(head[c + 1])) || !str(head[c])) continue;
      const title = str(rows[r]?.[c]);
      const spec = CHARTS[title];
      if (!spec) continue;
      const H: string[] = [];
      for (let k = c; k < head.length && str(head[k]); k++) H.push(str(head[k]));
      const at = (row: Cell[], h: string) => { const i = H.indexOf(h); return i >= 0 ? row[c + i] : null; };
      for (let k = r + 2; k < rows.length; k++) {
        const row = rows[k] ?? [];
        const key = row[c];
        const label = typeof key === "number" ? fmt(key) : str(key);
        const cost = num(row[c + 1]);
        if (!label || cost == null) break;
        const name = spec.name(label);
        const { avail, legal } = availOf(at(row, "Availability"));
        const stats: [string, string][] = [];
        for (const h of H.slice(2)) {
          const lab = CHART_STATS[h];
          const v = at(row, h);
          if (lab && v != null && v !== "") stats.push([lab, typeof v === "number" ? fmt(v) : str(v)]);
        }
        const gear: Omit<GearItem, "id"> = { name, category: spec.gear, cost, qty: 1 };
        const ess = num(at(row, "Essence")) ?? num(String(at(row, "Essence") ?? "").replace(/\(.*$/, ""));
        const item: CompItem = { id: slug(`${spec.cat}-${name}`), name, cat: spec.cat, group: spec.group, cost, per: spec.per, avail, legal, stats, gear, source };
        if (ess != null) { item.essence = ess; gear.essence = ess; }
        if (title === "Cyberjacks") item.equip = { kind: "cyberjack", index: Number(label.replace(/\D/g, "")) - 1 };
        if (title === "Bone Lacing" || title === "Bone Density") {
          const def = num(at(row, "Defense")) ?? num(at(row, "AR"));
          if (title === "Bone Lacing" && def) gear.effect = { defense: def };
        }
        item.book = bookOf(at(row, "Book"));
        item.page = num(at(row, "Page")) ?? undefined;
        item.wireless = str(at(row, "Wireless Bonus")) || undefined;
        item.note = str(at(row, "Note")) || undefined;
        out.push(item);
      }
    }
  }
  return out;
}

export function normalize(sheets: Sheets, source: CompItem["source"] = "imported"): CompItem[] {
  const items: CompItem[] = [];
  for (const [name, rows] of Object.entries(sheets)) {
    const spec = SHEETS[name];
    if (spec) items.push(...tableSheet(name, rows, spec, source));
    else if (/Limited Gear Charts|Specific Augmentations/i.test(name)) items.push(...chartSheet(rows, source));
  }
  const seen = new Map<string, number>();
  for (const it of items) { // keep ids unique if the list repeats a name
    const n = seen.get(it.id) ?? 0;
    seen.set(it.id, n + 1);
    if (n) it.id = `${it.id}-${n + 1}`;
  }
  return items;
}
