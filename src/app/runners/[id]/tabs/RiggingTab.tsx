"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { editExt, getExt, newVehicle, vehicleBoxes, type Vehicle } from "@/lib/sr6/ext";
import { Box, Boxes, Empty, Num } from "./ui";
import { basePool, type SheetCtx } from "./ctx";

function VehicleCard({ ctx, v }: { ctx: SheetCtx; v: Vehicle }) {
  const { c, d, upd } = ctx;
  const [dv, setDv] = useState(6);
  const [msg, setMsg] = useState<string | null>(null);
  const boxes = vehicleBoxes(v);
  const set = (fn: (t: Vehicle) => void) => upd((x) => editExt(x, (ex) => { const t = ex.vehicles.find((q) => q.id === v.id); if (t) fn(t); }));
  const piloting = basePool(c, d, "piloting", "reaction");
  const repair = basePool(c, d, "engineering", "logic");
  const stat = (key: keyof Vehicle, label: string, max = 20) => <Num key={key} label={label} value={v[key] as number} max={max} onChange={(n) => set((t) => { (t[key] as number) = n; })} />;
  const resist = () => {
    // vehicles soak with Body + Armor; the roll shows in the dice tray and the damage lands on the vehicle
    const r = ctx.rollPool(`${v.name} damage resistance (Body + Armor)`, v.body + v.armor, { noWound: true, noSustain: true });
    const taken = Math.max(0, dv - r.totalHits);
    setMsg(`${r.totalHits} hits soak ${Math.min(dv, r.totalHits)}, ${taken} damage to the vehicle`);
    set((t) => { t.damage = Math.min(boxes, t.damage + taken); });
  };
  return (
    <Box
      title={v.name || "Unnamed"}
      right={<button className="no-print btn ghost small" aria-label={`Remove ${v.name}`} onClick={() => upd((x) => editExt(x, (ex) => { ex.vehicles = ex.vehicles.filter((q) => q.id !== v.id); }))}>×</button>}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block text-xs text-dim">Name<input className="field mt-1" value={v.name} onChange={(ev) => set((t) => { t.name = ev.target.value; })} /></label>
        <label className="block text-xs text-dim">Kind
          <select className="field mt-1" value={v.kind} onChange={(ev) => set((t) => { t.kind = ev.target.value as Vehicle["kind"]; })}><option value="drone">Drone</option><option value="vehicle">Vehicle</option></select>
        </label>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {stat("handling", "Handling")}{stat("speed", "Speed")}{stat("accel", "Accel")}{stat("body", "Body")}{stat("armor", "Armor")}{stat("pilot", "Pilot")}{stat("sensor", "Sensor")}
      </div>
      <div className="mt-3">
        <Boxes label="Condition" boxes={boxes} filled={Math.min(v.damage, boxes)} onSet={(n) => set((t) => { t.damage = n; })} />
        {v.damage >= boxes && <p className="mt-1 text-sm text-danger">Destroyed or disabled.</p>}
        <label className="mt-2 block w-32 text-xs text-dim">Boxes (0 = standard)
          <input className="field num mt-1" type="number" min={0} max={40} value={v.boxes} onChange={(ev) => set((t) => { t.boxes = Math.max(0, Math.floor(Number(ev.target.value) || 0)); })} />
        </label>
      </div>
      <div className="no-print mt-3 flex flex-wrap items-center gap-2">
        <button className="btn small primary" disabled={piloting.blocked} onClick={() => ctx.rollPool(`${v.name}: drive or fly [Handling ${v.handling}]`, piloting.base, { limit: v.handling })}><Icon name="dice" size={14} /> Pilot {ctx.poolOf(piloting.base)}</button>
        <button className="btn small" disabled={repair.blocked} onClick={() => ctx.rollPool(`${v.name}: repair (Engineering + Logic)`, repair.base)}>Repair {ctx.poolOf(repair.base)}</button>
        <span className="ml-auto flex items-end gap-2"><Num label="Incoming DV" value={dv} min={0} max={40} onChange={setDv} className="w-24" /><button className="btn small" onClick={resist}>Soak {v.body + v.armor}</button></span>
      </div>
      {msg && <p className="mt-2 text-sm text-dim">{msg}</p>}
      <p className="mt-2 text-xs text-faint">Pilot is Piloting + Reaction, limited by Handling. Soak rolls Body + Armor and puts what gets through on the vehicle.</p>
      <label className="mt-2 block text-xs text-dim">Notes<input className="field mt-1" value={v.note} placeholder="Mods, weapons, autosofts" onChange={(ev) => set((t) => { t.note = ev.target.value; })} /></label>
    </Box>
  );
}

export function RiggingTab({ ctx }: { ctx: SheetCtx }) {
  const e = getExt(ctx.c);
  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <button className="btn small primary" onClick={() => ctx.upd((x) => editExt(x, (ex) => { ex.vehicles.push(newVehicle("drone")); }))}><Icon name="plus" size={14} /> Add drone</button>
        <button className="btn small" onClick={() => ctx.upd((x) => editExt(x, (ex) => { ex.vehicles.push(newVehicle("vehicle")); }))}><Icon name="plus" size={14} /> Add vehicle</button>
      </div>
      {e.vehicles.length === 0 && <Box title="Vehicles and drones"><Empty>Nothing in the garage. Add a drone or vehicle and fill in its stats from the book or your GM.</Empty></Box>}
      <div className="grid gap-4 xl:grid-cols-2">
        {e.vehicles.map((v) => <VehicleCard key={v.id} ctx={ctx} v={v} />)}
      </div>
    </div>
  );
}
