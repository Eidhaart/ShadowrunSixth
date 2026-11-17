"use client";
import clsx from "clsx";
import type { Character, GearItem } from "@/lib/sr6/character";
import { capacityUsed, hostOf, hostsFor, installedIn, roomFor, weaponAR } from "@/lib/sr6/loadout";

const MOUNT: Record<NonNullable<GearItem["mount"]>, string> = { top: "top", under: "underbarrel", barrel: "barrel", "top-under": "top or underbarrel" };

/** "Installed in" picker for a modification, implant or weapon accessory. Renders nothing for other gear. */
export function InstallSelect({ c, g, onChange }: { c: Pick<Character, "gear">; g: GearItem; onChange: (hostId: string | undefined) => void }) {
  if (!g.fits) return null;
  const hosts = hostsFor(c, g);
  const cur = hostOf(c, g);
  const weapon = g.fits === "weapon" || g.fits === "melee";
  return (
    <label className="flex items-center gap-1.5 text-xs text-dim">
      {g.fits === "melee" ? "Part of" : weapon ? "On" : "In"}
      <select className={clsx("field !min-h-0 !w-auto max-w-[13rem] !py-1 text-xs", !cur && !g.essence && "!border-accent")} value={cur?.id ?? ""} aria-label={`${g.name}: ${weapon ? "attached to" : "installed in"}`}
        onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">{g.fits === "melee" ? "Not part of a weapon" : weapon ? "Not attached" : g.essence ? "Implanted on its own" : "Not installed"}</option>
        {hosts.map((h) => {
          const fits = roomFor(c, h, g);
          return <option key={h.id} value={h.id} disabled={!fits && h.id !== cur?.id}>{h.name}{weapon ? "" : ` (${capacityUsed(c, h)}/${h.capacity ?? 0})`}{fits || h.id === cur?.id ? "" : " full"}</option>;
        })}
      </select>
      {hosts.length === 0 && <span className="text-faint">nothing to put it {weapon ? "on" : "in"} yet</span>}
    </label>
  );
}

/** One line on what a host carries: Capacity used, or a weapon's accessories and adjusted Attack Ratings. */
export function HostNote({ c, g }: { c: Pick<Character, "gear">; g: GearItem }) {
  // a weapon focus is shown by its own control on the weapon's row
  const kids = installedIn(c, g).filter((k) => k.fits !== "melee");
  if (g.category === "weapon") {
    if (!kids.length && !g.smartgun) return null;
    const { ar, why } = weaponAR(c, g);
    return (
      <div className="text-xs text-dim">
        {g.smartgun && <span>Smartgun built in. </span>}
        {kids.length > 0 && <span>{kids.map((k) => `${k.name}${k.mount ? ` (${MOUNT[k.mount]})` : ""}`).join(", ")}. </span>}
        {why && <span className="text-ok">AR {ar.map((v) => v ?? "–").join("/")} with {why}.</span>}
      </div>
    );
  }
  if (!g.capacity) return null;
  const used = capacityUsed(c, g);
  return <div className={clsx("num text-xs", used > g.capacity ? "text-danger" : "text-dim")}>Capacity {used} / {g.capacity}{kids.length ? ` · ${kids.map((k) => k.name).join(", ")}` : ""}</div>;
}
