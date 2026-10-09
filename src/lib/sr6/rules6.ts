/**
 * Sixth World rules data the sheet tabs automate: Matrix actions, gear, programs, complex forms, sprites,
 * spells and spirits. Numbers are game statistics; descriptions are short paraphrases, not book text.
 */
export type Slot = "attack" | "sleaze" | "dp" | "fw";

export interface MatrixAction {
  id: string;
  name: string;
  legal: boolean;
  skill: "cracking" | "electronics" | "";
  attr: string;
  against?: string;
  /** Hacking actions tied to Attack or Sleaze take a penalty when that is your lower of the two. */
  linked?: "attack" | "sleaze";
  /** Fixed threshold instead of an opposed roll. */
  threshold?: number;
  extended?: string;
  note: string;
}

export const MATRIX_ACTIONS: MatrixAction[] = [
  { id: "brute", name: "Brute Force", legal: false, skill: "cracking", attr: "logic", against: "Willpower + Firewall", linked: "attack", note: "Fast, loud way to User or Admin access. Always alerts the target. Admin without User access: opposition gets Firewall +2 and +4 Defense Rating." },
  { id: "probe", name: "Probe", legal: false, skill: "cracking", attr: "logic", against: "Willpower + Firewall or Firewall × 2", linked: "sleaze", extended: "1 minute", note: "Quiet. Net hits become a dice bonus on a later Backdoor Entry." },
  { id: "backdoor", name: "Backdoor Entry", legal: false, skill: "cracking", attr: "logic", against: "Willpower + Firewall", linked: "sleaze", note: "Needs a successful Probe first; its net hits add to this test. Success gives Admin access." },
  { id: "spike", name: "Data Spike", legal: false, skill: "cracking", attr: "logic", against: "Data Processing + Firewall", linked: "attack", note: "Matrix damage: Attack ÷ 2 (rounded up) plus 1 per net hit." },
  { id: "tarpit", name: "Tarpit", legal: false, skill: "cracking", attr: "logic", against: "Data Processing + Firewall", linked: "attack", note: "1 + net hits damage, and the target's Data Processing drops by the same amount." },
  { id: "crash", name: "Crash Program", legal: false, skill: "cracking", attr: "logic", against: "Data Processing + Device Rating", note: "Scrambles a running program until the device reboots. Needs Admin access." },
  { id: "snoop", name: "Snoop", legal: false, skill: "cracking", attr: "logic", against: "Logic + Firewall or Data Processing + Firewall", note: "Intercept the target's traffic while you keep access." },
  { id: "spoof", name: "Spoof Command", legal: false, skill: "cracking", attr: "logic", against: "Data Processing or Pilot + Firewall", note: "Send a forged order a device treats as its owner's." },
  { id: "crack", name: "Crack File", legal: false, skill: "cracking", attr: "logic", against: "Encryption rating × 2", note: "Strip a file's protection." },
  { id: "jam", name: "Jam Signals", legal: false, skill: "cracking", attr: "logic", note: "Your hits become noise for every device within 100 m." },
  { id: "checkos", name: "Check Overwatch Score", legal: false, skill: "cracking", attr: "logic", threshold: 4, note: "Threshold 4. Admin access needed. Tells you your current score." },
  { id: "hide", name: "Hide", legal: false, skill: "cracking", attr: "intuition", against: "Intuition + Data Processing or Data Processing + Sleaze", note: "Make a target lose track of you." },
  { id: "control", name: "Control Device", legal: true, skill: "electronics", attr: "logic", against: "Willpower + Firewall", note: "Use a device as its owner would. Not against a device a rigger is jumped into." },
  { id: "edit", name: "Edit File", legal: true, skill: "electronics", attr: "logic", against: "Intuition + Firewall or Firewall + Sleaze", note: "Create, change, copy, delete or protect a file, one detail per action." },
  { id: "encrypt", name: "Encrypt File", legal: true, skill: "electronics", attr: "logic", note: "Your hits set the file's Encryption rating." },
  { id: "format", name: "Format Device", legal: true, skill: "electronics", attr: "logic", against: "Willpower + Firewall or Firewall × 2", note: "Admin access. The device shuts down for good at its next reboot." },
  { id: "reboot", name: "Reboot Device", legal: true, skill: "electronics", attr: "logic", against: "Willpower + Firewall or Firewall × 2", note: "Target goes offline until the end of next round; its Overwatch Score and access reset." },
  { id: "jump", name: "Jump into Rigged Device", legal: true, skill: "electronics", attr: "logic", against: "Willpower + Firewall or Firewall × 2", note: "VR and a control rig needed. No test if the device is yours." },
  { id: "disarm", name: "Disarm Data Bomb", legal: true, skill: "cracking", attr: "logic", against: "Data Bomb rating × 2", note: "Any net hit removes the bomb; otherwise it goes off." },
  { id: "bomb", name: "Set Data Bomb", legal: false, skill: "electronics", attr: "logic", against: "Device Rating × 2", note: "Bomb rating up to your net hits. Triggers for Rating × 2 Matrix damage." },
  { id: "erase", name: "Erase Matrix Signature", legal: false, skill: "electronics", attr: "logic", against: "Willpower + Firewall or Firewall × 2", note: "Needs a Resonance rating. Removes a Resonance being's signature." },
  { id: "hash", name: "Hash Check", legal: false, skill: "electronics", attr: "logic", note: "Threshold 1 with a hash value, 4 on your own. Narrows matches to 32, halved per net hit." },
  { id: "percept", name: "Matrix Perception", legal: true, skill: "electronics", attr: "intuition", against: "Willpower + Sleaze", note: "A tie reveals the icon, 1 net hit basic info, 2 net hits attributes and programs." },
  { id: "search", name: "Matrix Search", legal: true, skill: "electronics", attr: "intuition", extended: "10 minutes", note: "Search the public Matrix." },
  { id: "trace", name: "Trace Icon", legal: false, skill: "electronics", attr: "intuition", against: "Willpower + Sleaze or Firewall + Sleaze", note: "Find the physical location behind an icon." },
  { id: "jackout", name: "Jack Out", legal: true, skill: "electronics", attr: "willpower", against: "Charisma + Data Processing or Attack + Data Processing", note: "Only rolled if someone link-locked you. You suffer dumpshock if you were in VR." },
];

/** Actions with no roll, shown as a reminder. */
export const MATRIX_FREE_ACTIONS = ["Change Icon", "Enter/Exit Host", "Reconfigure Matrix Attribute", "Send Message", "Switch Interface Mode", "Full Matrix Defense (add Firewall to every defense test this round)"];

export interface Commlink { name: string; rating: number; d: number; f: number; slots: number }
export const COMMLINKS: Commlink[] = [
  { name: "Meta Link", rating: 1, d: 1, f: 0, slots: 0 },
  { name: "Sony Emperor", rating: 2, d: 1, f: 1, slots: 1 },
  { name: "Renraku Sensei", rating: 3, d: 2, f: 0, slots: 1 },
  { name: "Erika Elite", rating: 4, d: 2, f: 1, slots: 2 },
  { name: "Hermes Ikon", rating: 5, d: 3, f: 0, slots: 2 },
  { name: "Transys Avalon", rating: 6, d: 3, f: 1, slots: 3 },
];
export interface Cyberdeck { name: string; rating: number; a: number; s: number; slots: number }
export const CYBERDECKS: Cyberdeck[] = [
  { name: "Erika MCD-6", rating: 1, a: 4, s: 3, slots: 2 },
  { name: "Spinrad Falcon", rating: 2, a: 5, s: 4, slots: 4 },
  { name: "MCT 360", rating: 3, a: 6, s: 5, slots: 6 },
  { name: "Renraku Kitsune", rating: 4, a: 7, s: 6, slots: 8 },
  { name: "Shiawase Cyber-6", rating: 5, a: 8, s: 7, slots: 10 },
  { name: "Fairlight Excalibur", rating: 6, a: 9, s: 8, slots: 12 },
];
export interface Cyberjack { rating: number; d: number; f: number; dice: number }
export const CYBERJACKS: Cyberjack[] = [
  { rating: 1, d: 4, f: 3, dice: 1 }, { rating: 2, d: 5, f: 4, dice: 1 }, { rating: 3, d: 6, f: 5, dice: 1 },
  { rating: 4, d: 7, f: 6, dice: 2 }, { rating: 5, d: 8, f: 7, dice: 2 }, { rating: 6, d: 9, f: 8, dice: 2 },
];

export interface ProgramDef { id: string; name: string; group: "Basic" | "Hacking"; note: string; dp?: number; defense?: number; dice?: number }
export const PROGRAMS: ProgramDef[] = [
  { id: "baby", name: "Baby Monitor", group: "Basic", note: "Shows your Overwatch Score without an action." },
  { id: "browse", name: "Browse", group: "Basic", note: "1 Edge on a Matrix search, used right away." },
  { id: "configurator", name: "Configurator", group: "Basic", note: "Store a second attribute arrangement and swap to it." },
  { id: "edit", name: "Edit", group: "Basic", note: "1 Edge on Edit File, used right away." },
  { id: "encryption", name: "Encryption", group: "Basic", note: "+2 dice on Encrypt File." },
  { id: "scrubber", name: "Signal Scrubber", group: "Basic", note: "Reduce noise by 2." },
  { id: "toolbox", name: "Toolbox", group: "Basic", note: "+1 Data Processing.", dp: 1 },
  { id: "vm", name: "Virtual Machine", group: "Basic", note: "2 extra program slots; 1 extra unresisted Matrix damage when attacked." },
  { id: "armor", name: "Armor", group: "Hacking", note: "+2 Defense Rating.", defense: 2 },
  { id: "biofeedback", name: "Biofeedback", group: "Hacking", note: "Matrix attacks also hurt the user: Stun in cold-sim, Physical in hot-sim. Linked to Attack." },
  { id: "bffilter", name: "Biofeedback Filter", group: "Hacking", note: "Roll Device Rating or Body to soak Matrix damage." },
  { id: "blackout", name: "Blackout", group: "Hacking", note: "Like Biofeedback but Stun only. Linked to Attack." },
  { id: "decryption", name: "Decryption", group: "Hacking", note: "+2 dice on Crack File." },
  { id: "defuse", name: "Defuse", group: "Hacking", note: "Roll Device Rating or Body to soak Data Bomb damage." },
  { id: "exploit", name: "Exploit", group: "Hacking", note: "Lowers a hacking target's Defense Rating by 2." },
  { id: "fork", name: "Fork", group: "Hacking", note: "Hit two targets with one action without splitting dice." },
  { id: "lockdown", name: "Lockdown", group: "Hacking", note: "Link-locks a target when you do Matrix damage." },
  { id: "overclock", name: "Overclock", group: "Hacking", note: "Add two dice to a Matrix action.", dice: 2 },
  { id: "stealth", name: "Stealth", group: "Hacking", note: "1 Edge on Hide, used right away. Linked to Sleaze." },
  { id: "trace", name: "Trace", group: "Hacking", note: "1 Edge on Trace Icon, used right away. Linked to Sleaze." },
];

export interface ComplexForm { name: string; fade: number; dur: "I" | "S" | "P"; pool: string; note: string; skill: "electronics" | "cracking"; against?: string }
export const COMPLEX_FORMS: ComplexForm[] = [
  { name: "Cleaner", fade: 2, dur: "P", skill: "electronics", pool: "Electronics + Resonance", note: "Each hit lowers your Overwatch Score by 1." },
  { name: "Diffusion", fade: 4, dur: "S", skill: "electronics", against: "Willpower + Firewall", pool: "Electronics + Resonance", note: "Each net hit lowers a chosen Matrix attribute by 1, minimum 1." },
  { name: "Editor", fade: 3, dur: "P", skill: "electronics", pool: "Electronics + Resonance", note: "Edit File without the proper access level." },
  { name: "Emulate", fade: 0, dur: "S", skill: "electronics", pool: "Electronics + Resonance", note: "Run one program, including autosofts rated at your Data Processing. Buy again for more." },
  { name: "Infusion", fade: 4, dur: "S", skill: "electronics", pool: "Electronics + Resonance (4)", note: "Each net hit raises a Matrix attribute by 1, up to double its rating." },
  { name: "Mirrored Persona", fade: 3, dur: "S", skill: "electronics", pool: "Electronics + Resonance", note: "A duplicate persona rated at your hits; attackers must see through it first." },
  { name: "Pulse Storm", fade: 3, dur: "I", skill: "electronics", against: "Logic + Data Processing", pool: "Electronics + Resonance", note: "Each net hit raises the target's noise by 1." },
  { name: "Puppeteer", fade: 5, dur: "S", skill: "electronics", pool: "Electronics + Resonance", note: "Control Device without the proper access level." },
  { name: "Resonance Channel", fade: 2, dur: "S", skill: "electronics", pool: "Electronics + Resonance", note: "Each hit lowers your noise by 1." },
  { name: "Resonance Spike", fade: 4, dur: "I", skill: "cracking", against: "Willpower + Firewall", pool: "Cracking + Resonance", note: "Each net hit causes 1 box of unresisted Matrix damage." },
  { name: "Resonance Veil", fade: 4, dur: "S", skill: "electronics", against: "Intuition + Data Processing", pool: "Electronics + Resonance", note: "A false Matrix event; seeing through it needs a Matrix Perception at your net hits." },
  { name: "Static Bomb", fade: 6, dur: "I", skill: "electronics", against: "Intuition + Data Processing", pool: "Electronics + Resonance", note: "Everything that can detect you loses you unless it gets net hits." },
  { name: "Static Veil", fade: 3, dur: "S", skill: "electronics", against: "Willpower or Firewall + Firewall", pool: "Electronics + Resonance", note: "A target stops gaining Overwatch from maintained illegal access." },
  { name: "Stitches", fade: 4, dur: "P", skill: "electronics", pool: "Electronics + Resonance", note: "Each net hit repairs 1 box of Matrix damage on a sprite." },
  { name: "Tattletale", fade: 3, dur: "P", skill: "electronics", pool: "Electronics + Resonance", note: "Each hit raises the target's Overwatch Score by 1." },
];

export interface SpriteType { id: string; name: string; a: number; s: number; d: number; f: number; init: number; powers: string }
export const SPRITES: SpriteType[] = [
  { id: "courier", name: "Courier", a: 0, s: 3, d: 1, f: 2, init: 1, powers: "Cookie, Hash" },
  { id: "crack", name: "Crack", a: 0, s: 3, d: 2, f: 1, init: 2, powers: "Phantom, Suppression" },
  { id: "data", name: "Data", a: -1, s: 0, d: 4, f: 1, init: 4, powers: "Camouflage, Watermark" },
  { id: "fault", name: "Fault", a: 3, s: 0, d: 1, f: 2, init: 1, powers: "Electron Storm, Trap" },
  { id: "machine", name: "Machine", a: 1, s: 0, d: 3, f: 2, init: 3, powers: "Diagnostics, Override, Stability" },
];

export interface SpellDef { name: string; cat: "Combat" | "Detection" | "Health" | "Illusion" | "Manipulation"; kind?: "direct" | "indirect"; area?: boolean; range: string; type: "M" | "P"; dur: string; dv: number | null; dmg?: "S" | "P" }
const sp = (name: string, cat: SpellDef["cat"], range: string, type: "M" | "P", dur: string, dv: number | null, extra: Partial<SpellDef> = {}): SpellDef => ({ name, cat, range, type, dur, dv, ...extra });
export const SPELLS: SpellDef[] = [
  sp("Acid Stream", "Combat", "LOS", "P", "I", 5, { kind: "indirect", dmg: "P" }),
  sp("Toxic Wave", "Combat", "LOS (A)", "P", "I", 6, { kind: "indirect", area: true, dmg: "P" }),
  sp("Clout", "Combat", "LOS", "P", "I", 3, { kind: "indirect", dmg: "S" }),
  sp("Blast", "Combat", "LOS (A)", "P", "I", 4, { kind: "indirect", area: true, dmg: "S" }),
  sp("Flamestrike", "Combat", "LOS", "P", "I", 5, { kind: "indirect", dmg: "P" }),
  sp("Fireball", "Combat", "LOS (A)", "P", "I", 6, { kind: "indirect", area: true, dmg: "P" }),
  sp("Ice Spear", "Combat", "LOS", "P", "I", 5, { kind: "indirect", dmg: "P" }),
  sp("Ice Storm", "Combat", "LOS (A)", "P", "I", 6, { kind: "indirect", area: true, dmg: "P" }),
  sp("Lightning Bolt", "Combat", "LOS", "P", "I", 5, { kind: "indirect", dmg: "P" }),
  sp("Lightning Ball", "Combat", "LOS (A)", "P", "I", 6, { kind: "indirect", area: true, dmg: "P" }),
  sp("Manabolt", "Combat", "LOS", "M", "I", 4, { kind: "direct", dmg: "P" }),
  sp("Manaball", "Combat", "LOS (A)", "M", "I", 5, { kind: "direct", area: true, dmg: "P" }),
  sp("Powerbolt", "Combat", "LOS", "P", "I", 4, { kind: "direct", dmg: "P" }),
  sp("Powerball", "Combat", "LOS (A)", "P", "I", 5, { kind: "direct", area: true, dmg: "P" }),
  sp("Stunbolt", "Combat", "LOS", "M", "I", 3, { kind: "direct", dmg: "S" }),
  sp("Stunball", "Combat", "LOS (A)", "M", "I", 4, { kind: "direct", area: true, dmg: "S" }),
  sp("Analyze Device", "Detection", "Touch", "P", "S", 2),
  sp("Analyze Magic", "Detection", "Touch", "P", "S", 3),
  sp("Analyze Truth", "Detection", "Touch", "M", "S", 3),
  sp("Clairaudience", "Detection", "Touch", "M", "S", 3),
  sp("Clairvoyance", "Detection", "Touch", "M", "S", 3),
  sp("Combat Sense", "Detection", "Touch", "M", "S", 3),
  sp("Detect Enemies", "Detection", "Touch", "M", "S", 3),
  sp("Detect Life", "Detection", "Touch", "M", "S", 3),
  sp("Detect Magic", "Detection", "Touch", "M", "S", 4),
  sp("Mindlink", "Detection", "Touch", "M", "S", 3),
  sp("Mind Probe", "Detection", "Touch", "P", "S", 5),
  sp("Antidote", "Health", "Touch", "P", "P", 5),
  sp("Cleansing Heal", "Health", "Touch", "P", "P", 5),
  sp("Cooling Heal", "Health", "Touch", "P", "P", 5),
  sp("Decrease Attribute", "Health", "Touch", "P", "S", 3),
  sp("Heal", "Health", "Touch", "P", "P", 3),
  sp("Increase Attribute", "Health", "Touch", "P", "S", 3),
  sp("Increase Reflexes", "Health", "Touch", "P", "S", 5),
  sp("Resist Pain", "Health", "Touch", "M", "S", 3),
  sp("Stabilize", "Health", "Touch", "M", "P", 3),
  sp("Warming Heal", "Health", "Touch", "P", "P", 5),
  sp("Agony", "Illusion", "LOS", "M", "S", 3),
  sp("Chaos", "Illusion", "LOS", "M", "S", 4),
  sp("Confusion", "Illusion", "LOS", "M", "S", 3),
  sp("Hush", "Illusion", "Touch", "P", "S", 3),
  sp("Silence", "Illusion", "Touch", "P", "S", 4),
  sp("Invisibility", "Illusion", "Touch", "M", "S", 3),
  sp("Improved Invisibility", "Illusion", "Touch", "P", "S", 4),
  sp("Mask", "Illusion", "Touch", "M", "S", 3),
  sp("Physical Mask", "Illusion", "Touch", "P", "S", 4),
  sp("Phantasm", "Illusion", "LOS (A)", "M", "S", 3),
  sp("Trid Phantasm", "Illusion", "LOS (A)", "P", "S", 4),
  sp("Sensor Sneak", "Illusion", "Touch", "P", "S", 2),
  sp("Animate Metal", "Manipulation", "LOS", "P", "L", null),
  sp("Animate Plastic", "Manipulation", "LOS", "P", "L", null),
  sp("Animate Stone", "Manipulation", "LOS", "P", "L", null),
  sp("Animate Wood", "Manipulation", "LOS", "P", "L", null),
  sp("Armor", "Manipulation", "Touch", "P", "S", 4),
  sp("Control Actions", "Manipulation", "LOS", "M", "L", 4),
  sp("Control Thoughts", "Manipulation", "LOS", "M", "L", 4),
  sp("Darkness", "Manipulation", "LOS (A)", "P", "S", 3),
  sp("Light", "Manipulation", "LOS (A)", "P", "S", 3),
  sp("Elemental Armor", "Manipulation", "Touch", "M", "S", 5),
  sp("Fling", "Manipulation", "LOS", "P", "I", 5),
  sp("Focus Burst", "Manipulation", "Touch", "M", "L", 7),
  sp("Levitate", "Manipulation", "LOS", "P", "S", 6),
  sp("Mana Barrier", "Manipulation", "LOS (A)", "M", "S", 5),
  sp("Mystic Armor", "Manipulation", "Touch", "M", "S", 3),
  sp("Overclock", "Manipulation", "LOS", "P", "S", 4),
  sp("Physical Barrier", "Manipulation", "LOS (A)", "P", "S", 6),
  sp("Shape Metal", "Manipulation", "LOS", "P", "S", null),
  sp("Shape Plastic", "Manipulation", "LOS", "P", "S", null),
  sp("Shape Stone", "Manipulation", "LOS", "P", "S", null),
  sp("Shape Wood", "Manipulation", "LOS", "P", "S", null),
  sp("Strengthen Wall", "Manipulation", "LOS (A)", "P", "S", 4),
  sp("Thunder", "Manipulation", "LOS (A)", "P", "S", 3),
  sp("Vehicle Armor", "Manipulation", "Touch", "P", "S", 6),
];
export const SPELL_BY_NAME: Record<string, SpellDef> = Object.fromEntries(SPELLS.map((s) => [s.name.toLowerCase(), s]));

export interface SpiritType {
  id: string; name: string;
  /** Attribute offsets from Force: Body, Agility, Reaction, Strength, Willpower, Logic, Intuition, Charisma. */
  attrs: [number, number, number, number, number, number, number, number];
  init: number; defense: number; move: number;
  attack: { name: string; dv: string; dvKind: "force" | "half"; dmg: "P" | "S" };
  powers: string;
}
export const SPIRITS: SpiritType[] = [
  { id: "air", name: "Air", attrs: [-2, 3, 4, -3, 0, 0, 0, 0], init: 4, defense: -2, move: 5, attack: { name: "Elemental attack", dv: "F", dvKind: "force", dmg: "P" }, powers: "Accident, Concealment, Confusion, Engulf, Movement, Search" },
  { id: "beasts", name: "Beasts", attrs: [2, 1, 0, 2, 0, 0, 0, 0], init: 0, defense: 2, move: 3, attack: { name: "Claw or bite", dv: "F/2", dvKind: "half", dmg: "P" }, powers: "Animal Control, Enhanced Senses, Fear, Movement" },
  { id: "earth", name: "Earth", attrs: [4, -2, -1, 4, 0, -1, 0, 0], init: -1, defense: 4, move: 1, attack: { name: "Elemental attack", dv: "F", dvKind: "force", dmg: "P" }, powers: "Binding, Guard, Movement, Search" },
  { id: "fire", name: "Fire", attrs: [1, 2, 3, -2, 0, 0, 1, 0], init: 4, defense: 1, move: 5, attack: { name: "Elemental attack", dv: "F", dvKind: "force", dmg: "P" }, powers: "Accident, Confusion, Energy Aura, Engulf" },
  { id: "kin", name: "Kin", attrs: [1, 0, 2, -2, 0, 0, 1, 0], init: 3, defense: 1, move: 1, attack: { name: "Fists", dv: "F/2", dvKind: "half", dmg: "S" }, powers: "Accident, Concealment, Confusion, Influence, Search" },
  { id: "water", name: "Water", attrs: [0, 1, 2, 0, 0, 0, 0, 0], init: 2, defense: 0, move: 2, attack: { name: "Elemental attack", dv: "F", dvKind: "force", dmg: "P" }, powers: "Concealment, Confusion, Engulf, Movement, Search" },
];

export const SPIRIT_ATTR_LABELS = ["Body", "Agility", "Reaction", "Strength", "Willpower", "Logic", "Intuition", "Charisma"] as const;

export interface Rcc { name: string; rating: number; d: number; f: number }
export const RCCS: Rcc[] = [
  { name: "Scratch-built junk", rating: 1, d: 3, f: 2 },
  { name: "Allegiance Control Center", rating: 2, d: 3, f: 3 },
  { name: "Essy Motors DroneMaster", rating: 3, d: 4, f: 4 },
  { name: "Horizon Overseer", rating: 4, d: 5, f: 4 },
  { name: "Maersk Spider", rating: 4, d: 4, f: 5 },
  { name: "Vulcan Liegelord", rating: 5, d: 6, f: 5 },
  { name: "Proteus Poseidon", rating: 5, d: 5, f: 6 },
  { name: "Transys Eidolon", rating: 6, d: 6, f: 5 },
  { name: "Ares Red Dog", rating: 6, d: 7, f: 6 },
  { name: "Aztechnology Tlaloc", rating: 6, d: 8, f: 7 },
];

/** Regular attribute -> jumped-in attribute when a rigger is jacked into a vehicle or drone. */
export const JUMPED_IN: Record<string, string> = { body: "willpower", strength: "charisma", agility: "logic", reaction: "intuition" };

/** Conjuring: the spirit rolls Force × 2 dice. Total Force of active spirits is capped at Magic × 3. */
export const SPIRIT_FORCE_CAP = 3;
