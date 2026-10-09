"use client";
import { useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { doInitiative } from "@/lib/actions";
import { SKILLS, SKILL_BY_ID, ATTR_LABEL } from "@/lib/sr6/data";
import {
  MATRIX_ACTIONS, MATRIX_SLOTS, nextPendingId, SLOT_ABBR, SLOT_LABEL, arrange, editExt, evalFormula, getExt, matrixStats, newDeck, xid,
  type CustomAction, type Deck, type MatrixSlot, type SimMode,
} from "@/lib/sr6/ext";
import { Box, Boxes, Empty, Num, Stat, Stepper } from "./ui";
import { basePool, type SheetCtx } from "./ctx";
import { ResistPrompt, type Pending } from "./Resist";

const MODES: { id: SimMode; label: string; blurb: string }[] = [
  { id: "ar", label: "AR", blurb: "Augmented reality: you act at normal initiative." },
  { id: "cold", label: "Cold-sim", blurb: "VR with safeties. Matrix initiative 2D6, biofeedback is Stun." },
  { id: "hot", label: "Hot-sim", blurb: "VR without safeties. Matrix initiative 3D6, biofeedback is Physical." },
];
// Which array entry each slot gets, best first, for a quick re-arrange.
const ARRANGEMENTS: { name: string; blurb: string; assign: Deck["assign"] }[] = [
  { name: "Attacker", blurb: "Attack > Sleaze > Data Processing > Firewall", assign: [0, 1, 2, 3] },
  { name: "Infiltrator", blurb: "Sleaze > Attack > Firewall > Data Processing", assign: [1, 0, 3, 2] },
  { name: "Analyst", blurb: "Data Processing > Sleaze > Firewall > Attack", assign: [3, 1, 0, 2] },
  { name: "Defender", blurb: "Firewall > Data Processing > Sleaze > Attack", assign: [3, 2, 1, 0] },
];
const ATTR_OPTS = ["logic", "intuition", "willpower", "charisma", "agility", "reaction", "resonance"];

function DeckEditor({ ctx }: { ctx: SheetCtx }) {
  const { c, upd } = ctx;
  const e = getExt(c);
  const deck = e.deck;
  const setDeck = (fn: (d: Deck) => Deck) => upd((x) => editExt(x, (ex) => { if (ex.deck) ex.deck = fn(ex.deck); }));
  if (!deck)
    return (
      <div>
        <Empty>No deck yet. Pick a starting rating, then rename it and edit the numbers to match your gear.</Empty>
        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6].map((r) => (
            <button key={r} className="btn small" onClick={() => upd((x) => editExt(x, (ex) => { ex.deck = newDeck(r); }))}>Rating {r}</button>
          ))}
        </div>
        <p className="mt-2 text-xs text-faint">These are templates: the four array numbers are the deck&apos;s own and fully editable.</p>
      </div>
    );
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block text-xs text-dim">Deck name
          <input className="field mt-1" value={deck.name} onChange={(ev) => setDeck((d) => ({ ...d, name: ev.target.value }))} />
        </label>
        <Num label="Device rating" value={deck.rating} min={1} max={9} onChange={(n) => setDeck((d) => ({ ...d, rating: n }))} className="w-28" />
      </div>
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-sm font-semibold">Arrange the array</span>
          <span className="text-xs text-dim">Swap the numbers between slots; each is used once</span>
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {ARRANGEMENTS.map((a) => (
            <button key={a.name} className="chip cursor-pointer" title={a.blurb} onClick={() => setDeck((d) => ({ ...d, assign: [...a.assign] as Deck["assign"] }))}>{a.name}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MATRIX_SLOTS.map((slot, i) => (
            <label key={slot} className="block text-xs text-dim">{SLOT_LABEL[slot]}
              <select className="field num mt-1" value={deck.assign[i]} onChange={(ev) => setDeck((d) => arrange(d, i, Number(ev.target.value)))}>
                {deck.array.map((v, idx) => <option key={idx} value={idx}>{v}</option>)}
              </select>
            </label>
          ))}
        </div>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-dim">Edit the deck&apos;s four numbers</summary>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {deck.array.map((v, i) => (
              <Num key={i} label={`Number ${i + 1}`} value={v} min={0} max={15} onChange={(n) => setDeck((d) => { const a = [...d.array] as Deck["array"]; a[i] = n; return { ...d, array: a }; })} />
            ))}
          </div>
        </details>
      </div>
      <Programs ctx={ctx} deck={deck} setDeck={setDeck} />
      <button className="btn ghost small danger" onClick={() => upd((x) => editExt(x, (ex) => { ex.deck = null; }))}>Remove deck</button>
    </div>
  );
}

function Programs({ ctx, deck, setDeck }: { ctx: SheetCtx; deck: Deck; setDeck: (fn: (d: Deck) => Deck) => void }) {
  void ctx;
  const [name, setName] = useState("");
  const add = () => {
    if (!name.trim()) return;
    setDeck((d) => ({ ...d, programs: [...d.programs, { id: xid("p"), name: name.trim(), note: "" }] }));
    setName("");
  };
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-semibold">Programs</span>
        <span className="num text-xs text-dim">{deck.programs.length} loaded · deck rating {deck.rating}</span>
      </div>
      <ul className="divide-y divide-line text-sm">
        {deck.programs.map((p) => (
          <li key={p.id} className="flex items-center gap-2 py-1.5">
            <b className="font-display">{p.name}</b>
            <input className="field !min-h-0 flex-1 !py-0.5 text-xs" value={p.note} placeholder="What it does" aria-label={`${p.name} note`} onChange={(ev) => setDeck((d) => ({ ...d, programs: d.programs.map((q) => (q.id === p.id ? { ...q, note: ev.target.value } : q)) }))} />
            <button className="btn ghost small" aria-label={`Remove ${p.name}`} onClick={() => setDeck((d) => ({ ...d, programs: d.programs.filter((q) => q.id !== p.id) }))}>×</button>
          </li>
        ))}
      </ul>
      <form className="mt-2 flex gap-2" onSubmit={(ev) => { ev.preventDefault(); add(); }}>
        <input className="field flex-1" value={name} onChange={(ev) => setName(ev.target.value)} placeholder="Add a program" aria-label="Program name" />
        <button className="btn small" disabled={!name.trim()}>Add</button>
      </form>
    </div>
  );
}

function ActionRow({ ctx, a, stats }: { ctx: SheetCtx; a: { id: string; name: string; skill: string; attr: string; limit: MatrixSlot | "none"; against?: string; note?: string; illegal?: boolean }; stats: ReturnType<typeof matrixStats>; }) {
  const { c, d } = ctx;
  const b = basePool(c, d, a.skill, a.attr);
  const limit = a.limit === "none" ? undefined : stats[a.limit];
  const pool = ctx.poolOf(b.base);
  const dead = stats.source === "none" || b.blocked;
  return (
    <li className="py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display font-semibold">{a.name}{a.illegal && <span className="ml-1.5 align-middle text-xs font-normal text-danger" title="Illegal action: raises your Overwatch Score if noticed">illegal</span>}</div>
          <div className="num text-xs text-dim">{b.parts}{limit !== undefined && a.limit !== "none" ? ` [${SLOT_LABEL[a.limit]} ${limit}]` : ""}</div>
          {a.against && <div className="text-xs text-faint">Against {a.against}</div>}
          {b.blocked && <div className="text-xs text-danger">Needs the {SKILL_BY_ID[a.skill]?.name} skill.</div>}
        </div>
        <button className="no-print btn small primary shrink-0" disabled={dead} onClick={() => ctx.rollPool(`${a.name}${limit !== undefined && a.limit !== "none" ? ` [${SLOT_ABBR[a.limit]} ${limit}]` : ""}`, b.base, { limit })}>
          <Icon name="dice" size={14} /> {pool}
        </button>
      </div>
      {a.note && <p className="mt-0.5 text-xs text-faint">{a.note}</p>}
    </li>
  );
}

function CustomActionForm({ ctx }: { ctx: SheetCtx }) {
  const [f, setF] = useState<CustomAction>({ id: "", name: "", skill: "cracking", attr: "logic", limit: "attack" });
  return (
    <details className="no-print mt-3">
      <summary className="cursor-pointer text-sm text-dim">Add your own action</summary>
      <form
        className="mt-2 grid gap-2 sm:grid-cols-2"
        onSubmit={(ev) => { ev.preventDefault(); if (!f.name.trim()) return; ctx.upd((x) => editExt(x, (e) => { e.customActions.push({ ...f, id: xid("a"), name: f.name.trim() }); })); setF({ ...f, name: "" }); }}
      >
        <label className="block text-xs text-dim sm:col-span-2">Name<input className="field mt-1" value={f.name} onChange={(ev) => setF({ ...f, name: ev.target.value })} placeholder="Probe the Host" /></label>
        <label className="block text-xs text-dim">Skill
          <select className="field mt-1" value={f.skill} onChange={(ev) => setF({ ...f, skill: ev.target.value })}>
            <option value="">None, attribute only</option>
            {SKILLS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="block text-xs text-dim">Attribute
          <select className="field mt-1" value={f.attr} onChange={(ev) => setF({ ...f, attr: ev.target.value })}>{ATTR_OPTS.map((a) => <option key={a} value={a}>{(ATTR_LABEL as Record<string, string>)[a]}</option>)}</select>
        </label>
        <label className="block text-xs text-dim">Limit
          <select className="field mt-1" value={f.limit} onChange={(ev) => setF({ ...f, limit: ev.target.value as CustomAction["limit"] })}>
            {MATRIX_SLOTS.map((s) => <option key={s} value={s}>{SLOT_LABEL[s]}</option>)}<option value="none">No limit</option>
          </select>
        </label>
        <div className="flex items-end"><button className="btn small" disabled={!f.name.trim()}>Add action</button></div>
      </form>
    </details>
  );
}

function Technomancer({ ctx }: { ctx: SheetCtx }) {
  const { c, d, upd } = ctx;
  const e = getExt(c);
  const [level, setLevel] = useState(Math.max(1, d.resonance));
  const [pending, setPending] = useState<Pending | null>(null);
  const [sprite, setSprite] = useState({ type: "Courier", rating: Math.max(1, d.resonance) });
  const thread = basePool(c, d, "electronics", "resonance");
  const compile = basePool(c, d, "tasking", "resonance");
  return (
    <>
      <Box title="Complex forms" right={<span className="num text-xs text-dim">{c.complexForms.length} / {d.slots.complexForms}</span>}>
        <div className="no-print mb-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-dim">Level<div className="mt-1"><Stepper label="Level" value={level} min={1} max={Math.max(1, d.resonance)} onChange={setLevel} /></div></label>
          <label className="text-xs text-dim">Resist fading with Willpower +
            <select className="field mt-1 !w-36" value={e.fadeAttr} onChange={(ev) => upd((x) => editExt(x, (ex) => { ex.fadeAttr = ev.target.value; }))}>
              {["resonance", "logic", "intuition", "charisma", "willpower"].map((a) => <option key={a} value={a}>{(ATTR_LABEL as Record<string, string>)[a]}</option>)}
            </select>
          </label>
        </div>
        {pending && <div className="mb-3"><ResistPrompt ctx={ctx} p={pending} onClose={() => setPending(null)} /></div>}
        <ul className="divide-y divide-line">
          {c.complexForms.map((f) => {
            const formula = e.formulas[f] ?? "";
            return (
              <li key={f} className="flex flex-wrap items-center gap-2 py-1.5">
                <span className="font-display flex-1">{f}</span>
                <input className="field num !min-h-0 !w-20 !py-0.5 text-xs" value={formula} placeholder="Fade F/2" aria-label={`${f} fading formula`} onChange={(ev) => upd((x) => editExt(x, (ex) => { ex.formulas[f] = ev.target.value; }))} />
                <button className="no-print btn small" disabled={thread.blocked} onClick={() => {
                  ctx.rollPool(`Thread ${f} (level ${level})`, thread.base, { limit: level });
                  setPending({ id: nextPendingId(), kind: "Fading", label: f, dv: evalFormula(formula, level), physical: level > d.resonance, attr: e.fadeAttr });
                }}>Thread {ctx.poolOf(thread.base)}</button>
              </li>
            );
          })}
          {c.complexForms.length === 0 && <li className="py-1.5 text-sm text-dim">No complex forms yet.</li>}
        </ul>
        <p className="mt-2 text-xs text-faint">Threading is Electronics + Resonance, limited by the level. Save a fading formula such as F/2 or F−1 on each form and the sheet works out the fading and rolls the resistance.</p>
      </Box>
      <Box title="Sprites" right={<span className="num text-xs text-dim">{e.sprites.length} registered</span>}>
        <div className="no-print mb-3 flex flex-wrap items-end gap-2">
          <button className="btn small" disabled={compile.blocked} onClick={() => ctx.rollPool(`Compile sprite (level ${sprite.rating})`, compile.base, { limit: sprite.rating })}>Compile {ctx.poolOf(compile.base)}</button>
          <span className="text-xs text-dim">Tasking + Resonance</span>
        </div>
        <ul className="divide-y divide-line text-sm">
          {e.sprites.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 py-1.5">
              <b className="font-display">{s.type} sprite</b>
              <span className="text-xs text-dim">level</span><Stepper label={`${s.type} level`} value={s.rating} min={1} max={12} onChange={(n) => upd((x) => editExt(x, (ex) => { const t = ex.sprites.find((q) => q.id === s.id); if (t) t.rating = n; }))} />
              <span className="text-xs text-dim">tasks</span><Stepper label={`${s.type} tasks`} value={s.tasks} min={0} max={12} onChange={(n) => upd((x) => editExt(x, (ex) => { const t = ex.sprites.find((q) => q.id === s.id); if (t) t.tasks = n; }))} />
              <button className="btn ghost small ml-auto" aria-label="Release sprite" onClick={() => upd((x) => editExt(x, (ex) => { ex.sprites = ex.sprites.filter((q) => q.id !== s.id); }))}>×</button>
            </li>
          ))}
          {e.sprites.length === 0 && <li className="py-1.5 text-dim">No sprites registered.</li>}
        </ul>
        <form className="no-print mt-2 flex flex-wrap items-center gap-2" onSubmit={(ev) => { ev.preventDefault(); upd((x) => editExt(x, (ex) => { ex.sprites.push({ id: xid("s"), type: sprite.type, rating: sprite.rating, tasks: sprite.rating, note: "" }); })); }}>
          <select className="field !w-32" aria-label="Sprite type" value={sprite.type} onChange={(ev) => setSprite({ ...sprite, type: ev.target.value })}>{["Courier", "Crack", "Data", "Fault", "Machine", "Other"].map((t) => <option key={t}>{t}</option>)}</select>
          <Stepper label="New sprite level" value={sprite.rating} min={1} max={12} onChange={(n) => setSprite({ ...sprite, rating: n })} />
          <button className="btn small">Register</button>
        </form>
      </Box>
    </>
  );
}

export function MatrixTab({ ctx }: { ctx: SheetCtx }) {
  const { c, d, upd, who } = ctx;
  const e = getExt(c);
  const m = matrixStats(c, d);
  const technomancer = c.magicType === "technomancer";
  const mode = MODES.find((x) => x.id === e.mode) ?? MODES[0];
  const groups = ["Attack", "Sleaze", "Data", "Defense"] as const;
  const custom = e.customActions;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="space-y-4">
        <Box title={technomancer ? "Living persona" : "Cyberdeck"} right={<span className="text-xs text-dim">{m.name}</span>}>
          {technomancer ? (
            <Empty>Your persona is built from you: Charisma is Attack, Intuition is Sleaze, Logic is Data Processing and Willpower is Firewall. Device rating is your Resonance.</Empty>
          ) : (
            <DeckEditor ctx={ctx} />
          )}
        </Box>
        {m.source !== "none" && (
          <Box title="In the Matrix">
            <div className="grid grid-cols-4 gap-2">
              {MATRIX_SLOTS.map((s) => <Stat key={s} label={SLOT_LABEL[s]} value={m[s]} tone={s === "attack" ? "danger" : s === "fw" ? "cyan" : "accent"} />)}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Stat label="Attack rating" value={m.attackRating} sub="Attack + Sleaze" />
              <Stat label="Defense rating" value={m.defenseRating} sub="Data Proc. + Firewall" />
              <Stat label="Device rating" value={m.rating} />
            </div>
            <div className="no-print mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Interface mode">
              {MODES.map((x) => <button key={x.id} className={clsx("btn small", e.mode === x.id && "primary")} aria-pressed={e.mode === x.id} onClick={() => upd((y) => editExt(y, (ex) => { ex.mode = x.id; }))}>{x.label}</button>)}
              <span className="ml-1 text-xs text-dim">{mode.blurb}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="no-print btn small primary" onClick={() => doInitiative(`${who} Matrix initiative`, m.init.rank, m.init.dice, 0, who)}>Roll Matrix initiative</button>
              <span className="num text-sm text-dim">{m.init.rank} + {m.init.dice}D6</span>
            </div>
            <div className="mt-4 space-y-3">
              <Boxes label="Matrix condition" boxes={m.condition} filled={Math.min(e.matrixDamage, m.condition)} tone="cyan" onSet={(n) => upd((x) => editExt(x, (ex) => { ex.matrixDamage = n; }))} />
              {e.matrixDamage >= m.condition && <p className="text-sm text-danger">Matrix condition full: you are dumped from the Matrix and take biofeedback ({e.mode === "hot" ? "Physical" : "Stun"}).</p>}
              <div>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="font-display font-semibold">Overwatch score</span>
                  <span className={clsx("num", e.overwatch >= 30 ? "text-danger" : "text-dim")}>{e.overwatch} / 40</span>
                </div>
                <div className="h-2 bg-line" role="progressbar" aria-valuenow={e.overwatch} aria-valuemin={0} aria-valuemax={40} aria-label="Overwatch score"><div className={clsx("h-full", e.overwatch >= 30 ? "bg-danger" : "bg-accent")} style={{ width: `${Math.min(100, (e.overwatch / 40) * 100)}%` }} /></div>
                <div className="no-print mt-2 flex flex-wrap gap-1.5">
                  {[1, 2, 5].map((n) => <button key={n} className="btn small" onClick={() => upd((x) => editExt(x, (ex) => { ex.overwatch = Math.min(40, ex.overwatch + n); }))}>+{n}</button>)}
                  <button className="btn small ghost" onClick={() => upd((x) => editExt(x, (ex) => { ex.overwatch = Math.max(0, ex.overwatch - 1); }))}>−1</button>
                  <button className="btn small ghost" onClick={() => upd((x) => editExt(x, (ex) => { ex.overwatch = 0; }))}>Reset</button>
                </div>
                <p className="mt-1 text-xs text-faint">Illegal actions you are noticed doing raise it. At 40 the GOD converges on you.</p>
              </div>
            </div>
          </Box>
        )}
      </div>

      <div className="space-y-4">
        {technomancer && <Technomancer ctx={ctx} />}
        <Box title="Matrix actions" right={<span className="text-xs text-dim">pool after wounds and sustaining</span>}>
          {m.source === "none" && <p className="mb-2 text-sm text-dim">Add a deck to roll Matrix actions; without one the limits are zero.</p>}
          {groups.map((g) => (
            <div key={g} className="mb-3 last:mb-0">
              <h3 className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-faint">{g}</h3>
              <ul className="divide-y divide-line">
                {MATRIX_ACTIONS.filter((a) => a.group === g).map((a) => <ActionRow key={a.id} ctx={ctx} a={a} stats={m} />)}
              </ul>
            </div>
          ))}
          {custom.length > 0 && (
            <div className="mb-3">
              <h3 className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-faint">Your actions</h3>
              <ul className="divide-y divide-line">
                {custom.map((a) => (
                  <div key={a.id} className="flex items-center gap-1">
                    <div className="flex-1"><ActionRow ctx={ctx} a={a} stats={m} /></div>
                    <button className="btn ghost small" aria-label={`Remove ${a.name}`} onClick={() => upd((x) => editExt(x, (ex) => { ex.customActions = ex.customActions.filter((q) => q.id !== a.id); }))}>×</button>
                  </div>
                ))}
              </ul>
            </div>
          )}
          <CustomActionForm ctx={ctx} />
          <p className="mt-3 text-xs text-faint">Hits above the limit are lost. The &quot;against&quot; pools are the usual defense; check your book for special cases.</p>
        </Box>
      </div>
    </div>
  );
}
