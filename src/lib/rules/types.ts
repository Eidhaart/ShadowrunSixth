export type RuleCategory =
  | "core"
  | "creation"
  | "skills"
  | "combat"
  | "magic"
  | "hacking"
  | "rigging"
  | "critters"
  | "gm"
  | "gear"
  | "setting"
  | "tables";

export interface RuleSection {
  id: string;
  chapter: string;
  /** Heading hierarchy: 1 = chapter-level splash, 2 = section, 3 = subsection */
  level: 1 | 2 | 3;
  title: string;
  /** Title of the closest higher-level heading, for breadcrumbs. */
  parent?: string;
  page: number;
  pageEnd: number;
  text: string;
  tags: RuleCategory[];
}

export interface RulebookChapter {
  title: string;
  pageStart: number;
  pageEnd: number;
}

export interface Rulebook {
  version: 1;
  source: { title: string; pages: number; importedAt: string };
  chapters: RulebookChapter[];
  sections: RuleSection[];
}

export const CATEGORY_META: Record<
  RuleCategory,
  { label: string; blurb: string; glyph: string }
> = {
  core: { label: "Core", blurb: "Tests, dice, attributes, edge", glyph: "◈" },
  creation: { label: "Creation", blurb: "Priorities, qualities, archetypes", glyph: "✦" },
  skills: { label: "Skills", blurb: "Skill list and specializations", glyph: "☰" },
  combat: { label: "Combat", blurb: "Initiative, attacks, damage, healing", glyph: "✖" },
  magic: { label: "Magic", blurb: "Spells, spirits, adepts, astral", glyph: "✧" },
  hacking: { label: "Hacking", blurb: "Matrix, hosts, IC, technomancers", glyph: "⌬" },
  rigging: { label: "Rigging", blurb: "Drones and vehicles", glyph: "⛭" },
  critters: { label: "Critters", blurb: "Creatures, spirits, powers", glyph: "☠" },
  gm: { label: "GM", blurb: "Running the game, runs, adjustments", glyph: "♛" },
  gear: { label: "Gear", blurb: "Weapons, armor, ware, tools", glyph: "⚙" },
  setting: { label: "Setting", blurb: "World, history, fiction", glyph: "❖" },
  tables: { label: "Tables", blurb: "Reference tables", glyph: "▦" },
};
