"use client";
import { useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { doInitiative } from "@/lib/actions";
import { SKILLS, SKILL_BY_ID, ATTR_LABEL, type AttrKey } from "@/lib/sr6/data";
import { MATRIX_ACTIONS, MATRIX_FREE_ACTIONS } from "@/lib/sr6/rules6";
import {
  DUMPSHOCK_DV, SLOT_LABEL, MATRIX_SLOTS, actionAdjust, biofeedbackType, editExt, getExt, matrixStats, nextPendingId, overwatchGain, xid,
  type CustomAction, type SimMode,
} from "@/lib/sr6/ext";
import { Box, Boxes, Empty, Num, Stat, Stepper } from "./ui";
import { basePool, type SheetCtx } from "./ctx";
import { ResistPrompt, type Pending } from "./Resist";
import { MatrixGearEditor } from "./MatrixGear";
import { PersonaBonus, Technomancer } from "./Technomancer";

const MODES: { id: SimMode; label: string; blurb: string }[] = [
  { id: "ar", label: "AR", blurb: "Normal initiative. No biofeedback or dumpshock." },
  { id: "cold", label: "Cold-sim", blurb: "VR with safeties: +1D6 initiative, Stun biofeedback." },
  { id: "hot", label: "Hot-sim", blurb: "VR without safeties: +2D6 initiative, Physical biofeedback." },
];
const ATTR_OPTS = ["logic", "intuition", "willpower", "charisma", "agility", "reaction", "resonance"];
const NOISE_PRESETS: [string, number][] = [["Local", 0], ["≤1 km", 1], ["≤10 km", 3], ["≤100 km", 5], ["Farther", 8]];

interface OsPrompt { id: number; label: string; hits: number; program: boolean }

const PROGRAM_HACKING = new Set(["armor", "biofeedback", "bffilter", "blackout", "decryption", "defuse", "exploit", "fork", "lockdown", "overclock", "stealth", "trace"]);

type RowAction = { id: string; name: string; skill: string; attr: string; legal: boolean; linked?: "attack" | "sleaze"; against?: string; note?: string };

function ActionRow({ ctx, a, m, dead, onRoll, removable }: { ctx: SheetCtx; a: RowAction; m: ReturnType<typeof matrixStats>; dead: boolean; onRoll: (a: RowAction) => void; removable?: boolean }) {
  const { c, d } = ctx;
  const e = getExt(c);
  const b = basePool(c, d, a.skill, a.attr);
  const adj = actionAdjust(a, m, e);
  return (
    <li className="py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display font-semibold">{a.name}</div>
          <div className="num text-xs text-dim">{b.parts}{adj.parts.length ? ` · ${adj.parts.join(", ")}` : ""}</div>
          {a.against && <div className="text-xs text-faint">Against {a.against}</div>}
          {b.blocked && <div className="text-xs text-danger">Needs the {SKILL_BY_ID[a.skill]?.name} skill.</div>}
        </div>
        <div className="no-print flex shrink-0 gap-1">
          <button className="btn small primary" disabled={dead || b.blocked} onClick={() => onRoll(a)}><Icon name="dice" size={14} /> {ctx.poolOf(b.base, { adjust: adj.adjust })}</button>
          {removable && <button className="btn ghost small" aria-label={`Remove ${a.name}`} onClick={() => ctx.upd((x) => editExt(x, (ex) => { ex.customActions = ex.customActions.filter((q) => q.id !== a.id); }))}>×</button>}
        </div>
      </div>
      {a.note && <p className="mt-0.5 text-xs text-faint">{a.note}</p>}
    </li>
  );
}

export function MatrixTab({ ctx }: { ctx: SheetCtx }) {
  const { c, d, upd, who } = ctx;
  const e = getExt(c);
  const m = matrixStats(c, d);
  const technomancer = c.magicType === "technomancer";
  const [pending, setPending] = useState<Pending | null>(null);
  const [os, setOs] = useState<OsPrompt | null>(null);
  const mode = MODES.find((x) => x.id === e.mode) ?? MODES[0];
  const vr = e.mode !== "ar";
  const bf = biofeedbackType(e.mode);
  const hasProgram = e.matrix.programs.some((p) => p.active && PROGRAM_HACKING.has(p.defId));
  const dead = m.source === "none";
  const overclock = e.matrix.programs.some((p) => p.active && p.defId === "overclock");
  const set = (fn: (ex: ReturnType<typeof getExt>) => void) => upd((x) => editExt(x, fn));

  const roll = (a: { id: string; name: string; skill: string; attr: string; legal: boolean; linked?: "attack" | "sleaze" }) => {
    const b = basePool(c, d, a.skill, a.attr);
    const adj = actionAdjust(a, m, e);
    ctx.rollPool(a.name, b.base, { adjust: adj.adjust });
    if (!a.legal) setOs({ id: nextPendingId(), label: a.name, hits: 0, program: hasProgram });
  };

  const damage = (kind: "matrix" | "bio" | "dump") => {
    const id = nextPendingId();
    if (kind === "matrix")
      setPending({
        id, title: "Matrix damage", dv: 3, type: "S", poolLabel: `Firewall ${m.fw}`, base: m.fw, bare: true,
        note: technomancer ? "A living persona takes it as Stun." : `Resisted with Firewall. Goes to your ${m.boxes}-box Matrix monitor.`,
        apply: technomancer ? undefined : (n) => set((ex) => { ex.matrixDamage = Math.min(m.boxes, ex.matrixDamage + n); }),
        applyLabel: technomancer ? "Apply as Stun" : "Mark on the device",
      });
    else if (kind === "bio")
      setPending({ id, title: `Biofeedback (${bf === "P" ? "Physical" : "Stun"})`, dv: 3, type: bf, poolLabel: `Willpower ${d.attrs.willpower}`, base: d.attrs.willpower, note: "Goes straight to you, around the device. Resisted with Willpower." });
    else
      setPending({ id, title: `Dumpshock (${DUMPSHOCK_DV}${bf})`, dv: DUMPSHOCK_DV, type: bf, poolLabel: `Willpower ${d.attrs.willpower}`, base: d.attrs.willpower, note: `Cold-sim 3S, hot-sim 3P. You also cannot use Edge for ${Math.max(0, 10 - d.attrs.willpower)} minutes.` });
  };

  // Defense pools. Full Matrix Defense adds Firewall to every one of them.
  const defenses: { label: string; base: number }[] = [
    { label: "Willpower + Firewall", base: d.attrs.willpower + m.fw },
    { label: "Intuition + Firewall", base: d.attrs.intuition + m.fw },
    { label: "Logic + Firewall", base: d.attrs.logic + m.fw },
    { label: "Data Processing + Firewall", base: m.dp + m.fw },
    { label: "Willpower + Sleaze", base: d.attrs.willpower + m.sleaze },
    { label: "Firewall × 2", base: m.fw * 2 },
  ];
  const [defIdx, setDefIdx] = useState(0);
  const defPick = defenses[defIdx];
  const defBase = defPick.base + (e.fullDefense ? m.fw : 0);
  const defAdjust = -(m.noise + m.damagePenalty);

  const legal = MATRIX_ACTIONS.filter((a) => a.legal);
  const illegal = MATRIX_ACTIONS.filter((a) => !a.legal);
  const custom = e.customActions;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="space-y-4">
        <Box title={technomancer ? "Persona" : "Deck and persona"} right={<span className="text-xs text-dim">{m.name}</span>}>
          {technomancer ? <PersonaBonus ctx={ctx} m={m} /> : <MatrixGearEditor ctx={ctx} />}
        </Box>

        <Box title="In the Matrix">
          {dead && !technomancer ? (
            <Empty>Pick a cyberdeck, commlink or cyberjack above to see your attributes and roll Matrix actions.</Empty>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2">
                {MATRIX_SLOTS.map((s) => <Stat key={s} label={s === "dp" ? "Data Proc." : SLOT_LABEL[s]} value={m[s]} tone={s === "attack" ? "danger" : s === "fw" ? "cyan" : "accent"} />)}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Stat label="Attack rating" value={m.attackRating} sub="Attack + Sleaze" />
                <Stat label="Defense rating" value={m.defenseRating} sub="Data Proc. + Firewall" />
                <Stat label="Device rating" value={m.rating} sub={technomancer ? "Resonance" : `${m.slotsUsed} / ${m.slots} programs`} />
              </div>
              <div className="no-print mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Interface mode">
                {MODES.map((x) => <button key={x.id} className={clsx("btn small", e.mode === x.id && "primary")} aria-pressed={e.mode === x.id} onClick={() => set((ex) => { ex.mode = x.id; })}>{x.label}</button>)}
                <span className="ml-1 text-xs text-dim">{mode.blurb}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button className="no-print btn small primary" onClick={() => doInitiative(`${who} Matrix initiative`, m.init.rank, m.init.dice, 0, who)}>Roll Matrix initiative</button>
                <span className="num text-sm text-dim">{m.init.rank} + {m.init.dice}D6</span>
              </div>
            </>
          )}
        </Box>

        {!dead && (
          <Box title="Damage and exposure">
            <div className="space-y-4">
              {technomancer ? (
                <p className="text-sm text-dim">A living persona has no device to brick. Matrix damage lands on your Stun monitor.</p>
              ) : (
                <div>
                  <Boxes label="Matrix condition" boxes={m.boxes} filled={Math.min(e.matrixDamage, m.boxes)} tone="cyan" onSet={(n) => set((ex) => { ex.matrixDamage = n; })} />
                  <p className="mt-1 text-xs text-faint">−1 die on every test for each 3 full boxes{m.damagePenalty ? ` (now −${m.damagePenalty})` : ""}. Filled, the device is bricked and you are dumped from the Matrix.</p>
                  {e.matrixDamage >= m.boxes && <p className="mt-1 text-sm text-danger">Device bricked. You take dumpshock if you were in VR.</p>}
                </div>
              )}
              <div className="no-print flex flex-wrap gap-1.5">
                <button className="btn small" onClick={() => damage("matrix")}>Take Matrix damage</button>
                <button className="btn small" disabled={!vr} title={vr ? undefined : "Only in VR"} onClick={() => damage("bio")}>Biofeedback</button>
                <button className="btn small" disabled={!vr} title={vr ? undefined : "Only in VR"} onClick={() => damage("dump")}>Dumpshock</button>
              </div>
              {pending && <ResistPrompt key={pending.id} ctx={ctx} p={pending} onClose={() => setPending(null)} />}

              <div>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="font-display font-semibold">Noise</span>
                  <span className="num text-dim">{e.noise}{m.noise !== e.noise ? ` → ${m.noise} with Scrubber` : ""}</span>
                </div>
                <div className="no-print flex flex-wrap items-center gap-1.5">
                  <Stepper label="Noise" value={e.noise} min={0} max={20} onChange={(n) => set((ex) => { ex.noise = n; })} />
                  {NOISE_PRESETS.map(([l, n]) => <button key={l} className={clsx("chip cursor-pointer", e.noise === n && "!border-accent text-accent")} onClick={() => set((ex) => { ex.noise = n; })}>{l}</button>)}
                </div>
                <p className="mt-1 text-xs text-faint">Distance to the target sets the base. −1 die per point on every Matrix test.{m.noise > m.rating && m.rating > 0 ? " Noise is above your device rating: you cannot reach the Matrix." : ""}</p>
              </div>

              <div className="no-print flex flex-wrap gap-2">
                <button className={clsx("btn small", e.fullDefense && "primary")} aria-pressed={e.fullDefense} onClick={() => set((ex) => { ex.fullDefense = !ex.fullDefense; })}>Full Matrix Defense{e.fullDefense ? " on" : ""}</button>
                {overclock && <button className={clsx("btn small", e.overclock && "primary")} aria-pressed={e.overclock} onClick={() => set((ex) => { ex.overclock = !ex.overclock; })}>Overclock{e.overclock ? " on (+2 dice)" : ""}</button>}
              </div>

              <div>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="font-display font-semibold">Overwatch score</span>
                  <span className={clsx("num", e.overwatch >= 30 ? "text-danger" : "text-dim")}>{e.overwatch} / 40</span>
                </div>
                <div className="h-2 bg-line" role="progressbar" aria-valuenow={e.overwatch} aria-valuemin={0} aria-valuemax={40} aria-label="Overwatch score"><div className={clsx("h-full", e.overwatch >= 30 ? "bg-danger" : "bg-accent")} style={{ width: `${Math.min(100, (e.overwatch / 40) * 100)}%` }} /></div>
                {os && (
                  <div className="no-print mt-2 flex flex-wrap items-end gap-3 border border-accent/50 bg-accent/5 p-3" role="group" aria-label="Add Overwatch">
                    <div className="text-sm"><b className="font-display">{os.label}</b> is illegal.<div className="text-xs text-dim">Add every hit the defender rolled, not net hits.</div></div>
                    <Num label="Defender hits" value={os.hits} max={30} onChange={(n) => setOs({ ...os, hits: n })} className="w-24" />
                    <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" className="accent-[var(--accent)]" checked={os.program} onChange={(ev) => setOs({ ...os, program: ev.target.checked })} /> Hacking program (+1)</label>
                    <button className="btn small primary" onClick={() => { const g = overwatchGain(os.hits, os.program); set((ex) => { ex.overwatch = Math.min(40, ex.overwatch + g); }); setOs(null); }}>Add {overwatchGain(os.hits, os.program)}</button>
                    <button className="btn ghost small" onClick={() => setOs(null)}>Skip</button>
                  </div>
                )}
                <div className="no-print mt-2 flex flex-wrap gap-1.5">
                  <button className="btn small" title="Per round with illegal User access to a host" onClick={() => set((ex) => { ex.overwatch = Math.min(40, ex.overwatch + 1); })}>+1 User round</button>
                  <button className="btn small" title="Per round with illegal Admin access to a host" onClick={() => set((ex) => { ex.overwatch = Math.min(40, ex.overwatch + 3); })}>+3 Admin round</button>
                  <button className="btn small ghost" onClick={() => set((ex) => { ex.overwatch = Math.max(0, ex.overwatch - 1); })}>−1</button>
                  <button className="btn small ghost" onClick={() => set((ex) => { ex.overwatch = 0; })}>Reset</button>
                </div>
                {e.overwatch >= 40 && <p className="mt-1 text-sm text-danger">Convergence. The device used for the last illegal action is bricked, you are dumped with dumpshock, and your location is reported.</p>}
                <p className="mt-1 text-xs text-faint">Illegal actions add the defender&apos;s hits. A hacking program on an action adds 1. Illegal access adds each round. Leaving the host, rebooting or jacking out clears your bonus Edge.</p>
              </div>
            </div>
          </Box>
        )}
      </div>

      <div className="space-y-4">
        {technomancer && <Technomancer ctx={ctx} />}

        {!dead && (
          <Box title="Defend" right={<span className="text-xs text-dim">{e.fullDefense ? "Full Matrix Defense: + Firewall" : "pool after modifiers"}</span>}>
            <div className="no-print flex flex-wrap items-center gap-2">
              <select className="field !w-auto min-w-48 flex-1" aria-label="Defense pool" value={defIdx} onChange={(ev) => setDefIdx(Number(ev.target.value))}>
                {defenses.map((x, i) => <option key={x.label} value={i}>{x.label}</option>)}
              </select>
              <button className="btn small primary" onClick={() => ctx.rollPool(`Matrix defense (${defPick.label}${e.fullDefense ? " + Firewall" : ""})`, defBase, { adjust: defAdjust })}><Icon name="dice" size={14} /> {ctx.poolOf(defBase, { adjust: defAdjust })}</button>
            </div>
            <p className="mt-1 text-xs text-faint">The attacker&apos;s test names which pool you roll. Hits are what the opposing roll gives the Overwatch tracker, so write them down.</p>
          </Box>
        )}

        <Box title="Legal actions" right={<span className="text-xs text-dim">pool after wounds, noise and damage</span>}>
          <ul className="divide-y divide-line">{legal.map((a) => <ActionRow key={a.id} ctx={ctx} a={a} m={m} dead={dead} onRoll={roll} />)}</ul>
        </Box>
        <Box title="Illegal actions" right={<span className="text-xs text-danger">raise your Overwatch</span>}>
          <ul className="divide-y divide-line">{illegal.map((a) => <ActionRow key={a.id} ctx={ctx} a={a} m={m} dead={dead} onRoll={roll} />)}</ul>
          {custom.length > 0 && (
            <>
              <h3 className="mb-0.5 mt-3 text-xs font-semibold text-faint">Your actions</h3>
              <ul className="divide-y divide-line">{custom.map((a) => <ActionRow key={a.id} ctx={ctx} a={a} m={m} dead={dead} onRoll={roll} removable />)}</ul>
            </>
          )}
          <CustomActionForm ctx={ctx} />
          <p className="mt-3 text-xs text-faint">Free: {MATRIX_FREE_ACTIONS.join("; ")}.</p>
        </Box>
      </div>
    </div>
  );
}


function CustomActionForm({ ctx }: { ctx: SheetCtx }) {
  const [f, setF] = useState<CustomAction>({ id: "", name: "", skill: "cracking", attr: "logic", legal: false });
  return (
    <details className="no-print mt-3">
      <summary className="cursor-pointer text-sm text-dim">Add your own action</summary>
      <form
        className="mt-2 grid gap-2 sm:grid-cols-2"
        onSubmit={(ev) => { ev.preventDefault(); if (!f.name.trim()) return; ctx.upd((x) => editExt(x, (e) => { e.customActions.push({ ...f, id: xid("a"), name: f.name.trim() }); })); setF({ ...f, name: "" }); }}
      >
        <label className="block text-xs text-dim sm:col-span-2">Name<input className="field mt-1" value={f.name} onChange={(ev) => setF({ ...f, name: ev.target.value })} placeholder="House rule action" /></label>
        <label className="block text-xs text-dim">Skill
          <select className="field mt-1" value={f.skill} onChange={(ev) => setF({ ...f, skill: ev.target.value })}>
            <option value="">None, attribute only</option>
            {SKILLS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="block text-xs text-dim">Attribute
          <select className="field mt-1" value={f.attr} onChange={(ev) => setF({ ...f, attr: ev.target.value })}>{ATTR_OPTS.map((a) => <option key={a} value={a}>{(ATTR_LABEL as Record<AttrKey | "resonance", string>)[a as AttrKey | "resonance"] ?? a}</option>)}</select>
        </label>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" className="accent-[var(--accent)]" checked={f.legal} onChange={(ev) => setF({ ...f, legal: ev.target.checked })} /> Legal action</label>
        <div className="flex items-end"><button className="btn small" disabled={!f.name.trim()}>Add action</button></div>
      </form>
    </details>
  );
}
