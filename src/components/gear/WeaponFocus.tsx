"use client";
import { useState } from "react";
import { BUILT_IN_ITEMS, addToRunner } from "@/lib/compendium/catalog";
import { rules } from "@/lib/house/rules";
import type { Character, GearItem } from "@/lib/sr6/character";
import { bondKarma } from "@/lib/sr6/data";
import { weaponFocus } from "@/lib/sr6/foci";
import { isMelee } from "@/lib/sr6/loadout";

const focusItem = (force: number) => BUILT_IN_ITEMS.find((i) => i.name === `Weapon focus, Force ${force}`);

/**
 * On a melee weapon's row: its weapon focus and what it adds, or a way to make the weapon a focus.
 * `budget` is the nuyen that can still be spent (creation budget, or the runner's nuyen in play).
 */
export function WeaponFocusControl({ c, w, budget, creation, apply }: {
  c: Character;
  w: GearItem;
  budget: number;
  creation: boolean;
  /** Runs the purchase on a fresh copy of the runner. */
  apply: (fn: (x: Character) => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [force, setForce] = useState(1);
  if (!isMelee(w)) return null;
  const on = weaponFocus(c, w);
  if (on) {
    return (
      <div className="text-xs">
        <span className="text-accent">Weapon focus, Force {on.force}</span>
        {on.bonus ? <span className="text-ok"> · +{on.bonus} {on.bonus === 1 ? "die" : "dice"} to Attack tests</span>
          : <span className="text-dim"> · {on.why}: {on.focus ? "bond and activate it on the Magic tab for its bonus" : "no bonus"}</span>}
      </div>
    );
  }
  const reason = (f: number): string => {
    const item = focusItem(f);
    if (!item) return "Not in the catalog";
    if (creation && (item.avail ?? 0) > rules().creationAvail) return `Availability ${item.avail}: above ${rules().creationAvail} at creation`;
    if ((item.cost ?? 0) > budget) return `Costs ${(item.cost ?? 0).toLocaleString("en-US")}¥; ${Math.max(0, budget).toLocaleString("en-US")}¥ left`;
    return "";
  };
  if (!open) return <button type="button" className="text-xs text-dim underline decoration-dotted hover:text-accent" onClick={() => setOpen(true)}>Make it a weapon focus</button>;
  const why = reason(force);
  const item = focusItem(force);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
      <select className="field !min-h-0 !w-auto !py-1 text-xs" aria-label={`Weapon focus Force for ${w.name}`} value={force} onChange={(e) => setForce(Number(e.target.value))}>
        {[1, 2, 3, 4, 5, 6].map((f) => <option key={f} value={f}>Force {f} · {(focusItem(f)?.cost ?? 0).toLocaleString("en-US")}¥ · bond {bondKarma({ kind: "Weapon", rating: f })} Karma{reason(f) ? " (locked)" : ""}</option>)}
      </select>
      <button type="button" className="btn small primary" disabled={!!why} title={why || undefined}
        onClick={() => { if (!item) return; apply((x) => { addToRunner(x, item, { pay: !creation, onto: w.id }); }); setOpen(false); }}>
        Make focus
      </button>
      <button type="button" className="btn small ghost" onClick={() => setOpen(false)}>Cancel</button>
      {why && <span className="text-danger">{why}</span>}
      {!why && <span className="text-dim">Adds {force} {force === 1 ? "die" : "dice"} to its Attack tests once bonded and active. Damage and Attack Rating stay the weapon&apos;s own.</span>}
    </div>
  );
}
