"use client";
import clsx from "clsx";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useRulebook } from "@/lib/store/rulebook";
import type { Character } from "@/lib/sr6/character";

export type Patch = (fn: (c: Character) => void) => void;
export interface StepProps {
  c: Character;
  patch: Patch;
}

/** Plus/minus control with an optional hard stop on either side. */
export function Stepper({
  value, onChange, min = 0, max = 99, label, disableUp, disableDown, size = "md",
}: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; label: string; disableUp?: boolean; disableDown?: boolean; size?: "sm" | "md";
}) {
  const up = disableUp || value >= max;
  const down = disableDown || value <= min;
  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label={label}>
      <button type="button" className="btn small" disabled={down} onClick={() => onChange(value - 1)} aria-label={`Decrease ${label}`}><Icon name="minus" size={13} /></button>
      <span className={clsx("num text-center font-semibold", size === "md" ? "w-9 text-lg" : "w-7")} aria-live="polite">{value}</span>
      <button type="button" className="btn small" disabled={up} onClick={() => onChange(value + 1)} aria-label={`Increase ${label}`}><Icon name="plus" size={13} /></button>
    </div>
  );
}

/** Segmented bar: filled to `value`, baseline range to 6, special range beyond. */
export function Segments({ value, max, base = 6 }: { value: number; max: number; base?: number }) {
  return (
    <div className="flex gap-[3px]" role="img" aria-label={`${value} of ${max}`}>
      {Array.from({ length: max }, (_, i) => {
        const n = i + 1;
        const on = n <= value;
        const special = n > base;
        return (
          <span
            key={i}
            className={clsx("h-3.5 w-[18px] border", on ? (special ? "border-cyan bg-cyan/70" : "border-accent bg-accent") : "border-line bg-transparent")}
          />
        );
      })}
    </div>
  );
}

export function Budget({ label, left, total, warnAt = 0 }: { label: string; left: number; total: number; warnAt?: number }) {
  const bad = left < 0;
  const done = left === 0 && total > 0;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-xs text-dim">
        <span>{label}</span>
        <span className={clsx("num", bad && "text-danger", done && "text-ok")}>{left} / {total}</span>
      </div>
      <div className="mt-1 h-1.5 w-full bg-line">
        <div className={clsx("h-full transition-[width]", bad ? "bg-danger" : done ? "bg-ok" : left <= warnAt ? "bg-accent" : "bg-accent")} style={{ width: `${total ? Math.max(0, Math.min(100, ((total - left) / total) * 100)) : 0}%` }} />
      </div>
    </div>
  );
}

export function StepHeader({ title, lead, rule }: { title: string; lead: string; rule?: RegExp }) {
  return (
    <header className="mb-5">
      <h2 className="text-2xl font-bold md:text-3xl">{title}</h2>
      <p className="mt-1 max-w-2xl text-dim">{lead}</p>
      {rule && <RuleLink match={rule} />}
    </header>
  );
}

/** Link to a rulebook section found by title, if a book is mounted. */
export function RuleLink({ match, children }: { match: RegExp; children?: React.ReactNode }) {
  const book = useRulebook((s) => s.book);
  const sec = book?.sections.find((s) => match.test(s.title));
  if (!sec) return null;
  return (
    <Link href={`/rules?s=${encodeURIComponent(sec.id)}`} target="_blank" className="mt-2 inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
      <Icon name="library" size={14} /> {children ?? `Read the rules: ${sec.title} (p. ${sec.page})`}
    </Link>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-dim">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

export function Note({ tone = "info", children }: { tone?: "info" | "warn" | "error"; children: React.ReactNode }) {
  return (
    <div
      className={clsx("border-l-2 px-3 py-2 text-sm", tone === "error" ? "border-danger bg-danger/10" : tone === "warn" ? "border-accent bg-accent/10" : "border-cyan bg-cyan/10")}
      role={tone === "error" ? "alert" : undefined}
    >
      {children}
    </div>
  );
}
