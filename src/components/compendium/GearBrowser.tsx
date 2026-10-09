"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { useRulebook } from "@/lib/store/rulebook";
import { COMP_CATS, RANGE_NAMES, type CompCat, type CompItem } from "@/lib/compendium/types";
import { DRAG_TYPE, findItem, useCatalog, useGearList } from "@/lib/compendium/catalog";

const yen = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("en-US")}¥`);

export function AvailBadge({ item }: { item: CompItem }) {
  if (item.avail == null) return null;
  return (
    <span
      className={clsx("num inline-flex min-w-8 justify-center border px-1 text-xs leading-5", item.legal === "I" ? "border-danger/70 text-danger" : item.legal === "L" ? "border-accent/60 text-accent" : "border-line-hi text-dim")}
      title={`Availability ${item.avail}${item.legal === "I" ? ", illegal" : item.legal === "L" ? ", needs a license" : ""}`}
    >
      {item.avail}{item.legal ?? ""}
    </span>
  );
}

/** Attack Rating across the five range bands, as a strip of cells. */
function RangeStrip({ ar }: { ar: (number | null)[] }) {
  const max = Math.max(1, ...ar.map((v) => v ?? 0));
  return (
    <div className="grid grid-cols-5 gap-1" role="img" aria-label={`Attack rating: ${ar.map((v, i) => `${RANGE_NAMES[i]} ${v ?? "none"}`).join(", ")}`}>
      {ar.map((v, i) => (
        <div key={i} className="text-center">
          <div className="relative h-10 border border-line bg-bg2">
            {v != null && <span className="absolute inset-x-0 bottom-0 bg-accent/25" style={{ height: `${(v / max) * 100}%` }} />}
            <span className={clsx("num relative grid h-full place-items-center text-sm font-semibold", v == null && "text-faint")}>{v ?? "–"}</span>
          </div>
          <div className="mt-0.5 text-[10px] text-faint">{RANGE_NAMES[i]}</div>
        </div>
      ))}
    </div>
  );
}

/** Mark the page while a gear item is being dragged, so drop zones can light up. */
function startDrag(e: React.DragEvent, item: CompItem) {
  e.dataTransfer.setData(DRAG_TYPE, item.id);
  e.dataTransfer.setData("text/plain", item.name);
  e.dataTransfer.effectAllowed = "copy";
  const ghost = document.createElement("div");
  ghost.className = "drag-ghost";
  ghost.textContent = `${item.name}${item.cost != null ? `  ·  ${item.cost.toLocaleString("en-US")}¥` : ""}`;
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, 14, 14);
  setTimeout(() => ghost.remove(), 0);
  document.documentElement.dataset.dragging = "gear";
}
const endDrag = () => { delete document.documentElement.dataset.dragging; };

/** Props for any element that should accept gear dropped from a browser. */
export function useGearDrop(onItem: (item: CompItem) => void) {
  const list = useCatalog();
  const [over, setOver] = useState(false);
  const props = {
    "data-gear-drop": "",
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      if (!over) setOver(true);
    },
    onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); },
    onDrop: (e: React.DragEvent) => {
      setOver(false);
      endDrag();
      const it = findItem(list, e.dataTransfer.getData(DRAG_TYPE));
      if (!it) return;
      e.preventDefault();
      onItem(it);
    },
  };
  return { over, props };
}

function Detail({ item, onAdd, addLabel, blocked }: { item: CompItem & { hasText?: boolean }; onAdd?: (item: CompItem, qty: number) => void; addLabel: string; blocked?: string }) {
  const book = useRulebook((s) => s.book);
  const imported = useGearList((s) => !!s.imported);
  const [qty, setQty] = useState(1);
  const sec = item.book === "Core" && item.page ? book?.sections.find((s) => s.page === item.page && s.chapter === "Gear") ?? book?.sections.find((s) => s.page === item.page) : undefined;
  const ar = item.gear.ar;
  const stackable = item.cat === "ammo" || item.cat === "tools" || item.cat === "electronics" || item.cat === "magic";
  return (
    <div className="mt-2 space-y-3 border-t border-line pt-3 text-sm">
      {ar && <RangeStrip ar={ar} />}
      {item.stats.filter(([k]) => k !== "AR").length > 0 && (
        <dl className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {item.stats.filter(([k]) => k !== "AR").map(([k, v]) => (
            <div key={k} className="border border-line px-2 py-1"><dt className="text-[10px] text-faint">{k}</dt><dd className="num font-semibold">{v}</dd></div>
          ))}
        </dl>
      )}
      {item.wireless && <p><span className="mr-1.5 inline-flex items-center gap-1 text-xs font-semibold text-cyan"><Icon name="wifi" size={13} /> Wireless</span>{item.wireless}</p>}
      {item.note && <p className="text-dim">{item.note}</p>}
      {!imported && item.hasText && <p className="text-xs text-faint">This item has a wireless bonus or notes in the gear list. Import your copy of the list on the Compendium page to see them.</p>}
      <div className="flex flex-wrap items-center gap-2 text-xs text-faint">
        {item.book && <span>{item.book}{item.page ? `, p. ${item.page}` : ""}</span>}
        {sec && <Link href={`/rules?s=${encodeURIComponent(sec.id)}`} className="text-accent hover:underline" target="_blank">Open in the library</Link>}
        {item.per && <span>Price {item.per}</span>}
      </div>
      {onAdd && (
        <div className="flex flex-wrap items-center gap-2">
          {stackable && (
            <label className="flex items-center gap-1.5 text-xs text-dim">Qty
              <input className="field num !min-h-0 !w-16 !py-1" type="number" min={1} max={99} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(99, Math.floor(Number(e.target.value) || 1))))} />
            </label>
          )}
          <button className="btn small primary" disabled={!!blocked} title={blocked} onClick={() => onAdd(item, qty)}><Icon name="plus" size={14} /> {addLabel}{qty > 1 ? ` ×${qty}` : ""}</button>
          {item.cost != null && qty > 1 && <span className="num text-xs text-dim">{yen(item.cost * qty)}</span>}
          {blocked && <span className="text-xs text-danger">{blocked}</span>}
        </div>
      )}
    </div>
  );
}

export interface BrowserProps {
  onAdd?: (item: CompItem, qty: number) => void;
  /** Button text, e.g. "Add to Cipher". */
  addLabel?: string;
  /** Character creation: Availability above 6 cannot be bought. */
  creation?: boolean;
  /** Nuyen on hand, for the "I can afford it" filter. */
  nuyen?: number;
  compact?: boolean;
  /** Shown as the hint above the list. */
  hint?: string;
  initialQuery?: string;
}

export function GearBrowser({ onAdd, addLabel = "Add", creation, nuyen, compact, hint, initialQuery }: BrowserProps) {
  const list = useCatalog();
  const [q, setQ] = useState(initialQuery ?? "");
  const [cat, setCat] = useState<CompCat | "all">("all");
  const [group, setGroup] = useState("");
  const [sort, setSort] = useState<"name" | "cost" | "avail">("name");
  const [legalOnly, setLegalOnly] = useState(false);
  const [afford, setAfford] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const counts = useMemo(() => {
    const m: Partial<Record<CompCat, number>> = {};
    for (const i of list) m[i.cat] = (m[i.cat] ?? 0) + 1;
    return m;
  }, [list]);
  const groups = useMemo(() => (cat === "all" ? [] : [...new Set(list.filter((i) => i.cat === cat).map((i) => i.group))].sort()), [list, cat]);

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const out = list.filter((i) => {
      if (cat !== "all" && i.cat !== cat) return false;
      if (group && i.group !== group) return false;
      if (legalOnly && i.legal) return false;
      if (afford && nuyen != null && (i.cost ?? 0) > nuyen) return false;
      if (!words.length) return true;
      const hay = `${i.name} ${i.group} ${i.stats.map((s) => s.join(" ")).join(" ")}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    out.sort((a, b) => (sort === "cost" ? (a.cost ?? Infinity) - (b.cost ?? Infinity) : sort === "avail" ? (a.avail ?? 0) - (b.avail ?? 0) : 0) || a.name.localeCompare(b.name));
    return out;
  }, [list, q, cat, group, legalOnly, afford, nuyen, sort]);

  const blockedFor = (i: CompItem) => (creation && (i.avail ?? 0) > 6 ? "Availability 7 or more: not allowed at creation" : undefined);

  return (
    <div className={clsx("flex min-h-0 flex-col", compact ? "flex-1 gap-2" : "gap-3")}>
      <div className="relative">
        <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input className="field !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search gear: name, type, DV…" aria-label="Search the compendium" />
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Category">
        <button role="tab" aria-selected={cat === "all"} className={clsx("chip shrink-0", cat === "all" && "on")} onClick={() => { setCat("all"); setGroup(""); }}>All <span className="num text-faint">{list.length}</span></button>
        {COMP_CATS.filter((c) => counts[c.id]).map((c) => (
          <button key={c.id} role="tab" aria-selected={cat === c.id} title={c.blurb} className={clsx("chip shrink-0", cat === c.id && "on")} onClick={() => { setCat(c.id); setGroup(""); }}>
            {c.name} <span className="num text-faint">{counts[c.id]}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-dim">
        {groups.length > 1 && (
          <select className="field !min-h-0 !w-auto !py-1 text-xs" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Type">
            <option value="">Every type</option>
            {groups.map((g) => <option key={g}>{g}</option>)}
          </select>
        )}
        <select className="field !min-h-0 !w-auto !py-1 text-xs" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort by">
          <option value="name">Sort by name</option><option value="cost">Sort by price</option><option value="avail">Sort by availability</option>
        </select>
        <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-[var(--accent)]" checked={legalOnly} onChange={(e) => setLegalOnly(e.target.checked)} /> No license needed</label>
        {nuyen != null && <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-[var(--accent)]" checked={afford} onChange={(e) => setAfford(e.target.checked)} /> Within {nuyen.toLocaleString("en-US")}¥</label>}
        <span className="num ml-auto text-faint">{shown.length} listed</span>
      </div>
      {hint && <p className="text-xs text-faint">{hint}</p>}
      <ul className={clsx("min-h-0 divide-y divide-line overflow-y-auto border-y border-line", compact && "flex-1")}>
        {shown.map((i) => {
          const isOpen = open === i.id;
          const blocked = blockedFor(i);
          return (
            <li
              key={i.id}
              draggable={!!onAdd}
              onDragStart={(e) => startDrag(e, i)}
              onDragEnd={endDrag}
              className={clsx("group relative py-2 pl-1 pr-1", onAdd && "md:cursor-grab md:active:cursor-grabbing", isOpen && "bg-panelhi/60")}
            >
              <div className="flex items-start gap-2">
                {onAdd && <Icon name="grip" size={16} className="mt-1 shrink-0 text-faint opacity-50 group-hover:opacity-100 max-md:hidden" />}
                <button className="min-w-0 flex-1 text-left" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : i.id)}>
                  <div className="flex items-baseline gap-2">
                    <span className={clsx("font-display font-semibold group-hover:text-accent", !compact && "truncate")}>{i.name}</span>
                    {i.source === "imported" && i.wireless && <Icon name="wifi" size={12} className="shrink-0 text-cyan" />}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-dim">
                    <span>{i.group}</span>
                    {i.stats.slice(0, compact ? 2 : 4).map(([k, v]) => <span key={k} className="num text-faint"><span className="text-faint/80">{k}</span> <span className="text-fg/80">{v}</span></span>)}
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-2 pt-0.5">
                  <span className="num text-sm">{yen(i.cost)}{i.per && <span className="block text-right text-[10px] text-faint">{i.per}</span>}</span>
                  <AvailBadge item={i} />
                  {onAdd && (
                    <button className="btn small !min-h-8 !px-2" aria-label={`${addLabel}: ${i.name}`} title={blocked ?? addLabel} disabled={!!blocked} onClick={() => onAdd(i, 1)}>
                      <Icon name="plus" size={14} />
                    </button>
                  )}
                </div>
              </div>
              {isOpen && <Detail item={i} onAdd={onAdd} addLabel={addLabel} blocked={blocked} />}
            </li>
          );
        })}
        {shown.length === 0 && <li className="py-6 text-center text-sm text-dim">Nothing matches. Try another word or clear the filters.</li>}
      </ul>
    </div>
  );
}
