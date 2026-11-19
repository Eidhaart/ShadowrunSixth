"use client";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

/** A tiny buzz on phones that support it. Silent elsewhere. */
export function buzz(ms = 8) {
  try { if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms); } catch { /* not allowed */ }
}

/** Counts from the old value to the new one in a few frames, so a change reads as movement. */
export function useTween(value: number, ms = 280): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const reduced = typeof window !== "undefined" && (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced");
    const t0 = performance.now();
    let raf = 0;
    if (reduced) { raf = requestAnimationFrame(() => { from.current = value; setShown(value); }); return () => cancelAnimationFrame(raf); }
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - (1 - k) ** 3;
      setShown(start + (value - start) * e);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value, ms]);
  return shown;
}

export interface MeterProps {
  label: string;
  /** What is left to spend. */
  value: number;
  total?: number;
  /** The number this page spends: highlighted. */
  focus?: boolean;
  /** Format for display; defaults to integers, two decimals when needed. */
  fmt?: (n: number) => string;
  /** Green at zero (fully spent budgets). Off for things like nuyen and Essence. */
  zeroIsDone?: boolean;
  onClick?: () => void;
  title?: string;
}

const plain = (n: number) => (Math.abs(n - Math.round(n)) < 0.005 ? String(Math.round(n)) : n.toFixed(2));

/** One back-header number: animated, flashes on change, shows the delta, shakes when overspent. */
export function Meter({ label, value, total, focus, fmt = plain, zeroIsDone = true, onClick, title }: MeterProps) {
  const shown = useTween(value);
  const prev = useRef(value);
  const [fx, setFx] = useState<{ key: number; d: number } | null>(null);
  useEffect(() => {
    const d = value - prev.current;
    prev.current = value;
    if (Math.abs(d) < 1e-6) return;
    setFx({ key: Date.now(), d });
  }, [value]);
  const over = value < -1e-9;
  const pct = total ? Math.max(0, Math.min(100, ((total - value) / total) * 100)) : null;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} title={title}
      className={clsx("wz-meter text-left", focus && "focus", over && "over", fx && over && "bump", zeroIsDone && Math.abs(value) < 1e-9 && (total ?? 0) > 0 && "zero", fx && (fx.d > 0 ? "wz-flash-up" : "wz-flash-down"))}
      key={fx && over ? fx.key : undefined}
      aria-label={`${label}: ${fmt(value)}${total != null ? ` of ${fmt(total)}` : ""} left`}>
      <span className="lab">{label}</span>
      <span className="val">{fmt(shown)}{total != null && <span className="of"> / {fmt(total)}</span>}</span>
      {pct != null && <span className="bar" style={{ width: `${pct}%` }} aria-hidden />}
      {fx && <span key={fx.key} className={clsx("wz-delta", fx.d > 0 ? "text-ok" : "text-accent")} aria-hidden>{fx.d > 0 ? "+" : "−"}{fmt(Math.abs(fx.d))}</span>}
    </Tag>
  );
}
