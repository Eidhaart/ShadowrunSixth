"use client";
import type { ReactNode } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";

export function Stepper({
  label, value, min = 0, max = 20, onChange, hint, wide,
}: { label: string; value: number; min?: number; max?: number; onChange: (n: number) => void; hint?: string; wide?: boolean }) {
  return (
    <div className={clsx("flex items-center justify-between gap-2", wide && "w-full")}>
      <span className="text-sm text-dim" title={hint}>{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" className="btn small" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}><Icon name="minus" size={12} /></button>
        <span className="num w-8 text-center text-lg font-semibold" aria-live="polite">{value}</span>
        <button type="button" className="btn small" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}><Icon name="plus" size={12} /></button>
      </div>
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="inline-flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={o.id === value} className={clsx("chip cursor-pointer", o.id === value && "on")} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Pct({ v }: { v: number }) {
  return <span className="num">{Math.round(v * 100)}%</span>;
}

export function Readout({ label, children, tone }: { label: string; children: ReactNode; tone?: "ok" | "bad" | "accent" }) {
  return (
    <div className="border border-line bg-bg2 px-3 py-2">
      <div className="text-xs text-dim">{label}</div>
      <div className={clsx("num text-xl font-semibold", tone === "ok" && "text-ok", tone === "bad" && "text-danger", tone === "accent" && "text-accent")}>{children}</div>
    </div>
  );
}

export function Boxes({ total, filled, per = 3, hot }: { total: number; filled: number; per?: number; hot?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1" role="img" aria-label={`${filled} of ${total} boxes filled`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={clsx("size-5 border", i < filled ? (hot ? "border-danger bg-danger/60" : "border-accent bg-accent/70") : "border-line-hi", (i + 1) % per === 0 && i + 1 < total && "mr-2")} />
      ))}
    </div>
  );
}
