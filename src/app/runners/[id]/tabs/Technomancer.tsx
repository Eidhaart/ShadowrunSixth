"use client";
import { useState } from "react";
import clsx from "clsx";
import { COMPLEX_FORMS, SPRITES } from "@/lib/sr6/rules6";
import { PRESETS, autoTmBonus, editExt, getExt, nextPendingId, rollHits, spriteBlock, spriteType, tmCap, xid, type MatrixStats } from "@/lib/sr6/ext";
import { Box, Stepper } from "./ui";
import { basePool, type SheetCtx } from "./ctx";
import { ResistPrompt, type Pending } from "./Resist";

const PERSONA = ["Attack (Charisma)", "Sleaze (Intuition)", "Data Processing (Logic)", "Firewall (Willpower)"];
const formDef = (name: string) => COMPLEX_FORMS.find((f) => f.name.toLowerCase() === name.trim().toLowerCase());

export function PersonaBonus({ ctx, m }: { ctx: SheetCtx; m: MatrixStats }) {
  const { d, upd } = ctx;
  const e = getExt(ctx.c);
  if (!m.tm) return null;
  const left = d.resonance - m.tm.spent;
  const setBonus = (i: number, n: number) => upd((x) => editExt(x, (ex) => { ex.tmBonus[i] = n; }));
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-semibold">Living persona</span>
        <span className={clsx("num text-xs", left < 0 ? "text-danger" : "text-dim")}>{left} of {d.resonance} Resonance points left</span>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => <button key={p.name} className="chip cursor-pointer" title={p.blurb} onClick={() => upd((x) => editExt(x, (ex) => { ex.tmBonus = autoTmBonus(m.tm!.base, d.resonance, p.order); }))}>{p.name}</button>)}
      </div>
      <ul className="space-y-1.5">
        {PERSONA.map((name, i) => {
          const base = m.tm!.base[i];
          const cap = tmCap(base);
          const bonus = m.tm!.bonus[i];
          return (
            <li key={name} className="flex items-center gap-2 text-sm">
              <span className="flex-1">{name} <span className="num text-xs text-dim">{base} base</span></span>
              <Stepper label={name} value={Math.min(e.tmBonus[i] ?? 0, cap)} min={0} max={cap} onChange={(n) => setBonus(i, n)} />
              <b className="num w-8 text-right">{base + bonus}</b>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 text-xs text-faint">Mental attributes plus Resonance points. One attribute gains at most half its base, up to 4. Moving points is a Reconfigure action.</p>
    </div>
  );
}

export function Technomancer({ ctx }: { ctx: SheetCtx }) {
  const { c, d, upd } = ctx;
  const e = getExt(c);
  const [pending, setPending] = useState<Pending | null>(null);
  const [type, setType] = useState("courier");
  const [level, setLevel] = useState(Math.max(1, d.resonance));
  const [compiled, setCompiled] = useState<{ id: number; type: string; level: number; mine: number; theirs: number } | null>(null);
  const fadeBase = d.attrs.willpower + d.attrs.logic;
  const tasking = basePool(c, d, "tasking", "resonance");

  const thread = (name: string) => {
    const f = formDef(name);
    const b = basePool(c, d, f?.skill ?? "electronics", "resonance");
    const r = ctx.rollPool(`${name} (${f?.pool ?? "Electronics + Resonance"})`, b.base);
    const fade = f ? f.fade : (e.dv[name.toLowerCase()] ?? 3);
    setPending({ id: nextPendingId(), title: `Fading from ${name}`, dv: fade, type: "auto", physicalAbove: d.resonance, poolLabel: "Willpower + Logic", base: fadeBase, note: `Threaded with ${r.totalHits} hit${r.totalHits === 1 ? "" : "s"}${f?.against ? `, against ${f.against}` : ""}` });
  };
  const toggleSustain = (name: string) => upd((x) => editExt(x, (ex) => { ex.sustained = ex.sustained.includes(name) ? ex.sustained.filter((s) => s !== name) : [...ex.sustained, name]; }));

  const compile = () => {
    const r = ctx.rollPool(`Compile ${spriteType(type)?.name ?? type} sprite, level ${level} (Tasking + Resonance)`, tasking.base);
    const theirs = rollHits(level * 2);
    setCompiled({ id: nextPendingId(), type, level, mine: r.totalHits, theirs });
    setPending(null);
  };
  const keepSprite = () => {
    if (!compiled) return;
    const net = compiled.mine - compiled.theirs;
    upd((x) => editExt(x, (ex) => { ex.sprites.push({ id: xid("s"), type: compiled.type, level: compiled.level, tasks: Math.max(1, net), registered: false, damage: 0, note: "" }); }));
    setPending({ id: nextPendingId(), title: "Fading from compiling", dv: compiled.theirs, type: "auto", physicalAbove: d.resonance, poolLabel: "Willpower + Charisma", base: d.attrs.willpower + d.attrs.charisma, note: "The sprite's hits on its defense test are the fading." });
    setCompiled(null);
  };
  const register = (id: string) => {
    const s = e.sprites.find((q) => q.id === id);
    if (!s) return;
    const r = ctx.rollPool(`Register ${s.type} sprite, level ${s.level} (Tasking + Resonance)`, tasking.base);
    const theirs = rollHits(s.level * 2);
    const net = r.totalHits - theirs;
    if (net >= 1) upd((x) => editExt(x, (ex) => { const t = ex.sprites.find((q) => q.id === id); if (t) { t.registered = true; t.tasks += net; } }));
    setPending({ id: nextPendingId(), title: `Fading from registering (${net >= 1 ? "registered" : "failed"})`, dv: Math.max(2, theirs * 2), type: "auto", physicalAbove: d.resonance, poolLabel: "Willpower + Charisma", base: d.attrs.willpower + d.attrs.charisma, note: `You ${r.totalHits}, sprite ${theirs}. 2 per sprite hit, at least 2.` });
  };
  const setSprite = (id: string, fn: (t: (typeof e.sprites)[number]) => void) => upd((x) => editExt(x, (ex) => { const t = ex.sprites.find((q) => q.id === id); if (t) fn(t); }));
  const registered = e.sprites.filter((s) => s.registered).length;

  return (
    <>
      <Box title="Complex forms" right={<span className="num text-xs text-dim">{c.complexForms.length} / {d.slots.complexForms}</span>}>
        {pending && <div className="mb-3"><ResistPrompt key={pending.id} ctx={ctx} p={pending} onClose={() => setPending(null)} /></div>}
        <ul className="divide-y divide-line">
          {c.complexForms.map((name) => {
            const f = formDef(name);
            const on = e.sustained.includes(name);
            const b = basePool(c, d, f?.skill ?? "electronics", "resonance");
            return (
              <li key={name} className="py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-display font-semibold">{name}</span>
                    <span className="num ml-2 text-xs text-dim">{f ? `fade ${f.fade} · ${f.dur === "S" ? "sustained" : f.dur === "P" ? "permanent" : "instant"}` : "custom"}</span>
                  </div>
                  {!f && <input className="field num !min-h-0 !w-16 !py-0.5 text-xs" type="number" min={0} value={e.dv[name.toLowerCase()] ?? 3} aria-label={`${name} fading value`} onChange={(ev) => upd((x) => editExt(x, (ex) => { ex.dv[name.toLowerCase()] = Math.max(0, Math.floor(Number(ev.target.value) || 0)); }))} />}
                  <div className="no-print flex gap-1.5">
                    <button className="btn small primary" disabled={b.blocked} onClick={() => thread(name)}>Thread {ctx.poolOf(b.base)}</button>
                    {(!f || f.dur === "S") && <button className={clsx("btn small", on && "primary")} aria-pressed={on} title="Sustaining costs 2 dice on every test" onClick={() => toggleSustain(name)}>{on ? "Sustained" : "Sustain"}</button>}
                  </div>
                </div>
                {f && <p className="mt-0.5 text-xs text-faint">{f.note}{f.against ? ` Against ${f.against}.` : ""}</p>}
              </li>
            );
          })}
          {c.complexForms.length === 0 && <li className="py-1.5 text-sm text-dim">No complex forms yet. Pick them in the Forge.</li>}
        </ul>
        <p className="mt-2 text-xs text-faint">Fading is resisted with Willpower + Logic, and turns Physical when what gets through is higher than your Resonance. Each sustained form costs 2 dice on everything you do.</p>
      </Box>

      <Box title="Sprites" right={<span className="num text-xs text-dim">{registered} / {d.resonance} registered</span>}>
        <div className="no-print mb-3 flex flex-wrap items-center gap-2">
          <select className="field !w-32" aria-label="Sprite type" value={type} onChange={(ev) => setType(ev.target.value)}>{SPRITES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <Stepper label="Sprite level" value={level} min={1} max={12} onChange={setLevel} />
          <button className="btn small primary" disabled={tasking.blocked} onClick={compile}>Compile {ctx.poolOf(tasking.base)}</button>
        </div>
        {compiled && (
          <div className="mb-3 border border-accent/50 bg-accent/5 p-3 text-sm" role="status">
            You rolled <b className="num">{compiled.mine}</b>, the sprite <b className="num">{compiled.theirs}</b> on {compiled.level * 2} dice.{" "}
            {compiled.mine > compiled.theirs ? <>It answers your call with <b>{compiled.mine - compiled.theirs}</b> task{compiled.mine - compiled.theirs === 1 ? "" : "s"}.</> : <>Nothing comes.</>}
            <span className="ml-2 inline-flex gap-1.5">
              {compiled.mine > compiled.theirs && <button className="btn small primary" onClick={keepSprite}>Keep sprite, resist fading</button>}
              {compiled.mine <= compiled.theirs && <button className="btn small" onClick={() => { setPending({ id: nextPendingId(), title: "Fading from compiling", dv: compiled.theirs, type: "auto", physicalAbove: d.resonance, poolLabel: "Willpower + Charisma", base: d.attrs.willpower + d.attrs.charisma }); setCompiled(null); }}>Resist fading</button>}
              <button className="btn ghost small" onClick={() => setCompiled(null)}>Dismiss</button>
            </span>
          </div>
        )}
        <ul className="divide-y divide-line text-sm">
          {e.sprites.map((s) => {
            const t = spriteType(s.type);
            const b = t ? spriteBlock(t, s.level) : null;
            return (
              <li key={s.id} className="py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="font-display">{t?.name ?? s.type} sprite</b>
                  <span className="text-xs text-dim">level</span><Stepper label={`${s.type} level`} value={s.level} min={1} max={12} onChange={(n) => setSprite(s.id, (q) => { q.level = n; })} />
                  <span className="text-xs text-dim">tasks</span><Stepper label={`${s.type} tasks`} value={s.tasks} min={0} max={24} onChange={(n) => setSprite(s.id, (q) => { q.tasks = n; })} />
                  <div className="no-print ml-auto flex gap-1.5">
                    {s.registered ? <span className="chip">registered</span> : <button className="btn small" disabled={tasking.blocked} onClick={() => register(s.id)}>Register</button>}
                    <button className="btn ghost small" aria-label="Release sprite" onClick={() => upd((x) => editExt(x, (ex) => { ex.sprites = ex.sprites.filter((q) => q.id !== s.id); }))}>×</button>
                  </div>
                </div>
                {b && t && (
                  <p className="num mt-1 text-xs text-dim">
                    A {b.attack} · S {b.sleaze} · D {b.dp} · F {b.fw} · Init {b.init}+{b.initDice}D6 · Monitor {b.boxes} · AR {b.attackRating} · DR {b.defenseRating}
                    <span className="text-faint"> · {t.powers}</span>
                  </p>
                )}
              </li>
            );
          })}
          {e.sprites.length === 0 && <li className="py-1.5 text-dim">No sprites.</li>}
        </ul>
        <p className="mt-2 text-xs text-faint">Compiling is Tasking + Resonance against Level × 2. Net hits are tasks. You resist the sprite&apos;s hits as fading with Willpower + Charisma. Registering keeps a sprite without a time limit.</p>
      </Box>
    </>
  );
}
