"use client";
import type { Character } from "@/lib/sr6/character";
import { METATYPES, PRIORITY_TABLE } from "@/lib/sr6/data";
import { budget, derive, type Issue } from "@/lib/sr6/derive";
import type { StepProps } from "../ui";
import { Method } from "../pages/Method";
import { Priorities } from "../steps/Priorities";
import { Metatype } from "../pages/Metatype";
import { MagicRes } from "../pages/MagicRes";
import { QualitiesPage } from "../pages/QualitiesPage";
import { AttributesPage } from "../pages/AttributesPage";
import { SkillsPage } from "../pages/SkillsPage";
import { FormsPage, InitiationPage, PowersPage, SpellsPage } from "../pages/MagicPicks";
import { GearPage } from "../pages/GearPage";
import { SinsPage, isFakeSin } from "../pages/SinsPage";
import { LifestylePage } from "../pages/LifestylePage";
import { ContactsPage } from "../pages/ContactsPage";
import { NamePage } from "../pages/NamePage";
import { Review } from "../steps/Review";
import { issuePage } from "./nav";
export { issuePage, GoContext, useGo } from "./nav";

type B = ReturnType<typeof budget>;
type D = ReturnType<typeof derive>;

export interface Pool { label: string; value: number; total?: number; zeroIsDone?: boolean; fmt?: (n: number) => string }

export interface PageDef {
  id: string;
  label: string;
  group: "Generator" | "Core" | "Magic" | "Resources" | "Identity" | "Finish";
  lead: string;
  rule?: RegExp;
  show?: (c: Character) => boolean;
  done: (c: Character, b: B, d: D) => boolean;
  /** The budgets this page spends, shown first and highlighted in the back headers. */
  pools?: (c: Character, b: B, d: D) => Pool[];
  Comp: React.ComponentType<StepProps>;
}

const caster = (c: Character) => c.magicType === "full" || c.magicType === "aspected" || c.magicType === "mystic";
const powered = (c: Character) => c.magicType === "adept" || c.magicType === "mystic";
const known = (c: Character) => c.spells.length + (c.rituals?.length ?? 0);

export const PAGES: PageDef[] = [
  { id: "method", label: "Generator", group: "Generator", lead: "How this runner is built. The core rulebook builds by priority.", done: () => true, Comp: Method },
  { id: "priorities", label: "Priorities", group: "Core", lead: "Give each of the five areas a different priority, A to E. Higher means more.", rule: /^Select Character Priorities$/i,
    done: (c) => Object.keys(c.priorities).length === 5, Comp: Priorities },
  { id: "metatype", label: "Metatype", group: "Core", lead: "What you are. Your Metatype priority decides who is on offer and how many adjustment points come with it.", rule: /^Character Metatypes$/i,
    done: (c) => !!c.priorities.metatype && PRIORITY_TABLE[c.priorities.metatype].metatypes.includes(c.metatype), pools: (_c, b) => [{ label: "Adjust", value: b.adjustment.left, total: b.adjustment.total }], Comp: Metatype },
  { id: "magic", label: "Magic or Resonance", group: "Core", lead: "How your runner reaches past the physical, if at all. Your Magic or Resonance priority sets the starting rating.", rule: /^Magic\/Resonance$/i,
    done: (c) => !!c.priorities.magic && (c.magicType !== "aspected" || !!c.aspect), Comp: MagicRes },
  { id: "qualities", label: "Qualities", group: "Core", lead: "Positive qualities cost Karma; negative ones give it back. Six at most, and negatives can give at most 20 Karma more than positives cost.", rule: /^Select Qualities$/i,
    done: (c) => c.qualities.length > 0, pools: (_c, b) => [{ label: "Qualities", value: 6 - b.qualities.count, total: 6, zeroIsDone: false }], Comp: QualitiesPage },
  { id: "attributes", label: "Attributes", group: "Core", lead: "Adjustment points, attribute points and Karma, side by side. Only one attribute may sit at its maximum.", rule: /^Attributes$/i,
    done: (_c, b) => b.attributes.left === 0 && b.adjustment.left === 0 && b.attributes.total > 0,
    pools: (_c, b) => [{ label: "Attr pts", value: b.attributes.left, total: b.attributes.total }, { label: "Adjust", value: b.adjustment.left, total: b.adjustment.total }], Comp: AttributesPage },
  { id: "skills", label: "Skills", group: "Core", lead: "Skill points buy ranks one for one, or a specialization. Rank 6 is the top at creation (7 with Aptitude), for one skill only.", rule: /^Skills$/i,
    done: (_c, b) => b.skills.left === 0 && b.skills.total > 0, pools: (_c, b) => [{ label: "Skill pts", value: b.skills.left, total: b.skills.total }], Comp: SkillsPage },
  { id: "spells", label: "Spells and rituals", group: "Magic", show: caster, lead: "Your free picks: priority Magic × 2, shared between spells and rituals.", rule: /^Spellcasting$/i,
    done: (c, _b, d) => d.slots.spells === 0 || known(c) === d.slots.spells, pools: (c, _b, d) => [{ label: "Spells", value: d.slots.spells - known(c), total: d.slots.spells }], Comp: SpellsPage },
  { id: "powers", label: "Adept powers", group: "Magic", show: powered, lead: "Power Points buy powers. Adepts get one per point of Magic; mystic adepts get what they give to powers.", rule: /^Adept Powers$/i,
    done: (_c, _b, d) => Math.abs(d.slots.ppLeft) < 0.01, pools: (_c, _b, d) => [{ label: "PP", value: d.slots.ppLeft, total: d.slots.powerPoints }], Comp: PowersPage },
  { id: "forms", label: "Complex forms", group: "Magic", show: (c) => c.magicType === "technomancer", lead: "Your free picks: priority Resonance × 2.", rule: /^Complex Forms$/i,
    done: (c, _b, d) => c.complexForms.length === d.slots.complexForms, pools: (c, _b, d) => [{ label: "Forms", value: d.slots.complexForms - c.complexForms.length, total: d.slots.complexForms }], Comp: FormsPage },
  { id: "initiation", label: "Metamagic and echoes", group: "Magic", show: (c) => c.magicType !== "mundane", lead: "Optional: initiate or submerge with creation Karma for a metamagic or echo.", rule: /^Initiation$/i,
    done: () => true, Comp: InitiationPage },
  { id: "gear", label: "Gear", group: "Resources", lead: "Spend your nuyen. Nothing above the creation Availability. Convert Karma for more cash; at most 5,000¥ carries into play.", rule: /^Gear Stats$/i,
    done: (c, b) => b.nuyen.left >= 0 && b.nuyen.left <= 5000 && c.gear.length > 0,
    pools: (_c, b, d) => [{ label: "Essence", value: d.essence, zeroIsDone: false }], Comp: GearPage },
  { id: "sins", label: "SINs and licenses", group: "Resources", lead: "Who you are on paper. Fake SINs, and the licenses attached to them.", rule: /^Fake SINs?$/i,
    done: (c) => c.qualities.some((q) => /^sinner/i.test(q.name)) || c.gear.some(isFakeSin), Comp: SinsPage },
  { id: "lifestyle", label: "Lifestyle", group: "Resources", lead: "Where you sleep and what it costs. Pay at least one month ahead or start on the street.", rule: /^Lifestyles$/i,
    done: (c) => c.lifestyle === "street" || c.lifestyleMonths > 0, Comp: LifestylePage },
  { id: "contacts", label: "Contacts", group: "Identity", lead: "The people who pick up when you call.", rule: /^Contacts$/i,
    done: (c, b) => c.contacts.length > 0 && b.contacts.left >= 0, pools: (_c, b) => [{ label: "Contact pts", value: b.contacts.left, total: b.contacts.total }], Comp: ContactsPage },
  { id: "name", label: "Name and look", group: "Identity", lead: "The person behind the numbers: alias, face, history.", rule: /^Step One/i,
    done: (c) => !!(c.name || c.alias), Comp: NamePage },
  { id: "review", label: "Finish", group: "Finish", lead: "Every rule is checked against the book. Red stops the save; amber is worth a look.", done: () => false, Comp: Review },
];

export type PageState = "todo" | "done" | "warn" | "error";

export function pageState(p: PageDef, c: Character, issues: Issue[], b: B, d: D): PageState {
  const mine = issues.filter((i) => issuePage(i) === p.id);
  if (mine.some((i) => i.level === "error")) return "error";
  if (p.id === "review") return issues.some((i) => i.level === "error") ? "todo" : "done";
  if (p.done(c, b, d)) return mine.length ? "warn" : "done";
  return mine.length ? "warn" : "todo";
}

export const metaName = (c: Character) => METATYPES[c.metatype].name;
