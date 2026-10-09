"use client";
import type { ComponentType } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { Block, Tone } from "@/lib/academy/types";
import { Prose } from "./Prose";
import { Quiz } from "./Quiz";
import { Icon } from "@/components/Icon";

const TONE: Record<Tone, { label: string; cls: string }> = {
  tip: { label: "Tip", cls: "border-cyan/60 text-cyan" },
  warn: { label: "Careful", cls: "border-danger/70 text-danger" },
  rule: { label: "The rule", cls: "border-accent/70 text-accent" },
  story: { label: "On the street", cls: "border-astral/60 text-astral" },
};

export function LessonView({ blocks, widgets }: { blocks: Block[]; widgets: Record<string, ComponentType> }) {
  return (
    <div className="space-y-5">
      {blocks.map((b, i) => {
        switch (b.t) {
          case "p":
            return <p key={i} className="max-w-[68ch] text-[1.02rem] leading-relaxed"><Prose text={b.text} /></p>;
          case "h":
            return <h2 key={i} className="pt-3 text-2xl font-bold">{b.text}</h2>;
          case "list": {
            const L = b.ordered ? "ol" : "ul";
            return (
              <L key={i} className={clsx("max-w-[68ch] space-y-1.5 pl-6 leading-relaxed", b.ordered ? "list-decimal" : "list-disc")}>
                {b.items.map((it, j) => <li key={j} className="marker:text-accent"><Prose text={it} /></li>)}
              </L>
            );
          }
          case "callout": {
            const t = TONE[b.tone];
            return (
              <aside key={i} className={clsx("max-w-[68ch] border-l-4 bg-panel px-4 py-3", t.cls.split(" ")[0])}>
                <div className={clsx("mb-1 font-display text-sm font-semibold", t.cls.split(" ")[1])}>{b.title ?? t.label}</div>
                <p className={clsx("text-[0.97rem] leading-relaxed", b.tone === "story" && "italic text-dim")}><Prose text={b.text} /></p>
              </aside>
            );
          }
          case "formula":
            return (
              <div key={i} className="max-w-[68ch]">
                {b.label && <div className="mb-1 text-sm text-dim">{b.label}</div>}
                <div className="flex flex-wrap items-center gap-2">
                  {b.parts.map((p, j) =>
                    /^[+−\-×x=÷/()]$/.test(p) ? (
                      <span key={j} className="num text-xl text-faint">{p}</span>
                    ) : (
                      <span key={j} className="chip on !text-base"><Prose text={p} /></span>
                    ),
                  )}
                </div>
              </div>
            );
          case "widget": {
            const W = widgets[b.id];
            return (
              <section key={i} className="panel space-y-3 p-4 md:p-5">
                {b.title && <h3 className="flex items-center gap-2 font-display text-lg font-semibold"><Icon name="spark" size={16} className="text-accent" /> {b.title}</h3>}
                {W ? <W /> : <p className="text-danger">Missing widget: {b.id}</p>}
              </section>
            );
          }
          case "book":
            return (
              <Link key={i} href={`/rules?q=${encodeURIComponent(b.query)}`} className="btn small">
                <Icon name="library" size={14} /> {b.label ?? `In the rulebook: ${b.query}`}
              </Link>
            );
          case "quiz":
            return <Quiz key={i} q={b} />;
          case "cards":
            return (
              <div key={i} className="grid gap-3 sm:grid-cols-2">
                {b.items.map((c, j) => (
                  <div key={j} className="panel quiet p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="font-semibold">{c.title}</h4>
                      {c.tag && <span className="chip">{c.tag}</span>}
                    </div>
                    <p className="mt-1 text-sm text-dim"><Prose text={c.text} /></p>
                  </div>
                ))}
              </div>
            );
        }
      })}
    </div>
  );
}
