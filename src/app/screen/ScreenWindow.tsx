"use client";
import { useEffect } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { ScreenBoard } from "@/app/gm/Screen";
import { ensureTable } from "@/lib/gm/table";
import { useComms } from "@/lib/store/comms";
import { useVtt } from "@/lib/vtt/store";

/**
 * The GM screen on its own, for a second monitor. It opens its own link to the room as the same GM
 * seat (quietly: nobody sees you join twice), so the turn order, the crew, music and rolls are live,
 * and it shares the binder, house rules and layouts with the main window on this device.
 */
export function ScreenWindow() {
  const status = useComms((s) => s.status);
  const role = useComms((s) => s.role);
  const room = useComms((s) => s.room);
  const loaded = useVtt((s) => !!s.state);

  useEffect(() => { ensureTable(); }, [status, role]);
  useEffect(() => { if (status === "online" || status === "local") void useVtt.getState().start(); }, [status, role]);

  const label = status === "online" ? `${role === "gm" ? "GM" : "Player"} · ${room}` : status === "local" ? "This device only" : status === "connecting" ? "Linking…" : "Solo prep";
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-[1100] flex h-11 items-center gap-3 border-b border-line bg-bg/90 px-3 backdrop-blur md:px-5">
        <Icon name="gavel" size={18} className="text-accent" />
        <b className="font-display">GM screen</b>
        <span className={clsx("vtt-conn", status === "online" && loaded && "on")}>{label}</span>
        {status === "online" && role !== "gm" && <span className="text-xs text-cyan">You hold a player seat here, so table controls are off.</span>}
        <span className="flex-1" />
        <button className="btn small ghost" onClick={() => { if (window.opener && !window.opener.closed) { window.opener.focus(); } else window.open("/gm", "_blank"); }} title="Bring the main window forward">
          <Icon name="back" size={14} /> Main window
        </button>
      </header>
      <main className="min-w-0 flex-1 p-3 md:p-4">
        <ScreenBoard popped />
      </main>
    </div>
  );
}
