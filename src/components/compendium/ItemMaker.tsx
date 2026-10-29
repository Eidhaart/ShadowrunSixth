"use client";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { COMP_CATS } from "@/lib/compendium/types";
import { houseToComp } from "@/lib/compendium/catalog";
import { SKILLS } from "@/lib/sr6/data";
import { uid, type GearItem } from "@/lib/sr6/character";
import { useRunners } from "@/lib/store/characters";
import { useHouse } from "@/lib/house/store";
import type { HouseItem } from "@/lib/house/rules";

const ITEM_CATS = COMP_CATS.filter((c) => c.id !== "matrix" && c.id !== "vehicles" && c.id !== "drones").map((c) => c.id) as HouseItem["cat"][];
const WEAPON_SKILLS = SKILLS.filter((s) => s.group === "combat" || s.id === "athletics");
const BANDS = ["Close", "Near", "Medium", "Far", "Extreme"];
const n = (v: string) => (v === "" ? null : Math.max(0, Number(v)));

/** Typical Sixth World numbers, so a new weapon starts somewhere sensible. */
export const WEAPON_TYPES: { group: string; dv: string; ar: (number | null)[]; skill: string; cost: number; avail: number; legal?: "L" | "I" }[] = [
  { group: "Hold-Out Pistol", dv: "2P", ar: [8, 8, null, null, null], skill: "firearms", cost: 250, avail: 2 },
  { group: "Light Pistol", dv: "2P", ar: [10, 7, 6, null, null], skill: "firearms", cost: 300, avail: 2, legal: "L" },
  { group: "Heavy Pistol", dv: "3P", ar: [10, 10, 8, null, null], skill: "firearms", cost: 750, avail: 3, legal: "L" },
  { group: "Submachine Gun", dv: "3P", ar: [8, 10, 8, null, null], skill: "firearms", cost: 1000, avail: 4, legal: "L" },
  { group: "Shotgun", dv: "4P", ar: [9, 8, 4, null, null], skill: "firearms", cost: 1000, avail: 4, legal: "L" },
  { group: "Assault Rifle", dv: "4P", ar: [4, 10, 9, 7, 2], skill: "firearms", cost: 2500, avail: 4, legal: "I" },
  { group: "Sniper Rifle", dv: "5P", ar: [2, 8, 12, 14, 12], skill: "firearms", cost: 8000, avail: 6, legal: "I" },
  { group: "Blade", dv: "3P", ar: [8, null, null, null, null], skill: "close-combat", cost: 100, avail: 2 },
  { group: "Sword", dv: "4P", ar: [10, null, null, null, null], skill: "close-combat", cost: 1000, avail: 4, legal: "L" },
  { group: "Club", dv: "4S", ar: [7, null, null, null, null], skill: "close-combat", cost: 50, avail: 1 },
  { group: "Throwing", dv: "2P", ar: [8, 6, null, null, null], skill: "athletics", cost: 50, avail: 2 },
];

export function blankItem(cat: HouseItem["cat"] = "weapons"): HouseItem {
  const base = { id: uid("hi"), name: "", cat, group: "", cost: 100, avail: 2 } as HouseItem;
  if (cat === "weapons") { const t = WEAPON_TYPES[2]; Object.assign(base, { group: t.group, dv: t.dv, ar: [...t.ar], skill: t.skill, cost: t.cost, avail: t.avail, legal: t.legal }); }
  if (cat === "armor") Object.assign(base, { group: "Armor", armor: 2, cost: 500 });
  if (cat === "cyberware" || cat === "augmentations") Object.assign(base, { group: "Bodyware", essence: 0.2, cost: 5000, avail: 4 });
  if (cat === "bioware") Object.assign(base, { group: "Bioware", essence: 0.2, cost: 8000, avail: 4 });
  return base;
}

/** Every field an item can have, shown for its category. Used by the item maker and the House page. */
export function ItemFields({ it, onChange }: { it: HouseItem; onChange: (p: Partial<HouseItem>) => void }) {
  const ar = it.ar ?? [null, null, null, null, null];
  const dvNum = /\d+/.exec(it.dv ?? "")?.[0] ?? "";
  const dvType = /S/i.test(it.dv ?? "") ? "S" : "P";
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="text-xs text-dim">Name<input className="field" value={it.name} onChange={(e) => onChange({ name: e.target.value.slice(0, 80) })} placeholder="Ares Thunderclap" autoFocus /></label>
        <label className="text-xs text-dim">Category
          <select className="field" value={it.cat} onChange={(e) => { const c = e.target.value as HouseItem["cat"]; const b = blankItem(c); onChange({ cat: c, group: b.group, dv: b.dv, ar: b.ar, skill: b.skill, armor: b.armor, essence: b.essence }); }}>
            {ITEM_CATS.map((c) => <option key={c} value={c}>{COMP_CATS.find((x) => x.id === c)?.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-dim">Type<input className="field" value={it.group} onChange={(e) => onChange({ group: e.target.value.slice(0, 40) })} placeholder="Heavy Pistol, Blade…" /></label>
      </div>

      {it.cat === "weapons" && (
        <div className="space-y-2.5 border-l-2 border-accent/40 pl-3">
          <div>
            <div className="mb-1 text-xs text-dim">Start from a type</div>
            <div className="flex flex-wrap gap-1">
              {WEAPON_TYPES.map((t) => (
                <button key={t.group} type="button" className={clsx("chip !text-[11px]", it.group === t.group && "on")}
                  onClick={() => onChange({ group: t.group, dv: t.dv, ar: [...t.ar], skill: t.skill, cost: t.cost, avail: t.avail, legal: t.legal })}>{t.group}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[5rem_6rem_minmax(0,1fr)] gap-2">
            <label className="text-xs text-dim">Damage<input className="field num" type="number" min={0} max={30} value={dvNum} onChange={(e) => onChange({ dv: `${e.target.value}${dvType}` })} /></label>
            <label className="text-xs text-dim">Type
              <select className="field" value={dvType} onChange={(e) => onChange({ dv: `${dvNum || 0}${e.target.value}` })}><option value="P">Physical</option><option value="S">Stun</option></select>
            </label>
            <label className="text-xs text-dim">Skill
              <select className="field" value={it.skill ?? "firearms"} onChange={(e) => onChange({ skill: e.target.value })}>
                {WEAPON_SKILLS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </div>
          <div>
            <div className="mb-1 text-xs text-dim">Attack Rating by range. Leave empty where it cannot reach.</div>
            <div className="grid grid-cols-5 gap-1">
              {BANDS.map((b, i) => (
                <label key={b} className="text-center text-[10px] text-faint">{b}
                  <input className="field num !min-h-0 !px-1 !py-1 text-center" type="number" min={0} max={30} value={ar[i] ?? ""} onChange={(e) => { const next = [...ar]; next[i] = n(e.target.value); onChange({ ar: next }); }} />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
      {it.cat === "armor" && (
        <label className="block border-l-2 border-accent/40 pl-3 text-xs text-dim">Defense Rating bonus while worn<input className="field num !w-28" type="number" min={0} max={30} value={it.armor ?? 0} onChange={(e) => onChange({ armor: Math.max(0, Number(e.target.value) || 0) })} /></label>
      )}
      {(it.cat === "cyberware" || it.cat === "bioware" || it.cat === "augmentations") && (
        <label className="block border-l-2 border-accent/40 pl-3 text-xs text-dim">Essence cost<input className="field num !w-28" type="number" min={0} max={6} step={0.05} value={it.essence ?? 0} onChange={(e) => onChange({ essence: Math.max(0, Number(e.target.value) || 0) })} /></label>
      )}

      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-dim">Cost (¥)<input className="field num" type="number" min={0} value={it.cost ?? ""} onChange={(e) => onChange({ cost: n(e.target.value) })} /></label>
        <label className="text-xs text-dim">Availability<input className="field num" type="number" min={0} max={20} value={it.avail ?? ""} onChange={(e) => onChange({ avail: n(e.target.value) ?? undefined })} /></label>
        <label className="text-xs text-dim">Legality
          <select className="field" value={it.legal ?? ""} onChange={(e) => onChange({ legal: (e.target.value || undefined) as HouseItem["legal"] })}>
            <option value="">Legal</option><option value="L">Licensed</option><option value="I">Illegal</option>
          </select>
        </label>
      </div>
      <label className="block text-xs text-dim">Notes, wireless bonus, special rules<textarea className="field min-h-16" value={it.note ?? ""} onChange={(e) => onChange({ note: e.target.value.slice(0, 600) })} /></label>
    </div>
  );
}

/** The sheet entry an item becomes. */
export function itemToGear(it: HouseItem): GearItem {
  return { id: uid("g"), ...houseToComp(it).gear } as GearItem;
}

/**
 * Make your own item: keep it in your items (it then sits in the Compendium for good), give it to a
 * runner, or both. Opened from the Compendium, a sheet's Gear tab and the Forge.
 */
export function ItemMaker({ onClose, runnerId, initial, payDefault = false }: { onClose: () => void; runnerId?: string; initial?: HouseItem; payDefault?: boolean }) {
  const [it, setIt] = useState<HouseItem>(() => initial ?? blankItem());
  const runnersMap = useRunners((s) => s.runners);
  const update = useRunners((s) => s.update);
  const addMine = useHouse((s) => s.addMine);
  const updateMine = useHouse((s) => s.updateMine);
  const runners = useMemo(() => Object.values(runnersMap).sort((a, b) => b.updatedAt - a.updatedAt), [runnersMap]);
  const editing = !!initial;
  const [keep, setKeep] = useState(true);
  const [give, setGive] = useState(runnerId ?? "");
  const [pay, setPay] = useState(payDefault);
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const preview = houseToComp({ ...it, name: it.name || "Unnamed item" });
  const r = give ? runnersMap[give] : undefined;
  const short = r && pay && (it.cost ?? 0) > r.nuyen;
  const valid = it.name.trim().length > 0 && (keep || !!r) && !short;

  const save = () => {
    if (!valid) return;
    const item = { ...it, name: it.name.trim() };
    if (editing) { updateMine(item); setDone("saved"); setTimeout(onClose, 600); return; }
    if (keep) addMine(item);
    if (r) update(r.id, (x) => { x.gear.push(itemToGear(item)); if (pay) x.nuyen -= item.cost ?? 0; });
    setDone([keep && "saved to your items", r && `given to ${r.alias || r.name || "your runner"}`].filter(Boolean).join(" and "));
    setTimeout(onClose, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form role="dialog" aria-modal="true" aria-label="Make an item" className="panel flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="panel-head"><span className="flex-1">{editing ? "Edit your item" : "Make your own item"}</span><button type="button" className="btn small ghost" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button></div>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-[minmax(0,1fr)_15rem]">
          <ItemFields it={it} onChange={(p) => setIt((x) => ({ ...x, ...p }))} />
          <aside className="space-y-3">
            <div className="text-xs text-faint">How it will look</div>
            <div className="border border-line bg-bg2 p-3">
              <div className="flex items-baseline gap-2"><b className="font-display">{preview.name}</b><span className="house-badge">Mine</span></div>
              <div className="text-xs text-dim">{preview.group || COMP_CATS.find((c) => c.id === it.cat)?.name}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {preview.stats.map(([k, v]) => <span key={k} className="num border border-line px-1.5 py-0.5 text-[11px]"><span className="text-faint">{k}</span> {v}</span>)}
              </div>
              <div className="num mt-2 text-sm">{it.cost != null ? `${it.cost.toLocaleString()}¥` : "No price"}{it.avail != null && <span className="ml-2 text-xs text-dim">Avail {it.avail}{it.legal ?? ""}</span>}</div>
              {it.note && <p className="mt-2 text-xs text-dim">{it.note}</p>}
            </div>
            {!editing && (
              <div className="space-y-2 text-sm">
                <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={keep} onChange={(e) => setKeep(e.target.checked)} /><span>Keep in my items<span className="block text-xs text-faint">It joins the Compendium on this device, to drag onto any runner.</span></span></label>
                <label className="block text-xs text-dim">Give it to
                  <select className="field mt-1" value={give} onChange={(e) => setGive(e.target.value)}>
                    <option value="">Nobody yet</option>
                    {runners.map((x) => <option key={x.id} value={x.id}>{x.alias || x.name || "Runner"}</option>)}
                  </select>
                </label>
                {r && <label className="flex items-center gap-2 text-xs text-dim"><input type="checkbox" checked={pay} onChange={(e) => setPay(e.target.checked)} /> Pay {(it.cost ?? 0).toLocaleString()}¥ from {r.nuyen.toLocaleString()}¥</label>}
                {short && <p className="text-xs text-danger">Not enough nuyen.</p>}
              </div>
            )}
          </aside>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line p-3">
          <button className="btn primary" disabled={!valid}><Icon name="check" size={15} /> {editing ? "Save changes" : "Create item"}</button>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          {done && <span role="status" className="text-sm text-ok">Done: {done}.</span>}
          {!it.name.trim() && <span className="text-xs text-faint">Give it a name first.</span>}
        </div>
      </form>
    </div>
  );
}
