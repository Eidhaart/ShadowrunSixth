"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRulebook } from "@/lib/store/rulebook";
import { uid, type GearItem } from "@/lib/sr6/character";
import { LIFESTYLES } from "@/lib/sr6/data";
import { budget } from "@/lib/sr6/derive";
import { Budget, Field, Note, StepHeader, Stepper, type StepProps } from "../ui";
import clsx from "clsx";
import { GearBrowser, useGearDrop } from "@/components/compendium/GearBrowser";
import { addToRunner } from "@/lib/compendium/catalog";
import type { CompItem } from "@/lib/compendium/types";

const CATS: { id: GearItem["category"]; label: string }[] = [
  { id: "weapon", label: "Weapon" },
  { id: "armor", label: "Armor or clothing" },
  { id: "cyberware", label: "Cyberware" },
  { id: "bioware", label: "Bioware" },
  { id: "commlink", label: "Commlink or deck" },
  { id: "vehicle", label: "Vehicle or drone" },
  { id: "ammo", label: "Ammo" },
  { id: "magic", label: "Magical gear" },
  { id: "misc", label: "Other" },
];

const blank = (): Omit<GearItem, "id"> => ({ name: "", category: "misc", cost: 0, qty: 1 });

export function GearStep({ c, patch }: StepProps) {
  const b = budget(c);
  const book = useRulebook((s) => s.book);
  const search = useRulebook((s) => s.search);
  const [item, setItem] = useState(blank());
  const [ar, setAr] = useState<string[]>(["", "", "", "", ""]);
  const [lookup, setLookup] = useState("");
  const [contact, setContact] = useState({ name: "", role: "", connection: 1, loyalty: 1 });
  const [bought, setBought] = useState("");
  const buy = (i: CompItem, qty: number) => { patch((x) => { addToRunner(x, i, { pay: false, qty }); }); setBought(`${i.name}${qty > 1 ? ` ×${qty}` : ""} added.`); };
  const { over, props: drop } = useGearDrop((i) => { if ((i.avail ?? 0) > 6) setBought(`${i.name} has Availability ${i.avail}: not allowed at creation.`); else buy(i, 1); });

  const names = useMemo(() => (book?.sections ?? []).filter((s) => s.chapter === "Gear" && s.level >= 2 && /^[A-Z0-9]/.test(s.title) && s.title.length < 40).slice(0, 700).map((s) => s.title), [book]);
  const hits = useMemo(() => (lookup.trim().length > 1 ? search(lookup, ["gear"], 5) : []), [lookup, search, book]);

  const add = () => {
    if (!item.name.trim()) return;
    const g: GearItem = { ...item, id: uid("g"), name: item.name.trim() };
    if (item.category === "weapon") g.ar = ar.map((v) => (v === "" ? null : Number(v))) as GearItem["ar"];
    patch((x) => { x.gear.push(g); });
    setItem(blank());
    setAr(["", "", "", "", ""]);
  };

  return (
    <div>
      <StepHeader title="Gear and lifestyle" lead="Spend your nuyen. Nothing with an Availability of 7 or higher at creation. Shop the compendium below or enter items by hand; armor, weapons and augmentations feed straight into your sheet." rule={/^Gear Stats$/i} />
      <div className="mb-5 grid max-w-2xl gap-4 sm:grid-cols-2">
        <Budget label="Nuyen left" left={b.nuyen.left} total={b.nuyen.total} />
        <div className="text-xs text-dim">Gear <b className="num text-fg">{b.nuyen.gear.toLocaleString("en-US")}¥</b> · Lifestyle <b className="num text-fg">{b.nuyen.lifestyle.toLocaleString("en-US")}¥</b>{b.nuyen.fromKarma > 0 && <> · From Karma <b className="num text-fg">{b.nuyen.fromKarma.toLocaleString("en-US")}¥</b></>}</div>
      </div>
      {b.nuyen.left > 5000 && <div className="mb-4"><Note tone="warn">You can start with at most 5,000¥ unspent. Buy more or lifestyle.</Note></div>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-5">
          <section className="panel p-4">
            <h3 className="mb-1 text-lg font-semibold">Shop the compendium</h3>
            <p className="mb-3 text-xs text-dim">Prices come off your nuyen budget automatically. Items with Availability 7 or more are locked at creation.</p>
            <div className="flex max-h-[34rem] min-h-80 flex-col">
              <GearBrowser compact creation onAdd={buy} addLabel="Buy" nuyen={b.nuyen.left} />
            </div>
            {bought && <p className="mt-2 text-sm text-ok" role="status">{bought}</p>}
          </section>

          <section className="panel quiet p-4">
            <h3 className="mb-2 text-lg font-semibold">Look it up</h3>
            <input className="field" placeholder="Search gear in the rulebook" value={lookup} onChange={(e) => setLookup(e.target.value)} aria-label="Search gear" />
            <ul className="mt-2 space-y-2">
              {hits.map(({ section: s }) => (
                <li key={s.id} className="border border-line p-2.5 text-sm">
                  <div className="flex justify-between gap-2"><b className="font-display">{s.title}</b><Link href={`/rules?s=${encodeURIComponent(s.id)}`} target="_blank" className="shrink-0 text-xs text-accent hover:underline">p.{s.page}</Link></div>
                  <p className="mt-1 line-clamp-4 text-xs text-dim">{s.text.replace(/\s+/g, " ")}</p>
                </li>
              ))}
              {!book && <li className="text-sm text-dim">Mount your rulebook to search here.</li>}
            </ul>
          </section>

          <section className="panel quiet p-4">
            <h3 className="mb-3 text-lg font-semibold">Add an item</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Name"><input className="field" list="gear-names" value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} placeholder="Ares Predator VI" /></Field>
                <datalist id="gear-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
              </div>
              <Field label="Type"><select className="field" value={item.category} onChange={(e) => setItem({ ...item, category: e.target.value as GearItem["category"] })}>{CATS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Cost (¥)"><input className="field num" type="number" min={0} value={item.cost} onChange={(e) => setItem({ ...item, cost: Math.max(0, Number(e.target.value) || 0) })} /></Field>
                <Field label="Qty"><input className="field num" type="number" min={1} value={item.qty} onChange={(e) => setItem({ ...item, qty: Math.max(1, Number(e.target.value) || 1) })} /></Field>
              </div>
              {item.category === "armor" && <Field label="Armor rating (adds to Defense Rating)"><input className="field num" type="number" min={0} value={item.armor ?? 0} onChange={(e) => setItem({ ...item, armor: Math.max(0, Number(e.target.value) || 0), worn: true })} /></Field>}
              {(item.category === "cyberware" || item.category === "bioware") && <Field label="Essence cost"><input className="field num" type="number" step="0.05" min={0} value={item.essence ?? 0} onChange={(e) => setItem({ ...item, essence: Math.max(0, Number(e.target.value) || 0) })} /></Field>}
              {item.category === "weapon" && (
                <>
                  <Field label="Damage Value (e.g. 3P)"><input className="field" value={item.dv ?? ""} onChange={(e) => setItem({ ...item, dv: e.target.value })} /></Field>
                  <Field label="Skill"><select className="field" value={item.skill ?? "firearms"} onChange={(e) => setItem({ ...item, skill: e.target.value })}><option value="firearms">Firearms</option><option value="close-combat">Close Combat</option><option value="athletics">Athletics</option><option value="exotic-weapons">Exotic Weapons</option></select></Field>
                  <div className="sm:col-span-2">
                    <span className="mb-1 block text-sm text-dim">Attack Rating: Close / Near / Medium / Far / Extreme (leave blank for none)</span>
                    <div className="grid grid-cols-5 gap-2">{ar.map((v, i) => <input key={i} className="field num text-center" aria-label={`Attack rating ${["close", "near", "medium", "far", "extreme"][i]}`} value={v} onChange={(e) => setAr(ar.map((x, j) => (j === i ? e.target.value.replace(/[^\d]/g, "") : x)))} />)}</div>
                  </div>
                </>
              )}
              <div className="sm:col-span-2"><button className="btn primary" onClick={add} disabled={!item.name.trim()}>Add to gear</button></div>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section {...drop} className={clsx("panel quiet p-4 transition-colors", over && "drop-over")}>
            <h3 className="mb-3 text-lg font-semibold">Your gear <span className="text-xs font-normal text-faint max-md:hidden">drop compendium items here</span></h3>
            {c.gear.length === 0 && <p className="text-sm text-dim">Nothing bought yet.</p>}
            <ul className="divide-y divide-line">
              {c.gear.map((g, i) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="font-display font-semibold">{g.name}</div>
                    <div className="text-xs text-dim">{CATS.find((k) => k.id === g.category)?.label} · {(g.cost * g.qty).toLocaleString("en-US")}¥
                      {g.armor ? ` · Armor ${g.armor}` : ""}{g.dv ? ` · DV ${g.dv}` : ""}{g.essence ? ` · Essence ${g.essence}` : ""}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {g.category === "armor" && <label className="flex items-center gap-1 text-xs"><input type="checkbox" className="accent-[var(--accent)]" checked={g.worn !== false} onChange={(e) => patch((x) => { x.gear[i].worn = e.target.checked; })} /> worn</label>}
                    <Stepper size="sm" label={`${g.name} quantity`} value={g.qty} min={1} onChange={(v) => patch((x) => { x.gear[i].qty = v; })} />
                    <button className="hover:text-danger" onClick={() => patch((x) => { x.gear.splice(i, 1); })} aria-label={`Remove ${g.name}`}>×</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel quiet p-4">
            <h3 className="mb-3 text-lg font-semibold">Lifestyle</h3>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Lifestyle"><select className="field w-48" value={c.lifestyle} onChange={(e) => patch((x) => { x.lifestyle = e.target.value; })}>{LIFESTYLES.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.cost.toLocaleString("en-US")}¥/mo)</option>)}</select></Field>
              <div><span className="mb-1 block text-sm text-dim">Months prepaid</span><Stepper label="Months prepaid" value={c.lifestyleMonths} min={0} max={24} onChange={(v) => patch((x) => { x.lifestyleMonths = v; })} /></div>
            </div>
          </section>

          <section className="panel quiet p-4">
            <h3 className="mb-3 text-lg font-semibold">Contacts</h3>
            <ul className="mb-3 divide-y divide-line">
              {c.contacts.map((k, i) => (
                <li key={k.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span><b className="font-display">{k.name}</b> <span className="text-dim">{k.role}</span></span>
                  <span className="flex items-center gap-3"><span className="num text-dim">C{k.connection} / L{k.loyalty}</span><button className="hover:text-danger" onClick={() => patch((x) => { x.contacts.splice(i, 1); })} aria-label={`Remove ${k.name}`}>×</button></span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-end gap-2">
              <input className="field w-40" placeholder="Name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} aria-label="Contact name" />
              <input className="field w-44" placeholder="Role (fixer, street doc)" value={contact.role} onChange={(e) => setContact({ ...contact, role: e.target.value })} aria-label="Contact role" />
              <label className="text-xs text-dim">Connection<input className="field num mt-1 w-16" type="number" min={1} max={12} value={contact.connection} onChange={(e) => setContact({ ...contact, connection: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })} /></label>
              <label className="text-xs text-dim">Loyalty<input className="field num mt-1 w-16" type="number" min={1} max={6} value={contact.loyalty} onChange={(e) => setContact({ ...contact, loyalty: Math.max(1, Math.min(6, Number(e.target.value) || 1)) })} /></label>
              <button className="btn" disabled={!contact.name.trim()} onClick={() => { patch((x) => { x.contacts.push({ id: uid("ct"), ...contact, name: contact.name.trim() }); }); setContact({ name: "", role: "", connection: 1, loyalty: 1 }); }}>Add</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
