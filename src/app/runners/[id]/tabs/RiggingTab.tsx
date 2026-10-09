"use client";
import { useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { doInitiative } from "@/lib/actions";
import { RCCS } from "@/lib/sr6/rules6";
import { editExt, getExt, nextPendingId, newVehicle, vehicleStats, type Vehicle } from "@/lib/sr6/ext";
import { Box, Boxes, Empty, Num, Stat, Stepper } from "./ui";
import { basePool, type SheetCtx } from "./ctx";
import { ResistPrompt, type Pending } from "./Resist";

function VehicleCard({ ctx, v }: { ctx: SheetCtx; v: Vehicle }) {
  const { c, d, upd, who } = ctx;
  const [pending, setPending] = useState<Pending | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const s = vehicleStats(c, d, v);
  const set = (fn: (t: Vehicle) => void) => upd((x) => editExt(x, (ex) => { const t = ex.vehicles.find((q) => q.id === v.id); if (t) fn(t); }));
  const remote = v.kind === "drone" && !v.jumped;
  const repair = basePool(c, d, "engineering", "logic");
  const weapon = remote
    ? { base: Math.max(0, v.sensor + (v.targeting > 0 ? v.targeting : -1)), label: v.targeting > 0 ? `Targeting ${v.targeting} + Sensor ${v.sensor}` : `Sensor ${v.sensor} − 1, no Targeting autosoft`, blocked: false }
    : { base: repair.base, label: repair.parts, blocked: repair.blocked };
  const adjust = -s.speedPenalty;
  const stat = (key: keyof Vehicle, label: string, max = 20) => <Num key={key} label={label} value={v[key] as number} max={max} onChange={(n) => set((t) => { (t[key] as number) = n; })} />;

  const handling = () => {
    const r = ctx.rollPool(`${v.name}: Handling test (${s.pilotPool.label})`, s.pilotPool.base, { adjust });
    const ok = r.totalHits >= s.handling;
    setMsg(`${r.totalHits} hit${r.totalHits === 1 ? "" : "s"} against Handling ${s.handling}: ${ok ? "you keep control." : "you lose it. Make a crash test."}`);
  };
  const crash = () => {
    const r = ctx.rollPool(`${v.name}: crash test (${s.pilotPool.label})`, s.pilotPool.base, { adjust });
    setMsg(`${r.totalHits} hit${r.totalHits === 1 ? "" : "s"} against Handling ${s.handling}: ${r.totalHits >= s.handling ? "you recover." : "the vehicle crashes."}`);
  };
  const soak = () => setPending({
    id: nextPendingId(), title: `${v.name} damage`, dv: 6, type: "P", poolLabel: `Body ${v.body}`, base: v.body, bare: true, applyLabel: "Mark on the vehicle",
    note: "Vehicles and drones resist damage with Body. Every 3 boxes of damage adds 1 to Handling.",
    apply: (n) => set((t) => { t.damage = Math.min(s.boxes, t.damage + n); }),
  });

  return (
    <Box title={v.name || "Unnamed"} right={<button className="no-print btn ghost small" aria-label={`Remove ${v.name}`} onClick={() => upd((x) => editExt(x, (ex) => { ex.vehicles = ex.vehicles.filter((q) => q.id !== v.id); }))}>×</button>}>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block text-xs text-dim">Name<input className="field mt-1" value={v.name} onChange={(ev) => set((t) => { t.name = ev.target.value; })} /></label>
        <label className="block text-xs text-dim">Kind
          <select className="field mt-1" value={v.kind} onChange={(ev) => set((t) => { t.kind = ev.target.value as Vehicle["kind"]; })}><option value="drone">Drone</option><option value="vehicle">Vehicle</option></select>
        </label>
      </div>

      <div className="no-print mt-3 flex flex-wrap gap-2">
        <button className={clsx("btn small", v.jumped && "primary")} aria-pressed={v.jumped} onClick={() => set((t) => { t.jumped = !t.jumped; })} title="In VR with a control rig. You use Willpower, Charisma, Logic and Intuition for Body, Strength, Agility and Reaction.">{v.jumped ? "Jumped in" : "Jump in"}</button>
        <button className={clsx("btn small", v.offroad && "primary")} aria-pressed={v.offroad} onClick={() => set((t) => { t.offroad = !t.offroad; })}>{v.offroad ? "Off road" : "On road"}</button>
        <span className="ml-auto text-xs text-dim self-center">{v.jumped ? "Piloting + Intuition" : remote ? "Remote: Pilot + autosoft" : "Piloting + Reaction"}</span>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-dim">Stats from the book</summary>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {stat("handlingOn", "Handling on")}{stat("handlingOff", "Handling off")}{stat("accel", "Accel", 99)}{stat("speedInterval", "Speed interval", 999)}{stat("topSpeed", "Top speed", 9999)}
          {stat("body", "Body")}{stat("armor", "Armor")}{stat("pilot", "Pilot")}{stat("sensor", "Sensor")}{stat("seats", "Seats", 20)}
          {stat("maneuver", "Maneuvering autosoft", 6)}{stat("targeting", "Targeting autosoft", 6)}
        </div>
      </details>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Handling now" value={s.handling} sub={s.handling > (v.offroad ? v.handlingOff : v.handlingOn) ? "damage raised it" : v.offroad ? "off road" : "on road"} tone="accent" />
        <Stat label="Attack rating" value={s.attackRating} sub={remote ? "Pilot + Sensor" : "Piloting + Sensor"} tone="danger" />
        <Stat label="Defense rating" value={s.defenseRating} sub={remote ? "Pilot + Armor" : "Piloting + Armor"} tone="cyan" />
        <Stat label="Ram damage" value={`${s.ramDamage}P`} sub="Body ÷ 2 + speed intervals" />
      </div>

      <div className="no-print mt-3 flex flex-wrap items-center gap-3">
        <label className="text-xs text-dim">Current speed<div className="mt-1 flex items-center gap-2"><Stepper label="Speed" value={v.speed} min={0} max={v.topSpeed} onChange={(n) => set((t) => { t.speed = n; })} /><input aria-label="Speed value" className="field num !w-20" type="number" min={0} max={v.topSpeed} value={v.speed} onChange={(ev) => set((t) => { t.speed = Math.max(0, Math.min(v.topSpeed, Math.floor(Number(ev.target.value) || 0))); })} /></div></label>
        <div className="text-xs text-dim">Interval {v.speedInterval}. <b className={s.speedPenalty ? "text-danger" : ""}>−{s.speedPenalty}</b> dice on Handling tests and attacks.</div>
      </div>

      <div className="mt-3">
        <Boxes label="Condition" boxes={s.boxes} filled={Math.min(v.damage, s.boxes)} onSet={(n) => set((t) => { t.damage = n; })} />
        {v.damage >= s.boxes && <p className="mt-1 text-sm text-danger">Broken down. A jumped-in rigger is ejected.</p>}
        <p className="mt-1 text-xs text-faint">Monitor is Body ÷ 2 + 8. Handling rises by 1 for every 3 boxes of damage.</p>
      </div>

      <div className="no-print mt-3 flex flex-wrap items-center gap-2">
        <button className="btn small primary" disabled={s.pilotPool.blocked} onClick={handling}><Icon name="dice" size={14} /> Handling {ctx.poolOf(s.pilotPool.base, { adjust })}</button>
        <button className="btn small" disabled={s.pilotPool.blocked} onClick={crash}>Crash test</button>
        <button className="btn small" disabled={s.pilotPool.blocked} onClick={() => ctx.rollPool(`${v.name}: ram (${s.pilotPool.label})`, s.pilotPool.base, { adjust })}>Ram {ctx.poolOf(s.pilotPool.base, { adjust })}</button>
        <button className="btn small" disabled={weapon.blocked} title={weapon.label} onClick={() => ctx.rollPool(`${v.name}: fire weapon (${weapon.label})`, weapon.base, { adjust })}>Fire {ctx.poolOf(weapon.base, { adjust })}</button>
        <button className="btn small" disabled={repair.blocked} onClick={() => ctx.rollPool(`${v.name}: repair (Engineering + Logic)`, repair.base)}>Repair {ctx.poolOf(repair.base)}</button>
        <button className="btn small" onClick={soak}>Take damage</button>
        <button className="btn small" onClick={() => doInitiative(`${who}: ${v.name} initiative`, s.init, 4, 0, who)}>Init {s.init}+4D6</button>
      </div>
      {msg && <p className="mt-2 text-sm text-dim" role="status">{msg}</p>}
      {pending && <div className="mt-3"><ResistPrompt key={pending.id} ctx={ctx} p={pending} onClose={() => setPending(null)} /></div>}
      <p className="mt-2 text-xs text-faint">
        Handling tests: {s.pilotPool.label}, threshold Handling. Weapons: {weapon.label}. A drone runs {s.autosofts} autosoft{s.autosofts === 1 ? "" : "s"} (Pilot ÷ 2, rounded up).
      </p>
      <label className="mt-2 block text-xs text-dim">Notes<input className="field mt-1" value={v.note} placeholder="Mods, weapons, autosofts" onChange={(ev) => set((t) => { t.note = ev.target.value; })} /></label>
    </Box>
  );
}

export function RiggingTab({ ctx }: { ctx: SheetCtx }) {
  const e = getExt(ctx.c);
  const rcc = e.rcc;
  const slaved = e.vehicles.filter((v) => v.kind === "drone").length;
  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <button className="btn small primary" onClick={() => ctx.upd((x) => editExt(x, (ex) => { ex.vehicles.push(newVehicle("drone")); }))}><Icon name="plus" size={14} /> Add drone</button>
        <button className="btn small" onClick={() => ctx.upd((x) => editExt(x, (ex) => { ex.vehicles.push(newVehicle("vehicle")); }))}><Icon name="plus" size={14} /> Add vehicle</button>
        <select className="field !w-auto min-w-52" aria-label="Rigger command console" value="" onChange={(ev) => { const r = RCCS[Number(ev.target.value)]; if (r) ctx.upd((x) => editExt(x, (ex) => { ex.rcc = { ...r }; })); }}>
          <option value="">{rcc ? `${rcc.name} (change)` : "Rigger command console…"}</option>
          {RCCS.map((r, i) => <option key={r.name} value={i}>{r.name}: rating {r.rating}, D{r.d}/F{r.f}</option>)}
        </select>
        {rcc && <button className="btn ghost small" onClick={() => ctx.upd((x) => editExt(x, (ex) => { ex.rcc = null; }))}>Remove console</button>}
      </div>
      {rcc && (
        <Box title={rcc.name} right={<span className="num text-xs text-dim">rating {rcc.rating}</span>}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Slaved drones" value={`${slaved} / ${rcc.rating * 3}`} tone={slaved > rcc.rating * 3 ? "danger" : undefined} sub="Rating × 3" />
            <Stat label="Data Proc." value={rcc.d} sub="programs and autosofts shared" />
            <Stat label="Firewall" value={rcc.f} />
            <Stat label="Noise reduction" value={rcc.rating} sub="its device rating" />
          </div>
          <p className="mt-2 text-xs text-faint">Hackers must get through the console before they reach a slaved drone. One Minor Action commands any number of them.</p>
        </Box>
      )}
      {e.vehicles.length === 0 && <Box title="Vehicles and drones"><Empty>Nothing in the garage. Add a drone or vehicle and fill in its stats from the book or your GM.</Empty></Box>}
      <div className="grid gap-4 xl:grid-cols-2">
        {e.vehicles.map((v) => <VehicleCard key={v.id} ctx={ctx} v={v} />)}
      </div>
    </div>
  );
}
