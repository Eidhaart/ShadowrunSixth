"use client";
import clsx from "clsx";
import { Icon } from "@/components/Icon";

export function Box({ title, children, className, right }: { title: string; children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <section className={clsx("panel", className)}>
      <div className="panel-head text-sm"><span className="flex-1">{title}</span>{right}</div>
      <div className="p-3.5">{children}</div>
    </section>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1" role="group" aria-label={label}>
      <button type="button" className="btn small" aria-label={`${label}, less`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}><Icon name="minus" size={12} /></button>
      <b className="num w-7 text-center">{value}</b>
      <button type="button" className="btn small" aria-label={`${label}, more`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}><Icon name="plus" size={12} /></button>
    </span>
  );
}

export function Num({ value, onChange, label, min = 0, max = 99, className }: { value: number; onChange: (n: number) => void; label: string; min?: number; max?: number; className?: string }) {
  return (
    <label className={clsx("block text-xs text-dim", className)}>
      {label}
      <input className="field num mt-1" type="number" min={min} max={max} value={value} onChange={(e) => onChange(Math.min(max, Math.max(min, Math.floor(Number(e.target.value) || 0))))} />
    </label>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: "accent" | "cyan" | "danger" }) {
  return (
    <div className="border border-line bg-bg-2/60 px-3 py-2">
      <div className="text-xs text-dim">{label}</div>
      <div className={clsx("num text-2xl font-bold", tone === "accent" && "text-accent", tone === "cyan" && "text-cyan", tone === "danger" && "text-danger")}>{value}</div>
      {sub && <div className="text-xs text-faint">{sub}</div>}
    </div>
  );
}

/** A clickable row of boxes for a condition monitor. */
export function Boxes({ label, boxes, filled, onSet, tone = "danger" }: { label: string; boxes: number; filled: number; onSet: (n: number) => void; tone?: "danger" | "cyan" | "accent" }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-display font-semibold">{label}</span>
        <span className="num text-dim">{filled} / {boxes}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: boxes }, (_, i) => {
          const n = i + 1;
          const on = n <= filled;
          return (
            <button
              key={n}
              onClick={() => onSet(filled === n ? n - 1 : n)}
              aria-label={`${label} box ${n}${on ? ", damaged" : ""}`}
              aria-pressed={on}
              className={clsx("h-6 w-6 border transition-colors", on ? (tone === "danger" ? "border-danger bg-danger/80" : tone === "cyan" ? "border-cyan bg-cyan/70" : "border-accent bg-accent/80") : "border-linehi hover:border-accent")}
            />
          );
        })}
      </div>
    </div>
  );
}

export const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-dim">{children}</p>;
