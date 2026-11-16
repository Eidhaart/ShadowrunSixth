/**
 * The rest of the core rulebook's gear tables: projectile weapons, weapon accessories, special ammunition,
 * grenades, rockets, explosives, clothing and armor modifications, electronics accessories, communications,
 * software, optical and audio devices, security gear, breaking and entering gear, chemicals, survival gear,
 * biotech, toxins, drugs and vehicle modifications.
 *
 * Names and numbers only, read from the tables in the Seattle City Edition. No rules text.
 */
import type { CompCat } from "@/lib/compendium/types";

type Num = number | ((rating: number) => number);

export interface MoreRow {
  n: string;
  cat: CompCat;
  g: string;
  /** Availability as printed: "3", "4(L)", "5(I)". A function for gear whose availability follows its rating. */
  a: string | ((rating: number) => string);
  /** Nuyen, or a function of the rating. */
  c: Num;
  /** Book page. */
  p: number;
  /** Rated or capacity-priced gear: one entry per value from lo to hi. */
  r?: [number, number];
  /** What the number in `r` is called on the stat chip. */
  rl?: "Rating" | "Capacity";
  /** Price note: "per 10", "per dose"… */
  per?: string;
  /** Extra stat chips. */
  s?: [string, string][];
  /** Weapons. */
  dv?: string | ((rating: number) => string);
  ar?: (number | null)[] | ((rating: number) => (number | null)[]);
  skill?: string;
  /** Armor: Defense Rating bonus while worn. */
  dr?: number;
  /** Sheet category when it is not the obvious one. */
  gc?: "weapon" | "armor" | "misc" | "ammo" | "commlink" | "vehicle";
}

const up = (n: number) => Math.ceil(n - 1e-9);
const x = (per: number) => (r: number) => r * per;

const W = "weapons", E = "electronics", T = "tools";

export const MORE_GEAR: MoreRow[] = [
  // throwing weapons and projectiles (p. 250). Fractions round up, as on the archetype's Rating 5 bow.
  { n: "Bow", cat: W, g: "Bow and crossbow", r: [1, 10], a: (r) => `${up(r / 3)}(L)`, c: (r) => 100 + r * 10, p: 250, skill: "athletics",
    dv: (r) => `${up(r / 2)}P`, ar: (r) => [up(r / 2), r, up(r / 4), null, null] },
  { n: "Arrows", cat: "ammo", g: "Arrows and bolts", r: [1, 10], a: (r) => String(up(r / 3)), c: x(2), p: 250, per: "each" },
  { n: "Injection arrows", cat: "ammo", g: "Arrows and bolts", r: [1, 10], a: "4", c: x(20), p: 250, per: "each" },
  { n: "Crossbow, light", cat: W, g: "Bow and crossbow", a: "3", c: 150, p: 250, skill: "athletics", dv: "2P", ar: [6, 8, 2, null, null] },
  { n: "Crossbow, standard", cat: W, g: "Bow and crossbow", a: "3(L)", c: 290, p: 250, skill: "athletics", dv: "3P", ar: [2, 10, 4, 2, null] },
  { n: "Crossbow, heavy", cat: W, g: "Bow and crossbow", a: "4(L)", c: 425, p: 250, skill: "athletics", dv: "4P", ar: [2, 8, 6, 4, null] },
  { n: "Bolts", cat: "ammo", g: "Arrows and bolts", a: "2", c: 5, p: 250, per: "each" },
  { n: "Injection bolts", cat: "ammo", g: "Arrows and bolts", a: "4", c: 50, p: 250, per: "each" },
  { n: "Throwing knives", cat: W, g: "Throwing weapon", a: "2", c: 155, p: 250, skill: "athletics", dv: "2P", ar: [10, 9, 3, null, null] },
  { n: "Throwing stars", cat: W, g: "Throwing weapon", a: "2", c: 160, p: 250, skill: "athletics", dv: "2P", ar: [9, 11, 5, null, null] },

  // weapon accessories (p. 261)
  ...([
    ["Airburst link", "—", "3", 600], ["Bipod", "Under", "1", 200], ["Concealable holster", "—", "1", 150], ["Gas-vent system", "Barrel", "3", 500],
    ["Gyro mount", "Under", "3", 1400], ["Hidden arm slide", "—", "2", 350], ["Imaging scope", "Top", "1", 350], ["Laser sight", "Top or under", "1", 125],
    ["Periscope", "Top", "2", 70], ["Quick-draw holster", "—", "2", 175], ["Shock pad", "—", "2", 50], ["Silencer/suppressor", "Barrel", "4", 500],
    ["Smart firing platform", "Under", "5", 2500], ["Smartgun system, internal", "—", "1(L)", 500], ["Smartgun system, external", "Top or under", "2(L)", 200],
    ["Spare clip", "—", "2", 5], ["Speed loader", "—", "1", 25], ["Tripod", "Under", "2", 500],
  ] as [string, string, string, number][]).map(([n, mount, a, c]): MoreRow => ({ n, cat: W, g: "Weapon accessory", a, c, p: 261, s: mount === "—" ? [] : [["Mount", mount]] })),

  // grenades (p. 263): DV at ground zero / close / near
  ...([
    ["Stun grenade", "10S/8S/6S", "15 m", "4(L)", 100], ["Fragmentation grenade", "16P/12P/8P", "20 m", "4(I)", 150], ["High explosive grenade", "16P/10P/4P", "15 m", "4(I)", 150],
    ["Gas grenade", "", "", "4(I)", 50], ["Smoke grenade", "", "", "4(I)", 50], ["Thermal smoke grenade", "", "", "4(I)", 50], ["Flash-pak", "", "10 m", "4(L)", 125],
  ] as [string, string, string, string, number][]).map(([n, dv, blast, a, c]): MoreRow => ({
    n, cat: W, g: "Grenade", a, c, p: 263, gc: "ammo", per: n === "Gas grenade" ? "plus 20 doses of the chemical" : undefined,
    s: [...(dv ? [["DV GZ/close/near", dv] as [string, string]] : []), ...(blast ? [["Blast", blast] as [string, string]] : [])] })),
  // rockets (p. 264); a missile is the same rocket with a sensor
  ...([
    ["Anti-vehicle rocket", "12P/8P/4P", "10 m", "5(I)", 2800], ["Fragmentation rocket", "16P/12P/8P", "30 m", "5(I)", 2000], ["High explosive rocket", "16P/10P/4P", "20 m", "5(I)", 2100],
    ["Gas rocket", "", "", "4(I)", 750], ["Smoke rocket", "", "", "4(I)", 1200], ["Thermal smoke rocket", "", "", "4(I)", 1200],
  ] as [string, string, string, string, number][]).map(([n, dv, blast, a, c]): MoreRow => ({
    n, cat: W, g: "Rocket and missile", a, c, p: 264, gc: "ammo", per: n === "Gas rocket" ? "plus 100 doses of the chemical" : undefined,
    s: [...(dv ? [["DV GZ/close/near", dv] as [string, string]] : []), ...(blast ? [["Blast", blast] as [string, string]] : [])] })),
  { n: "Explosive package", cat: W, g: "Explosives", r: [1, 20], p: 264, gc: "ammo",
    a: (r) => `${r <= 3 ? 1 : r <= 6 ? 2 : r <= 9 ? 3 : r <= 12 ? 4 : r <= 15 ? 5 : r <= 18 ? 6 : 7}(I)`,
    c: (r) => r * (r <= 3 ? 10 : r <= 6 ? 50 : r <= 9 ? 100 : r <= 12 ? 250 : r <= 15 ? 500 : r <= 18 ? 1000 : 5000) },
  { n: "Detonator cap", cat: W, g: "Explosives", a: "4(I)", c: 75, p: 264, gc: "ammo" },

  // clothing and armor modifications (pp. 265-266), cloaks from the Seattle pages
  { n: "Clothing", cat: "armor", g: "Clothing", a: "1", c: 10, p: 265, per: "10¥ to 10,000¥", gc: "misc" },
  { n: "Electrochromic feature", cat: "armor", g: "Clothing", a: "1", c: 75, p: 265, gc: "misc" },
  { n: "Feedback feature", cat: "armor", g: "Clothing", a: "2", c: 150, p: 265, gc: "misc" },
  { n: "Disposable cloak", cat: "armor", g: "Clothing", a: "1", c: 5, p: 335, gc: "misc" },
  { n: "Armorweave cloak", cat: "armor", g: "Armor", a: "2", c: 200, p: 335, dr: 1, s: [["Capacity", "4"]] },
  { n: "Trés Chic cloak", cat: "armor", g: "Armor", a: "4", c: 5000, p: 335, dr: 1, s: [["Capacity", "5"]] },
  { n: "Chemical protection", cat: "armor", g: "Armor modification", r: [1, 6], a: "3", c: x(250), p: 266, s: [["Capacity", "[Rating]"]], gc: "misc" },
  { n: "Chemical seal", cat: "armor", g: "Armor modification", a: "5", c: 3000, p: 266, s: [["Capacity", "[6]"]], gc: "misc" },
  { n: "Cold resistance", cat: "armor", g: "Armor modification", r: [1, 6], a: "3", c: x(250), p: 266, s: [["Capacity", "[Rating]"]], gc: "misc" },
  { n: "Fire resistance", cat: "armor", g: "Armor modification", r: [1, 6], a: "3", c: x(250), p: 266, s: [["Capacity", "[Rating]"]], gc: "misc" },
  { n: "Electricity resistance", cat: "armor", g: "Armor modification", r: [1, 6], a: "3", c: x(250), p: 266, s: [["Capacity", "[Rating]"]], gc: "misc" },

  // electronics accessories (p. 268)
  ...([
    ["AR gloves", 3, "1", 150], ["Biometric reader", 3, "2", 200], ["Electronic paper", 1, "1", 5], ["Printer", 3, "1", 25], ["Satellite link", 4, "3", 500],
    ["Sim module", 0, "1", 100], ["Sim module, hot-sim", 0, "2(I)", 250], ["Simrig (worn)", 3, "4", 1000], ["Subvocal mic", 3, "2", 50], ["Trid projector", 3, "1", 200], ["Trodes", 3, "1", 70],
  ] as [string, number, string, number][]).map(([n, dr, a, c]): MoreRow => ({ n, cat: E, g: "Accessory", a, c, p: 268, s: dr ? [["Device rating", String(dr)]] : [] })),

  // communications and countermeasures (p. 271)
  { n: "Bug scanner", cat: E, g: "Communications", a: "3", c: 200, p: 271 },
  { n: "Data tap", cat: E, g: "Communications", a: "2", c: 300, p: 271 },
  { n: "Headjammer", cat: E, g: "Communications", r: [1, 6], a: "5(I)", c: x(150), p: 271 },
  { n: "Jammer, area", cat: E, g: "Communications", r: [1, 6], a: "4(L)", c: x(200), p: 271 },
  { n: "Jammer, directional", cat: E, g: "Communications", r: [1, 6], a: "4(L)", c: x(200), p: 271 },
  { n: "Micro-transceiver", cat: E, g: "Communications", a: "1", c: 100, p: 271 },
  { n: "Tag eraser", cat: E, g: "Communications", a: "3", c: 450, p: 271 },
  { n: "White noise generator", cat: E, g: "Communications", r: [1, 6], a: "3", c: x(50), p: 271 },

  // software (p. 272)
  { n: "Autosoft", cat: "matrix", g: "Software", r: [1, 9], a: (r) => String(r), c: x(500), p: 272 },
  { n: "Cyberprogram, basic", cat: "matrix", g: "Software", a: "1", c: 60, p: 272 },
  { n: "Cyberprogram, hacking", cat: "matrix", g: "Software", a: "4(I)", c: 250, p: 272 },
  { n: "Datasoft", cat: "matrix", g: "Software", a: "2", c: 120, p: 272 },
  { n: "Mapsoft", cat: "matrix", g: "Software", a: "2", c: 100, p: 272 },
  { n: "Shopsoft", cat: "matrix", g: "Software", a: "2", c: 150, p: 272 },
  { n: "Activesoft", cat: "matrix", g: "Skillsoft", r: [1, 6], a: "4", c: x(5000), p: 272 },
  { n: "Knowsoft", cat: "matrix", g: "Skillsoft", a: "2", c: 2500, p: 272 },
  { n: "Linguasoft", cat: "matrix", g: "Skillsoft", r: [1, 4], a: "1", c: x(1500), p: 272 },
  { n: "Tutorsoft", cat: "matrix", g: "Skillsoft", r: [1, 6], a: (r) => String(up(r / 3)), c: x(400), p: 272 },

  // optical and imaging devices (p. 274): the price follows the Capacity
  { n: "Binoculars", cat: E, g: "Optical device", r: [1, 3], rl: "Capacity", a: "1", c: x(50), p: 274 },
  { n: "Binoculars, optical", cat: E, g: "Optical device", a: "1", c: 50, p: 274 },
  { n: "Camera", cat: E, g: "Optical device", r: [1, 6], rl: "Capacity", a: "1", c: x(100), p: 274 },
  { n: "Micro-camera", cat: E, g: "Optical device", a: "1", c: 100, p: 274, s: [["Capacity", "1"]] },
  { n: "Contacts", cat: E, g: "Optical device", r: [1, 3], rl: "Capacity", a: "2", c: x(200), p: 274 },
  { n: "Endoscope", cat: E, g: "Optical device", a: "3", c: 250, p: 274 },
  { n: "Glasses", cat: E, g: "Optical device", r: [1, 4], rl: "Capacity", a: "1", c: x(100), p: 274 },
  { n: "Goggles", cat: E, g: "Optical device", r: [1, 6], rl: "Capacity", a: "1", c: x(50), p: 274 },
  { n: "Imaging scope (device)", cat: E, g: "Optical device", a: "1", c: 300, p: 274, s: [["Capacity", "3"]] },
  { n: "Monocle", cat: E, g: "Optical device", r: [1, 4], rl: "Capacity", a: "1", c: x(120), p: 274 },
  { n: "Mage sight goggles", cat: E, g: "Optical device", a: "5", c: 3000, p: 274 },
  { n: "Periscope (device)", cat: E, g: "Optical device", a: "2", c: 50, p: 274 },
  // visual enhancements (p. 275): added to a device's Capacity
  ...([
    ["Flare compensation", 1, "1", 250], ["Image link", 1, "1", 25], ["Low-light vision", 1, "2", 500], ["Smartlink", 2, "2", 2000],
    ["Thermographic vision", 1, "2", 500], ["Ultrasound link", 1, "1", 300], ["Vision enhancement", 2, "1", 500], ["Vision magnification", 1, "1", 250],
  ] as [string, number, string, number][]).map(([n, cap, a, c]): MoreRow => ({ n: `${n} (device)`, cat: E, g: "Visual enhancement", a, c, p: 275, s: [["Capacity", `[${cap}]`]] })),
  // auditory devices and enhancements (p. 276)
  { n: "Directional microphone", cat: E, g: "Audio device", r: [1, 6], rl: "Capacity", a: "2", c: x(50), p: 276 },
  { n: "Earbuds", cat: E, g: "Audio device", r: [1, 3], rl: "Capacity", a: "1", c: x(50), p: 276 },
  { n: "Headphones", cat: E, g: "Audio device", r: [1, 6], rl: "Capacity", a: "1", c: x(50), p: 276 },
  { n: "Laser microphone", cat: E, g: "Audio device", r: [1, 6], rl: "Capacity", a: "2", c: x(100), p: 276 },
  { n: "Omnidirectional microphone", cat: E, g: "Audio device", r: [1, 6], rl: "Capacity", a: "1", c: x(50), p: 276 },
  { n: "Audio enhancement (device)", cat: E, g: "Audio enhancement", a: "1", c: 500, p: 276, s: [["Capacity", "[1]"]] },
  { n: "Select sound filter (device)", cat: E, g: "Audio enhancement", r: [1, 3], a: "3", c: x(250), p: 276, s: [["Capacity", "[Rating]"]] },
  { n: "Spatial recognizer (device)", cat: E, g: "Audio enhancement", a: "2", c: 1000, p: 276, s: [["Capacity", "[2]"]] },

  // security devices and restraints (p. 278)
  { n: "Key lock", cat: T, g: "Security", r: [1, 6], a: "2", c: x(10), p: 278 },
  { n: "Maglock", cat: T, g: "Security", r: [1, 9], a: "3", c: x(100), p: 278 },
  { n: "Maglock keypad", cat: T, g: "Security", a: "1", c: 50, p: 278 },
  { n: "Maglock card reader", cat: T, g: "Security", a: "1", c: 50, p: 278 },
  { n: "Maglock biometric reader", cat: T, g: "Security", a: "2", c: 200, p: 278 },
  { n: "Containment manacles", cat: T, g: "Restraints", a: "3", c: 250, p: 278 },
  { n: "Metal restraints", cat: T, g: "Restraints", a: "1", c: 20, p: 278 },
  { n: "Plasteel restraints", cat: T, g: "Restraints", a: "2", c: 50, p: 278 },
  { n: "Plastic straps", cat: T, g: "Restraints", a: "1", c: 5, p: 278, per: "per 10" },
  // breaking and entering gear (p. 279)
  { n: "Autopicker", cat: T, g: "Breaking and entering", a: "4(L)", c: 500, p: 279 },
  { n: "Cellular glove molder", cat: T, g: "Breaking and entering", r: [1, 4], a: "6(I)", c: x(500), p: 279 },
  { n: "Chisel/wrecking bar", cat: T, g: "Breaking and entering", a: "1", c: 20, p: 279 },
  { n: "Keycard copier", cat: T, g: "Breaking and entering", a: "4(I)", c: 600, p: 279 },
  { n: "Lockpick set", cat: T, g: "Breaking and entering", a: "2", c: 250, p: 279 },
  { n: "Maglock passkey", cat: T, g: "Breaking and entering", r: [1, 4], a: "3(I)", c: x(2000), p: 279 },
  { n: "Miniwelder", cat: T, g: "Breaking and entering", a: "1", c: 250, p: 279 },
  { n: "Miniwelder fuel canister", cat: T, g: "Breaking and entering", a: "1", c: 80, p: 279 },
  { n: "Monofilament chainsaw", cat: T, g: "Breaking and entering", a: "3", c: 500, p: 279 },
  { n: "Sequencer", cat: T, g: "Breaking and entering", r: [1, 6], a: "4(I)", c: x(250), p: 279 },
  // industrial chemicals (p. 279)
  { n: "Glue solvent", cat: T, g: "Chemicals", a: "1", c: 90, p: 279 },
  { n: "Glue sprayer", cat: T, g: "Chemicals", a: "1", c: 150, p: 279 },
  { n: "Thermite burning bar", cat: T, g: "Chemicals", a: "5(L)", c: 500, p: 279 },
  // survival gear (p. 280)
  { n: "Chemsuit", cat: T, g: "Survival", r: [1, 6], a: "4", c: x(150), p: 280 },
  ...([
    ["Climbing gear", "1", 200], ["Diving gear", "3", 2000], ["Flashlight", "1", 25], ["Gas mask", "1", 200], ["Gecko tape gloves", "3", 250], ["Hazmat suit", "3", 3000],
    ["Light stick", "1", 25], ["Magnesium torch/flare", "1", 5], ["Microflare launcher", "1", 175], ["Microflares", "1", 25], ["Rappelling gloves", "1", 50], ["Survival kit", "2", 200],
  ] as [string, string, number][]).map(([n, a, c]): MoreRow => ({ n, cat: T, g: "Survival", a, c, p: 280 })),
  { n: "Respirator", cat: T, g: "Survival", r: [1, 6], a: "1", c: x(50), p: 280 },
  // biotech (p. 282)
  { n: "Biomonitor", cat: T, g: "Biotech", a: "2", c: 300, p: 282 },
  { n: "Disposable syringe", cat: T, g: "Biotech", a: "2", c: 10, p: 282 },
  { n: "Medkit", cat: T, g: "Biotech", r: [1, 6], a: "3", c: x(250), p: 282 },
  { n: "Medkit supplies", cat: T, g: "Biotech", a: "1", c: 100, p: 282 },
  { n: "Antidote patch", cat: T, g: "Slap patch", a: "3", c: 150, p: 282 },
  { n: "Chem patch", cat: T, g: "Slap patch", a: "3", c: 200, p: 282 },
  { n: "Stim patch", cat: T, g: "Slap patch", r: [1, 6], a: "3", c: x(25), p: 282 },
  { n: "Tranq patch", cat: T, g: "Slap patch", r: [1, 12], a: "3", c: (r) => r * r * 10, p: 282 },
  { n: "Trauma patch", cat: T, g: "Slap patch", a: "3", c: 500, p: 282 },
  // toxins and drugs (p. 122), per dose
  ...([
    ["CS/tear gas", "2(L)", 20], ["Gamma-scopolamine", "7(I)", 200], ["Narcoject", "4(L)", 50], ["Nausea gas", "3(L)", 25], ["Neuro-Stun VIII", "5(L)", 60],
    ["Neuro-Stun IX", "6(L)", 60], ["Neuro-Stun X", "7(L)", 100], ["Pepper Punch", "0", 5], ["Seven-7", "10(I)", 1000],
  ] as [string, string, number][]).map(([n, a, c]): MoreRow => ({ n, cat: T, g: "Toxin", a, c, p: 122, per: "per dose" })),
  ...([
    ["Bliss", "2(I)", 15], ["Cram", "2(L)", 10], ["Deepweed", "4(I)", 400], ["Jazz", "2(L)", 75], ["Kamikaze", "3(L)", 100], ["Long Haul", "0", 50],
    ["Nitro", "2(L)", 50], ["Novacoke", "2(L)", 10], ["Psyche", "0", 200], ["Zen", "3(L)", 5],
  ] as [string, string, number][]).map(([n, a, c]): MoreRow => ({ n, cat: T, g: "Drug", a, c, p: 122, per: "per dose" })),

  // MapMaster gear from the Seattle pages
  { n: "MapMaster sensor fob", cat: E, g: "Sensor", r: [1, 6], a: "3", c: x(300), p: 335, per: "per year" },

  // vehicle modifications (p. 200)
  { n: "Rigger interface", cat: "vehicles", g: "Vehicle modification", a: "2", c: 1000, p: 200, gc: "misc" },
  { n: "Standard weapon mount", cat: "vehicles", g: "Vehicle modification", a: "4(I)", c: 2500, p: 200, gc: "misc" },
  { n: "Heavy weapon mount", cat: "vehicles", g: "Vehicle modification", a: "6(I)", c: 5000, p: 200, gc: "misc" },
  { n: "Weapon mount, manual operation", cat: "vehicles", g: "Vehicle modification", a: "1", c: 500, p: 200, per: "added to the mount; Availability +1", gc: "misc" },
];

/** Special ammunition (p. 262): the regular price of the weapon class times this, with the changes to Attack Rating and DV. */
export const AMMO_TYPES: [name: string, ar: string, dv: string, mult: number][] = [
  ["APDS", "+2", "–1", 3],
  ["Explosive", "—", "+1", 2],
  ["Flechette", "+1", "–1", 1.5],
  ["Gel", "—", "Stun", 1.5],
  ["Stick-n-Shock", "+1", "–1, Stun (e)", 2],
];
