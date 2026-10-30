"use client";
import { rules } from "@/lib/house/rules";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { useVtt } from "@/lib/vtt/store";
import { controllerOf, defensePools, weaponsOf } from "@/lib/vtt/combat";
import type { Attack, Token } from "@/lib/vtt/types";
import { useTableUi } from "./ui";
import { attack, cancel, defend, gmRolls, penaltyFor, plan, rollsFor, soak, tokenById } from "./combat";

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

function Mod({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span className="inline-flex items-center gap-1">
      <button className="vtt-mini" onClick={() => onChange(value - 1)} aria-label="One die less">−</button>
      <span className="num w-7 text-center text-sm">{signed(value)}</span>
      <button className="vtt-mini" onClick={() => onChange(value + 1)} aria-label="One die more">+</button>
    </span>
  );
}

/** Pick a weapon and roll the attack against the chosen target. */
export function AttackDialog({ attackerId, targetId }: { attackerId: string; targetId: string }) {
  const ui = useTableUi();
  const state = useVtt((s) => s.state)!;
  const [mod, setMod] = useState(0);
  const [tid, setTid] = useState(targetId);
  const close = () => ui.set({ dialog: null });
  const a = tokenById(attackerId);
  const tg = tokenById(tid);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  const others = useMemo(() => {
    if (!a) return [];
    return Object.values(a.scene.objects)
      .filter((o): o is Token => o.kind === "token" && o.id !== a.t.id && o.layer !== "map")
      .map((o) => ({ o, m: plan(a.t, o, a.scene, { name: "", pool: 0, dv: 0, type: "P", ar: [] }, 0).meters }))
      .sort((x, y) => x.m - y.m);
  }, [a, state]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!a || !tg) return null;
  const weapons = weaponsOf(a.t);
  const pen = penaltyFor(a.t);
  const first = weapons[0] ? plan(a.t, tg.t, a.scene, weapons[0], mod) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div role="dialog" aria-modal="true" aria-label="Attack" className="panel w-full max-w-lg overflow-hidden">
        <div className="panel-head"><span className="flex-1 truncate">{a.t.name} attacks</span><button className="btn small ghost" onClick={close} aria-label="Close"><Icon name="x" size={16} /></button></div>
        <div className="space-y-3 p-4">
          <label className="block text-sm">Target
            <select className="field mt-1" value={tid} onChange={(e) => setTid(e.target.value)}>
              {others.map(({ o, m }) => <option key={o.id} value={o.id}>{o.name || "Token"}{o.layer === "gm" ? " (hidden)" : ""}, {m.toFixed(0)} m</option>)}
            </select>
          </label>
          {first && (
            <p className="num text-sm text-dim">
              {first.meters.toFixed(1)} m, <b className="text-fg">{first.band}</b> range. Target Defense Rating <b className="text-fg">{first.dr}</b>.
              {pen !== 0 && <> Wounds and sheet modifier {signed(-pen)}.</>}
            </p>
          )}
          <div className="flex items-center gap-2 text-sm">
            <span>Situational dice</span><Mod value={mod} onChange={setMod} />
            <span className="text-xs text-faint">cover, called shots, visibility, recoil</span>
          </div>
          {weapons.length === 0 && <p className="text-sm text-dim">No weapons on this token.{useVtt.getState().me.gm ? " Add some in the token editor." : ""}</p>}
          <ul className="space-y-1.5">
            {weapons.map((w, i) => {
              const p = plan(a.t, tg.t, a.scene, w, mod);
              return (
                <li key={i} className="flex items-center gap-3 border border-line bg-bg2 p-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{w.name}</div>
                    <div className="num text-xs text-dim">DV {w.dv}{w.type} · AR {w.ar.map((v) => v ?? "–").join("/")}</div>
                    {p.ar == null ? <div className="text-xs text-danger">Cannot reach {p.band} range.</div>
                      : p.edgeTo === "attacker" ? <div className="text-xs text-ok">AR {p.ar} beats DR {p.dr} by 4+: {a.t.name} gains 1 Edge.</div>
                      : p.edgeTo === "defender" ? <div className="text-xs text-danger">DR {p.dr} beats AR {p.ar} by 4+: {tg.t.name} gains 1 Edge.</div>
                      : <div className="text-xs text-faint">AR {p.ar} against DR {p.dr}: no Edge.</div>}
                  </div>
                  <button className="btn small primary shrink-0" disabled={p.ar == null} onClick={() => { attack(a.t, tg.t, a.scene, w, mod); close(); }}>
                    Attack {p.pool}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-faint">The target rolls Defense (Reaction + Intuition). More hits for you is a hit; {rules().tie === "hit" ? "a tie still hits for the base DV" : rules().tie === "graze" ? "a tie grazes for no damage" : "a tie misses"}. Damage is DV plus net hits, resisted with Body.</p>
        </div>
      </div>
    </div>
  );
}

function AttackCard({ rec }: { rec: Attack }) {
  const me = useVtt((s) => s.me);
  const [mod, setMod] = useState(0);
  const f = tokenById(rec.target.tokenId);
  const t = f?.t;
  const mine = !!t && rollsFor(t);
  const expected = t && (controllerOf(t) === me.handle || (me.gm && gmRolls(t)));
  const who = t ? controllerOf(t) ?? "the GM" : "the GM";
  const pools = t ? defensePools(t) : { defend: 0, soak: 0 };
  const defendPool = t ? Math.max(0, pools.defend - penaltyFor(t) + mod) : 0;
  const dv = rec.weapon.dv + (rec.net ?? 0);

  return (
    <div className={clsx("vtt-attack p-2.5 text-sm", expected && "is-mine")}>
      <div className="flex items-start gap-2">
        <Icon name="bolt" size={15} className="mt-0.5 shrink-0 text-danger" />
        <div className="min-w-0 flex-1">
          <div className="truncate"><b>{rec.attacker.name}</b> → <b>{rec.target.name}</b></div>
          <div className="num text-xs text-dim">
            {rec.weapon.name} {rec.weapon.dv}{rec.weapon.type} · {rec.band} {rec.meters} m · AR {rec.ar} v DR {rec.dr} · <b className="text-fg">{rec.attack.hits} hit{rec.attack.hits === 1 ? "" : "s"}</b>{rec.attack.glitch ? (rec.attack.crit ? " · critical glitch" : " · glitch") : ""}
          </div>
          {rec.status === "soak" && <div className="num text-xs">Hit by {rec.net} net: resist <b>{dv}{rec.weapon.type}</b> with Body.</div>}
        </div>
        {(me.gm || rec.by === me.handle) && rec.status === "defend" && (
          <button className="btn small ghost !px-1.5" onClick={() => cancel(rec)} title="Cancel this attack" aria-label="Cancel attack"><Icon name="x" size={14} /></button>
        )}
      </div>
      {mine ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {rec.status === "defend" && (
            <>
              <button className={clsx("btn small", expected ? "primary" : "")} onClick={() => defend(rec, mod)}>
                {expected ? "" : "Roll for them: "}Defend {defendPool}
              </button>
              <Mod value={mod} onChange={setMod} />
              {rec.edgeTo === "defender" && <span className="text-xs text-ok">+1 Edge for {rec.target.name}</span>}
            </>
          )}
          {rec.status === "soak" && (
            <>
              <button className={clsx("btn small", expected ? "primary" : "")} onClick={() => soak(rec, mod)}>{expected ? "" : "Roll for them: "}Soak {Math.max(0, pools.soak + mod)}</button>
              <Mod value={mod} onChange={setMod} />
            </>
          )}
        </div>
      ) : (
        <p className="mt-1 text-xs text-faint">Waiting for {who} to {rec.status === "defend" ? "defend" : "resist damage"}.</p>
      )}
    </div>
  );
}

function resultLine(r: Attack) {
  if (r.status === "cancelled") return "cancelled";
  if (r.outcome === "miss") return "missed";
  if (r.outcome === "graze") return "grazed, no damage";
  return r.damage ? `${r.damage}${r.weapon.type} taken` : "fully soaked";
}

/** Attacks waiting on someone, and the last few results. The GM's client resolves GM-run targets. */
export function CombatFeed() {
  const combat = useVtt((s) => s.state?.combat);
  const me = useVtt((s) => s.me);
  const dispatch = useVtt((s) => s.dispatch);
  const ui = useTableUi();
  const [recentOpen, setRecentOpen] = useState(false);
  const list = useMemo(() => Object.values(combat ?? {}).sort((a, b) => a.at - b.at), [combat]);
  const open = list.filter((r) => r.status === "defend" || r.status === "soak");
  const recent = list.filter((r) => r.status === "done" || r.status === "cancelled").slice(-4).reverse();
  const busy = useRef(new Set<string>());

  // GM: roll defense and soak for NPCs and other GM-run targets
  useEffect(() => {
    if (!me.gm || !ui.autoNpc) return;
    for (const r of open) {
      const t = tokenById(r.target.tokenId)?.t;
      if (!t || !gmRolls(t)) continue;
      const key = `${r.id}:${r.status}`;
      if (busy.current.has(key)) continue;
      busy.current.add(key);
      setTimeout(() => { const cur = useVtt.getState().state?.combat?.[r.id]; if (cur?.status === "defend") defend(cur); else if (cur?.status === "soak") soak(cur); }, 600);
    }
  }, [open, me.gm, ui.autoNpc]);

  // GM: keep the log short
  useEffect(() => {
    if (!me.gm || list.length <= 40) return;
    const old = list.filter((r) => r.status === "done" || r.status === "cancelled").slice(0, list.length - 30);
    if (old.length) dispatch(old.map((r) => ({ k: "del" as const, p: ["combat", r.id] })));
  }, [list, me.gm, dispatch]);

  if (!open.length && !recent.length) return null;
  return (
    <section className="vtt-combat absolute left-1/2 top-3 z-20 w-[min(28rem,calc(100%-6rem))] -translate-x-1/2 max-md:left-[3.5rem] max-md:top-2 max-md:w-[calc(100%-4.5rem)] max-md:translate-x-0" aria-label="Combat" aria-live="polite">
      {open.map((r) => <AttackCard key={r.id} rec={r} />)}
      {recent.length > 0 && (
        <div className="vtt-attack px-2.5 py-1.5 text-xs">
          <div className="flex items-center gap-2">
            <button className="flex-1 text-left text-dim" onClick={() => setRecentOpen(!recentOpen)}>
              Last: <b className="text-fg">{recent[0].attacker.name}</b> → <b className="text-fg">{recent[0].target.name}</b>, {resultLine(recent[0])}
            </button>
            {me.gm && <label className="flex shrink-0 items-center gap-1 text-faint" title="Your device rolls defense and soak for NPCs automatically"><input type="checkbox" checked={ui.autoNpc} onChange={(e) => ui.set({ autoNpc: e.target.checked })} /> Auto NPC</label>}
          </div>
          {recentOpen && (
            <ul className="mt-1 space-y-0.5 text-dim">
              {recent.map((r) => (
                <li key={r.id}>{r.attacker.name} → {r.target.name}: {r.weapon.name}, {r.attack.hits}{r.defense ? ` v ${r.defense.hits}` : ""}{r.soak ? `, soaked ${r.soak.hits}` : ""}, {resultLine(r)}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
