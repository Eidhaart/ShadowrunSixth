"use client";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { useRulebook } from "@/lib/store/rulebook";
import { uid, type GearItem } from "@/lib/sr6/character";
import { KARMA } from "@/lib/sr6/data";
import { budget, derive } from "@/lib/sr6/derive";
import { rules } from "@/lib/house/rules";
import { GearBrowser, useGearDrop } from "@/components/compendium/GearBrowser";
import { addToRunner } from "@/lib/compendium/catalog";
import type { CompItem } from "@/lib/compendium/types";
import { editExt } from "@/lib/sr6/ext";
import { essenceOf, ordered } from "@/lib/sr6/loadout";
import { HostNote, InstallSelect } from "@/components/gear/Install";
import { Fittings, dropGear } from "@/components/gear/Fittings";
import { WeaponFocusControl } from "@/components/gear/WeaponFocus";
import { sfxUi } from "@/lib/sound";
import { BookText } from "../wizard/BookText";
import { buzz } from "../wizard/fx";
import { Foci } from "../steps/MagicStep";
import { Field, Stepper, type StepProps } from "../ui";

const CATS: { id: GearItem["category"]; label: string }[] = [
  { id: "weapon", label: "Weapon" }, { id: "armor", label: "Armor or clothing" }, { id: "cyberware", label: "Cyberware" }, { id: "bioware", label: "Bioware" },
  { id: "commlink", label: "Commlink or deck" }, { id: "vehicle", label: "Vehicle or drone" }, { id: "ammo", label: "Ammo" }, { id: "magic", label: "Magical gear" }, { id: "misc", label: "Other" },
];
const catLabel = (id: GearItem["category"]) => CATS.find((k) => k.id === id)?.label ?? id;
const yen = (n: number) => `${n.toLocaleString("en-US")}¥`;

function stats(c: StepProps["c"], g: GearItem, host?: GearItem): string[] {
  const out: string[] = [catLabel(g.category), g.included ? "built in" : yen(g.cost * g.qty)];
  if (g.qty > 1) out.push(`×${g.qty}`);
  if (g.armor) out.push(`Armor ${g.armor}`);
  if (g.dv) out.push(`DV ${g.dv}`);
  if (g.ar?.some((v) => v != null)) out.push(`AR ${g.ar.map((v) => v ?? "—").join("/")}`);
  const ess = essenceOf(c, g);
  if (g.essence) out.push(host ? "no Essence, uses Capacity" : `Essence ${+ess.toFixed(2)}`);
  if (g.capCost) out.push(`[${g.capCost}]`);
  if (g.capacity) out.push(`Capacity ${g.capacity}`);
  if (g.avail != null) out.push(`Avail ${g.avail}${g.legal ?? ""}`);
  return out;
}

/** A catalog item's write-up in the Gear chapter, matched by its base name. */
function useGearSection(name?: string) {
  const book = useRulebook((s) => s.book);
  return useMemo(() => {
    if (!book || !name) return undefined;
    const base = name.replace(/,\s*rating \d+$/i, "").replace(/\s*\((?:alpha|beta|delta|used)[^)]*\)$/i, "").trim().toLowerCase();
    return book.sections.find((s) => s.chapter === "Gear" && s.title.trim().toLowerCase() === base)
      ?? book.sections.find((s) => s.chapter === "Gear" && base.startsWith(s.title.trim().toLowerCase()) && s.title.length > 5);
  }, [book, name]);
}

function removeGear(x: StepProps["c"], id: string) {
  const gone = dropGear(x, id);
  if (gone?.category === "magic") editExt(x, (ex) => { const f = ex.foci.find((q) => q.gearId === gone.id) ?? ex.foci.find((q) => !q.gearId && q.name === gone.name); if (f) ex.foci = ex.foci.filter((q) => q !== f); });
}

export function GearPage({ c, patch }: StepProps) {
  const b = budget(c);
  const d = derive(c);
  const [focus, setFocus] = useState<string | null>(null);
  const [tab, setTab] = useState<"shop" | "mine">("shop");
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<{ t: string; bad?: boolean; n: number } | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const perKarma = b.nuyen.fromKarma && c.karmaToNuyen ? b.nuyen.fromKarma / c.karmaToNuyen : KARMA.nuyenPerKarma;

  const buy = (i: CompItem, qty: number) => {
    if ((i.avail ?? 0) > rules().creationAvail) { setToast({ t: `${i.name}: Availability ${i.avail} is above ${rules().creationAvail}, closed at creation.`, bad: true, n: Date.now() }); sfxUi("deny"); buzz(25); return; }
    let newId: string | undefined;
    patch((x) => { const before = new Set(x.gear.map((g) => g.id)); addToRunner(x, i, { pay: false, qty }); newId = x.gear.find((g) => !before.has(g.id))?.id; });
    setFresh(newId ?? null);
    setTimeout(() => setFresh(null), 900);
    setToast({ t: `${i.name}${qty > 1 ? ` ×${qty}` : ""} added · ${yen((i.cost ?? 0) * qty)}`, n: Date.now() });
    sfxUi("add"); buzz();
  };
  const { over, props: drop } = useGearDrop((i) => buy(i, 1));
  const items = ordered(c);
  const sel = c.gear.find((g) => g.id === focus);
  const selHost = sel?.inId ? c.gear.find((g) => g.id === sel.inId) : undefined;
  const section = useGearSection(sel?.name);
  const open = (id: string) => { setFocus(id); if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches) setSheet(true); };

  const detail = sel ? (
    <div key={sel.id} className="wz-rise">
      <h3 className="font-display text-2xl font-bold leading-tight">{sel.name}</h3>
      <p className="num mt-1 text-sm text-dim">{stats(c, sel, selHost).join(" · ")}</p>
      <div className="mt-3 space-y-3">
        <HostNote c={c} g={sel} />
        <Fittings c={c} g={sel} patch={patch} creation onMessage={(t, bad) => setToast({ t, bad, n: Date.now() })} />
        {!sel.slot && <InstallSelect c={c} g={sel} onChange={(id) => patch((x) => { const g = x.gear.find((y) => y.id === sel.id); if (g) g.inId = id; })} />}
        <WeaponFocusControl c={c} w={sel} creation budget={b.nuyen.left} apply={patch} />
        <div className="flex flex-wrap items-center gap-3">
          {sel.category === "armor" && <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" className="accent-[var(--accent)]" checked={sel.worn !== false} onChange={(e) => patch((x) => { const g = x.gear.find((y) => y.id === sel.id); if (g) g.worn = e.target.checked; })} /> Worn</label>}
          {!/ focus, Force \d/i.test(sel.name) && !sel.included && !sel.slot && <span className="flex items-center gap-2 text-sm text-dim">Quantity <Stepper size="sm" label={`${sel.name} quantity`} value={sel.qty} min={1} onChange={(v) => patch((x) => { const g = x.gear.find((y) => y.id === sel.id); if (g) g.qty = v; })} /></span>}
          {sel.included ? <span className="text-xs text-faint">Built into the {selHost?.name ?? "item"}: it goes when that goes.</span> : <button className="btn small danger" onClick={() => { patch((x) => removeGear(x, sel.id)); setFocus(null); setSheet(false); sfxUi("remove"); }}><Icon name="trash" size={14} /> Remove</button>}
        </div>
        <Field label="Notes"><input className="field text-sm" value={sel.notes ?? ""} onChange={(e) => patch((x) => { const g = x.gear.find((y) => y.id === sel.id); if (g) g.notes = e.target.value || undefined; })} placeholder="Where it is kept, what it is for" /></Field>
      </div>
      <div className="mt-5 border-t border-line pt-4"><BookText section={section} /></div>
    </div>
  ) : (
    <div className="grid h-full place-items-center text-center text-sm text-faint"><div><Icon name="crate" size={28} className="mx-auto mb-2 opacity-50" />Select an item you own to fit it, focus it or read about it.</div></div>
  );

  return (
    <div>
      <section className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 border border-line bg-panel/60 p-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-dim">Karma to nuyen</div>
          <div className="flex items-center gap-3">
            <Stepper label="Karma converted to nuyen" value={c.karmaToNuyen} min={0} max={Math.max(0, c.karmaToNuyen + b.karma.left)} disableUp={b.karma.left <= 0} onChange={(v) => patch((x) => { x.karmaToNuyen = v; })} />
            <span className="num text-sm text-dim">× {perKarma.toLocaleString("en-US")}¥ = <b className="text-fg">+{yen(b.nuyen.fromKarma)}</b></span>
          </div>
        </div>
        <div className="num text-xs text-dim">Gear <b className="text-fg">{yen(b.nuyen.gear)}</b> · Lifestyle <b className="text-fg">{yen(b.nuyen.lifestyle)}</b> · Essence <b className="text-fg">{d.essence}</b></div>
        {b.nuyen.left > 5000 && <span className="text-xs text-accent">At most 5,000¥ carries into play; {yen(b.nuyen.left - 5000)} would be lost.</span>}
        {toast && <span key={toast.n} role="status" className={clsx("wz-rise ml-auto text-sm", toast.bad ? "text-danger" : "text-ok")}>{toast.t}</span>}
      </section>

      <div className="mb-2 inline-flex w-full border border-line lg:hidden" role="tablist" aria-label="Gear">
        {(["shop", "mine"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={clsx("min-h-11 flex-1 font-display text-sm", tab === t ? "bg-panelhi text-accent shadow-[inset_0_-2px_0_var(--accent)]" : "text-dim")}>
            {t === "shop" ? "Shop" : `Your gear (${c.gear.length})`}
          </button>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <section className={clsx("sel-pane lg:h-[clamp(28rem,calc(100dvh-21rem),48rem)]", tab !== "shop" && "max-lg:hidden")} aria-label="Shop">
          <div className="sel-head"><span>Available</span><span className="normal-case tracking-normal">Avail ≤ {rules().creationAvail}</span></div>
          <div className="flex min-h-0 flex-1 flex-col p-2 max-lg:min-h-[32rem]"><GearBrowser compact creation onAdd={buy} addLabel="Buy" nuyen={b.nuyen.left} /></div>
        </section>
        <section {...drop} className={clsx("sel-pane lg:h-[clamp(28rem,calc(100dvh-21rem),48rem)]", over && "sel-drop", tab !== "mine" && "max-lg:hidden")} aria-label="Your gear">
          <div className="sel-head"><span>Selected</span><span className="num normal-case tracking-normal">{c.gear.length}</span></div>
          <ul className="sel-list" role="listbox" aria-label="Your gear">
            {items.map(({ g, host }) => (
              <li key={g.id} data-row tabIndex={0} role="option" aria-selected={focus === g.id} onClick={() => open(g.id)}
                className={clsx("sel-row", host && "!pl-6", fresh === g.id && "sel-in")}
                onKeyDown={(e) => { if (e.key === "Delete" && !g.included) { patch((x) => removeGear(x, g.id)); sfxUi("remove"); } }}>
                {host && <span className="absolute left-2.5 top-3 text-faint" aria-hidden>└</span>}
                <div className="min-w-0 flex-1">
                  <div className="font-display font-semibold leading-tight">{g.name}{g.qty > 1 && <span className="num ml-1 text-xs text-dim">×{g.qty}</span>}</div>
                  <div className="num mt-0.5 truncate text-xs text-dim">{stats(c, g, host).slice(1).join(" · ")}</div>
                </div>
                {g.included ? null : <button className="btn small ghost !min-h-8 !px-2 shrink-0 hover:text-danger" aria-label={`Remove ${g.name}`} onClick={(e) => { e.stopPropagation(); patch((x) => removeGear(x, g.id)); if (focus === g.id) setFocus(null); sfxUi("remove"); }}><Icon name="x" size={14} /></button>}
              </li>
            ))}
            {c.gear.length === 0 && <li className="p-4 text-sm text-dim">Nothing bought yet. <span className="max-lg:hidden">Drag from the shop or press Buy.</span></li>}
          </ul>
        </section>
        <aside className="sel-pane sel-desc max-lg:hidden lg:h-[clamp(28rem,calc(100dvh-21rem),48rem)]" aria-label="Item details">
          <div className="sel-head"><span>Description</span></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{detail}</div>
        </aside>
      </div>
      {sheet && sel && (
        <div className="fixed inset-0 z-[70] bg-black/60 lg:hidden" onClick={() => setSheet(false)} role="presentation">
          <div className="sel-sheet sel-desc absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto border-t border-accent bg-bg p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={sel.name}>
            <button className="btn small ghost absolute right-2 top-2 z-10" onClick={() => setSheet(false)} aria-label="Close"><Icon name="x" size={16} /></button>
            {detail}
          </div>
        </div>
      )}

      {c.magicType !== "mundane" && c.magicType !== "technomancer" && <div className="mt-8"><Foci c={c} patch={patch} /></div>}
      <ManualItem patch={patch} />
    </div>
  );
}

const blank = (): Omit<GearItem, "id"> => ({ name: "", category: "misc", cost: 0, qty: 1 });

function ManualItem({ patch }: Pick<StepProps, "patch">) {
  const [item, setItem] = useState(blank());
  const [ar, setAr] = useState<string[]>(["", "", "", "", ""]);
  const add = () => {
    if (!item.name.trim()) return;
    const g: GearItem = { ...item, id: uid("g"), name: item.name.trim() };
    if (item.category === "weapon") g.ar = ar.map((v) => (v === "" ? null : Number(v))) as GearItem["ar"];
    patch((x) => { x.gear.push(g); });
    setItem(blank()); setAr(["", "", "", "", ""]); sfxUi("add");
  };
  return (
    <details className="mt-6 border border-line p-3">
      <summary className="cursor-pointer font-display text-sm text-dim">Add an item by hand</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2"><Field label="Name"><input className="field" value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} placeholder="Ares Predator VI" /></Field></div>
        <Field label="Type"><select className="field" value={item.category} onChange={(e) => setItem({ ...item, category: e.target.value as GearItem["category"] })}>{CATS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Cost (¥)"><input className="field num" type="number" min={0} value={item.cost} onChange={(e) => setItem({ ...item, cost: Math.max(0, Number(e.target.value) || 0) })} /></Field>
          <Field label="Qty"><input className="field num" type="number" min={1} value={item.qty} onChange={(e) => setItem({ ...item, qty: Math.max(1, Number(e.target.value) || 1) })} /></Field>
        </div>
        {item.category === "armor" && <Field label="Armor rating"><input className="field num" type="number" min={0} value={item.armor ?? 0} onChange={(e) => setItem({ ...item, armor: Math.max(0, Number(e.target.value) || 0), worn: true })} /></Field>}
        {(item.category === "cyberware" || item.category === "bioware") && <Field label="Essence cost"><input className="field num" type="number" step="0.05" min={0} value={item.essence ?? 0} onChange={(e) => setItem({ ...item, essence: Math.max(0, Number(e.target.value) || 0) })} /></Field>}
        {item.category === "weapon" && (
          <>
            <Field label="Damage Value (e.g. 3P)"><input className="field" value={item.dv ?? ""} onChange={(e) => setItem({ ...item, dv: e.target.value })} /></Field>
            <Field label="Skill"><select className="field" value={item.skill ?? "firearms"} onChange={(e) => setItem({ ...item, skill: e.target.value })}><option value="firearms">Firearms</option><option value="close-combat">Close Combat</option><option value="athletics">Athletics</option><option value="exotic-weapons">Exotic Weapons</option></select></Field>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-sm text-dim">Attack Rating: Close / Near / Medium / Far / Extreme</span>
              <div className="grid grid-cols-5 gap-2">{ar.map((v, i) => <input key={i} className="field num text-center" aria-label={`Attack rating ${["close", "near", "medium", "far", "extreme"][i]}`} value={v} onChange={(e) => setAr(ar.map((x, j) => (j === i ? e.target.value.replace(/[^\d]/g, "") : x)))} />)}</div>
            </div>
          </>
        )}
        <div className="flex items-end"><button className="btn primary" onClick={add} disabled={!item.name.trim()}>Add to gear</button></div>
      </div>
    </details>
  );
}
