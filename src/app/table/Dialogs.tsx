"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { Sheet } from "@/app/runners/[id]/Sheet";
import { useComms } from "@/lib/store/comms";
import { useRunners } from "@/lib/store/characters";
import { BAR_META, type BarKey, type Npc, type Weapon, type Scene, type TableState, type Token } from "@/lib/vtt/types";
import { useVtt } from "@/lib/vtt/store";
import { loadImage } from "@/lib/vtt/images";
import { blankNpc } from "@/lib/vtt/runner";
import { vid } from "@/lib/vtt/ops";
import { useTableUi } from "./ui";
import { rollInitFor, rollPool } from "./act";
import { AttackDialog } from "./Combat";

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={clsx("panel flex max-h-[92dvh] w-full flex-col overflow-hidden", wide ? "max-w-6xl" : "max-w-xl")}>
        <div className="panel-head"><span className="flex-1 truncate">{title}</span><button className="btn small ghost" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button></div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function findToken(state: TableState, id: string): { t: Token; scene: Scene } | null {
  for (const s of Object.values(state.scenes)) {
    const o = s.objects[id];
    if (o?.kind === "token") return { t: o, scene: s };
  }
  return null;
}

export function NpcEditor({ npc, onChange }: { npc: Npc; onChange: (n: Npc) => void }) {
  const set = (p: Partial<Npc>) => onChange({ ...npc, ...p });
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-dim">Init base<input className="field num" type="number" value={npc.init.base} onChange={(e) => set({ init: { ...npc.init, base: Number(e.target.value) || 0 } })} /></label>
        <label className="text-xs text-dim">Init dice<input className="field num" type="number" min={1} max={5} value={npc.init.dice} onChange={(e) => set({ init: { ...npc.init, dice: Math.max(1, Math.min(5, Number(e.target.value) || 1)) } })} /></label>
        <label className="text-xs text-dim">Defense rating<input className="field num" type="number" value={npc.dr} onChange={(e) => set({ dr: Number(e.target.value) || 0 })} /></label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-dim">Defense pool (REA + INT)<input className="field num" type="number" value={npc.defend ?? 0} onChange={(e) => set({ defend: Number(e.target.value) || 0 })} /></label>
        <label className="text-xs text-dim">Soak pool (BOD)<input className="field num" type="number" value={npc.soak ?? 0} onChange={(e) => set({ soak: Number(e.target.value) || 0 })} /></label>
      </div>
      <div className="space-y-1">
        <div className="text-xs text-dim">Weapons: name, attack pool, DV, P or S, AR by range (Close/Near/Medium/Far/Extreme, – for none)</div>
        {(npc.weapons ?? []).map((w, i) => {
          const upd = (p: Partial<Weapon>) => set({ weapons: (npc.weapons ?? []).map((x, j) => (j === i ? { ...x, ...p } : x)) });
          return (
            <div key={i} className="flex flex-wrap gap-1.5">
              <input className="field min-w-28 flex-1" value={w.name} onChange={(e) => upd({ name: e.target.value })} aria-label="Weapon" />
              <input className="field num !w-16" type="number" value={w.pool} onChange={(e) => upd({ pool: Number(e.target.value) || 0 })} aria-label="Attack pool" title="Attack pool" />
              <input className="field num !w-14" type="number" value={w.dv} onChange={(e) => upd({ dv: Number(e.target.value) || 0 })} aria-label="Damage Value" title="DV" />
              <select className="field !w-16" value={w.type} onChange={(e) => upd({ type: e.target.value as "P" | "S" })} aria-label="Damage type"><option value="P">P</option><option value="S">S</option></select>
              <input className="field num !w-36" defaultValue={w.ar.map((v) => v ?? "-").join("/")} onBlur={(e) => upd({ ar: [0, 1, 2, 3, 4].map((k) => { const v = Number(e.target.value.split("/")[k]); return Number.isFinite(v) && v > 0 ? v : null; }) })} aria-label="Attack Rating" title="AR, e.g. 10/10/8/-/-" />
              <button className="btn small ghost" onClick={() => set({ weapons: (npc.weapons ?? []).filter((_, j) => j !== i) })} aria-label="Remove weapon"><Icon name="x" size={14} /></button>
            </div>
          );
        })}
        <button className="btn small" onClick={() => set({ weapons: [...(npc.weapons ?? []), { name: "Heavy pistol", pool: 8, dv: 3, type: "P", ar: [10, 10, 8, null, null] }] })}><Icon name="plus" size={14} /> Weapon</button>
      </div>
      <div className="space-y-1">
        <div className="text-xs text-dim">Other dice pools</div>
        {npc.pools.map((p, i) => (
          <div key={i} className="flex gap-1.5">
            <input className="field flex-1" value={p.label} onChange={(e) => set({ pools: npc.pools.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} aria-label="Pool name" />
            <input className="field num !w-20" type="number" value={p.dice} onChange={(e) => set({ pools: npc.pools.map((x, j) => (j === i ? { ...x, dice: Number(e.target.value) || 0 } : x)) })} aria-label="Dice" />
            <button className="btn small ghost" onClick={() => set({ pools: npc.pools.filter((_, j) => j !== i) })} aria-label="Remove pool"><Icon name="x" size={14} /></button>
          </div>
        ))}
        <button className="btn small" onClick={() => set({ pools: [...npc.pools, { label: "New pool", dice: 6 }] })}><Icon name="plus" size={14} /> Pool</button>
      </div>
      <label className="block text-xs text-dim">Notes<textarea className="field min-h-20" value={npc.notes} onChange={(e) => set({ notes: e.target.value })} /></label>
    </div>
  );
}

/** The GM's token editor: who controls it, what it shows, its stat block. */
function TokenDialog({ id }: { id: string }) {
  const state = useVtt((s) => s.state)!;
  const dispatch = useVtt((s) => s.dispatch);
  const users = useComms((s) => s.users);
  const close = () => useTableUi.getState().set({ dialog: null });
  const found = findToken(state, id);
  const [d, setD] = useState<Token | null>(found?.t ?? null);
  if (!found || !d) return <Modal title="Token" onClose={close}><p className="p-4 text-dim">That token is gone.</p></Modal>;
  const players = [...new Set(users.filter((u) => u.role !== "gm").map((u) => u.handle).concat(d.owners.filter((o) => o !== "*")))];
  const set = (p: Partial<Token>) => setD({ ...d, ...p });
  const save = () => { dispatch([{ k: "set", p: ["scenes", found.scene.id, "objects", id], v: d }]); close(); };
  const img = d.img ? state.assets[d.img]?.data : undefined;

  const pick = async (f: File | undefined) => {
    if (!f) return;
    const a = await loadImage(f, "token");
    const aid = vid("a");
    dispatch([{ k: "set", p: ["assets", aid], v: { id: aid, ...a } }]);
    set({ img: aid });
  };

  return (
    <Modal title={`Edit ${d.name || "token"}`} onClose={close}>
      <div className="space-y-4 p-4">
        <div className="flex gap-3">
          <label className="relative grid size-20 shrink-0 cursor-pointer place-items-center overflow-hidden border border-line bg-bg2" title="Change image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {img ? <img src={img} alt="" className="size-full object-cover" /> : <Icon name="upload" />}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
          </label>
          <div className="flex-1 space-y-2">
            <input className="field" value={d.name} onChange={(e) => set({ name: e.target.value })} aria-label="Name" placeholder="Name" />
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={d.showName} onChange={(e) => set({ showName: e.target.checked })} /> Show name</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={d.barsPublic} onChange={(e) => set({ barsPublic: e.target.checked })} /> Everyone sees bars</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!d.locked} onChange={(e) => set({ locked: e.target.checked })} /> Lock in place</label>
              {img && <button className="text-xs text-dim underline" onClick={() => set({ img: undefined })}>Remove image</button>}
            </div>
          </div>
        </div>

        <fieldset>
          <legend className="mb-1 text-sm font-semibold">Controlled by</legend>
          <div className="flex flex-wrap gap-1.5">
            <button className={clsx("chip", d.owners.includes("*") && "!border-accent text-accent")} onClick={() => set({ owners: d.owners.includes("*") ? d.owners.filter((o) => o !== "*") : [...d.owners, "*"] })}>All players</button>
            {players.map((h) => (
              <button key={h} className={clsx("chip", d.owners.includes(h) && "!border-accent text-accent")} onClick={() => set({ owners: d.owners.includes(h) ? d.owners.filter((o) => o !== h) : [...d.owners, h] })}>{h}</button>
            ))}
            {players.length === 0 && <span className="text-xs text-faint">Players who join the room appear here.</span>}
          </div>
          {d.runner && <p className="mt-1 text-xs text-dim">Linked to {d.runner.owner}&apos;s runner sheet. Bars and stats update from their device. <button className="underline" onClick={() => set({ runner: undefined, card: undefined })}>Unlink</button></p>}
        </fieldset>

        <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <legend className="mb-1 text-sm font-semibold">Size and aura</legend>
          <label className="text-xs text-dim">Width (squares)<input className="field num" type="number" min={0.5} step={0.5} value={d.w / 70} onChange={(e) => set({ w: Math.max(0.25, Number(e.target.value) || 1) * 70 })} /></label>
          <label className="text-xs text-dim">Height (squares)<input className="field num" type="number" min={0.5} step={0.5} value={d.h / 70} onChange={(e) => set({ h: Math.max(0.25, Number(e.target.value) || 1) * 70 })} /></label>
          <label className="text-xs text-dim">Aura (m)<input className="field num" type="number" min={0} value={d.aura ?? 0} onChange={(e) => set({ aura: Number(e.target.value) || undefined })} /></label>
          <label className="text-xs text-dim">Color<input className="field !h-10 !p-1" type="color" value={d.color} onChange={(e) => set({ color: e.target.value })} /></label>
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-sm font-semibold">Bars</legend>
          {(["b1", "b2", "b3"] as BarKey[]).map((k) => {
            const b = d.bars[k];
            return (
              <div key={k} className="flex items-center gap-2 text-sm">
                <span className="w-20" style={{ color: BAR_META[k].color }}>{BAR_META[k].name}</span>
                <input className="field num !w-20" type="number" value={b?.cur ?? 0} onChange={(e) => set({ bars: { ...d.bars, [k]: { cur: Number(e.target.value) || 0, max: b?.max ?? 0 } } })} aria-label={`${BAR_META[k].name} current`} />
                <span className="text-faint">of</span>
                <input className="field num !w-20" type="number" value={b?.max ?? 0} onChange={(e) => set({ bars: { ...d.bars, [k]: { cur: b?.cur ?? 0, max: Number(e.target.value) || 0 } } })} aria-label={`${BAR_META[k].name} max`} />
              </div>
            );
          })}
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-sm font-semibold">Stat block</legend>
          {d.npc ? <NpcEditor npc={d.npc} onChange={(npc) => set({ npc })} /> : (
            <button className="btn small" onClick={() => set({ npc: blankNpc().npc })}><Icon name="plus" size={14} /> Add an NPC stat block</button>
          )}
        </fieldset>

        <label className="block text-sm">GM notes<textarea className="field min-h-16" value={d.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} placeholder="Only you see these" /></label>
      </div>
      <div className="sticky bottom-0 flex gap-2 border-t border-line bg-panel p-3">
        <button className="btn primary" onClick={save}><Icon name="check" size={15} /> Save token</button>
        <button className="btn ghost" onClick={close}>Cancel</button>
      </div>
    </Modal>
  );
}

/** The essentials of a runner or NPC with one-tap rolls. */
function CardDialog({ id }: { id: string }) {
  const state = useVtt((s) => s.state)!;
  const me = useVtt((s) => s.me);
  const ui = useTableUi();
  const close = () => ui.set({ dialog: null });
  const found = findToken(state, id);
  if (!found) return <Modal title="Token" onClose={close}><p className="p-4 text-dim">That token is gone.</p></Modal>;
  const t = found.t;
  const src = t.npc ?? t.card;
  const canRoll = me.gm || t.runner?.owner === me.handle || t.owners.includes(me.handle) || t.owners.includes("*");
  const img = t.img ? state.assets[t.img]?.data : undefined;
  return (
    <Modal title={t.name || "Token"} onClose={close}>
      <div className="space-y-3 p-4">
        <div className="flex gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {img && <img src={img} alt="" className="size-20 border border-line object-cover" />}
          <div>
            {t.card?.sub && <div className="text-sm text-dim">{t.card.sub}</div>}
            {src && <div className="num mt-1 flex flex-wrap gap-x-3 text-sm"><span>Init <b>{src.init.base}+{src.init.dice}D6</b></span><span>DR <b>{src.dr}</b></span></div>}
            {t.runner && <div className="mt-1 text-xs text-faint">Runner of {t.runner.owner}</div>}
          </div>
        </div>
        {t.card && (
          <div className="grid grid-cols-5 gap-1 text-center sm:grid-cols-9">
            {t.card.attrs.map(([k, v]) => <div key={k} className="border border-line py-0.5"><div className="text-[9px] text-faint">{k}</div><div className="num text-sm font-semibold">{v}</div></div>)}
          </div>
        )}
        {src && canRoll && (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Rolls</h3>
              {me.gm && t.npc && <label className="flex items-center gap-1.5 text-xs text-dim"><input type="checkbox" checked={ui.secret} onChange={(e) => ui.set({ secret: e.target.checked })} /> Roll in secret</label>}
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {src.pools.map((p, i) => (
                <button key={i} className="btn small justify-between" onClick={() => rollPool(t, p.label, p.dice)}>
                  <span className="truncate">{p.label}</span><b className="num">{p.dice}</b>
                </button>
              ))}
              <button className="btn small primary justify-between" onClick={() => rollInitFor(t)}><span>Initiative</span><b className="num">{src.init.base}+{src.init.dice}D6</b></button>
            </div>
          </>
        )}
        {t.npc?.notes && me.gm && <p className="whitespace-pre-wrap text-sm text-dim">{t.npc.notes}</p>}
        {t.notes && me.gm && <p className="whitespace-pre-wrap border-t border-line pt-2 text-sm text-dim">{t.notes}</p>}
        {!src && <p className="text-sm text-dim">No stats on this token.{me.gm ? " Edit it to add an NPC stat block." : ""}</p>}
      </div>
    </Modal>
  );
}

function SheetDialog({ runnerId }: { runnerId: string }) {
  const close = () => useTableUi.getState().set({ dialog: null });
  const has = useRunners((s) => !!s.runners[runnerId]);
  return (
    <Modal title="Runner sheet" onClose={close} wide>
      {has ? <div className="p-2 md:p-4"><Sheet id={runnerId} /></div> : <p className="p-4 text-dim">That runner is not on this device.</p>}
    </Modal>
  );
}

function HandoutDialog({ id }: { id: string }) {
  const state = useVtt((s) => s.state)!;
  const close = () => useTableUi.getState().set({ dialog: null });
  const h = state.handouts[id];
  if (!h) return <Modal title="Handout" onClose={close}><p className="p-4 text-dim">That handout is no longer shared.</p></Modal>;
  const img = h.img ? state.assets[h.img]?.data : undefined;
  return (
    <Modal title={h.title} onClose={close} wide={!!img}>
      <div className="space-y-3 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {img && <img src={img} alt={h.title} className="mx-auto max-h-[70dvh] w-auto" />}
        {h.text && <p className="whitespace-pre-wrap">{h.text}</p>}
      </div>
    </Modal>
  );
}

export function Dialogs() {
  const dialog = useTableUi((s) => s.dialog);
  const state = useVtt((s) => s.state);
  if (!dialog || !state) return null;
  if (dialog.kind === "token") return <TokenDialog key={dialog.id} id={dialog.id} />;
  if (dialog.kind === "card") return <CardDialog id={dialog.id} />;
  if (dialog.kind === "sheet") return <SheetDialog runnerId={dialog.runnerId} />;
  if (dialog.kind === "attack") return <AttackDialog key={dialog.attackerId} attackerId={dialog.attackerId} targetId={dialog.targetId} />;
  return <HandoutDialog id={dialog.id} />;
}
