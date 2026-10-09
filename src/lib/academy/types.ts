export type Tone = "tip" | "warn" | "rule" | "story";

export interface QuizQ {
  id: string;
  q: string;
  options: string[];
  answer: number;
  why: string;
}

export type Block =
  | { t: "p"; text: string }
  | { t: "h"; text: string }
  | { t: "list"; items: string[]; ordered?: boolean }
  | { t: "callout"; tone: Tone; title?: string; text: string }
  /** A little equation, e.g. ["Cracking", "+", "Logic"] */
  | { t: "formula"; label?: string; parts: string[] }
  | { t: "widget"; id: string; title?: string }
  /** Link into the Library search (works once the rulebook is imported). */
  | { t: "book"; query: string; label?: string }
  | ({ t: "quiz" } & QuizQ)
  | { t: "cards"; items: { title: string; text: string; tag?: string }[] };

export interface Lesson {
  id: string;
  title: string;
  /** One line shown in the lesson list. */
  blurb: string;
  minutes: number;
  blocks: Block[];
}

export type ModuleId = "matrix" | "magic";

export interface ModuleDef {
  id: ModuleId;
  title: string;
  tagline: string;
  intro: string;
  lessons: Lesson[];
  glossary: Record<string, string>;
  sim: { title: string; blurb: string; minutes: number };
  exam: QuizQ[];
}
