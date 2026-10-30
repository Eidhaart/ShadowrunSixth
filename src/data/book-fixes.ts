/**
 * Corrections to the community gear list where it differs from the core rulebook tables
 * (Seattle edition pages). Applied on load, so a rebuilt or imported list gets them too.
 */

type Ar = (number | null)[];
interface Fix {
  name?: string;
  cost?: number;
  avail?: number;
  /** null clears the license or illegal mark. */
  legal?: "L" | "I" | null;
  ar?: Ar;
  dv?: string;
  modes?: string;
  ammo?: string;
}

/** Launchers have no Close range Attack Rating (p. 259); the list printed 0 there. */
const launcher = (ar: Ar): Fix => ({ ar: [null, ...ar.slice(1)] });

export const BOOK_FIXES: Record<string, Fix> = {
  // p. 251 hold-outs: no Medium range, no license
  "weapons-streetline-special": { ar: [8, 8, null, null, null], legal: null },
  "weapons-walther-palm-pistol": { ar: [12, 7, null, null, null], legal: null },
  // p. 256 shotguns; the short barrel is a version of the T-250 with DV 3 and AR 8/8/4 only
  "weapons-pjss-model-55": { ammo: "2(b)" },
  "weapons-remington-roomsweeper": { ammo: "8(m)" },
  "weapons-defiance-t-250-short-barrel": { cost: 330, avail: 2, legal: "L", modes: "SS/SA", ammo: "5(m)" },
  // p. 257 rifles, sniper rifles and the assault cannon
  "weapons-yamaha-raiden-shotgun": { ammo: "2(b)" },
  "weapons-ares-desert-strike": { legal: "I" },
  "weapons-cavalier-arms-crockett-ebr": { legal: "I" },
  "weapons-ranger-arms-sm-5": { legal: "I" },
  "weapons-remington-900": { ammo: "5(m)" },
  "weapons-ruger-101": { ammo: "8(m)" },
  "weapons-barret-model-122": { legal: "I" },
  "weapons-panther-xxl": { ar: [1, 9, 12, 8, 6], legal: "I" },
  // p. 259 launchers
  "weapons-ares-antioch-ii": launcher([0, 6, 8, 6, 5]),
  "weapons-armtech-mgl-6": launcher([0, 8, 8, 3, null]),
  "weapons-armtech-mgl-12": { ...launcher([0, 8, 9, 6, 2]), ammo: "12(c)" },
  "weapons-aztechnology-strkier": { ...launcher([0, 4, 10, 9, 6]), name: "Aztechnology Striker" },
  "weapons-onotari-interceptor": launcher([0, 5, 9, 10, 8]),
};

const arText = (ar: Ar) => ar.map((v) => (v == null ? "–" : String(v))).join("/");

interface Fixable {
  id: string;
  name: string;
  cost?: number | null;
  avail?: number;
  legal?: "L" | "I";
  stats?: [string, string][];
  ar?: Ar;
  dv?: string;
  gear?: { name: string; cost: number; ar?: Ar; dv?: string; notes?: string };
}

/** The item with the book's numbers, or the item itself when it needs no fix. */
export function withBookFix<T extends Fixable>(item: T): T {
  const f = BOOK_FIXES[item.id];
  if (!f) return item;
  const out: T = JSON.parse(JSON.stringify(item));
  const setStat = (k: string, v: string) => {
    if (!out.stats) return;
    const row = out.stats.find((s) => s[0] === k);
    if (row) row[1] = v;
  };
  if (f.name) { out.name = f.name; if (out.gear) out.gear.name = f.name; }
  if (f.cost != null) { out.cost = f.cost; if (out.gear) out.gear.cost = f.cost; }
  if (f.avail != null) out.avail = f.avail;
  if (f.legal !== undefined) { if (f.legal) out.legal = f.legal; else delete out.legal; }
  if (f.ar) { if ("ar" in out) out.ar = f.ar; if (out.gear) out.gear.ar = f.ar; setStat("AR", arText(f.ar)); }
  if (f.dv) { if ("dv" in out) out.dv = f.dv; if (out.gear) out.gear.dv = f.dv; setStat("DV", f.dv); }
  if (f.modes) setStat("Modes", f.modes);
  if (f.ammo) setStat("Ammo", f.ammo);
  if (out.gear?.notes && (f.modes || f.ammo)) {
    const modes = f.modes ?? out.stats?.find((s) => s[0] === "Modes")?.[1];
    const ammo = f.ammo ?? out.stats?.find((s) => s[0] === "Ammo")?.[1];
    out.gear.notes = out.gear.notes.replace(/^[A-Z/]+ · Ammo [^ ·]+/, `${modes} · Ammo ${ammo}`);
  }
  return out;
}
