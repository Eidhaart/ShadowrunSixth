/**
 * Export a runner as a Foundry VTT actor for the shadowrun6-eden system (4.x): a "Player" actor in the
 * system's own data shape, ready for Foundry's "Import Data" on an actor or the SixthDeck Bridge import.
 * The full SixthDeck build rides along in flags.sixthdeck so it can come back without loss.
 *
 * The system works out its own pools, monitors and initiative from the attributes and items. Where a
 * SixthDeck number differs from what it would work out (qualities, implants, Essence), the difference is
 * written to the matching "mod" field so the sheet ends up with the same numbers.
 */
import { C6_BY_ID } from "@/lib/sr6/c6";
import EDEN_TYPES from "@/data/eden-gear-types.json";
import { BUILT_IN_ITEMS, GRADES } from "@/lib/compendium/catalog";
import { EDEN_GEAR, EDEN_SPECS, EDEN_WEAPON_SPEC } from "@/data/eden";
import { withAdv } from "@/lib/sr6/advance";
import type { Character, GearItem } from "@/lib/sr6/character";
import { LIFESTYLES, METATYPES, SKILL_BY_ID, traditionName } from "@/lib/sr6/data";
import { derive } from "@/lib/sr6/derive";
import { getExt, matrixStats } from "@/lib/sr6/ext";
import { weaponFocus } from "@/lib/sr6/foci";
import { installedIn } from "@/lib/sr6/loadout";
import { SPELL_BY_NAME, COMPLEX_FORMS } from "@/lib/sr6/rules6";

export const EDEN_SYSTEM = "shadowrun6-eden";
const EDEN_VERSION = "4.0.11";

const ATTR: Record<string, string> = { body: "bod", agility: "agi", reaction: "rea", strength: "str", willpower: "wil", logic: "log", intuition: "int", charisma: "cha" };
const MORTYPE: Record<Character["magicType"], string> = {
  mundane: "mundane", full: "magician", aspected: "aspectedmagician", mystic: "mysticadept", adept: "adept", technomancer: "technomancer",
};
/** The system allows Body, Logic, Charisma and Intuition as tradition attributes. */
const TRADITION_ATTR: Record<string, string> = { logic: "log", charisma: "cha", intuition: "int", body: "bod" };

/** Foundry document ids: 16 letters and digits. */
function docId(): string {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 16; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const html = (s: string) => (s ? s.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("") : "");
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "").replace(/s$/, "");

/** A specialization name in SixthDeck to the system's id for that skill, or "" when it has none. */
export function edenSpec(skill: string, name?: string): string {
  if (!name) return "";
  const list = EDEN_SPECS[skill] ?? {};
  const n = norm(name);
  const hit = Object.entries(list).find(([id, label]) => norm(label) === n || norm(id) === n)
    ?? Object.entries(list).find(([, label]) => norm(label.split(" ")[0]) === norm(name.split(" ")[0]));
  return hit?.[0] ?? "";
}

let byName: Map<string, (typeof BUILT_IN_ITEMS)[number]> | null = null;
/** The catalog entry an item came from, so its gear type is known; implants match without their grade. */
function catalogOf(g: GearItem) {
  byName ??= new Map(BUILT_IN_ITEMS.map((i) => [i.name.toLowerCase(), i]));
  const base = g.name.replace(/\s*\((used|alphaware|betaware|deltaware)\)$/i, "").toLowerCase();
  return byName.get(g.name.toLowerCase()) ?? byName.get(base);
}

function gearType(g: GearItem): [string, string] {
  const hit = catalogOf(g);
  let t = hit ? EDEN_GEAR[hit.group] : undefined;
  if (t) {
    // a few groups split further by name
    if (t[1] === "RIFLE_ASSAULT" && /sniper/i.test(g.name)) t = ["WEAPON_FIREARMS", "RIFLE_SNIPER"];
    else if (t[1] === "RIFLE_ASSAULT" && /hunting|sporting/i.test(g.name)) t = ["WEAPON_FIREARMS", "RIFLE_HUNTING"];
    else if (t[1] === "LMG" && /\bmmg|medium/i.test(g.name)) t = ["WEAPON_FIREARMS", "MMG"];
    else if (t[1] === "LMG" && /\bhmg|heavy/i.test(g.name)) t = ["WEAPON_FIREARMS", "HMG"];
    else if (t[1] === "BOWS" && t[0] === "WEAPON_RANGED" && /crossbow/i.test(g.name)) t = ["WEAPON_RANGED", "CROSSBOWS"];
    else if (t[1] === "CYBER_HEADWARE" && /cyberjack/i.test(g.name)) t = ["CYBERWARE", "CYBERJACK"];
    else if (t[1] === "ROCKETS" && /missile/i.test(g.name)) t = ["AMMUNITION", "MISSILES"];
    return t;
  }
  // items typed in by hand: go by the sheet category
  switch (g.category) {
    case "weapon": {
      const sk = g.skill ?? "firearms";
      if (sk === "close-combat") return ["WEAPON_CLOSE_COMBAT", "OTHER_CLOSE"];
      if (sk === "athletics") return ["WEAPON_RANGED", "THROWING"];
      if (sk === "exotic-weapons") return ["WEAPON_SPECIAL", "OTHER_SPECIAL"];
      return ["WEAPON_FIREARMS", /heavy pistol/i.test(g.name) ? "PISTOLS_HEAVY" : /pistol/i.test(g.name) ? "PISTOLS_LIGHT" : /shotgun/i.test(g.name) ? "SHOTGUNS" : /rifle/i.test(g.name) ? "RIFLE_ASSAULT" : "SUBMACHINE_GUNS"];
    }
    case "armor": return ["ARMOR", /helmet/i.test(g.name) ? "ARMOR_HELMET" : /shield/i.test(g.name) ? "ARMOR_SHIELD" : "ARMOR_BODY"];
    case "cyberware": return ["CYBERWARE", g.fits === "eyes" || g.holds === "eyes" ? "CYBER_EYEWARE" : g.fits === "ears" || g.holds === "ears" ? "CYBER_EARWARE" : g.fits === "limb" || g.holds === "limb" ? "CYBER_LIMBS" : "CYBER_BODYWARE"];
    case "bioware": return ["BIOWARE", "BIOWARE_STANDARD"];
    case "ammo": return ["AMMUNITION", "AMMUNITION"];
    case "commlink": return ["ELECTRONICS", /deck/i.test(g.name) ? "CYBERDECK" : "COMMLINK"];
    case "vehicle": return /drone|eye|roto|dalmat|crawler|doberman|steel lynx|kanmushi|fly-spy|shamus/i.test(g.name) ? ["DRONES", "SMALL_DRONES"] : ["VEHICLES", "CARS"];
    case "magic": return ["MAGICAL", "MAGIC_SUPPLIES"];
    default: return ["TOOLS", "TOOLS"];
  }
}

/** The gear item's system data with every field the system template has. */
function gearSystem(over: Record<string, unknown>) {
  return {
    genesisID: "", description: "", product: "", page: 0,
    modifier: 0, wild: false, pool: 0,
    isElectronicMatrixDevice: false,
    matrix: { deviceRating: 2, hasWirelessInterface: true, hasDataCableInterface: false, wirelessActive: true, matrixCM: { value: null } },
    type: "TOOLS", subtype: "", count: 0, countable: false, availDef: "", avail: 0, ammocap: 0, ammocount: 0, ammoLoaded: "regular",
    priceDef: "", price: 0, customName: "", usedForPool: false, notes: "", accessories: "", needsRating: false, rating: 0,
    skill: "", skillSpec: "", dmg: 0, stun: false, dmgDef: "", attackRating: [0, 0, 0, 0, 0],
    modes: { BF: false, FA: false, SA: false, SS: false }, defense: 0, social: 0, essence: 0, capacity: 0, natural: false,
    a: 0, s: 0, d: 0, f: 0, progSlots: 0, handlOn: 0, handlOff: 0, accOn: 0, accOff: 0, spdiOn: 0, spdiOff: 0, tspd: 0,
    bod: 0, arm: 0, pil: 0, sen: 0, sea: 0, vtype: "", vehicle: { opMode: "manual" }, strWeapon: false, dualHand: false,
    ...over,
  };
}

const item = (name: string, type: string, system: Record<string, unknown>, sort: number) =>
  ({ _id: docId(), name, type, img: undefined as string | undefined, system, effects: [], folder: null, sort, flags: {} });

export interface FoundryExport { actor: Record<string, unknown>; skipped: string[] }

/** The runner as a shadowrun6-eden Player actor. `skipped` lists what the system has no place for. */
export function runnerToEden(raw: Character): FoundryExport {
  const c = withAdv(raw);
  const d = derive(c);
  const e = getExt(c);
  const skipped: string[] = [];
  const items: ReturnType<typeof item>[] = [];
  let sort = 100000;
  const push = (name: string, type: string, system: Record<string, unknown>) => { items.push(item(name, type, system, (sort += 100000))); };

  // ---- attributes: base is the natural rating, mod what augmentations add -----------------------
  const attributes: Record<string, unknown> = {};
  for (const [ours, theirs] of Object.entries(ATTR)) {
    const nat = d.natural[ours as keyof typeof d.natural];
    const now = d.attrs[ours as keyof typeof d.attrs];
    attributes[theirs] = { base: nat, mod: now - nat, modString: "", augment: 0, pool: now };
  }
  const awakened = c.magicType !== "mundane" && c.magicType !== "technomancer";
  attributes.mag = { base: awakened ? d.magic : 0, mod: 0, pool: awakened ? d.magic : 0, min: 0, initiation: awakened ? c.initiateGrade ?? 0 : 0 };
  attributes.res = { base: c.magicType === "technomancer" ? d.resonance : 0, mod: 0, pool: c.magicType === "technomancer" ? d.resonance : 0, submersion: c.magicType === "technomancer" ? c.initiateGrade ?? 0 : 0 };
  attributes.edg = { current: c.edgeCurrent, max: d.edge };
  attributes.essence = { base: 6, mod: +(d.essence - 6).toFixed(2), pool: +d.essence.toFixed(2) };

  // ---- monitors and initiative: the system's own formula, with our difference as the mod ------------
  const bod = d.attrs.body, wil = d.attrs.willpower;
  const physBase = 8 + Math.round(bod / 2), stunBase = 8 + Math.round(wil / 2);
  const m = matrixStats(c, d);

  // ---- skills -------------------------------------------------------------------------------
  const skills: Record<string, unknown> = {};
  const lostSpecs: string[] = [];
  for (const id of Object.keys(EDEN_SPECS)) {
    const ours = id.replace(/_/g, "-");
    const e2 = c.skills[ours];
    const rank = e2 ? e2.pts + e2.kar : 0;
    const spec = edenSpec(id, e2?.spec);
    if (e2?.spec && !spec) lostSpecs.push(`${SKILL_BY_ID[ours]?.name ?? id}: ${e2.spec}`);
    skills[id] = {
      points: rank, specialization: e2?.expert ? "" : spec, expertise: e2?.expert ? spec : "",
      modifier: 0, augment: 0, expandedSpecializations: [],
    };
  }
  if (lostSpecs.length) skipped.push(`specializations the system has no entry for (in notes): ${lostSpecs.join(", ")}`);

  // knowledge and languages are skill items
  for (const k of c.knowledge) {
    push(k.name, "skill", { genesisID: k.kind === "language" ? "language" : "knowledge", description: k.kind === "language" ? (k.native ? "Native language" : ["", "Basic", "Specialist", "Expert"][k.level ?? 1]) : "", product: "", page: 0, points: k.kind === "language" ? (k.native ? 4 : k.level ?? 1) : 1, modifier: 0 });
  }

  // ---- qualities ------------------------------------------------------------------------------
  for (const q of c.qualities) {
    push(q.name, "quality", {
      genesisID: q.id, product: "SR6", page: 0, category: q.kind === "positive" ? "ADVANTAGE" : "DISADVANTAGE", level: q.level > 1,
      value: q.level, explain: q.note ?? "", modifier: [],
      description: html(`${q.kind === "positive" ? "Positive" : "Negative"} quality, ${q.karma * q.level} Karma.${q.note ? `\n\n${q.note}` : ""}`),
    });
  }

  // ---- magic ----------------------------------------------------------------------------------
  for (const name of c.spells) {
    const s = SPELL_BY_NAME[name.toLowerCase()];
    push(name, "spell", {
      genesisID: name.toLowerCase().replace(/[^a-z0-9]+/g, "_"), description: "", product: "SR6", page: 0,
      category: s?.cat?.toLowerCase() ?? "combat",
      duration: s?.dur === "S" ? "sustained" : s?.dur === "P" ? "permanent" : s?.dur === "L" ? "limited" : "instantaneous",
      drain: s?.dv ?? 0,
      type: s?.type?.startsWith("M") ? "mana" : "physical",
      range: !s ? "line_of_sight" : /touch/i.test(s.range ?? "") ? "touch" : /self/i.test(s.range ?? "") ? (/\(A\)/.test(s.range ?? "") ? "self_area" : "self") : /\(A\)/.test(s.range ?? "") ? "line_of_sight_area" : "line_of_sight",
      damage: s?.dmg === "S" ? "stun" : "physical",
      alchemic: false, multiSense: false, isOpposed: true, withEssence: false, wildDie: false, isSustained: e.sustained.includes(name),
      combatSpellType: s?.kind === "direct" ? "spells_direct" : "spells_indirect",
    });
  }
  if (c.rituals?.length) skipped.push(`rituals (the system has no ritual item; listed in notes): ${c.rituals.join(", ")}`);
  for (const p of c.adeptPowers) {
    push(p.name, "adeptpower", { genesisID: "", description: "", product: "SR6", page: 0, hasLevel: (p.level ?? 1) > 1, level: p.level ?? 1, choice: "", cost: p.cost, activation: "passive" });
  }
  for (const f of e.foci) {
    const g = c.gear.find((x) => x.id === f.gearId);
    const on = g?.inId ? c.gear.find((x) => x.id === g.inId)?.name : "";
    push(f.name, "focus", {
      genesisID: `${f.kind.toLowerCase()}_focus`, product: "SR6", page: 0, rating: f.rating,
      description: html(`${f.kind} focus, Force ${f.rating}. ${f.bonded ? "Bonded" : "Not bonded"}${f.active ? ", active" : ""}.${on ? ` Part of ${on}.` : ""}`),
    });
  }
  for (const name of c.metamagic ?? []) {
    if (/^power point$/i.test(name)) continue;
    push(name, c.magicType === "technomancer" ? "echo" : "metamagic", c.magicType === "technomancer"
      ? { genesisID: "", description: "", product: "SR6", page: 0 }
      : { genesisID: "", description: "", product: "SR6", page: 0, hasLevel: false, level: 1, adepts: c.magicType === "adept" || c.magicType === "mystic", mages: c.magicType !== "adept" });
  }
  for (const name of c.complexForms) {
    const f = COMPLEX_FORMS.find((x) => x.name.toLowerCase() === name.toLowerCase());
    push(name, "complexform", { genesisID: name.toLowerCase().replace(/[^a-z0-9]+/g, "_"), description: html(f?.note ?? ""), product: "SR6", page: 0, duration: f?.dur === "I" ? "instantaneous" : f?.dur === "P" ? "permanent" : "sustained", fading: f?.fade ?? 3, skill: "electronics", skillSpec: "complex_forms", attrib: "res", threshold: 0, oppAttr1: "", oppAttr2: "" });
  }
  if (e.spirits.length) skipped.push(`spirits (the system makes them separate Spirit actors): ${e.spirits.map((s) => `${s.type} Force ${s.force}`).join(", ")}`);
  if (e.sprites.length) skipped.push(`sprites (the system makes them separate actors): ${e.sprites.map((s) => `${s.type} level ${s.level}`).join(", ")}`);

  // ---- gear -----------------------------------------------------------------------------------
  const deckName = e.matrix.deck?.name.toLowerCase();
  const linkName = e.matrix.link?.name.toLowerCase();
  for (const g of c.gear) {
    // a Commlink 6 template gives the exact type and the genesisID the system's importer knows
    const t6 = g.c6 ? C6_BY_ID.get(g.c6) : undefined;
    const known = (EDEN_TYPES as Record<string, string[]>)[t6?.t ?? ""]?.includes(t6?.s ?? "");
    const [type, subtype] = t6 && known ? [t6.t, t6.s] : gearType(g);
    const qty = g.qty || 1;
    const accessories = installedIn(c, g).filter((k) => k.fits !== "melee").map((k) => k.name).join(", ");
    const notes = [g.notes ?? "", g.inId ? `Installed in ${c.gear.find((x) => x.id === g.inId)?.name ?? "another item"}.` : ""].filter(Boolean).join(" ");
    const sys: Record<string, unknown> = {
      type, subtype, price: g.cost, avail: g.avail ?? 0, availDef: g.avail != null ? `${g.avail}${g.legal ?? ""}` : "",
      count: qty, countable: qty > 1 || type === "AMMUNITION", notes, accessories, essence: g.essence ? +(g.essence).toFixed(3) : 0,
      capacity: g.capacity ?? g.capCost ?? 0, product: "SR6", description: html(g.notes ?? ""),
      ...(t6 ? { genesisID: t6.id, product: "core", page: t6.p ?? 0 } : {}),
    };
    const rating = Number(/(?:rating|force|capacity) (\d+)/i.exec(g.name)?.[1] ?? 0);
    if (rating) Object.assign(sys, { needsRating: true, rating });
    if (g.category === "weapon") {
      const dmg = Number(/^(\d+)/.exec(g.dv ?? "")?.[1] ?? 0);
      const modes = (g.notes ?? "").toUpperCase();
      const spec = EDEN_WEAPON_SPEC[subtype];
      const wf = weaponFocus(c, g);
      Object.assign(sys, {
        dmg, dmgDef: g.dv ?? "", stun: /S/.test((g.dv ?? "").replace(/\(.*\)/, "").replace(/^\d+/, "")),
        attackRating: (g.ar ?? [null, null, null, null, null]).map((v) => v ?? 0),
        modes: { BF: /\bBF\b/.test(modes), FA: /\bFA\b/.test(modes), SA: /\bSA\b/.test(modes), SS: /\bSS\b/.test(modes) },
        skill: (g.skill ?? spec?.[0] ?? "firearms").replace(/-/g, "_"), skillSpec: spec?.[1] ?? "",
        ammocap: Number(/ammo (\d+)/i.exec(g.notes ?? "")?.[1] ?? 0),
        ...(wf ? { notes: `${notes} Weapon focus, Force ${wf.force}: +${wf.force} dice to attack when bonded and active.`.trim() } : {}),
      });
      if (sys.ammocap) sys.ammocount = sys.ammocap;
    }
    if (type === "ARMOR") Object.assign(sys, { defense: g.armor ?? 0, usedForPool: g.worn !== false && !!g.armor });
    // the device the runner is on the Matrix with
    if (subtype === "CYBERDECK" || (deckName && g.name.toLowerCase() === deckName)) {
      const dk = e.matrix.deck;
      Object.assign(sys, { type: "ELECTRONICS", subtype: "CYBERDECK", isElectronicMatrixDevice: true, usedForPool: !!dk, a: dk?.a ?? 0, s: dk?.s ?? 0, progSlots: dk?.slots ?? 0, matrix: { deviceRating: dk?.rating ?? rating, hasWirelessInterface: true, hasDataCableInterface: false, wirelessActive: true, matrixCM: { value: null } } });
    } else if (subtype === "COMMLINK" || (linkName && g.name.toLowerCase() === linkName)) {
      const lk = e.matrix.link;
      Object.assign(sys, { type: "ELECTRONICS", subtype: "COMMLINK", isElectronicMatrixDevice: true, usedForPool: !!lk, d: lk?.d ?? 0, f: lk?.f ?? 0, progSlots: lk?.slots ?? 0, matrix: { deviceRating: lk?.rating ?? rating, hasWirelessInterface: true, hasDataCableInterface: false, wirelessActive: true, matrixCM: { value: null } } });
    }
    if (/\(alphaware|betaware|deltaware|used\)/i.test(g.name)) {
      const gr = (Object.keys(GRADES) as (keyof typeof GRADES)[]).find((k) => g.name.toLowerCase().includes(k));
      if (gr) sys.notes = `${sys.notes} ${GRADES[gr].label} grade.`.trim();
    }
    push(qty > 1 && type !== "AMMUNITION" ? g.name : g.name, "gear", gearSystem(sys));
  }
  // a deck or link set up on the Matrix tab but not in the gear list
  if (e.matrix.deck && !c.gear.some((g) => g.name.toLowerCase() === deckName)) {
    const dk = e.matrix.deck;
    push(dk.name, "gear", gearSystem({ type: "ELECTRONICS", subtype: "CYBERDECK", isElectronicMatrixDevice: true, usedForPool: true, a: dk.a, s: dk.s, progSlots: dk.slots, matrix: { deviceRating: dk.rating, hasWirelessInterface: true, hasDataCableInterface: false, wirelessActive: true, matrixCM: { value: null } } }));
  }
  if (e.matrix.link && !c.gear.some((g) => g.name.toLowerCase() === linkName)) {
    const lk = e.matrix.link;
    push(lk.name, "gear", gearSystem({ type: lk.kind === "cyberjack" ? "CYBERWARE" : "ELECTRONICS", subtype: lk.kind === "cyberjack" ? "CYBERJACK" : "COMMLINK", isElectronicMatrixDevice: true, usedForPool: true, d: lk.d, f: lk.f, progSlots: lk.slots, matrix: { deviceRating: lk.rating, hasWirelessInterface: true, hasDataCableInterface: false, wirelessActive: true, matrixCM: { value: null } } }));
  }
  for (const p of e.matrix.programs) push(p.name, "gear", gearSystem({ type: "SOFTWARE", subtype: "OTHER_PROGRAMS", usedForPool: p.active, notes: p.note, description: html(p.note) }));
  for (const v of e.vehicles) {
    const drone = v.kind === "drone";
    push(v.name, "gear", gearSystem({
      type: drone ? "DRONES" : "VEHICLES", subtype: drone ? "SMALL_DRONES" : "CARS", vtype: drone ? "drone" : "vehicle",
      handlOn: v.handlingOn, handlOff: v.handlingOff, accOn: v.accel, accOff: v.accel, spdiOn: v.speedInterval, spdiOff: v.speedInterval,
      tspd: v.topSpeed, bod: v.body, arm: v.armor, pil: v.pilot, sen: v.sensor, sea: v.seats, notes: v.note,
      description: html(`Maneuvering ${v.maneuver}, Targeting ${v.targeting}.${v.note ? `\n\n${v.note}` : ""}`),
    }));
  }

  // ---- SINs, lifestyle, contacts --------------------------------------------------------------
  const SIN_Q = ["", "ANYONE", "ROUGH_MATCH", "GOOD_MATCH", "SUPERFICIALLY_PLAUSIBLE", "HIGHLY_PLAUSIBLE", "SECOND_LIFE"];
  if (c.qualities.some((q) => /^sinner/i.test(q.name))) push(c.name || c.alias || "Real SIN", "sin", { name: c.name || c.alias || "Real SIN", quality: "REAL_SIN", description: "" });
  for (const g of c.gear.filter((x) => /fake sin/i.test(x.name))) {
    const r = Math.min(6, Math.max(1, Number(/rating (\d+)/i.exec(g.name)?.[1] ?? 1)));
    for (let n = 0; n < (g.qty || 1); n++) push(g.name, "sin", { name: g.name, quality: SIN_Q[r], description: html(g.notes ?? "") });
  }
  const ls = LIFESTYLES.find((l) => l.id === c.lifestyle);
  if (ls) push(`${ls.name} lifestyle`, "lifestyle", { genesisID: ls.id, description: "", product: "SR6", page: 0, type: ls.id, paid: c.lifestyleMonths, cost: ls.cost, sin: "" });
  for (const k of c.contacts) push(k.name || "Contact", "contact", { name: k.name || "Contact", rating: k.connection, loyalty: k.loyalty, favors: 0, type: k.role, description: html(k.notes ?? ""), pronouns: "" });

  // ---- what the system has no field for goes in the notes -----------------------------------------
  const tradAttr = TRADITION_ATTR[c.tradition || "logic"];
  if (awakened && c.magicType !== "adept" && !tradAttr) skipped.push(`tradition attribute ${c.tradition} (the system offers Body, Logic, Charisma or Intuition; Logic is set)`);
  const extra = [
    lostSpecs.length ? `Specializations: ${lostSpecs.join(", ")}` : "",
    c.rituals?.length ? `Rituals: ${c.rituals.join(", ")}` : "",
    c.aspect ? `Aspect: ${c.aspect}` : "",
    e.spirits.length ? `Spirits: ${e.spirits.map((s) => `${s.type} Force ${s.force}, ${s.services} services${s.bound ? ", bound" : ""}${s.note ? ` (${s.note})` : ""}`).join("; ")}` : "",
    e.sprites.length ? `Sprites: ${e.sprites.map((s) => `${s.type} level ${s.level}, ${s.tasks} tasks${s.registered ? ", registered" : ""}`).join("; ")}` : "",
    c.magicType === "mystic" ? `Mystic adept split: ${d.slots.mysticPP} of ${d.slots.mysticMagic} priority Magic to adept powers.` : "",
  ].filter(Boolean);
  const description = html([c.concept, c.background].filter(Boolean).join("\n\n"));
  const notes = html([c.notes, ...extra].filter(Boolean).join("\n\n"));

  const name = c.alias || c.name || "Runner";
  const actor = {
    name,
    type: "Player",
    img: "icons/svg/mystery-man.svg",
    system: {
      attributes,
      type: MORTYPE[c.magicType],
      gender: "",
      physical: { base: physBase, mod: d.condition.physical - physBase, modString: "", value: d.condition.physical - c.damage.physical, dmg: c.damage.physical, max: d.condition.physical },
      stun: { base: stunBase, mod: d.condition.stun - stunBase, modString: "", value: d.condition.stun - c.damage.stun, dmg: c.damage.stun, max: d.condition.stun },
      overflow: { mod: d.condition.overflow - bod * 2, modString: "", value: 0, dmg: c.damage.overflow, max: d.condition.overflow },
      edge: { value: c.edgeCurrent, max: d.edge },
      derived: {
        composure: { mod: d.composure - (wil + d.attrs.charisma) },
        judge_intentions: { mod: d.judgeIntentions - (wil + d.attrs.intuition) },
        memory: { mod: d.memory - (d.attrs.logic + d.attrs.intuition) },
        lift_carry: { mod: d.liftCarry - (bod + wil) },
        matrix_perception: { mod: 0 },
      },
      defenserating: {
        physical: { mod: d.defenseRating - bod - c.gear.filter((g) => g.category === "armor" && g.worn !== false && g.armor && gearType(g)[0] === "ARMOR").reduce((n, g) => n + (g.armor ?? 0), 0) },
        matrix: { mod: 0 }, vehicle: { mod: 0 }, astral: { mod: 0 }, social: { mod: 0 },
      },
      defensepool: {
        physical: { mod: 0 }, astral: { mod: 0 }, spells_direct: { mod: 0 }, spells_indirect: { mod: 0 }, spells_other: { mod: 0 },
        vehicle: { mod: 0 }, toxin: { mod: 0 }, damage_physical: { mod: 0 }, damage_astral: { mod: 0 },
      },
      initiative: {
        astral: { mod: d.initiative.astralRank - (d.attrs.logic + d.attrs.intuition), dice: d.initiative.astralDice, diceMod: 0 },
        matrix: { mod: m.source === "none" ? 0 : m.init.rank - (d.attrs.reaction + d.attrs.intuition), dice: m.source === "none" ? 1 : m.init.dice, diceMod: 0 },
        physical: { mod: d.initiative.rank - (d.attrs.reaction + d.attrs.intuition), dice: d.initiative.dice, diceMod: 0 },
        actions: 0,
      },
      walk: d.movement.walk,
      sprint: d.movement.sprint,
      perHit: 1,
      skills,
      tradition: { genesisID: "", name: awakened && c.magicType !== "adept" ? traditionName(c) : "", attribute: tradAttr ?? "log" },
      persona: {
        device: { mod: { a: 0, s: 0, d: 0, f: 0 } }, living: { mod: { a: 0, s: 0, d: 0, f: 0 } }, used: { a: 0, s: 0, d: 0, f: 0 },
        runningSilent: false, description: "", img: "",
      },
      name: c.name || c.alias || "",
      metatype: METATYPES[c.metatype]?.name.toLowerCase() ?? c.metatype,
      mortype: MORTYPE[c.magicType],
      matrixIni: e.mode === "ar" ? "ar" : e.mode === "hot" ? "vrhot" : "vrcold",
      nuyen: c.nuyen,
      overwatch: e.overwatch ?? 0,
      description,
      notes,
      karma: c.karmaEarned - c.karmaSpent,
      karma_total: c.karmaEarned,
      heat: 0,
      reputation: 0,
    },
    prototypeToken: { name, actorLink: true, disposition: 1, displayName: 30, displayBars: 20, bar1: { attribute: "physical" }, bar2: { attribute: "stun" }, texture: { src: "icons/svg/mystery-man.svg" } },
    items,
    effects: [],
    folder: null,
    flags: { sixthdeck: { version: 2, system: EDEN_SYSTEM, systemVersion: EDEN_VERSION, exportedAt: new Date().toISOString(), character: raw } },
  };
  return { actor, skipped };
}
