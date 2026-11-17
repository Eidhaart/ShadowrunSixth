"use client";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import type { QualityPick } from "@/lib/sr6/character";
import { ATTR_LABEL, SKILL_BY_ID } from "@/lib/sr6/data";
import type { QualityDef } from "@/lib/sr6/qualities";

/** What a quality is aimed at, when the note is a skill or attribute id: "Firearms". Long free text stays in the body. */
export function qualityTarget(q: QualityPick): string {
  if (!q.note) return "";
  const n = q.note.trim();
  return SKILL_BY_ID[n]?.name ?? (ATTR_LABEL as Record<string, string>)[n] ?? (n.length <= 28 ? n : "");
}

/** The free-text part of the note, when it is longer than a short target. */
const longNote = (q: QualityPick) => (q.note && !qualityTarget(q) ? q.note.trim() : "");

export function KarmaTag({ q, short }: { q: QualityPick; short?: boolean }) {
  const n = q.karma * q.level;
  return (
    <span className={clsx("num shrink-0 whitespace-nowrap text-sm", q.kind === "positive" ? "text-accent" : "text-cyan")}>
      {q.kind === "positive" ? "−" : "+"}{n}{short ? " K" : " Karma"}
    </span>
  );
}

/**
 * One quality that folds open: the name, level, target and Karma on one line; the book's text, the
 * page and your own note underneath. `children` go in the open body (the Forge's editing controls).
 */
export function QualityRow({ q, def, children, onRemove, compact, open }: {
  q: QualityPick;
  def?: QualityDef;
  children?: React.ReactNode;
  onRemove?: () => void;
  compact?: boolean;
  open?: boolean;
}) {
  const target = qualityTarget(q);
  const note = longNote(q);
  const text = def?.effectText || def?.blurb || "";
  return (
    <details className={clsx("group", compact ? "py-1.5" : "panel quiet")} open={open}>
      <summary className={clsx("flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden", compact ? "" : "p-3")}>
        <Icon name="chev" size={14} className="shrink-0 text-dim transition-transform group-open:rotate-90" />
        <span className="min-w-0 flex-1">
          <span className={clsx("font-display font-semibold", compact && "text-sm")}>{q.name}</span>
          {q.level > 1 && <span className="num ml-1.5 text-sm text-dim">{q.level}</span>}
          {target && <span className="ml-1.5 text-sm text-dim">· {target}</span>}
          {q.kind === "negative" && compact && <span className="ml-1.5 text-xs text-cyan">negative</span>}
          {q.effect && <span className="ml-1.5 text-xs text-ok">auto</span>}
        </span>
        <KarmaTag q={q} short={compact} />
        {onRemove && (
          <button type="button" className="-my-1 shrink-0 px-1.5 text-lg leading-none text-dim hover:text-danger"
            onClick={(e) => { e.preventDefault(); onRemove(); }} aria-label={`Remove ${q.name}`}>×</button>
        )}
      </summary>
      <div className={clsx("space-y-2 text-sm", compact ? "pb-1 pl-6 pt-1.5" : "border-t border-line px-3 pb-3 pl-9 pt-2.5")}>
        {text ? <p className="leading-relaxed text-dim">{text}</p> : !note && !children && <p className="text-faint">No description: mount your rulebook to see the book&apos;s text.</p>}
        {note && !children && <p className="leading-relaxed"><span className="text-xs uppercase tracking-wide text-faint">Note </span>{note}</p>}
        {def && <p className="text-[11px] text-faint">Core rulebook p.{def.page}</p>}
        {children}
      </div>
    </details>
  );
}
