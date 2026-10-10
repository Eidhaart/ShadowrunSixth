/**
 * Everything a player can personalise about the deck's look and voice. Settings store the ids; CSS in
 * globals.css reacts to the data-* attributes ApplySettings puts on <html>.
 */

export type ThemeId =
  | "sodium" | "matrix" | "astral" | "corp" | "terminal" | "neon" | "crimson" | "rust" | "jade" | "ice" | "blackout" | "zaibatsu"
  | "municipal" | "spraypaint" | "chrome" | "ronin" | "grimoire" | "totem" | "dojo" | "resonance" | "hazard" | "noir";

export type ThemeGroup = "Streets" | "Arcane" | "Steel" | "Matrix" | "Corporate" | "Classic";

export interface ThemeDef {
  id: ThemeId;
  name: string;
  blurb: string;
  group: ThemeGroup;
  light?: boolean;
  /** background, main accent, second accent, third accent */
  swatch: [string, string, string, string];
}

export const THEMES: ThemeDef[] = [
  { id: "sodium", name: "Sodium", group: "Classic", blurb: "Seattle night, amber street light, cyan data", swatch: ["#080a0e", "#ffae3d", "#43dbe8", "#b995ff"] },
  { id: "spraypaint", name: "Spraypaint", group: "Streets", blurb: "Wet asphalt tagged in pink, lime and yellow", swatch: ["#0d0d10", "#ff2d95", "#b8ff3c", "#ffd23f"] },
  { id: "chrome", name: "Chrome", group: "Streets", blurb: "Gunmetal bikes, flame paint, polished chrome", swatch: ["#0b0c0e", "#ff6a13", "#c9d3dc", "#ffcc33"] },
  { id: "rust", name: "Rust", group: "Streets", blurb: "Barrens scrap, burnt orange, oxidised teal", swatch: ["#0e0a07", "#e2762a", "#6cc7b8", "#c79cff"] },
  { id: "noir", name: "Noir", group: "Streets", blurb: "Smoky bar, whisky amber, a neon sign outside", swatch: ["#0e0d0c", "#d9a35b", "#4fd1c5", "#e86a92"] },
  { id: "neon", name: "Neon", group: "Streets", blurb: "Hot pink and electric cyan on indigo", swatch: ["#0b0620", "#ff3ea5", "#2df0ff", "#ffe14d"] },
  { id: "grimoire", name: "Grimoire", group: "Arcane", blurb: "Midnight study, gilt pages, violet wards", swatch: ["#0a0a16", "#e3b341", "#a78bfa", "#6fc3df"] },
  { id: "totem", name: "Totem", group: "Arcane", blurb: "Forest night, ochre paint, turquoise and rust", swatch: ["#0c0f0b", "#e0a03c", "#3fc1b0", "#c75b39"] },
  { id: "astral", name: "Astral", group: "Arcane", blurb: "Aura-lit violet with gold highlights", swatch: ["#0a0710", "#c39bff", "#ffd27a", "#7fd9ff"] },
  { id: "dojo", name: "Dojo", group: "Arcane", light: true, blurb: "Rice paper, sumi ink, vermilion seal, jade", swatch: ["#ece6da", "#c8321e", "#2f7d6d", "#1b1a17"] },
  { id: "ronin", name: "Ronin", group: "Steel", blurb: "Black lacquer, crimson cord, gold leaf", swatch: ["#0b0909", "#d7263d", "#d4af37", "#7fb8c9"] },
  { id: "crimson", name: "Crimson", group: "Steel", blurb: "Red Samurai black and blood red", swatch: ["#0c0607", "#ff3b3b", "#ffb34d", "#5fd0e0"] },
  { id: "hazard", name: "Hazard", group: "Steel", blurb: "Garage floor, safety yellow, warning orange", swatch: ["#0d0e10", "#ffc400", "#ff7a1a", "#4fc3f7"] },
  { id: "jade", name: "Jade", group: "Steel", blurb: "Triad lacquer, gold on deep green", swatch: ["#060c0b", "#e8c15a", "#3fe0b0", "#b995ff"] },
  { id: "matrix", name: "Matrix", group: "Matrix", blurb: "Cold AR overlay, cyan on deep teal, pink alerts", swatch: ["#04090c", "#3fe3ff", "#ff6fb1", "#5dffb0"] },
  { id: "terminal", name: "Terminal", group: "Matrix", blurb: "Green phosphor, old-school deck", swatch: ["#020a04", "#39ff7a", "#d6ff5c", "#7dffd0"] },
  { id: "resonance", name: "Resonance", group: "Matrix", blurb: "Iridescent teal to violet, living data", swatch: ["#05060c", "#7cf7e4", "#c07bff", "#ff8ad8"] },
  { id: "municipal", name: "Municipal Terminal", group: "Corporate", blurb: "Your Port Meridian terminal: THE red, cyan, yellow, green, blue", swatch: ["#150f1d", "#ff1238", "#1fe3f0", "#f6e33b"] },
  { id: "zaibatsu", name: "Zaibatsu", group: "Corporate", blurb: "Megacorp terminal: red hairlines, mono headings", swatch: ["#0a0708", "#ff2a3c", "#00f0ff", "#fcee0a"] },
  { id: "corp", name: "Corp", group: "Corporate", light: true, blurb: "Clean arcology light, megacorp red", swatch: ["#e7eaee", "#c8102e", "#0b6bcb", "#6d3fd1"] },
  { id: "ice", name: "Ice", group: "Corporate", light: true, blurb: "Pale lab light, cobalt and teal", swatch: ["#e6eef5", "#0a6fd6", "#0a8f9c", "#7b4ee0"] },
  { id: "blackout", name: "Blackout", group: "Classic", blurb: "Maximum contrast, yellow on black", swatch: ["#000000", "#ffe600", "#00e5ff", "#ff8cff"] },
];
export const THEME_GROUPS: ThemeGroup[] = ["Streets", "Arcane", "Steel", "Matrix", "Corporate", "Classic"];

export type FontId =
  | "street" | "terminal" | "clean" | "legible" | "system"
  | "marker" | "stencil" | "blackletter" | "arcane" | "uncial" | "crt" | "hud" | "katana" | "dossier" | "readout" | "mincho" | "glyphic" | "executive" | "glitch";

/** `ui` is the face for buttons, tabs and navigation when the display face is too ornate for small text. */
export interface FontDef { id: FontId; name: string; blurb: string; display: string; body: string; ui?: string }
const CHAKRA = '"Chakra Petch", ui-sans-serif, system-ui, sans-serif';
const PLEX = '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
export const FONTS: FontDef[] = [
  { id: "street", name: "Street", blurb: "Chakra Petch over Plex", display: '"Chakra Petch", ui-sans-serif, system-ui, sans-serif', body: PLEX },
  { id: "marker", name: "Spraycan", blurb: "Marker tags over clean text", display: '"Permanent Marker", "Chakra Petch", cursive', body: PLEX, ui: CHAKRA },
  { id: "blackletter", name: "Blackletter", blurb: "Go-gang jacket lettering", display: '"Pirata One", "Chakra Petch", serif', body: PLEX, ui: CHAKRA },
  { id: "stencil", name: "Stencil", blurb: "Crate and armor markings", display: '"Saira Stencil One", "Chakra Petch", sans-serif', body: PLEX, ui: CHAKRA },
  { id: "dossier", name: "Dossier", blurb: "Typewritten files from a fixer", display: '"Special Elite", "Courier New", monospace', body: PLEX },
  { id: "arcane", name: "Grimoire", blurb: "Carved capitals over book serif", display: '"Cinzel", Georgia, serif', body: '"Crimson Pro", Georgia, serif' },
  { id: "uncial", name: "Uncial", blurb: "Old hand over calligraphic serif", display: '"Uncial Antiqua", Georgia, serif', body: '"Alegreya", Georgia, serif', ui: '"Alegreya", Georgia, serif' },
  { id: "mincho", name: "Mincho", blurb: "Brushed serif for the quiet path", display: '"Shippori Mincho", Georgia, serif', body: '"Shippori Mincho", Georgia, serif' },
  { id: "katana", name: "Katana", blurb: "Tall condensed steel", display: '"Teko", "Rajdhani", sans-serif', body: '"Rajdhani", ' + PLEX, ui: '"Rajdhani", ' + PLEX },
  { id: "hud", name: "HUD", blurb: "Vehicle heads-up display", display: '"Oxanium", "Chakra Petch", sans-serif', body: '"Rajdhani", ' + PLEX },
  { id: "readout", name: "Readout", blurb: "Share Tech Mono terminal headings", display: '"Share Tech Mono", ' + MONO, body: PLEX, ui: '"Share Tech Mono", ' + MONO },
  { id: "crt", name: "CRT", blurb: "Pixel terminal headings", display: '"VT323", ' + MONO, body: '"Share Tech Mono", ' + MONO, ui: '"Share Tech Mono", ' + MONO },
  { id: "terminal", name: "Terminal", blurb: "Monospace everywhere", display: MONO, body: MONO },
  { id: "glyphic", name: "Glyphic", blurb: "Resonant lowercase glyphs", display: '"Major Mono Display", ' + MONO, body: '"Syne Mono", ' + MONO, ui: '"Syne Mono", ' + MONO },
  { id: "glitch", name: "Glitch", blurb: "Corrupted headings, clean text", display: '"Rubik Glitch", "Chakra Petch", sans-serif', body: PLEX, ui: CHAKRA },
  { id: "executive", name: "Executive", blurb: "Boardroom grotesque", display: '"Archivo", ui-sans-serif, sans-serif', body: '"Archivo", ui-sans-serif, sans-serif' },
  { id: "clean", name: "Clean", blurb: "IBM Plex Sans throughout", display: PLEX, body: PLEX },
  { id: "legible", name: "Legible", blurb: "Atkinson Hyperlegible, easy on the eyes", display: '"Atkinson Hyperlegible", ui-sans-serif, sans-serif', body: '"Atkinson Hyperlegible", ui-sans-serif, sans-serif' },
  { id: "system", name: "System", blurb: "Your device's own font", display: "ui-sans-serif, system-ui, sans-serif", body: "ui-sans-serif, system-ui, sans-serif" },
];

export type OrnamentId = "barcode" | "brackets" | "tape" | "rivets" | "seal" | "filigree" | "stitch" | "traces" | "hazard" | "frame" | "none";
export const ORNAMENTS: { id: OrnamentId; name: string; blurb: string }[] = [
  { id: "brackets", name: "HUD brackets", blurb: "Corner brackets" },
  { id: "tape", name: "Duct tape", blurb: "Taped to the wall" },
  { id: "rivets", name: "Rivets", blurb: "Bolted plate" },
  { id: "seal", name: "Hanko seal", blurb: "Red stamp in the corner" },
  { id: "filigree", name: "Filigree", blurb: "Double rule, gilt corners" },
  { id: "stitch", name: "Stitched", blurb: "Hide and sinew" },
  { id: "traces", name: "Traces", blurb: "Circuit bars" },
  { id: "hazard", name: "Hazard", blurb: "Warning stripes on headers" },
  { id: "frame", name: "Frame", blurb: "Thin inner rule, top bar" },
  { id: "barcode", name: "Barcode", blurb: "Terminal barcode on headers" },
  { id: "none", name: "Plain", blurb: "No decoration" },
];

export type MotifId = "grid" | "glow" | "flat" | "spray" | "sigil" | "enso" | "topo" | "circuit" | "rain" | "stream" | "stars" | "hex";
export const MOTIFS: { id: MotifId; name: string }[] = [
  { id: "grid", name: "Grid and glow" }, { id: "glow", name: "Glow only" }, { id: "flat", name: "Flat" },
  { id: "spray", name: "Spray speckle" }, { id: "rain", name: "Rain" }, { id: "sigil", name: "Warding circle" },
  { id: "topo", name: "Contour lines" }, { id: "stars", name: "Astral motes" }, { id: "enso", name: "Ensō" },
  { id: "circuit", name: "Circuit" }, { id: "stream", name: "Data stream" }, { id: "hex", name: "Hex mesh" },
];

export type HeadsId = "plain" | "caps" | "slant" | "glow" | "bar";
export const HEADS: { id: HeadsId; name: string }[] = [
  { id: "plain", name: "Plain" }, { id: "bar", name: "Underscored" }, { id: "caps", name: "Spaced capitals" }, { id: "slant", name: "Slanted" }, { id: "glow", name: "Glowing" },
];

/** Symbols that can mark every panel header. Text presentation is forced so none render as emoji. */
export const GLYPHS = ["", "▸", "◆", "✦", "✶", "✕", "☽", "▲", "⬡", "⌬", "■", "▪", "§", "※", "◯", "⚡", "☠", "⚔", "♠", "⌘", "☯"] as const;

export type VoiceId = "deck" | "street" | "fixer" | "arcane" | "shaman" | "adept" | "samurai" | "decker" | "techno" | "rigger" | "corp";
export interface VoiceDef {
  id: VoiceId;
  name: string;
  greet: (handle: string) => string;
  kicker: string;
  /** Boot screen lines; `book` is the rulebook status line. */
  boot: (book: string, deck: string) => string[];
}
const dots = (s: string, tail: string) => `${s} ${".".repeat(Math.max(3, 40 - s.length))} ${tail}`;
export const VOICES: VoiceDef[] = [
  {
    id: "deck", name: "Deck", greet: (h) => (h ? `Jacked in, ${h}` : "Jacked in"),
    kicker: "Rules, dice, runners and the table chat in one place. Everything stays on your device unless you link a room.",
    boot: (b, d) => [`${d} BIOS 6.0.80  //  cyberdeck cold start`, dots("seating datajack", "ok"), dots("loading ICE-breaker stubs", "ok"), b, dots("forging fake SIN", "rating 4"), "jacking in"],
  },
  {
    id: "street", name: "Street", greet: (h) => (h ? `Yo ${h}, deck's warm` : "Yo chummer, deck's warm"),
    kicker: "Rules, dice, your crew and the chat. Nothing leaves this deck unless you say so.",
    boot: (b, d) => [`${d} // junk-deck, held together with tape`, dots("leeching the neighbor's signal", "got it"), dots("loading cracked ICE-breakers", "ok"), b, dots("faking a SIN", "don't look close"), "let's go"],
  },
  {
    id: "fixer", name: "Fixer", greet: (h) => (h ? `Got work for you, ${h}` : "Got work for you"),
    kicker: "Everything you need for the job: the rules, the dice, the crew and a quiet line to the table.",
    boot: (b, d) => [`${d} // private line`, dots("checking for tails", "clean"), dots("calling in favors", "3 owed"), b, dots("laundering the advance", "done"), "meet's on"],
  },
  {
    id: "arcane", name: "Hermetic", greet: (h) => (h ? `The circle is drawn, ${h}` : "The circle is drawn"),
    kicker: "Lore, dice, your cabal and the speaking-stones. Nothing leaves these wards unless you will it.",
    boot: (b, d) => [`${d} // opening the warded pages`, dots("drawing the circle", "closed"), dots("binding the watcher", "bound"), b, dots("masking the aura", "Force 4"), "the astral is quiet. proceed"],
  },
  {
    id: "shaman", name: "Shamanic", greet: (h) => (h ? `The spirits are listening, ${h}` : "The spirits are listening"),
    kicker: "The old stories, the bones you cast, your people and the voices on the wind.",
    boot: (b, d) => [`${d} // waking the totem`, dots("smudging the deck", "clean"), dots("asking the spirits' leave", "granted"), b, dots("walking softly", "unseen"), "the path is open"],
  },
  {
    id: "adept", name: "Adept", greet: (h) => (h ? `Breathe, ${h}. The body is ready` : "Breathe. The body is ready"),
    kicker: "Discipline, the dice, your companions and a channel to the table. Focus.",
    boot: (b, d) => [`${d} // centering`, dots("breath", "slow"), dots("ki", "flowing"), b, dots("distraction", "none"), "begin"],
  },
  {
    id: "samurai", name: "Samurai", greet: (h) => (h ? `Blade ready, ${h}` : "Blade ready"),
    kicker: "Know the rules. Know your weapon. Know your crew.",
    boot: (b, d) => [`${d} // bushido protocol`, dots("wired reflexes", "online"), dots("smartlink handshake", "locked"), b, dots("contract terms", "accepted"), "draw"],
  },
  {
    id: "decker", name: "Decker", greet: (h) => (h ? `Session open, ${h}` : "Session open"),
    kicker: "Rules, dice, persona files and an encrypted channel. Keep your Overwatch Score low.",
    boot: (b, d) => [`${d} BIOS 6.0.80  //  cold start`, dots("spoofing grid credentials", "ok"), dots("Overwatch Score", "0"), b, dots("loading persona", "online"), "you're in"],
  },
  {
    id: "techno", name: "Technomancer", greet: (h) => (h ? `The Resonance hums, ${h}` : "The Resonance hums"),
    kicker: "No hardware needed. The rules, the dice, your sprites and the stream.",
    boot: (b, d) => [`${d} // no hardware detected`, dots("living persona", "coherent"), dots("compiling sprite", "ok"), b, dots("fading", "negligible"), "dissolving into the stream"],
  },
  {
    id: "rigger", name: "Rigger", greet: (h) => (h ? `Engines warm, ${h}` : "Engines warm"),
    kicker: "Rules, dice, the crew roster and comms. Drones are slaved, fuel is topped up.",
    boot: (b, d) => [`${d} // control rig sync`, dots("drone swarm", "4 of 4 slaved"), dots("autosofts", "loaded"), b, dots("fuel", "87%"), "jumping in"],
  },
  {
    id: "corp", name: "Corporate", greet: (h) => (h ? `Welcome back, ${h}. This session is recorded` : "Welcome back. This session is recorded"),
    kicker: "Operational reference, probability engine, personnel files and a secure channel. All activity on this terminal is logged.",
    boot: (b, d) => [`${d} // AUTHORIZED PERSONNEL ONLY`, dots("verifying SIN", "valid"), dots("loading compliance module", "ok"), b, dots("audit trail", "enabled"), "access granted"],
  },
];

export interface PackSettings {
  theme: ThemeId; font: FontId; ornament: OrnamentId; backdrop: MotifId; glyph: string; heads: HeadsId; voice: VoiceId;
  corners: "cut" | "square" | "round";
}
export interface PackDef { id: string; name: string; blurb: string; s: PackSettings }

export const PACKS: PackDef[] = [
  { id: "classic", name: "Sixthdeck", blurb: "The original cyberdeck", s: { theme: "sodium", font: "street", ornament: "brackets", backdrop: "grid", glyph: "", heads: "plain", voice: "deck", corners: "cut" } },
  { id: "street-kid", name: "Street kid", blurb: "Tagged walls, borrowed signal, big dreams", s: { theme: "spraypaint", font: "marker", ornament: "tape", backdrop: "spray", glyph: "✕", heads: "slant", voice: "street", corners: "cut" } },
  { id: "go-ganger", name: "Go-ganger", blurb: "Chrome, flame paint and a loud engine", s: { theme: "chrome", font: "blackletter", ornament: "rivets", backdrop: "rain", glyph: "☠", heads: "caps", voice: "street", corners: "square" } },
  { id: "samurai", name: "Street samurai", blurb: "Lacquer, steel and a code", s: { theme: "ronin", font: "katana", ornament: "seal", backdrop: "enso", glyph: "⚔", heads: "caps", voice: "samurai", corners: "square" } },
  { id: "hermetic", name: "Hermetic mage", blurb: "Gilt grimoire and a drawn circle", s: { theme: "grimoire", font: "arcane", ornament: "filigree", backdrop: "sigil", glyph: "✦", heads: "bar", voice: "arcane", corners: "square" } },
  { id: "shaman", name: "Shaman", blurb: "Ochre, turquoise and the old ways", s: { theme: "totem", font: "uncial", ornament: "stitch", backdrop: "topo", glyph: "☽", heads: "plain", voice: "shaman", corners: "round" } },
  { id: "adept", name: "Adept", blurb: "Paper, ink and stillness", s: { theme: "dojo", font: "mincho", ornament: "seal", backdrop: "enso", glyph: "◯", heads: "bar", voice: "adept", corners: "square" } },
  { id: "decker", name: "Decker", blurb: "Phosphor and traces", s: { theme: "terminal", font: "crt", ornament: "traces", backdrop: "circuit", glyph: "▸", heads: "glow", voice: "decker", corners: "cut" } },
  { id: "technomancer", name: "Technomancer", blurb: "Living data, iridescent", s: { theme: "resonance", font: "glyphic", ornament: "traces", backdrop: "stream", glyph: "⌬", heads: "glow", voice: "techno", corners: "round" } },
  { id: "rigger", name: "Rigger", blurb: "Garage, safety stripes, a drone swarm", s: { theme: "hazard", font: "hud", ornament: "hazard", backdrop: "hex", glyph: "▲", heads: "caps", voice: "rigger", corners: "cut" } },
  { id: "face", name: "Face", blurb: "Smoky bar, typed dossiers, a deal", s: { theme: "noir", font: "dossier", ornament: "frame", backdrop: "rain", glyph: "§", heads: "plain", voice: "fixer", corners: "square" } },
  { id: "astral", name: "Astral wanderer", blurb: "Auras and motes of light", s: { theme: "astral", font: "arcane", ornament: "filigree", backdrop: "stars", glyph: "✶", heads: "glow", voice: "arcane", corners: "round" } },
  { id: "suit", name: "Corp suit", blurb: "Arcology daylight, clean lines", s: { theme: "corp", font: "executive", ornament: "frame", backdrop: "flat", glyph: "■", heads: "plain", voice: "corp", corners: "square" } },
  { id: "municipal", name: "Municipal Terminal", blurb: "Port Meridian city terminal, all activity logged", s: { theme: "municipal", font: "readout", ornament: "barcode", backdrop: "glow", glyph: "▸", heads: "caps", voice: "corp", corners: "square" } },
  { id: "zaibatsu", name: "Zaibatsu", blurb: "Megacorp security terminal", s: { theme: "zaibatsu", font: "street", ornament: "frame", backdrop: "glow", glyph: "▪", heads: "caps", voice: "corp", corners: "square" } },
  { id: "synthwave", name: "Neon kid", blurb: "Indigo night and arcade light", s: { theme: "neon", font: "glitch", ornament: "brackets", backdrop: "grid", glyph: "⚡", heads: "glow", voice: "street", corners: "cut" } },
];

export function packMatches(p: PackDef, cur: PackSettings): boolean {
  return (Object.keys(p.s) as (keyof PackSettings)[]).every((k) => p.s[k] === cur[k]);
}

const MONO_STACK = MONO;
/** Display and body font stacks for a typeface choice. Zaibatsu keeps mono headings with the default face. */
export function fontVars(font: FontId, theme: ThemeId): { display: string; body: string; ui: string } {
  const f = FONTS.find((x) => x.id === font) ?? FONTS[0];
  if (theme === "zaibatsu" && font === "street") return { display: MONO_STACK, body: f.body, ui: MONO_STACK };
  return { display: f.display, body: f.body, ui: f.ui ?? f.display };
}

/** Compact table for the pre-paint script in layout.tsx. */
export const FONT_BOOT: Record<string, [string, string, string]> = Object.fromEntries(FONTS.map((f) => [f.id, [f.display, f.body, f.ui ?? f.display]]));
