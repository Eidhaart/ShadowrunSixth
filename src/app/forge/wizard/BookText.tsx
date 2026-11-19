"use client";
import Link from "next/link";
import { useRulebook } from "@/lib/store/rulebook";
import type { RuleSection } from "@/lib/rules/types";
import { Icon } from "@/components/Icon";

/** Paragraphs as the book prints them, with hyphenation at line ends undone. */
export function paragraphs(text: string): string[] {
  const t = text
    .replace(/(\w)-\s*\n\s*(?=[a-z])/g, "$1")
    .replace(/(\w)- (?=[a-z])/g, "$1")
    // a blank line is a paragraph break only after the end of a sentence; otherwise it is a column break
    .replace(/([.!?:”"’])\s*\n\s*\n\s*/g, "$1\u0001")
    .replace(/\s+/g, " ");
  return t
    .split(/\u0001|(?=\s•\s)|(?=^•\s)/)
    .map((p) => p.replace(/^\s*•\s*/, "• ").trim())
    .filter(Boolean);
}

/** The full rulebook text for a section, from the user's own mounted book. */
export function BookText({ id, section, fallback, clamp }: { id?: string; section?: RuleSection; fallback?: string; clamp?: number }) {
  const byId = useRulebook((s) => s.byId);
  const book = useRulebook((s) => s.book);
  const s = section ?? (id ? byId.get(id) : undefined);
  if (!s) {
    if (fallback) return <p className="text-sm text-dim">{fallback}</p>;
    return <p className="text-sm text-faint">{book ? "No rulebook entry for this one." : "Mount your rulebook in the Library to read the full entry here."}</p>;
  }
  const ps = paragraphs(s.text);
  return (
    <div className="book text-sm leading-relaxed text-fg/90">
      {(clamp ? ps.slice(0, clamp) : ps).map((p, i) => <p key={i}>{p}</p>)}
      <Link href={`/rules?s=${encodeURIComponent(s.id)}`} target="_blank" className="mt-3 inline-flex items-center gap-1.5 text-xs text-accent hover:underline">
        <Icon name="library" size={13} /> {s.title}, p. {s.page}
      </Link>
    </div>
  );
}
