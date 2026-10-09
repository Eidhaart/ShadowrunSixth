"use client";
import { createContext, useContext, useState, type ReactNode } from "react";

export const GlossaryCtx = createContext<Record<string, string>>({});

function Term({ name, shown }: { name: string; shown: string }) {
  const gl = useContext(GlossaryCtx);
  const [open, setOpen] = useState(false);
  const key = Object.keys(gl).find((k) => k.toLowerCase() === name.toLowerCase());
  if (!key) return <>{shown}</>;
  return (
    <span className="relative inline">
      <button
        type="button"
        className="term"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        title={gl[key]}
      >
        {shown}
      </button>
      {open && (
        <span role="tooltip" className="term-pop">
          <b className="text-accent">{key}</b> {gl[key]}
        </span>
      )}
    </span>
  );
}

/** Tiny inline markup: **bold**, `code`, [[Glossary term]] or [[Glossary term|shown text]]. */
export function Prose({ text }: { text: string }): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\[[^\]]+\]\])/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**")) return <strong key={i} className="font-semibold text-fg">{p.slice(2, -2)}</strong>;
        if (p.startsWith("`")) return <code key={i} className="num rounded bg-bg2 px-1 text-[0.92em] text-cyan">{p.slice(1, -1)}</code>;
        if (p.startsWith("[[")) {
          const [name, shown] = p.slice(2, -2).split("|");
          return <Term key={i} name={name} shown={shown ?? name} />;
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}
