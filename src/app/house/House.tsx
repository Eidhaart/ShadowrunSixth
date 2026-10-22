"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { useCatalog } from "@/lib/compendium/catalog";
import { COMP_CATS } from "@/lib/compendium/types";
import { SKILLS } from "@/lib/sr6/data";
import { useComms } from "@/lib/store/comms";
import { effective, useHouse } from "@/lib/house/store";
import { BOOK, FIELDS, GROUPS, PRESETS, diffs, show, type Field, type HouseItem, type Mechanics, type Ruleset } from "@/lib/house/rules";

type Tab = "mech" | "items" | "notes" | "statuses";
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// ───────────────────────── worked examples ─────────────────────────

/** Three small scenes that show what the numbers do, side by side with the book. */
function Examples({ m }: { m: Mechanics }) {
  const rows = (mm: Mechanics) => {
    // a 3P pistol hit: attack 4 hits, defense 2 (net 2); a BOD 4 runner with 2 armor soaks 1 hit (+1 if armor soaks)
    const soakHits = 1 + (mm.armorSoaks ? 1 : 0);
    const dmg = Math.max(0, 3 + 2 - soakHits);
    const tie = mm.tie === "graze" ? "graze, 0 boxes" : mm.tie === "hit" ? "hit for 3P" : "miss";
    const phys = mm.physBase + 2, stun = mm.stunBase + 2;
    const wounds = Math.floor(6 / mm.woundEvery);
    const spill = Math.floor(6 / Math.max(1, mm.stunSpill));
    return [
      ["Heavy pistol, 4 v 2 hits", `${dmg}P taken`],
      ["Tied 3 v 3", tie],
      ["BOD 4, WIL 4 monitors", `${phys} Physical, ${stun} Stun`],
      ["6 boxes of damage", `−${wounds} dice`],
      ["6 Stun past a full track", `${spill}P`],
      ["Initiative 2D6", `${mm.minorBase + 2} Minor actions`],
    ];
  };
  const mine = rows(m), book = rows(BOOK);
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-xs text-faint"><th className="pb-1 font-normal">Situation</th><th className="pb-1 font-normal">Book</th><th className="pb-1 font-normal">Your table</th></tr></thead>
      <tbody>
        {mine.map(([label, v], i) => (
          <tr key={label} className="border-t border-line">
            <td className="py-1.5 pr-2 text-dim">{label}</td>
            <td className="num py-1.5 pr-2">{book[i][1]}</td>
            <td className={clsx("num py-1.5", v !== book[i][1] && "font-semibold text-accent")}>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ───────────────────────── mechanics ─────────────────────────

function Control({ f, value, onChange, readOnly }: { f: Field; value: Mechanics[keyof Mechanics]; onChange: (v: Mechanics[keyof Mechanics]) => void; readOnly?: boolean }) {
  if (f.spec.kind === "bool")
    return (
      <button role="switch" aria-checked={!!value} aria-label={f.label} disabled={readOnly} className={clsx("house-switch", value && "on")} onClick={() => onChange(!value)}>
        <span />
      </button>
    );
  if (f.spec.kind === "choice")
    return (
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={f.label}>
        {f.spec.options.map((o) => (
          <button key={o.v} role="radio" aria-checked={value === o.v} disabled={readOnly} className={clsx("chip", value === o.v && "on")} onClick={() => onChange(o.v as Mechanics[keyof Mechanics])}>{o.label}</button>
        ))}
      </div>
    );
  const { min, max, step = 1, unit } = f.spec;
  const n = Number(value);
  return (
    <div className="flex items-center gap-1">
      <button className="vtt-mini !size-8" disabled={readOnly || n <= min} onClick={() => onChange(Math.max(min, n - step))} aria-label={`Lower ${f.label}`}>−</button>
      <input className="field num !min-h-0 !w-20 !py-1 text-center" type="number" min={min} max={max} step={step} value={n} disabled={readOnly}
        onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v))); }} aria-label={f.label} />
      <button className="vtt-mini !size-8" disabled={readOnly || n >= max} onClick={() => onChange(Math.min(max, n + step))} aria-label={`Raise ${f.label}`}>+</button>
      {unit && <span className="text-xs text-faint">{unit}</span>}
    </div>
  );
}

function Mechanic({ rs, readOnly }: { rs: Ruleset; readOnly?: boolean }) {
  const update = useHouse((s) => s.update);
  const m: Mechanics = { ...BOOK, ...rs.mech };
  const set = (k: keyof Mechanics, v: Mechanics[keyof Mechanics]) => update(rs.id, (r) => {
    if (v === BOOK[k]) delete r.mech[k];
    else (r.mech as Record<string, unknown>)[k] = v;
  });
  const [q, setQ] = useState("");
  const [onlyChanged, setOnlyChanged] = useState(false);
  const shown = FIELDS.filter((f) => (!q || `${f.label} ${f.help} ${f.group}`.toLowerCase().includes(q.toLowerCase())) && (!onlyChanged || m[f.key] !== BOOK[f.key]));
  const changed = diffs(rs.mech).length;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-5">
        {!readOnly && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">Start from a style</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {PRESETS.map((p) => {
                const on = JSON.stringify(p.mech) === JSON.stringify(rs.mech);
                return (
                  <button key={p.id} className={clsx("house-preset p-3 text-left", on && "on")} onClick={() => update(rs.id, (r) => { r.mech = { ...p.mech }; })}>
                    <span className="flex items-center justify-between gap-2"><b className="font-display">{p.name}</b>{on && <Icon name="check" size={15} className="text-accent" />}</span>
                    <span className="mt-1 block text-xs text-dim">{p.blurb}</span>
                    <span className="num mt-2 block text-[11px] text-faint">{Object.keys(p.mech).length ? `${Object.keys(p.mech).length} changes` : "No changes"}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-faint">A style replaces your mechanics. Items, notes and statuses stay.</p>
          </section>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input className="field max-w-xs flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a rule: edge, wound, karma" aria-label="Find a rule" />
          <button className={clsx("chip", onlyChanged && "on")} onClick={() => setOnlyChanged(!onlyChanged)} aria-pressed={onlyChanged}>Only changed ({changed})</button>
          {!readOnly && changed > 0 && <button className="btn small ghost" onClick={() => update(rs.id, (r) => { r.mech = {}; })}><Icon name="undo" size={14} /> All back to the book</button>}
        </div>
        {GROUPS.map((g) => {
          const fs = shown.filter((f) => f.group === g.id);
          if (!fs.length) return null;
          return (
            <section key={g.id} className="panel">
              <div className="panel-head"><span className="flex-1">{g.id}</span><span className="text-xs font-normal text-dim">{g.blurb}</span></div>
              <ul className="divide-y divide-line">
                {fs.map((f) => {
                  const v = m[f.key];
                  const diff = v !== BOOK[f.key];
                  return (
                    <li key={f.key} className={clsx("house-row grid gap-2 px-3.5 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center", diff && "changed")}>
                      <div className="min-w-0">
                        <div className="font-semibold">{f.label}</div>
                        <div className="text-xs text-dim">
                          {f.help}{f.help && " "}
                          {diff ? (
                            <span className="text-accent">Book: {show(f, BOOK[f.key])}.{!readOnly && <> <button className="underline" onClick={() => set(f.key, BOOK[f.key])}>Reset</button></>}</span>
                          ) : <span className="text-faint">As the book.</span>}
                        </div>
                      </div>
                      <Control f={f} value={v} onChange={(nv) => set(f.key, nv)} readOnly={readOnly} />
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {!shown.length && <p className="text-dim">No rule matches that.</p>}
      </div>
      <aside className="space-y-4 xl:sticky xl:top-16 xl:self-start">
        <section className="panel p-4">
          <h2 className="font-semibold">What changes at the table</h2>
          <p className="mb-3 text-xs text-dim">{changed ? `${changed} rule${changed === 1 ? "" : "s"} differ from the book.` : "Everything plays by the book."}</p>
          <Examples m={m} />
        </section>
        <section className="panel p-4 text-sm text-dim">
          <h2 className="mb-1 font-semibold text-fg">Where it applies</h2>
          <p>Attacks, defense, soak and damage on the Table; condition monitors, wound modifiers and initiative on every sheet; Karma prices on the Advance tab; the Forge budget and gear availability. Players at your table get these rules from you while they are in your room.</p>
        </section>
      </aside>
    </div>
  );
}

// ───────────────────────── items ─────────────────────────

const ITEM_CATS = COMP_CATS.filter((c) => c.id !== "matrix").map((c) => c.id) as HouseItem["cat"][];
const COMBAT_SKILLS = SKILLS.filter((s) => s.group === "combat");

function ItemEditor({ it, onChange, onRemove }: { it: HouseItem; onChange: (p: Partial<HouseItem>) => void; onRemove: () => void }) {
  const ar = it.ar ?? [null, null, null, null, null];
  return (
    <div className="space-y-3 p-3.5">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="text-xs text-dim">Name<input className="field" value={it.name} onChange={(e) => onChange({ name: e.target.value })} /></label>
        <label className="text-xs text-dim">Category
          <select className="field" value={it.cat} onChange={(e) => onChange({ cat: e.target.value as HouseItem["cat"] })}>
            {ITEM_CATS.map((c) => <option key={c} value={c}>{COMP_CATS.find((x) => x.id === c)?.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-dim">Type<input className="field" value={it.group} onChange={(e) => onChange({ group: e.target.value })} placeholder="Heavy Pistol, Blade…" /></label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-dim">Cost (¥)<input className="field num" type="number" min={0} value={it.cost ?? ""} onChange={(e) => onChange({ cost: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })} /></label>
        <label className="text-xs text-dim">Availability<input className="field num" type="number" min={0} value={it.avail ?? ""} onChange={(e) => onChange({ avail: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) })} /></label>
        <label className="text-xs text-dim">Legality
          <select className="field" value={it.legal ?? ""} onChange={(e) => onChange({ legal: (e.target.value || undefined) as HouseItem["legal"] })}>
            <option value="">Legal</option><option value="L">Licensed</option><option value="I">Illegal</option>
          </select>
        </label>
      </div>
      {it.cat === "weapons" && (
        <div className="space-y-2 border-l-2 border-accent/40 pl-3">
          <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
            <label className="text-xs text-dim">Damage<input className="field num" value={it.dv ?? ""} onChange={(e) => onChange({ dv: e.target.value.toUpperCase().slice(0, 8) })} placeholder="4P" /></label>
            <label className="text-xs text-dim">Skill
              <select className="field" value={it.skill ?? "firearms"} onChange={(e) => onChange({ skill: e.target.value })}>
                {COMBAT_SKILLS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </div>
          <div>
            <div className="mb-1 text-xs text-dim">Attack Rating by range (empty: cannot reach)</div>
            <div className="grid grid-cols-5 gap-1">
              {["Close", "Near", "Medium", "Far", "Extreme"].map((b, i) => (
                <label key={b} className="text-center text-[10px] text-faint">{b}
                  <input className="field num !min-h-0 !py-1 text-center" type="number" min={0} value={ar[i] ?? ""} onChange={(e) => { const next = [...ar]; next[i] = e.target.value === "" ? null : Math.max(0, Number(e.target.value)); onChange({ ar: next }); }} />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
      {it.cat === "armor" && (
        <label className="block border-l-2 border-accent/40 pl-3 text-xs text-dim">Defense Rating bonus<input className="field num !w-28" type="number" min={0} value={it.armor ?? 0} onChange={(e) => onChange({ armor: Math.max(0, Number(e.target.value) || 0) })} /></label>
      )}
      {it.cat === "augmentations" && (
        <label className="block border-l-2 border-accent/40 pl-3 text-xs text-dim">Essence cost<input className="field num !w-28" type="number" min={0} step={0.05} value={it.essence ?? 0} onChange={(e) => onChange({ essence: Math.max(0, Number(e.target.value) || 0) })} /></label>
      )}
      <label className="block text-xs text-dim">Notes, wireless bonus, special rules<textarea className="field min-h-16" value={it.note ?? ""} onChange={(e) => onChange({ note: e.target.value })} /></label>
      <button className="btn small ghost text-danger" onClick={onRemove}><Icon name="trash" size={14} /> Remove item</button>
    </div>
  );
}

function Items({ rs, readOnly }: { rs: Ruleset; readOnly?: boolean }) {
  const update = useHouse((s) => s.update);
  const catalog = useCatalog();
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const hits = q.trim().length > 1 ? catalog.filter((i) => i.source !== "house" && i.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const add = (it: HouseItem) => { update(rs.id, (r) => { r.items.unshift(it); }); setOpen(it.id); setQ(""); };
  const patch = (id: string, p: Partial<HouseItem>) => update(rs.id, (r) => { const i = r.items.findIndex((x) => x.id === id); if (i >= 0) r.items[i] = { ...r.items[i], ...p }; });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-2">
        {!readOnly && (
          <div className="panel space-y-2 p-3">
            <div className="flex flex-wrap gap-2">
              <button className="btn small primary" onClick={() => add({ id: uid("hi"), name: "New weapon", cat: "weapons", group: "Heavy Pistol", cost: 500, avail: 3, dv: "3P", ar: [10, 10, 8, null, null], skill: "firearms" })}><Icon name="plus" size={14} /> Weapon</button>
              <button className="btn small" onClick={() => add({ id: uid("hi"), name: "New armor", cat: "armor", group: "Armor", cost: 500, avail: 2, armor: 2 })}><Icon name="plus" size={14} /> Armor</button>
              <button className="btn small" onClick={() => add({ id: uid("hi"), name: "New implant", cat: "augmentations", group: "Cyberware", cost: 5000, avail: 4, essence: 0.2 })}><Icon name="plus" size={14} /> Augmentation</button>
              <button className="btn small" onClick={() => add({ id: uid("hi"), name: "New gear", cat: "tools", group: "Gear", cost: 100, avail: 1 })}><Icon name="plus" size={14} /> Other</button>
            </div>
            <div className="relative">
              <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Or start from a book item: Ares Predator, armor jacket…" aria-label="Copy a book item" />
              {hits.length > 0 && (
                <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto border border-line-hi bg-panel shadow-xl">
                  {hits.map((h) => (
                    <li key={h.id}>
                      <button className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-panelhi" onClick={() => add({
                        id: uid("hi"), name: `${h.name} (house)`, cat: (h.cat === "matrix" ? "electronics" : h.cat) as HouseItem["cat"], group: h.group, cost: h.cost, avail: h.avail, legal: h.legal,
                        dv: h.dv, ar: h.ar, skill: h.skill, armor: h.gear.armor, essence: h.essence, note: h.note,
                      })}>
                        <span className="truncate">{h.name}</span><span className="shrink-0 text-xs text-faint">{h.group}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        {rs.items.length === 0 && <p className="p-3 text-dim">{readOnly ? "No house items." : "Homebrew weapons, armor and implants appear in the Compendium, the Forge and the sheets, marked House."}</p>}
        {rs.items.map((it) => (
          <article key={it.id} className="panel overflow-hidden">
            <button className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left" onClick={() => setOpen(open === it.id ? null : it.id)} aria-expanded={open === it.id}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display font-semibold">{it.name || "Untitled"}</span>
                <span className="num block text-xs text-dim">{it.group} {it.dv ? `· DV ${it.dv}` : ""}{it.ar?.some((v) => v != null) ? ` · AR ${it.ar.map((v) => v ?? "–").join("/")}` : ""}{it.armor ? ` · +${it.armor} DR` : ""}{it.essence ? ` · ${it.essence} Ess` : ""}</span>
              </span>
              <span className="num shrink-0 text-sm">{it.cost != null ? `${it.cost.toLocaleString()}¥` : "–"}</span>
              {it.avail != null && <span className="chip shrink-0">{it.avail}{it.legal ?? ""}</span>}
              <Icon name="chev" size={16} className={clsx("shrink-0 transition-transform", open === it.id && "rotate-90")} />
            </button>
            {open === it.id && (readOnly ? <p className="border-t border-line p-3.5 text-sm text-dim">{it.note || "No notes."}</p> : (
              <div className="border-t border-line"><ItemEditor it={it} onChange={(p) => patch(it.id, p)} onRemove={() => update(rs.id, (r) => { r.items = r.items.filter((x) => x.id !== it.id); })} /></div>
            ))}
          </article>
        ))}
      </div>
      <aside className="panel h-fit p-4 text-sm text-dim">
        <h2 className="mb-1 font-semibold text-fg">House gear</h2>
        <p>Items here join the Compendium with a House badge. They can be dragged onto sheets and bought in the Forge like any book item, within your availability cap. Weapons bring their DV and Attack Ratings to the Table.</p>
        <p className="mt-2"><Link className="text-accent underline" href="/compendium">Open the Compendium</Link></p>
      </aside>
    </div>
  );
}

// ───────────────────────── notes and statuses ─────────────────────────

function Notes({ rs, readOnly }: { rs: Ruleset; readOnly?: boolean }) {
  const update = useHouse((s) => s.update);
  const [q, setQ] = useState("");
  const list = rs.notes.filter((n) => !q || `${n.title} ${n.text} ${n.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase()));
  const patch = (id: string, p: Partial<Ruleset["notes"][number]>) => update(rs.id, (r) => { const i = r.notes.findIndex((x) => x.id === id); if (i >= 0) r.notes[i] = { ...r.notes[i], ...p }; });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input className="field max-w-sm flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search house rules" aria-label="Search house rules" />
        {!readOnly && <button className="btn primary" onClick={() => update(rs.id, (r) => { r.notes.unshift({ id: uid("hn"), title: "New house rule", text: "", tags: [] }); })}><Icon name="plus" size={15} /> House rule</button>}
      </div>
      {list.length === 0 && <p className="text-dim">{readOnly ? "No written house rules." : "Write down the rulings your table keeps: how you handle called shots, what the fixer pays, which books are in play. Players can search them from the Table."}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((n) => readOnly ? (
          <article key={n.id} className="panel p-4">
            <h3 className="font-display text-lg font-semibold">{n.title}</h3>
            {n.tags.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{n.tags.map((t) => <span key={t} className="chip !text-[11px]">{t}</span>)}</div>}
            <p className="mt-2 whitespace-pre-wrap text-sm text-dim">{n.text}</p>
          </article>
        ) : (
          <article key={n.id} className={clsx("panel space-y-2 p-3.5", n.secret && "border-astral/50")}>
            <div className="flex gap-2">
              <input className="field flex-1 font-semibold" value={n.title} onChange={(e) => patch(n.id, { title: e.target.value })} aria-label="Title" />
              <button className="btn small ghost !px-2" onClick={() => update(rs.id, (r) => { r.notes = r.notes.filter((x) => x.id !== n.id); })} aria-label="Delete"><Icon name="trash" size={14} /></button>
            </div>
            <textarea className="field min-h-28 text-sm" value={n.text} onChange={(e) => patch(n.id, { text: e.target.value })} placeholder="The rule, in your words" />
            <div className="flex flex-wrap items-center gap-2">
              <input className="field !min-h-0 flex-1 !py-1 text-sm" value={n.tags.join(", ")} onChange={(e) => patch(n.id, { tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8) })} placeholder="Tags: combat, magic" aria-label="Tags" />
              <label className="flex items-center gap-1.5 text-xs text-dim" title="Secret notes stay with you; players never receive them"><input type="checkbox" checked={!!n.secret} onChange={(e) => patch(n.id, { secret: e.target.checked })} /> GM only</label>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Statuses({ rs, readOnly }: { rs: Ruleset; readOnly?: boolean }) {
  const update = useHouse((s) => s.update);
  const patch = (id: string, p: Partial<Ruleset["statuses"][number]>) => update(rs.id, (r) => { const i = r.statuses.findIndex((x) => x.id === id); if (i >= 0) r.statuses[i] = { ...r.statuses[i], ...p }; });
  return (
    <div className="max-w-3xl space-y-2">
      <p className="text-sm text-dim">Custom statuses join the book&apos;s list on sheets and on Table tokens, with your description on hover.</p>
      {rs.statuses.map((s) => readOnly ? (
        <div key={s.id} className="panel p-3"><b>{s.name}</b> <span className="text-sm text-dim">{s.text}</span></div>
      ) : (
        <div key={s.id} className="panel flex flex-wrap gap-2 p-2.5">
          <input className="field !w-40" value={s.name} onChange={(e) => patch(s.id, { name: e.target.value.slice(0, 24) })} aria-label="Status name" />
          <input className="field min-w-48 flex-1" value={s.text} onChange={(e) => patch(s.id, { text: e.target.value })} placeholder="What it does" aria-label="Status effect" />
          <button className="btn small ghost" onClick={() => update(rs.id, (r) => { r.statuses = r.statuses.filter((x) => x.id !== s.id); })} aria-label="Delete"><Icon name="trash" size={14} /></button>
        </div>
      ))}
      {!readOnly && <button className="btn" onClick={() => update(rs.id, (r) => { r.statuses.push({ id: uid("hs"), name: "Marked", text: "" }); })}><Icon name="plus" size={15} /> Status</button>}
    </div>
  );
}

// ───────────────────────── page ─────────────────────────

export function House() {
  const h = useHouse();
  const comms = useComms();
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("mech");
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const list = useMemo(() => Object.values(h.sets).sort((a, b) => b.updatedAt - a.updatedAt), [h.sets]);
  const atTable = h.asPlayer ? h.tableRules : null;
  const current = sel === "table" ? atTable : sel && h.sets[sel] ? h.sets[sel] : h.activeId && h.sets[h.activeId] ? h.sets[h.activeId] : list[0] ?? null;
  const readOnly = sel === "table";
  const inForce = effective(h);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t); }, [msg]);

  const exportSet = (r: Ruleset) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(r, null, 2)], { type: "application/json" }));
    a.download = `${r.name.replace(/[^\w-]+/g, "-").toLowerCase() || "house-rules"}.sixthrules.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importSet = async (f?: File) => {
    if (!f) return;
    try { const r = h.importOne(JSON.parse(await f.text())); if (!r) throw new Error(); setSel(r.id); setMsg(`Imported ${r.name}.`); }
    catch { setMsg("That file is not a SixthDeck ruleset."); }
  };
  const tabs: { id: Tab; label: string; n?: number }[] = [
    { id: "mech", label: "Mechanics", n: current ? diffs(current.mech).length : 0 },
    { id: "items", label: "Items", n: current?.items.length },
    { id: "notes", label: "House rules", n: current?.notes.length },
    { id: "statuses", label: "Statuses", n: current?.statuses.length },
  ];

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-8 md:py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold md:text-4xl">House rules</h1>
          <p className="mt-1 max-w-2xl text-dim">Your table, your Sixth World. Bend the mechanics, add your own gear and write down your rulings. Everything starts at the book and shows you what you changed.</p>
        </div>
        <div className="house-inforce px-3 py-2 text-sm">
          <span className="text-xs text-faint">In force on this device</span>
          <div className="font-display font-semibold">{inForce ? inForce.name : "The book"}{h.asPlayer && inForce ? " (from your GM)" : ""}</div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="space-y-3">
          {atTable && (
            <button className={clsx("house-set w-full p-3 text-left", sel === "table" && "on")} onClick={() => setSel("table")}>
              <span className="text-xs text-cyan">At {comms.room}, from your GM</span>
              <b className="block font-display">{atTable.name}</b>
              <span className="text-xs text-dim">{plural(diffs(atTable.mech).length, "change")} · {plural(atTable.items.length, "item")}</span>
            </button>
          )}
          <div className="space-y-1.5">
            {list.map((r) => (
              <button key={r.id} className={clsx("house-set w-full p-3 text-left", current?.id === r.id && sel !== "table" && "on")} onClick={() => setSel(r.id)}>
                <span className="flex items-center justify-between gap-2">
                  <b className="truncate font-display">{r.name}</b>
                  {h.activeId === r.id && <span className="chip shrink-0 !text-[10px] text-accent">Active</span>}
                </span>
                <span className="text-xs text-dim">{plural(diffs(r.mech).length, "change")} · {plural(r.items.length, "item")} · {plural(r.notes.length, "note")}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button className="btn small primary" onClick={() => { const id = h.create(); setSel(id); setTab("mech"); }}><Icon name="plus" size={14} /> New ruleset</button>
            <button className="btn small" onClick={() => file.current?.click()}><Icon name="upload" size={14} /> Import</button>
            <input ref={file} type="file" accept=".json,application/json" className="sr-only" onChange={(e) => { void importSet(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          {msg && <p role="status" className="text-xs text-accent">{msg}</p>}
        </aside>

        {!current ? (
          <section className="panel grid place-items-center p-10 text-center">
            <div className="max-w-md space-y-3">
              <h2 className="text-2xl font-bold">No house rules yet</h2>
              <p className="text-dim">Pick a style to start from. You can change every number after.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {PRESETS.map((p) => <button key={p.id} className="house-preset p-3 text-left" onClick={() => { const id = h.create(p.id === "book" ? "My table" : p.name, p.id); h.setActive(id); setSel(id); }}><b className="font-display">{p.name}</b><span className="mt-1 block text-xs text-dim">{p.blurb}</span></button>)}
              </div>
            </div>
          </section>
        ) : (
          <section className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                {readOnly ? <h2 className="text-2xl font-bold">{current.name}</h2> : (
                  <input className="house-title w-full bg-transparent font-display text-2xl font-bold outline-none" value={current.name} onChange={(e) => h.update(current.id, (r) => { r.name = e.target.value.slice(0, 60); })} aria-label="Ruleset name" />
                )}
                {readOnly ? <p className="text-dim">{current.blurb}</p> : (
                  <input className="w-full bg-transparent text-sm text-dim outline-none" value={current.blurb} onChange={(e) => h.update(current.id, (r) => { r.blurb = e.target.value.slice(0, 400); })} placeholder="One line for your players: the feel of this table" aria-label="Description" />
                )}
              </div>
              {!readOnly && (
                <div className="flex flex-wrap gap-1.5">
                  {h.activeId === current.id ? (
                    <button className="btn small" onClick={() => h.setActive(null)} title="Play by the book on this device and at your table">Use the book instead</button>
                  ) : (
                    <button className="btn small primary" onClick={() => { h.setActive(current.id); setMsg(`${current.name} is now in force.`); }}><Icon name="check" size={14} /> Use at my table</button>
                  )}
                  <button className="btn small" onClick={() => { const id = h.create(undefined, current.id); setSel(id); }}><Icon name="copy" size={14} /> Duplicate</button>
                  <button className="btn small" onClick={() => exportSet(current)}><Icon name="download" size={14} /> Export</button>
                  <button className="btn small ghost text-danger" onClick={() => { if (confirm(`Delete ${current.name}?`)) { h.remove(current.id); setSel(null); } }}><Icon name="trash" size={14} /></button>
                </div>
              )}
            </div>
            {h.asPlayer && !readOnly && <p className="text-xs text-cyan">You are a player in {comms.room}, so your GM&apos;s rules are in force. Edits here apply when you run your own table.</p>}
            <nav className="flex gap-1 overflow-x-auto border-b border-line" role="tablist">
              {tabs.map((t) => (
                <button key={t.id} role="tab" aria-selected={tab === t.id} className={clsx("vtt-tab shrink-0 px-3 py-2 text-sm", tab === t.id && "on")} onClick={() => setTab(t.id)}>
                  {t.label}{t.n ? <span className="num ml-1.5 text-xs text-faint">{t.n}</span> : null}
                </button>
              ))}
            </nav>
            {tab === "mech" && <Mechanic rs={current} readOnly={readOnly} />}
            {tab === "items" && <Items rs={current} readOnly={readOnly} />}
            {tab === "notes" && <Notes rs={current} readOnly={readOnly} />}
            {tab === "statuses" && <Statuses rs={current} readOnly={readOnly} />}
          </section>
        )}
      </div>
    </div>
  );
}
