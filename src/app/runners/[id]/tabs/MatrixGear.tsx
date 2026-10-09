"use client";
import { useState } from "react";
import clsx from "clsx";
import { COMMLINKS, CYBERDECKS, CYBERJACKS, PROGRAMS } from "@/lib/sr6/rules6";
import { PRESETS, arrange, arrangeBy, editExt, gearValues, getExt, programSlots, xid, type MatrixGear, type Program, type SheetExt } from "@/lib/sr6/ext";
import { Num } from "./ui";
import type { SheetCtx } from "./ctx";

const SLOT_NAMES = ["Attack", "Sleaze", "Data Processing", "Firewall"];

/** Deck, commlink or cyberjack, how the four numbers are arranged, and which programs run. */
export function MatrixGearEditor({ ctx }: { ctx: SheetCtx }) {
  const { c, upd } = ctx;
  const e = getExt(c);
  const g = e.matrix;
  const set = (fn: (g: MatrixGear, ex: SheetExt) => void) => upd((x) => editExt(x, (ex) => fn(ex.matrix, ex)));
  const vals = gearValues(g);
  const src = ["Deck A", "Deck S", `${g.link?.kind === "cyberjack" ? "Cyberjack" : "Commlink"} D`, `${g.link?.kind === "cyberjack" ? "Cyberjack" : "Commlink"} F`];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between text-sm font-semibold"><span>Cyberdeck</span>{g.deck && <button className="btn ghost small" onClick={() => set((m) => { m.deck = null; m.assign = [0, 1, 2, 3]; })}>Remove</button>}</div>
          <select className="field" aria-label="Pick a cyberdeck" value="" onChange={(ev) => { const d = CYBERDECKS[Number(ev.target.value)]; if (d) set((m) => { m.deck = { name: d.name, rating: d.rating, a: d.a, s: d.s, slots: d.slots }; }); }}>
            <option value="">{g.deck ? `${g.deck.name} (change)` : "Pick a deck…"}</option>
            {CYBERDECKS.map((d, i) => <option key={d.name} value={i}>{d.name}: rating {d.rating}, {d.a}/{d.s}, {d.slots} programs</option>)}
          </select>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-sm font-semibold"><span>Commlink or cyberjack</span>{g.link && <button className="btn ghost small" onClick={() => set((m) => { m.link = null; m.assign = [0, 1, 2, 3]; })}>Remove</button>}</div>
          <select className="field" aria-label="Pick a commlink or cyberjack" value="" onChange={(ev) => {
            const [kind, i] = ev.target.value.split(":");
            if (kind === "c") { const l = COMMLINKS[Number(i)]; if (l) set((m) => { m.link = { kind: "commlink", name: l.name, rating: l.rating, d: l.d, f: l.f, slots: l.slots, dice: 0 }; }); }
            if (kind === "j") { const j = CYBERJACKS[Number(i)]; if (j) set((m) => { m.link = { kind: "cyberjack", name: `Cyberjack ${j.rating}`, rating: j.rating, d: j.d, f: j.f, slots: 0, dice: j.dice }; }); }
          }}>
            <option value="">{g.link ? `${g.link.name} (change)` : "Pick one…"}</option>
            <optgroup label="Commlinks">{COMMLINKS.map((l, i) => <option key={l.name} value={`c:${i}`}>{l.name}: rating {l.rating}, D{l.d}/F{l.f}</option>)}</optgroup>
            <optgroup label="Cyberjacks">{CYBERJACKS.map((j, i) => <option key={j.rating} value={`j:${i}`}>Cyberjack {j.rating}: D{j.d}/F{j.f}, +{j.dice} VR init dice</option>)}</optgroup>
          </select>
        </div>
      </div>

      {(g.deck || g.link) && (
        <details>
          <summary className="cursor-pointer text-xs text-dim">Edit the numbers (your gear may differ)</summary>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {g.deck && (
              <>
                <label className="col-span-3 block text-xs text-dim sm:col-span-6">Deck name<input className="field mt-1" value={g.deck.name} onChange={(ev) => set((m) => { if (m.deck) m.deck.name = ev.target.value; })} /></label>
                <Num label="Deck rating" value={g.deck.rating} min={1} max={9} onChange={(n) => set((m) => { if (m.deck) m.deck.rating = n; })} />
                <Num label="Attack" value={g.deck.a} max={15} onChange={(n) => set((m) => { if (m.deck) m.deck.a = n; })} />
                <Num label="Sleaze" value={g.deck.s} max={15} onChange={(n) => set((m) => { if (m.deck) m.deck.s = n; })} />
                <Num label="Program slots" value={g.deck.slots} max={30} onChange={(n) => set((m) => { if (m.deck) m.deck.slots = n; })} />
              </>
            )}
            {g.link && (
              <>
                <label className="col-span-3 block text-xs text-dim sm:col-span-6">Link name<input className="field mt-1" value={g.link.name} onChange={(ev) => set((m) => { if (m.link) m.link.name = ev.target.value; })} /></label>
                <Num label="Link rating" value={g.link.rating} min={1} max={9} onChange={(n) => set((m) => { if (m.link) m.link.rating = n; })} />
                <Num label="Data Proc." value={g.link.d} max={15} onChange={(n) => set((m) => { if (m.link) m.link.d = n; })} />
                <Num label="Firewall" value={g.link.f} max={15} onChange={(n) => set((m) => { if (m.link) m.link.f = n; })} />
                <Num label="Slots" value={g.link.slots} max={30} onChange={(n) => set((m) => { if (m.link) m.link.slots = n; })} />
                <Num label="VR init dice" value={g.link.dice} max={3} onChange={(n) => set((m) => { if (m.link) m.link.dice = n; })} />
              </>
            )}
          </div>
        </details>
      )}

      {(g.deck || g.link) && (
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm font-semibold">Arrange attributes</span>
            <span className="text-xs text-dim">Any number can go to any attribute. Free action: Reconfigure.</span>
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => <button key={p.name} className="chip cursor-pointer" title={p.blurb} onClick={() => set((m) => { m.assign = arrangeBy(gearValues(m), p.order); })}>{p.name}</button>)}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SLOT_NAMES.map((name, slot) => (
              <label key={name} className="block text-xs text-dim">{name}
                <select className="field num mt-1" value={g.assign[slot]} onChange={(ev) => set((m) => { m.assign = arrange(m.assign, slot, Number(ev.target.value)); })}>
                  {vals.map((v, i) => <option key={i} value={i}>{src[i]} · {v}</option>)}
                </select>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-faint">Once you have access to a place you hacked, you cannot swap Attack and Sleaze until you leave. Data Processing and Firewall can still change.</p>
        </div>
      )}

      <Programs ctx={ctx} />
    </div>
  );
}

function Programs({ ctx }: { ctx: SheetCtx }) {
  const e = getExt(ctx.c);
  const g = e.matrix;
  const { cap, used } = programSlots(g);
  const [custom, setCustom] = useState("");
  const set = (fn: (g: MatrixGear) => void) => ctx.upd((x) => editExt(x, (ex) => fn(ex.matrix)));
  const have = new Set(g.programs.map((p) => p.defId));
  const add = (p: Program) => set((m) => { m.programs.push(p); });
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-semibold">Programs</span>
        <span className={clsx("num text-xs", used > cap ? "text-danger" : "text-dim")}>{used} / {cap} running</span>
      </div>
      <ul className="divide-y divide-line text-sm">
        {g.programs.map((p) => {
          const def = PROGRAMS.find((d) => d.id === p.defId);
          const full = !p.active && used >= cap && p.defId !== "vm";
          return (
            <li key={p.id} className="flex items-center gap-2 py-1.5">
              <button className={clsx("btn small shrink-0", p.active && "primary")} aria-pressed={p.active} disabled={full} title={full ? "No free program slot" : undefined} onClick={() => set((m) => { const t = m.programs.find((q) => q.id === p.id); if (t) t.active = !t.active; })}>{p.active ? "Running" : "Stored"}</button>
              <div className="min-w-0 flex-1">
                <b className="font-display">{p.name}</b>
                <div className="text-xs text-faint">{def?.note ?? p.note}</div>
              </div>
              <button className="btn ghost small" aria-label={`Remove ${p.name}`} onClick={() => set((m) => { m.programs = m.programs.filter((q) => q.id !== p.id); })}>×</button>
            </li>
          );
        })}
        {g.programs.length === 0 && <li className="py-1.5 text-dim">No programs. Add some below; running ones are limited by your slots.</li>}
      </ul>
      <div className="no-print mt-2 flex flex-wrap gap-2">
        <select className="field !w-auto min-w-48 flex-1" aria-label="Add a program" value="" onChange={(ev) => { const d = PROGRAMS.find((q) => q.id === ev.target.value); if (d) add({ id: xid("p"), defId: d.id, name: d.name, note: d.note, active: false }); }}>
          <option value="">Add a program…</option>
          {(["Basic", "Hacking"] as const).map((grp) => (
            <optgroup key={grp} label={grp}>{PROGRAMS.filter((d) => d.group === grp && !have.has(d.id)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</optgroup>
          ))}
        </select>
        <form className="flex flex-1 gap-2" onSubmit={(ev) => { ev.preventDefault(); const n = custom.trim(); if (!n) return; add({ id: xid("p"), defId: "custom", name: n, note: "", active: false }); setCustom(""); }}>
          <input className="field flex-1" value={custom} onChange={(ev) => setCustom(ev.target.value)} placeholder="Or your own" aria-label="Custom program name" />
          <button className="btn small" disabled={!custom.trim()}>Add</button>
        </form>
      </div>
      <p className="mt-1 text-xs text-faint">Toolbox, Armor, Signal Scrubber, Virtual Machine and Overclock change your numbers automatically while running. Using a hacking program on an action adds 1 to your Overwatch Score.</p>
    </div>
  );
}
