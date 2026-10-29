/**
 * Gear from the Sixth World core rulebook (Seattle edition page numbers) that the community gear
 * list does not cover: armor, cyberware, bioware, foci, vehicles and drones. Names and game
 * statistics only. Rated rows are expanded into one catalog entry per rating.
 */

type Legal = "L" | "I" | undefined;
/** Availability as printed: "4(L)" → 4, L. */
export const av = (s: string): { avail?: number; legal: Legal } => {
  const m = /^(\d+)?\s*\(?([LI])?\)?$/.exec(s.trim());
  return { avail: m?.[1] ? Number(m[1]) : undefined, legal: (m?.[2] as Legal) ?? undefined };
};

// name, Defense Rating bonus, capacity, availability, cost   (p. 267–268)
export const ARMOR: [string, number, number, string, number, string][] = [
  ["Synthleather jacket", 1, 3, "1", 300, "Armor"],
  ["Actioneer business clothes", 2, 6, "2", 1500, "Armor"],
  ["Armor clothing", 2, 4, "2", 500, "Armor"],
  ["Armor jacket", 4, 8, "2", 1000, "Armor"],
  ["Armor vest", 3, 6, "2", 750, "Armor"],
  ["Chameleon suit", 2, 4, "4(I)", 2000, "Armor"],
  ["Full body armor", 5, 10, "4(L)", 2000, "Armor"],
  ["Full body armor helmet", 2, 6, "4(L)", 500, "Armor"],
  ["Lined coat", 3, 7, "2", 900, "Armor"],
  ["Urban explorer jumpsuit", 3, 6, "2", 800, "Armor"],
  ["Helmet", 1, 4, "1", 200, "Helmet and shield"],
  ["Ballistic shield", 2, 2, "4", 900, "Helmet and shield"],
  ["Riot shield", 2, 2, "4", 1200, "Helmet and shield"],
];

/**
 * Cyberware and bioware (p. 285–295). essence and cost may scale with rating: [base, perRating].
 * maxRating 0 means a single item.
 */
export interface AugRow { name: string; group: string; ess: number; essPerRating?: boolean; cap?: string; avail: string; cost: number; costPerRating?: boolean; ratings?: [number, number]; plus?: string }

export const CYBERWARE: AugRow[] = [
  // headware (cyberjacks come from the gear list)
  { name: "Commlink (implanted)", group: "Headware", ess: 0.2, cap: "[2]", avail: "2", cost: 2000, plus: "plus the commlink" },
  { name: "Control rig", group: "Headware", ess: 1, essPerRating: true, avail: "4(L)", cost: 30000, costPerRating: true, ratings: [1, 3] },
  { name: "Cortex kink bomb", group: "Headware", ess: 0, cap: "[1]", avail: "6(I)", cost: 10000 },
  { name: "Cortex microbomb", group: "Headware", ess: 0, cap: "[2]", avail: "6(I)", cost: 25000 },
  { name: "Cortex area bomb", group: "Headware", ess: 0, cap: "[3]", avail: "6(I)", cost: 40000 },
  { name: "Cyberdeck (implanted)", group: "Headware", ess: 0.4, cap: "[4]", avail: "4(L)", cost: 5000, plus: "plus the cyberdeck" },
  { name: "Datajack", group: "Headware", ess: 0.1, avail: "2", cost: 1000 },
  { name: "Datalock", group: "Headware", ess: 0.1, avail: "4", cost: 1000, costPerRating: true, ratings: [1, 12] },
  { name: "Olfactory booster", group: "Headware", ess: 0.2, avail: "3", cost: 4000, costPerRating: true, ratings: [1, 3] },
  { name: "Simrig", group: "Headware", ess: 0.2, avail: "4(L)", cost: 4000 },
  { name: "Skilljack", group: "Headware", ess: 0.1, essPerRating: true, avail: "4", cost: 20000, costPerRating: true, ratings: [1, 6] },
  { name: "Taste booster", group: "Headware", ess: 0.2, avail: "3", cost: 3000, costPerRating: true, ratings: [1, 3] },
  { name: "Tooth compartment", group: "Headware", ess: 0, avail: "4", cost: 800 },
  { name: "Ultrasound sensor", group: "Headware", ess: 0.3, cap: "[2]", avail: "4", cost: 3600 },
  { name: "Voice modulator", group: "Headware", ess: 0.2, avail: "4(L)", cost: 5000, costPerRating: true, ratings: [1, 3] },
  // eyeware
  ...[[1, 0.1, 1, "2", 1000], [2, 0.2, 4, "2", 4000], [3, 0.3, 8, "3", 6000], [4, 0.4, 12, "3", 10000], [5, 0.5, 16, "3", 16000]].map(
    ([r, e, c, a, k]) => ({ name: `Cybereyes, rating ${r}`, group: "Eyeware", ess: e as number, cap: String(c), avail: a as string, cost: k as number })),
  { name: "Flare compensation", group: "Eyeware", ess: 0.1, cap: "[1]", avail: "2", cost: 1000 },
  { name: "Image link", group: "Eyeware", ess: 0.1, avail: "2", cost: 800 },
  { name: "Low-light vision", group: "Eyeware", ess: 0.1, cap: "[2]", avail: "2", cost: 1500 },
  { name: "Ocular drone", group: "Eyeware", ess: 0.3, cap: "[6]", avail: "3", cost: 6000 },
  { name: "Retinal duplication", group: "Eyeware", ess: 0.1, cap: "[1]", avail: "5(I)", cost: 20000, costPerRating: true, ratings: [1, 6] },
  { name: "Smartlink", group: "Eyeware", ess: 0.2, cap: "[3]", avail: "3(L)", cost: 4000 },
  { name: "Thermographic vision", group: "Eyeware", ess: 0.1, cap: "[2]", avail: "2", cost: 2000 },
  { name: "Vision enhancement", group: "Eyeware", ess: 0.1, cap: "[2]", avail: "3", cost: 4000 },
  { name: "Vision magnification", group: "Eyeware", ess: 0.1, cap: "[2]", avail: "3", cost: 2000 },
  // earware
  ...[[1, 0.1, 1, "2", 1000], [2, 0.2, 4, "2", 3000], [3, 0.3, 8, "3", 4500], [4, 0.4, 12, "3", 7500], [5, 0.5, 16, "3", 11000]].map(
    ([r, e, c, a, k]) => ({ name: `Cyberears, rating ${r}`, group: "Earware", ess: e as number, cap: String(c), avail: a as string, cost: k as number })),
  { name: "Audio enhancement", group: "Earware", ess: 0.1, cap: "[1]", avail: "2", cost: 4000 },
  { name: "Balance augmenter", group: "Earware", ess: 0.1, cap: "[4]", avail: "3", cost: 8000 },
  { name: "Damper", group: "Earware", ess: 0.1, cap: "[1]", avail: "2", cost: 2250 },
  { name: "Select sound filter", group: "Earware", ess: 0.1, cap: "[Rating]", avail: "4", cost: 3500, costPerRating: true, ratings: [1, 5] },
  { name: "Sound link", group: "Earware", ess: 0.1, avail: "2", cost: 1000 },
  { name: "Spatial recognizer", group: "Earware", ess: 0.1, cap: "[2]", avail: "3", cost: 4000 },
  // bodyware (bone lacing comes from the gear list)
  { name: "Dermal plating", group: "Bodyware", ess: 0.3, essPerRating: true, avail: "4(L)", cost: 4000, costPerRating: true, ratings: [1, 4] },
  { name: "Fingertip compartment", group: "Bodyware", ess: 0.1, cap: "[1]", avail: "2", cost: 3000 },
  { name: "Grapple gun (implanted)", group: "Bodyware", ess: 0.5, cap: "[4]", avail: "3", cost: 5000 },
  { name: "Internal air tank", group: "Bodyware", ess: 0.25, cap: "[Rating]", avail: "2", cost: 4500, costPerRating: true, ratings: [1, 4] },
  { name: "Muscle replacement", group: "Bodyware", ess: 0.7, essPerRating: true, avail: "3(L)", cost: 30000, costPerRating: true, ratings: [1, 4] },
  { name: "Reaction enhancers", group: "Bodyware", ess: 0.3, essPerRating: true, avail: "4(L)", cost: 15000, costPerRating: true, ratings: [1, 4] },
  { name: "Skillwires", group: "Bodyware", ess: 0.1, essPerRating: true, avail: "4", cost: 20000, costPerRating: true, ratings: [1, 6] },
  { name: "Smuggling compartment", group: "Bodyware", ess: 0.2, avail: "3", cost: 7500 },
  { name: "Wired reflexes, rating 1", group: "Bodyware", ess: 1, avail: "3(L)", cost: 40000 },
  { name: "Wired reflexes, rating 2", group: "Bodyware", ess: 2, avail: "3(L)", cost: 150000 },
  { name: "Wired reflexes, rating 3", group: "Bodyware", ess: 3, avail: "4(I)", cost: 250000 },
  { name: "Wired reflexes, rating 4", group: "Bodyware", ess: 4, avail: "6(I)", cost: 400000 },
  // cyberlimbs: synthetic (looks natural) and obvious (more capacity, cheaper)   (p. 290)
  ...([["Cyberskull", 0.75, "5", 15000, 2, 10000, 4], ["Cybertorso", 1.5, "4", 25000, 5, 20000, 10], ["Cyberarm", 1, "4", 20000, 8, 15000, 15],
    ["Cyber forearm", 0.45, "3", 12000, 5, 10000, 10], ["Cyberhand", 0.25, "3", 6000, 2, 5000, 4], ["Cyberleg", 1, "4", 20000, 10, 15000, 20],
    ["Cyber lower leg", 0.45, "4", 12000, 6, 10000, 12], ["Cyberfoot", 0.25, "4", 6000, 2, 5000, 4]] as [string, number, string, number, number, number, number][]).flatMap(
    ([n, e, a, sc, scap, oc, ocap]) => [
      { name: `${n}, synthetic`, group: "Cyberlimb", ess: e, cap: String(scap), avail: a, cost: sc },
      { name: `${n}, obvious`, group: "Cyberlimb", ess: e, cap: String(ocap), avail: a, cost: oc },
    ]),
  { name: "Cyberlimb gyromount", group: "Cyberlimb accessory", ess: 0, cap: "[8]", avail: "5(I)", cost: 6000 },
  { name: "Cyberlimb slide", group: "Cyberlimb accessory", ess: 0, cap: "[3]", avail: "5(L)", cost: 3000 },
  { name: "Cyberlimb holster", group: "Cyberlimb accessory", ess: 0, cap: "[5]", avail: "4", cost: 2000 },
  { name: "Cyberlimb smuggling compartment", group: "Cyberlimb accessory", ess: 0, cap: "[5]", avail: "2", cost: 6000 },
  // implant weapons   (p. 291)
  { name: "Cyberjaw", group: "Implant weapon", ess: 0.1, cap: "[1]", avail: "2", cost: 1500 },
  { name: "Hardening", group: "Implant weapon", ess: 0.1, cap: "[1]", avail: "2", cost: 2500 },
  { name: "Shock limb", group: "Implant weapon", ess: 0.25, cap: "[1]", avail: "3", cost: 5000 },
  { name: "Handblade", group: "Implant weapon", ess: 0.15, cap: "[1]", avail: "4(I)", cost: 2000 },
  { name: "Retractable handblade", group: "Implant weapon", ess: 0.25, cap: "[2]", avail: "4(I)", cost: 2500 },
  { name: "Hand razors", group: "Implant weapon", ess: 0.15, cap: "[1]", avail: "3(I)", cost: 1000 },
  { name: "Retractable hand razors", group: "Implant weapon", ess: 0.25, cap: "[2]", avail: "3(I)", cost: 1250 },
  { name: "Spurs", group: "Implant weapon", ess: 0.15, cap: "[1]", avail: "4(I)", cost: 3000 },
  { name: "Retractable spurs", group: "Implant weapon", ess: 0.25, cap: "[3]", avail: "4(I)", cost: 5000 },
  { name: "Implanted hold-out pistol", group: "Implant weapon", ess: 0.1, cap: "[2]", avail: "3(L)", cost: 2000 },
  { name: "Implanted light pistol", group: "Implant weapon", ess: 0.25, cap: "[4]", avail: "3(L)", cost: 3000 },
  { name: "Implanted machine pistol", group: "Implant weapon", ess: 0.5, cap: "[6]", avail: "4(L)", cost: 3500 },
  { name: "Implanted heavy pistol", group: "Implant weapon", ess: 0.5, cap: "[6]", avail: "4(L)", cost: 4300 },
  { name: "Implanted SMG", group: "Implant weapon", ess: 1, cap: "[8]", avail: "5(L)", cost: 4800 },
  { name: "Implanted shotgun", group: "Implant weapon", ess: 1.25, cap: "[10]", avail: "5(L)", cost: 8500 },
  { name: "Implanted grenade launcher", group: "Implant weapon", ess: 1.5, cap: "[15]", avail: "6(I)", cost: 24000 },
  { name: "Implant weapon external clip port", group: "Implant weapon", ess: 0.1, cap: "[1]", avail: "1", cost: 1000 },
  { name: "Implant weapon laser sight", group: "Implant weapon", ess: 0.1, cap: "[1]", avail: "1", cost: 1000 },
  { name: "Implant weapon silencer", group: "Implant weapon", ess: 0.1, cap: "[2]", avail: "4(I)", cost: 1000 },
];

export const BIOWARE: AugRow[] = [
  // bone density augmentation comes from the gear list
  { name: "Adrenaline pump", group: "Bioware", ess: 0.75, essPerRating: true, avail: "5(I)", cost: 55000, costPerRating: true, ratings: [1, 3] },
  { name: "Cat's eyes", group: "Bioware", ess: 0.1, avail: "3", cost: 4000 },
  { name: "Enhanced articulation", group: "Bioware", ess: 0.2, avail: "4", cost: 30000 },
  { name: "Muscle augmentation", group: "Bioware", ess: 0.2, essPerRating: true, avail: "4(L)", cost: 31000, costPerRating: true, ratings: [1, 4] },
  { name: "Muscle toner", group: "Bioware", ess: 0.2, essPerRating: true, avail: "4(L)", cost: 32000, costPerRating: true, ratings: [1, 4] },
  { name: "Orthoskin", group: "Bioware", ess: 0.25, essPerRating: true, avail: "4(L)", cost: 6000, costPerRating: true, ratings: [1, 4] },
  { name: "Platelet factories", group: "Bioware", ess: 0.2, avail: "4", cost: 17000 },
  { name: "Skin pocket", group: "Bioware", ess: 0.1, avail: "4", cost: 12000 },
  { name: "Suprathyroid gland", group: "Bioware", ess: 0.7, avail: "5(L)", cost: 140000 },
  { name: "Symbiotes", group: "Bioware", ess: 0.2, essPerRating: true, avail: "4", cost: 3500, costPerRating: true, ratings: [1, 4] },
  { name: "Synthacardium", group: "Bioware", ess: 0.1, essPerRating: true, avail: "3", cost: 30000, costPerRating: true, ratings: [1, 3] },
  { name: "Tailored pheromones", group: "Bioware", ess: 0.2, essPerRating: true, avail: "4(L)", cost: 31000, costPerRating: true, ratings: [1, 4] },
  { name: "Toxin extractor", group: "Bioware", ess: 0.2, essPerRating: true, avail: "4", cost: 4800, costPerRating: true, ratings: [1, 6] },
  { name: "Tracheal filter", group: "Bioware", ess: 0.1, essPerRating: true, avail: "4", cost: 4500, costPerRating: true, ratings: [1, 6] },
  // cultured bioware
  { name: "Cerebral booster", group: "Cultured bioware", ess: 0.2, essPerRating: true, avail: "5", cost: 31500, costPerRating: true, ratings: [1, 3] },
  { name: "Damage compensator", group: "Cultured bioware", ess: 0.1, essPerRating: true, avail: "5(L)", cost: 2000, costPerRating: true, ratings: [1, 12] },
  { name: "Mnemonic enhancer", group: "Cultured bioware", ess: 0.1, essPerRating: true, avail: "5", cost: 9000, costPerRating: true, ratings: [1, 3] },
  { name: "Pain editor", group: "Cultured bioware", ess: 0.3, avail: "5(I)", cost: 48000 },
  { name: "Reflex recorder", group: "Cultured bioware", ess: 0.1, avail: "5", cost: 14000, plus: "one per skill" },
  { name: "Sleep regulator", group: "Cultured bioware", ess: 0.1, avail: "5", cost: 12000 },
  { name: "Synaptic booster", group: "Cultured bioware", ess: 0.5, essPerRating: true, avail: "5(L)", cost: 95000, costPerRating: true, ratings: [1, 3] },
];

/** Foci: cost per Force, bonding Karma per Force; Availability equals Force, licensed (p. 295). */
export const FOCI: [string, number, number][] = [
  ["Enchanting focus", 5000, 3], ["Metamagic focus", 9000, 3], ["Power focus", 18000, 6], ["Qi focus", 3000, 2],
  ["Spell focus", 4000, 2], ["Spirit focus", 4000, 2], ["Weapon focus", 7000, 3],
];
/** Spell formulas by category: availability, cost. */
export const FORMULAS: [string, string, number][] = [
  ["Combat", "3(L)", 2000], ["Detection", "2(L)", 500], ["Health", "2(L)", 500], ["Illusion", "3(L)", 1000], ["Manipulation", "3(L)", 1500],
];

/** Vehicles and drones (p. 301–302): handling on/off road, accel, speed interval, top speed, body, armor, pilot, sensor, seats, avail, cost. */
export type VehRow = [name: string, group: string, hand: string, accel: number, interval: number, top: number, body: number, armor: number, pilot: number, sensor: number, seats: string, avail: string, cost: number];
export const VEHICLES: VehRow[] = [
  ["Dodge Scoot", "Bike", "5/7", 4, 10, 80, 2, 0, 1, 0, "2", "2", 3000],
  ["Harley-Davidson Scorpion", "Bike", "3/5", 16, 30, 200, 7, 6, 1, 1, "2", "2", 14000],
  ["Yamaha Growler", "Bike", "3/3", 15, 20, 180, 6, 4, 1, 1, "2", "2", 8000],
  ["Suzuki Mirage", "Bike", "2/6", 29, 30, 260, 4, 2, 1, 1, "1", "2", 12000],
  ["Chrysler-Nissan Jackrabbit", "Car", "3/5", 20, 15, 160, 8, 4, 2, 1, "3", "2", 11000],
  ["Honda Spirit", "Car", "4/5", 15, 20, 150, 10, 3, 1, 1, "4", "2", 13000],
  ["Eurocar Westwind X80", "Car", "2/6", 24, 30, 250, 6, 1, 4, 3, "2", "3", 115000],
  ["Hyundai Shin-hyung", "Car", "3/5", 12, 25, 200, 7, 1, 1, 1, "3", "2", 20000],
  ["Ford Americar", "Car", "4/5", 9, 20, 160, 11, 4, 1, 2, "4", "2", 16000],
  ["Saeder-Krupp-Bentley Concordat", "Car", "3/5", 18, 30, 180, 14, 8, 3, 3, "4", "3", 65000],
  ["Mitsubishi Nightsky", "Car", "4/6", 10, 10, 160, 18, 10, 3, 4, "8", "3", 259000],
  ["Toyota Gopher", "Truck and van", "4/4", 15, 15, 150, 12, 6, 1, 1, "4", "2", 25000],
  ["GMC Bulldog", "Truck and van", "5/7", 10, 10, 140, 16, 12, 2, 3, "2/10", "2", 35000],
  ["Range Rover Model 2080", "Truck and van", "4/5", 12, 20, 160, 16, 10, 4, 4, "7", "3", 73000],
  ["Ares Roadmaster", "Truck and van", "5/7", 8, 10, 120, 18, 16, 2, 2, "2/12", "2", 68000],
  ["Samuvani Criscraft Otter", "Boat", "4", 10, 15, 90, 6, 4, 2, 2, "6", "2", 25000],
  ["Aztechnology Sunrunner/Nightrunner", "Boat", "3", 20, 20, 120, 10, 8, 3, 3, "5", "3", 39000],
  ["GMC Riverine", "Boat", "4", 15, 15, 100, 14, 12, 4, 4, "8", "4", 113000],
  ["Proteus Lamprey/Sea Snake", "Submarine", "3", 13, 10, 60, 2, 1, 2, 1, "4", "2/4", 15000],
  ["YNT Delfin", "Submarine", "5", 18, 10, 70, 6, 12, 3, 3, "3", "3", 110000],
  ["Artemis Industries Nightwing", "Fixed-wing aircraft", "4", 15, 25, 150, 2, 0, 1, 1, "1", "2", 20000],
  ["Cessna C750", "Fixed-wing aircraft", "5", 20, 25, 250, 8, 2, 2, 1, "4", "2", 150000],
  ["MCT-Sikorsky-Bell Seahawk", "Fixed-wing aircraft", "5", 30, 50, 500, 12, 4, 2, 2, "8", "2", 300000],
  ["Ares Dragon", "Rotorcraft", "4", 10, 30, 260, 22, 10, 2, 3, "2/16", "2", 360000],
  ["MCT-Sikorsky-Bell Wolfhound", "Rotorcraft", "3", 20, 40, 320, 12, 14, 4, 4, "8", "4", 423000],
  ["Northrup Wasp", "Rotorcraft", "3", 25, 30, 330, 10, 8, 3, 3, "2", "3", 93000],
  ["Ares Venture", "VTOL/VSTOL", "4", 40, 60, 680, 16, 12, 2, 2, "2/8", "3", 400000],
  ["GMC Banshee", "VTOL/VSTOL", "3", 60, 90, 900, 18, 18, 4, 4, "2/12", "4", 1300000],
  ["Federated Boeing Commuter", "VTOL/VSTOL", "3", 35, 60, 420, 16, 10, 2, 2, "2/10", "2", 350000],
  ["Federated Boeing Osprey X", "VTOL/VSTOL", "3", 35, 80, 420, 16, 16, 4, 4, "2/10", "4", 800000],
];
export const DRONES: VehRow[] = [
  ["GMC Micromachine", "Microdrone", "3/6", 5, 5, 25, 0, 0, 1, 1, "—", "2", 450],
  ["Shiawase Kanmushi", "Microdrone", "2/3", 4, 5, 15, 0, 0, 3, 2, "—", "2", 900],
  ["Sikorsky-Bell Microskimmer XXS", "Microdrone", "2", 6, 10, 35, 0, 0, 2, 1, "—", "2", 850],
  ["MCT Gnat", "Microdrone", "3", 4, 10, 30, 0, 0, 2, 1, "—", "2", 800],
  ["GM-Nissan Flip-Flop", "Minidrone", "2/4", 8, 15, 50, 1, 0, 2, 1, "—", "2", 1000],
  ["Shiawase Inu", "Minidrone", "2/3", 6, 8, 24, 1, 0, 2, 2, "—", "2", 1100],
  ["Horizon Flying Eye", "Minidrone", "3", 15, 15, 40, 1, 0, 2, 2, "—", "2", 2000],
  ["MCT Hornet", "Minidrone", "3", 20, 15, 35, 1, 0, 2, 2, "—", "2", 2100],
  ["Chrysler-Nissan Pursuit V", "Small drone", "3/6", 30, 50, 280, 4, 2, 4, 3, "—", "3", 11000],
  ["Aztechnology Crawler", "Small drone", "3/4", 8, 10, 30, 6, 2, 2, 2, "—", "2", 4500],
  ["Cyberspace Designs Quadrotor", "Small drone", "2", 15, 20, 120, 3, 1, 3, 2, "—", "2", 5000],
  ["Lockheed Optic-X2", "Small drone", "4", 15, 30, 140, 2, 4, 4, 4, "—", "3", 18000],
  ["GM-Nissan Doberman", "Medium drone", "3/5", 10, 15, 100, 4, 6, 2, 3, "—", "2", 6500],
  ["Nissan Samurai", "Medium drone", "3/4", 10, 10, 30, 6, 6, 3, 2, "—", "2", 4500],
  ["Nissan Oni", "Medium drone", "3/4", 10, 8, 30, 9, 10, 3, 2, "—", "2", 6700],
  ["MCT-Nissan Roto-Drone", "Medium drone", "3", 20, 30, 160, 5, 6, 3, 2, "—", "2", 5000],
  ["Federated Boeing Blackhawk", "Medium drone", "3", 35, 40, 200, 8, 6, 3, 3, "—", "3", 8000],
  ["Steel Lynx Combat Drone", "Large drone", "3/5", 15, 15, 80, 12, 16, 4, 4, "—", "4", 25000],
  ["Ares Packmule", "Large drone", "3/4", 6, 5, 30, 8, 6, 2, 1, "—", "3", 10000],
  ["Cyberspace Designs Dalmatian", "Large drone", "3", 13, 20, 130, 6, 4, 3, 3, "—", "3", 10000],
  ["Ares Black Sky", "Large drone", "2", 25, 50, 300, 8, 10, 4, 4, "—", "5", 43000],
];
