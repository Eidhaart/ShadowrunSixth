"use client";
import { useEffect, useState } from "react";
import { DieFace } from "@/components/Dice";
import type { Die } from "@/lib/sr6/dice";

/** A row of d6 that tumble for a moment, then settle on the real faces. */
export function DiceRow({ dice, size = "2.1rem", animate = true }: { dice: Die[]; size?: string; animate?: boolean }) {
  const [rolling, setRolling] = useState(animate);
  const [tick, setTick] = useState(0);
  const [settle, setSettle] = useState(animate);
  useEffect(() => {
    if (!animate) return;
    const iv = setInterval(() => setTick((t) => t + 1), 90);
    const t1 = setTimeout(() => { setRolling(false); clearInterval(iv); }, Math.min(800, 320 + dice.length * 24));
    const t2 = setTimeout(() => setSettle(false), 1300);
    return () => { clearInterval(iv); clearTimeout(t1); clearTimeout(t2); };
  }, [animate, dice.length]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {dice.map((d, i) => (
        <DieFace
          key={i}
          value={rolling ? ((i * 7 + tick) % 6) + 1 : d.value}
          size={size}
          state={{
            rolling,
            settle: !rolling && settle,
            hit: !rolling && d.hit && !d.rerolled,
            one: !rolling && d.value === 1 && !d.rerolled,
            ghost: !rolling && d.rerolled,
            boom: !rolling && d.exploded,
            bump: !rolling && d.bumped,
          }}
        />
      ))}
    </div>
  );
}
