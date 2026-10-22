"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { useComms } from "@/lib/store/comms";
import { useSettings } from "@/lib/store/settings";

type Role = "gm" | "player";
const KEY = "sixthdeck.seat-picked";

/** Has this browser tab already picked a seat? Asked once per visit. */
export function seatPicked(): boolean {
  try { return sessionStorage.getItem(KEY) === "1"; } catch { return true; }
}
function markPicked() { try { sessionStorage.setItem(KEY, "1"); } catch { /* private mode */ } }

function join(role: Role, handle: string, room: string) {
  const s = useSettings.getState();
  const c = useComms.getState();
  const h = handle.trim() || "runner", r = room.trim() || "table-1";
  s.set({ handle: h, room: r, role });
  c.connect({ url: s.chatUrl.trim(), room: r, handle: h, role });
  markPicked();
}

function PlayerArt() {
  return (
    <svg viewBox="0 0 120 90" className="seat-art" aria-hidden="true">
      <circle cx="60" cy="30" r="13" />
      <path d="M34 82c2-20 12-30 26-30s24 10 26 30" />
      <path d="M86 52l16-6M98 40l8 12" className="seat-accent" />
      <path d="M8 86h104" className="seat-line" />
    </svg>
  );
}
function GmArt() {
  return (
    <svg viewBox="0 0 120 90" className="seat-art" aria-hidden="true">
      <rect x="18" y="14" width="84" height="56" rx="2" />
      <path d="M18 32h84M18 50h84M46 14v56M74 14v56" className="seat-line" />
      <circle cx="60" cy="41" r="6" className="seat-accent" />
      <path d="M30 80h60" />
    </svg>
  );
}

function SeatCard({ role, pick, onPick, onGo, title, lead, points, art }: { role: Role; pick: Role; onPick: (r: Role) => void; onGo: (r: Role) => void; title: string; lead: string; points: string[]; art: React.ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={pick === role} onClick={() => onPick(role)} onDoubleClick={() => onGo(role)}
      className={clsx("seat-card flex flex-col p-4 text-left", pick === role && "on")}>
      <span className="mb-2 block">{art}</span>
      <span className="font-display text-2xl font-bold">{title}</span>
      <span className="mt-0.5 text-sm text-dim">{lead}</span>
      <ul className="mt-3 space-y-1 text-xs text-dim">
        {points.map((p) => <li key={p} className="flex gap-1.5"><Icon name="check" size={13} className="mt-0.5 shrink-0 text-accent" />{p}</li>)}
      </ul>
    </button>
  );
}

/** Pick a seat: play a runner, or run the table. Shown when you open the Table. */
export function SeatGate({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  const c = useComms();
  const [handle, setHandle] = useState(s.handle);
  const [room, setRoom] = useState(s.room || "table-1");
  const [pick, setPick] = useState<Role>(c.status !== "off" ? c.role : s.role);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!handle) nameRef.current?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const ready = handle.trim().length > 0;
  const goAs = (role: Role) => { setPick(role); if (!ready) { nameRef.current?.focus(); return; } join(role, handle, room); onClose(); };
  const go = () => goAs(pick);

  return (
    <div className="absolute inset-0 z-40 grid place-items-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm">
      <form className="seat-gate w-full max-w-2xl p-5 md:p-6" onSubmit={(e) => { e.preventDefault(); go(); }} aria-label="Take a seat">
        <h2 className="text-3xl font-bold">Take a seat</h2>
        <p className="mt-1 text-sm text-dim">Who are you at this table tonight?</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Seat">
          <SeatCard role="player" pick={pick} onPick={setPick} onGo={goAs} title="Player" lead="Run the shadows with your crew." art={<PlayerArt />}
            points={["Move and attack with your runner", "Your sheet stays in sync with your token", "See only what the GM reveals"]} />
          <SeatCard role="gm" pick={pick} onPick={setPick} onGo={goAs} title="Game master" lead="Run the city, the scenes and the opposition." art={<GmArt />}
            points={["Scenes, layers, fog and NPCs", "Your house rules apply to the table", "One GM seat per room"]} />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-dim">Your name at the table<input ref={nameRef} className="field mt-0.5" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Handle" autoComplete="nickname" /></label>
          <label className="text-xs text-dim">Room<input className="field mt-0.5" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="table-1" /></label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn primary" disabled={!ready}><Icon name="link" size={15} /> {pick === "gm" ? "Run the table" : "Join as player"}</button>
          <button type="button" className="btn ghost" onClick={() => { markPicked(); onClose(); }}>{c.status === "off" ? "Prep solo for now" : "Keep my seat"}</button>
          <Link className="ml-auto text-xs text-faint underline" href="/comms">Relay settings</Link>
        </div>
        <p className="mt-2 text-xs text-faint">Players share the room name with their GM. Voice stays on Discord.</p>
      </form>
    </div>
  );
}

/** The connection chip in the scene bar: shows your seat and lets you switch or leave. */
export function SeatChip({ label, gm, onPick }: { label: string; gm: boolean; onPick: () => void }) {
  const c = useComms();
  const s = useSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const k = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("pointerdown", k);
    return () => window.removeEventListener("pointerdown", k);
  }, [open]);
  const switchTo = (role: Role) => { setOpen(false); join(role, c.handle || s.handle, c.room || s.room); };
  return (
    <div ref={ref} className="relative ml-auto shrink-0">
      <button className={clsx("vtt-conn", c.status === "online" && "on")} onClick={() => setOpen(!open)} aria-expanded={open}>
        {gm ? "GM · " : c.status !== "off" ? "Player · " : ""}{label}
      </button>
      {open && (
        <div className="vtt-flyout absolute right-0 top-full z-40 mt-1 w-52 space-y-1 p-2 text-sm">
          {c.status === "off" ? (
            <button className="btn small primary w-full" onClick={() => { setOpen(false); onPick(); }}>Join a room</button>
          ) : (
            <>
              <div className="px-1 text-xs text-faint">{c.handle} in {c.room}</div>
              {gm ? <button className="btn small w-full" onClick={() => switchTo("player")}>Switch to player</button>
                : <button className="btn small w-full" onClick={() => switchTo("gm")}>Switch to game master</button>}
              <button className="btn small w-full" onClick={() => { setOpen(false); onPick(); }}>Change room or name</button>
              <button className="btn small ghost w-full" onClick={() => { setOpen(false); c.disconnect(); }}>Leave the room</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
