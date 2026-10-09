"use client";
import { useEffect, useState } from "react";
import { GearBrowser, useGearDrop } from "@/components/compendium/GearBrowser";
import { addToRunner, type AddResult } from "@/lib/compendium/catalog";
import type { CompItem } from "@/lib/compendium/types";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { uid, type GearItem } from "@/lib/sr6/character";
import { LIFESTYLES, SKILLS } from "@/lib/sr6/data";
import { Box, Empty, Num, Stepper } from "./ui";
import type { SheetCtx } from "./ctx";

const CATS: { id: GearItem["category"]; label: string }[] = [
  { id: "weapon", label: "Weapons" }, { id: "armor", label: "Armor" }, { id: "cyberware", label: "Cyberware" }, { id: "bioware", label: "Bioware" },
  { id: "commlink", label: "Commlinks" }, { id: "vehicle", label: "Vehicles" }, { id: "ammo", label: "Ammo" }, { id: "magic", label: "Magic items" }, { id: "misc", label: "Other" },
];
const RANGES = ["Close", "Near", "Medium", "Far", "Extreme"];

function ItemRow({ ctx, g }: { ctx: SheetCtx; g: GearItem }) {
  const set = (fn: (t: GearItem) => void) => ctx.upd((x) => { const t = x.gear.find((q) => q.id === g.id); if (t) fn(t); });
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center gap-2">
        <input className="field !min-h-0 min-w-32 flex-1 !py-1 font-display font-semibold" value={g.name} aria-label="Item name" onChange={(ev) => set((t) => { t.name = ev.target.value; })} />
        <Stepper label={`${g.name} quantity`} value={g.qty} min={1} max={99} onChange={(n) => set((t) => { t.qty = n; })} />
        {g.category === "armor" && (
          <button className={clsx("btn small", g.worn !== false && "primary")} aria-pressed={g.worn !== false} onClick={() => set((t) => { t.worn = t.worn === false; })}>{g.worn !== false ? "Worn" : "Stowed"}</button>
        )}
        <button className="btn ghost small" aria-label={`Remove ${g.name}`} onClick={() => ctx.upd((x) => { x.gear = x.gear.filter((q) => q.id !== g.id); })}>×</button>
      </div>
      <details className="mt-1">
        <summary className="cursor-pointer text-xs text-dim">
          {[g.armor ? `Armor ${g.armor}` : "", g.dv ? `DV ${g.dv}` : "", g.essence ? `Essence ${g.essence}` : "", g.cost ? `${g.cost.toLocaleString()}¥` : ""].filter(Boolean).join(" · ") || "Details"}
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="block text-xs text-dim">Category
            <select className="field mt-1" value={g.category} onChange={(ev) => set((t) => { t.category = ev.target.value as GearItem["category"]; })}>{CATS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select>
          </label>
          <Num label="Cost (¥)" value={g.cost} max={99_999_999} onChange={(n) => set((t) => { t.cost = n; })} />
          {g.category === "armor" && <Num label="Armor bonus" value={g.armor ?? 0} max={30} onChange={(n) => set((t) => { t.armor = n; })} />}
          {(g.category === "cyberware" || g.category === "bioware") && (
            <label className="block text-xs text-dim">Essence cost
              <input className="field num mt-1" type="number" step="0.05" min={0} max={6} value={g.essence ?? 0} onChange={(ev) => set((t) => { t.essence = Math.max(0, Number(ev.target.value) || 0); })} />
            </label>
          )}
          {g.category === "weapon" && (
            <>
              <label className="block text-xs text-dim">Damage value<input className="field num mt-1" value={g.dv ?? ""} placeholder="5P" onChange={(ev) => set((t) => { t.dv = ev.target.value; })} /></label>
              <label className="block text-xs text-dim">Skill
                <select className="field mt-1" value={g.skill ?? "firearms"} onChange={(ev) => set((t) => { t.skill = ev.target.value; })}>{SKILLS.filter((s) => s.group === "combat" || s.id === "athletics").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              </label>
              <div className="col-span-2 sm:col-span-4">
                <div className="mb-1 text-xs text-dim">Attack rating by range (leave empty if it cannot attack there)</div>
                <div className="grid grid-cols-5 gap-1.5">
                  {RANGES.map((r, i) => (
                    <label key={r} className="block text-[11px] text-faint">{r}
                      <input className="field num mt-0.5 !px-1.5" type="number" min={0} max={30} value={g.ar?.[i] ?? ""} onChange={(ev) => set((t) => { const ar = [...(t.ar ?? [null, null, null, null, null])] as NonNullable<GearItem["ar"]>; ar[i] = ev.target.value === "" ? null : Math.max(0, Math.floor(Number(ev.target.value))); t.ar = ar; })} />
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
          <label className="col-span-2 block text-xs text-dim sm:col-span-4">Notes<input className="field mt-1" value={g.notes ?? ""} onChange={(ev) => set((t) => { t.notes = ev.target.value; })} /></label>
        </div>
      </details>
    </li>
  );
}

export function GearTab({ ctx }: { ctx: SheetCtx }) {
  const { c, d, upd } = ctx;
  const [cat, setCat] = useState<GearItem["category"] | "all">("all");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<GearItem["category"]>("misc");
  const [contact, setContact] = useState({ name: "", role: "" });
  const [shop, setShop] = useState(false);
  const [pay, setPay] = useState(true);
  const [last, setLast] = useState<AddResult | null>(null);
  const take = (i: CompItem, qty: number) => {
    const res = addToRunner(JSON.parse(JSON.stringify(c)), i, { pay, qty }); // dry run first: refuses if they cannot pay
    if (res.ok) upd((x) => { addToRunner(x, i, { pay, qty }); });
    setLast(res);
  };
  const { over, props: drop } = useGearDrop((i) => take(i, 1));
  useEffect(() => {
    if (!shop) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShop(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shop]);
  const items = c.gear.filter((g) => cat === "all" || g.category === cat);
  const total = c.gear.reduce((s, g) => s + g.cost * (g.qty || 1), 0);
  const addItem = () => {
    if (!name.trim()) return;
    const base: GearItem = { id: uid("g"), name: name.trim(), category: kind, cost: 0, qty: 1 };
    if (kind === "weapon") { base.dv = "5P"; base.skill = "firearms"; base.ar = [null, 8, 8, 6, 0]; }
    if (kind === "armor") { base.armor = 4; base.worn = true; }
    upd((x) => { x.gear.push(base); });
    setName("");
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div {...drop} className={clsx("transition-colors", over && "drop-over")}>
      <Box title="Inventory" right={<span className="num text-xs text-dim">{c.gear.length} items · {total.toLocaleString()}¥ · essence {d.essence}</span>}>
        <div className="no-print mb-3 flex flex-wrap items-center gap-2">
          <button className="btn small primary" onClick={() => setShop(true)} aria-expanded={shop}><Icon name="crate" size={15} /> Browse the compendium</button>
          <span className="text-xs text-faint max-md:hidden">Drag items from it straight onto this list.</span>
        </div>
        {last && !shop && <p className={clsx("mb-2 text-sm", last.ok ? "text-ok" : "text-danger")} role="status">{last.msg}</p>}
        <div className="no-print mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
          <button className={clsx("chip cursor-pointer", cat === "all" && "!border-accent !text-accent")} onClick={() => setCat("all")}>All</button>
          {CATS.filter((k) => c.gear.some((g) => g.category === k.id)).map((k) => <button key={k.id} className={clsx("chip cursor-pointer", cat === k.id && "!border-accent !text-accent")} onClick={() => setCat(k.id)}>{k.label}</button>)}
        </div>
        <ul className="divide-y divide-line">
          {items.map((g) => <ItemRow key={g.id} ctx={ctx} g={g} />)}
          {items.length === 0 && <li className="py-2"><Empty>Nothing here yet.</Empty></li>}
        </ul>
        <form className="no-print mt-3 flex flex-wrap gap-2" onSubmit={(ev) => { ev.preventDefault(); addItem(); }}>
          <input className="field min-w-40 flex-1" value={name} onChange={(ev) => setName(ev.target.value)} placeholder="Add an item" aria-label="New item name" />
          <select className="field !w-36" aria-label="Category" value={kind} onChange={(ev) => setKind(ev.target.value as GearItem["category"])}>{CATS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select>
          <button className="btn small primary" disabled={!name.trim()}><Icon name="plus" size={14} /> Add</button>
        </form>
        <p className="mt-2 text-xs text-faint">Armor you wear adds to Defense Rating, cyberware essence lowers Essence and Magic, and weapons show up under Attacks on the main sheet. All of it updates as you edit.</p>
      </Box>
      </div>

      <div className="space-y-4">
        <Box title="Money and lifestyle">
          <div className="grid grid-cols-2 gap-3">
            <Num label="Nuyen" value={c.nuyen} max={999_999_999} onChange={(n) => upd((x) => { x.nuyen = n; })} />
            <label className="block text-xs text-dim">Lifestyle
              <select className="field mt-1" value={c.lifestyle} onChange={(ev) => upd((x) => { x.lifestyle = ev.target.value; })}>{LIFESTYLES.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
            </label>
            <Num label="Months prepaid" value={c.lifestyleMonths} max={120} onChange={(n) => upd((x) => { x.lifestyleMonths = n; })} />
          </div>
        </Box>
        <Box title="Contacts" right={<span className="num text-xs text-dim">{c.contacts.length}</span>}>
          <ul className="divide-y divide-line text-sm">
            {c.contacts.map((k) => (
              <li key={k.id} className="py-2">
                <div className="flex items-center gap-2">
                  <input className="field !min-h-0 flex-1 !py-1 font-display font-semibold" value={k.name} aria-label="Contact name" onChange={(ev) => upd((x) => { const t = x.contacts.find((q) => q.id === k.id); if (t) t.name = ev.target.value; })} />
                  <button className="btn ghost small" aria-label={`Remove ${k.name}`} onClick={() => upd((x) => { x.contacts = x.contacts.filter((q) => q.id !== k.id); })}>×</button>
                </div>
                <input className="field mt-1 !min-h-0 !py-1 text-xs" value={k.role} placeholder="Role" aria-label="Contact role" onChange={(ev) => upd((x) => { const t = x.contacts.find((q) => q.id === k.id); if (t) t.role = ev.target.value; })} />
                <div className="mt-1.5 flex items-center gap-3 text-xs text-dim">
                  Connection <Stepper label={`${k.name} connection`} value={k.connection} min={1} max={12} onChange={(n) => upd((x) => { const t = x.contacts.find((q) => q.id === k.id); if (t) t.connection = n; })} />
                  Loyalty <Stepper label={`${k.name} loyalty`} value={k.loyalty} min={1} max={6} onChange={(n) => upd((x) => { const t = x.contacts.find((q) => q.id === k.id); if (t) t.loyalty = n; })} />
                </div>
              </li>
            ))}
            {c.contacts.length === 0 && <li className="py-2"><Empty>No contacts yet.</Empty></li>}
          </ul>
          <form className="no-print mt-3 flex flex-wrap gap-2" onSubmit={(ev) => { ev.preventDefault(); if (!contact.name.trim()) return; upd((x) => { x.contacts.push({ id: uid("k"), name: contact.name.trim(), role: contact.role.trim(), connection: 1, loyalty: 1 }); }); setContact({ name: "", role: "" }); }}>
            <input className="field min-w-32 flex-1" value={contact.name} onChange={(ev) => setContact({ ...contact, name: ev.target.value })} placeholder="Name" aria-label="New contact name" />
            <input className="field min-w-32 flex-1" value={contact.role} onChange={(ev) => setContact({ ...contact, role: ev.target.value })} placeholder="Role" aria-label="New contact role" />
            <button className="btn small" disabled={!contact.name.trim()}>Add</button>
          </form>
        </Box>
      </div>
      {shop && (
        <div className="no-print fixed inset-0 z-[60] flex justify-end bg-bg/40 md:pointer-events-none md:bg-transparent" onClick={() => setShop(false)}>
          <div role="dialog" aria-label="Compendium" className="pointer-events-auto flex h-full w-full flex-col border-l border-accent/40 bg-bg/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl backdrop-blur md:w-[30rem]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold">Compendium</h2>
                <p className="num text-sm text-dim">{c.nuyen.toLocaleString("en-US")}¥ on hand</p>
              </div>
              <button className="btn small ghost" onClick={() => setShop(false)} aria-label="Close the compendium"><Icon name="x" size={16} /></button>
            </div>
            <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--accent)]" checked={pay} onChange={(e) => setPay(e.target.checked)} /> Pay from {ctx.who}&apos;s nuyen</label>
            {last && <p className={clsx("mb-2 text-sm", last.ok ? "text-ok" : "text-danger")} role="status">{last.msg}</p>}
            <div className="flex min-h-0 flex-1 flex-col">
              <GearBrowser compact onAdd={take} addLabel={`Add to ${ctx.who}`} nuyen={pay ? c.nuyen : undefined} hint="Tap + to add, or drag an item onto the inventory." />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
