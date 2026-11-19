"use client";
import { createContext, useContext } from "react";
import type { Issue } from "@/lib/sr6/derive";

/** The page an issue belongs on. */
export function issuePage(i: Issue): string {
  const t = i.text.toLowerCase();
  switch (i.where) {
    case "Concept": return "name";
    case "Priorities": return "priorities";
    case "Metatype": return "metatype";
    case "Adjustment": case "Attributes": return "attributes";
    case "Skills": case "Knowledge": return "skills";
    case "Qualities": return "qualities";
    case "Contacts": return "contacts";
    // Karma is spent on many pages: the finish page lists where it went
    case "Karma": return "review";
    case "Magic":
      if (/complex form/.test(t)) return "forms";
      if (/ritual|spell/.test(t) && !/power/.test(t)) return "spells";
      if (/power|\bpp\b/.test(t)) return "powers";
      if (/focus|foci|bond/.test(t)) return "gear";
      if (/initiat|metamagic|echo|grade/.test(t)) return "initiation";
      return "magic";
    case "Gear":
      if (/over budget/.test(t)) return "gear";
      if (/\bsin\b|licen/.test(t)) return "sins";
      if (/lifestyle/.test(t)) return "lifestyle";
      return "gear";
    default: return "review";
  }
}

/** Lets a page send the user to another page (the review's issue list, for instance). */
export const GoContext = createContext<(id: string) => void>(() => {});
export const useGo = () => useContext(GoContext);


export const PAGE_LABEL: Record<string, string> = {
  method: "Generator", priorities: "Priorities", metatype: "Metatype", magic: "Magic or Resonance", qualities: "Qualities", attributes: "Attributes",
  skills: "Skills", spells: "Spells and rituals", powers: "Adept powers", forms: "Complex forms", initiation: "Metamagic and echoes", gear: "Gear",
  sins: "SINs and licenses", lifestyle: "Lifestyle", contacts: "Contacts", name: "Name and look", review: "Finish",
};
