"use client";
/**
 * An item's mounts and Capacity slots, the way Commlink 6 edits a carried item: every slot listed with
 * what sits in it, and an Add button that shows only what fits there, at the price it costs there.
 */
import { useMemo, useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { uid, type Character, type GearItem } from "@/lib/sr6/character";
import { C6, c6Val, fitsIn, meetsReq, type C6Item, type Fit, type Slot } from "@/lib/sr6/c6";
import { inSlot, putInSlot, slotRoom, slotUsed, slotsFor, templateOf } from "@/lib/sr6/loadout";
import { BUILT_IN_ITEMS, categoryOfC6 } from "@/lib/compendium/catalog";
import { rules } from "@/lib/house/rules";
import { sfxUi } from "@/lib/sound";

type Patch = (fn: (x: Character) => void) => void;
const yen = (n: number) => `${n.toLocaleString("en-US")}¥`;

/** Remove an item: whatever came built into it goes with it; anything else installed in it comes loose. */
export function dropGear(x: Pick<Character, "gear">, id: string): GearItem | undefined {
  const i = x.gear.findIndex((g) => g.id === id);
  if (i < 0) return undefined;
  const [gone] = x.gear.splice(i, 1);
  for (const k of x.gear.filter((g) => g.inId === id)) {
    if (k.included) dropGear(x, k.id);
    else { delete k.inId; delete k.slot; }
  }
  return gone;
}

/** A sheet item for a template in a slot: the catalog's own item when it has one, at the slot's price. */
function makeItem(t: C6Item, fit: Fit, rating?: number): GearItem {
  const comp = BUILT_IN_ITEMS.find((i) => i.c6 === t.id && (!rating || i.name.includes(` ${rating}`))) ?? BUILT_IN_ITEMS.find((i) => i.c6 === t.id);
  const base: Omit<GearItem, "id"> = comp ? JSON.parse(JSON.stringify(comp.gear)) : { name: t.n, category: categoryOfC6(t), cost: 0, qty: 1 };
  const variant = fit.variant?.n && fit.variant.n.toLowerCase() !== t.n.toLowerCase() ? fit.variant.n.toLowerCase() : "";
  const name = `${t.n}${rating && t.ratings ? `, rating ${rating}` : ""}${variant ? ` (${variant})` : ""}`;
  const g: GearItem = { ...base, id: uid("g"), name: comp && !variant && !rating ? base.name : name, cost: fit.price ?? base.cost ?? 0, qty: 1, c6: t.id };
  if (rating) g.rating = rating;
  if (fit.avail != null) g.avail = fit.avail; else delete g.avail;
  if (fit.legal) g.legal = fit.legal;
  return g;
}

interface Props {
  c: Character;
  g: GearItem;
  patch: Patch;
  /** Character creation: nothing above the Availability limit, and nuyen is counted by the budget. */
  creation?: boolean;
  /** After creation: take the price from the runner's nuyen. */
  pay?: boolean;
  onMessage?: (text: string, bad?: boolean) => void;
}

export function Fittings({ c, g, patch, creation, pay, onMessage }: Props) {
  const slots = slotsFor(g);
  const [open, setOpen] = useState<string | null>(null);
  if (!slots.length || g.inId) return null;
  return (
    <section aria-label={`${g.name}: mounts and slots`}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-widest text-dim">Mounts and slots</span>
        {templateOf(g) && <span className="text-[10px] text-faint">layout from Commlink 6</span>}
      </div>
      <div className="grid gap-2">
        {slots.map((s) => (
          <SlotBox key={s.hook} c={c} host={g} s={s} patch={patch} open={open === s.hook} onToggle={() => setOpen(open === s.hook ? null : s.hook)} creation={creation} pay={pay} onMessage={onMessage} />
        ))}
      </div>
    </section>
  );
}

function SlotBox({ c, host, s, patch, open, onToggle, creation, pay, onMessage }: { c: Character; host: GearItem; s: Slot; patch: Patch; open: boolean; onToggle: () => void } & Pick<Props, "creation" | "pay" | "onMessage">) {
  const kids = inSlot(c, host, s);
  const used = slotUsed(c, host, s);
  const isCap = s.capacity != null && s.capacity !== Infinity;
  const full = s.capacity == null ? kids.length > 0 : isCap ? used >= (s.capacity ?? 0) : false;
  return (
    <div className={clsx("border bg-panel/40", open ? "border-accent/60" : "border-line")}>
      <div className="flex items-center gap-2 px-2.5 pt-2">
        <span className="font-display text-sm font-semibold">{s.label}</span>
        <span className="num ml-auto text-[11px] text-dim">{isCap ? `${used} / ${s.capacity}` : s.capacity == null ? (kids.length ? "taken" : "free") : kids.length ? `${kids.length} fitted` : "open"}</span>
      </div>
      {isCap && (
        <div className="mx-2.5 mt-1 h-1 bg-line" aria-hidden>
          <div className={clsx("h-full", used > (s.capacity ?? 0) ? "bg-danger" : "bg-accent")} style={{ width: `${Math.min(100, (used / Math.max(1, s.capacity ?? 1)) * 100)}%` }} />
        </div>
      )}
      <ul className="px-2.5 py-1.5">
        {kids.map((k) => (
          <li key={k.id} className="flex items-center gap-2 py-0.5 text-sm">
            <span className="min-w-0 flex-1 truncate">{k.name}</span>
            {k.capCost ? <span className="num text-[11px] text-dim">[{k.capCost}]</span> : null}
            {k.included ? <span className="text-[11px] text-faint">built in</span> : (
              <>
                <button className="btn small ghost !min-h-7 !px-1.5 text-[11px]" title="Take it off, keep it in your gear" onClick={() => patch((x) => { const t = x.gear.find((y) => y.id === k.id); if (t) { delete t.inId; delete t.slot; } })}>Detach</button>
                <button className="btn small ghost !min-h-7 !px-1.5 hover:text-danger" aria-label={`Remove ${k.name}`} onClick={() => { patch((x) => { dropGear(x, k.id); }); sfxUi("remove"); }}><Icon name="x" size={13} /></button>
              </>
            )}
          </li>
        ))}
        {!kids.length && <li className="py-0.5 text-xs text-faint">Empty</li>}
      </ul>
      <div className="px-2.5 pb-2">
        <button className={clsx("btn small ghost !min-h-8 text-xs", open && "text-accent")} onClick={onToggle} disabled={full && !open} aria-expanded={open}>
          <Icon name={open ? "x" : "plus"} size={13} /> {open ? "Close" : full ? "Full" : "Add"}
        </button>
      </div>
      {open && <Picker c={c} host={host} s={s} patch={patch} creation={creation} pay={pay} onMessage={onMessage} onDone={onToggle} />}
    </div>
  );
}

function Picker({ c, host, s, patch, creation, pay, onMessage, onDone }: { c: Character; host: GearItem; s: Slot; patch: Patch; onDone: () => void } & Pick<Props, "creation" | "pay" | "onMessage">) {
  const [q, setQ] = useState("");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const limit = rules().creationAvail;
  const hostT = templateOf(host);
  const shop = useMemo(() => C6.items.map((t) => ({ t, fit: fitsIn(t, s.hook) })).filter((x): x is { t: C6Item; fit: Fit } => !!x.fit && x.fit.price != null && meetsReq(x.t, hostT))
    .sort((a, b) => a.t.n.localeCompare(b.t.n)), [s.hook, hostT]);
  // things already owned and lying loose that fit here
  const loose = c.gear.filter((k) => !k.inId && k.id !== host.id && !k.included && (() => { const t = templateOf(k); return t ? !!fitsIn(t, s.hook, k.rating) && meetsReq(t, hostT) : false; })());
  const t0 = q.trim().toLowerCase();
  const list = shop.filter(({ t }) => !t0 || t.n.toLowerCase().includes(t0));

  const fit = (k: GearItem) => {
    const t = templateOf(k)!;
    const f = fitsIn(t, s.hook, k.rating)!;
    if (!slotRoom(c, host, s, f.size)) { onMessage?.(`${k.name} does not fit: ${s.label} is full.`, true); sfxUi("deny"); return; }
    patch((x) => { const h = x.gear.find((y) => y.id === host.id); const it = x.gear.find((y) => y.id === k.id); if (h && it) putInSlot(h, it, s.hook, f.size); });
    onMessage?.(`${k.name} fitted to the ${host.name}.`); sfxUi("add"); onDone();
  };
  const buy = (t: C6Item) => {
    const r = t.ratings ? ratings[t.id] ?? t.ratings[0] : undefined;
    const f = fitsIn(t, s.hook, r)!;
    if (creation && (f.avail ?? 0) > limit) { onMessage?.(`${t.n}: Availability ${f.avail} is above ${limit}, closed at creation.`, true); sfxUi("deny"); return; }
    if (!slotRoom(c, host, s, f.size)) { onMessage?.(`${t.n} needs ${f.size} Capacity; ${s.label} does not have it free.`, true); sfxUi("deny"); return; }
    const price = f.price ?? 0;
    if (pay && !creation && price > c.nuyen) { onMessage?.(`${t.n} costs ${yen(price)}; you have ${yen(c.nuyen)}.`, true); sfxUi("deny"); return; }
    patch((x) => {
      const h = x.gear.find((y) => y.id === host.id);
      if (!h) return;
      const it = makeItem(t, f, r);
      putInSlot(h, it, s.hook, f.size);
      x.gear.push(it);
      if (pay && !creation) x.nuyen -= price;
    });
    onMessage?.(`${t.n} added to the ${host.name} · ${yen(price)}`); sfxUi("add"); onDone();
  };

  return (
    <div className="border-t border-line bg-bg/60 p-2">
      <input className="field !min-h-0 !py-1 text-sm" autoFocus placeholder={`What goes in: ${s.label.toLowerCase()}`} value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Search ${s.label}`} />
      <ul className="mt-1.5 max-h-64 overflow-y-auto" role="listbox" aria-label={`Fits ${s.label}`}>
        {loose.map((k) => (
          <li key={k.id} className="flex items-center gap-2 border-b border-line/60 py-1.5 text-sm">
            <span className="min-w-0 flex-1"><span className="font-display font-semibold">{k.name}</span> <span className="text-[11px] text-ok">yours</span></span>
            <button className="btn small !min-h-7 text-xs" onClick={() => fit(k)}>Fit</button>
          </li>
        ))}
        {list.map(({ t }) => {
          const r = t.ratings ? ratings[t.id] ?? t.ratings[0] : undefined;
          const f = fitsIn(t, s.hook, r)!;
          const closed = creation && (f.avail ?? 0) > limit;
          const room = slotRoom(c, host, s, f.size);
          return (
            <li key={t.id} className={clsx("flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line/60 py-1.5 text-sm", (closed || !room) && "opacity-55")}>
              <span className="min-w-0 flex-1">
                <span className="font-display font-semibold">{t.n}</span>
                {f.variant?.n && f.variant.n.toLowerCase() !== t.n.toLowerCase() && <span className="text-[11px] text-dim"> · {f.variant.n.toLowerCase()} version</span>}
                <span className="num block text-[11px] text-dim">{yen(f.price ?? 0)}{f.avail != null ? ` · Avail ${f.avail}${f.legal ?? ""}` : ""}{f.size ? ` · [${f.size}]` : ""}{t.p ? ` · p. ${t.p}` : ""}</span>
              </span>
              {t.ratings && (
                <select className="field !min-h-0 !w-auto !py-0.5 text-xs" aria-label={`${t.n} rating`} value={r} onChange={(e) => setRatings({ ...ratings, [t.id]: Number(e.target.value) })}>
                  {t.ratings.map((n) => <option key={n} value={n}>R{n} · {yen(c6Val(f.variant?.price ?? t.price, n, t.ratings) ?? 0)}</option>)}
                </select>
              )}
              <button className="btn small !min-h-7 text-xs" onClick={() => buy(t)} disabled={closed || !room} title={closed ? `Availability above ${limit}` : !room ? "Not enough room" : undefined}>{pay && !creation ? "Buy" : "Add"}</button>
            </li>
          );
        })}
        {!list.length && !loose.length && <li className="py-2 text-xs text-faint">Nothing in the core data fits here.</li>}
      </ul>
    </div>
  );
}
