"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Icon } from "@/components/Icon";
import { useComms } from "@/lib/store/comms";
import { useVtt } from "@/lib/vtt/store";
import { audio, audioLocked, setLayer, setMasterVolume, stopLayersExcept, unlockAudio } from "@/lib/audio/ambient";
import { describe, musicOf } from "@/lib/audio/table";

/** This listener's own volume and mute; the GM sets the mix, you set how loud it is for you. */
export const useListen = create<{ volume: number; muted: boolean; set: (p: Partial<{ volume: number; muted: boolean }>) => void }>()(
  persist((set) => ({ volume: 0.8, muted: false, set: (p) => set(p) }), { name: "sixthdeck.listen", version: 1 }),
);

const NO_AMB: Record<string, number> = {};

/**
 * Plays whatever the GM has on at the table, on every device in the room, from any page of the deck.
 * Music tracks start at the same moment everywhere; soundscapes are built locally from the same recipe.
 */
export function MusicHost() {
  const status = useComms((s) => s.status);
  const role = useComms((s) => s.role);
  const handle = useComms((s) => s.handle);
  const music = useVtt((s) => s.state?.music ?? null);
  const listen = useListen();
  const [locked, setLocked] = useState(false);
  const [open, setOpen] = useState(false);
  const el = useRef<HTMLAudioElement | null>(null);
  const yt = useRef<HTMLIFrameElement>(null);
  const m = musicOf(music);
  const ambience = music?.ambience ?? NO_AMB;
  const track = m.track;
  const playing = !!track && !m.paused;
  const anything = playing || Object.keys(ambience).length > 0;
  const level = listen.muted ? 0 : listen.volume;

  // keep the table connected on every page so the music follows you around the deck
  useEffect(() => {
    if (status === "online" || status === "local") void useVtt.getState().start();
  }, [status, role, handle]);

  useEffect(() => { useListen.persist.rehydrate(); }, []);

  // soundscapes: ambience layers plus an ambient music track
  useEffect(() => {
    const want = new Set<string>();
    if (anything && level > 0) {
      for (const [id, v] of Object.entries(ambience)) { want.add(`amb:${id}`); setLayer(`amb:${id}`, id, v); }
      if (playing && track!.kind === "ambient") { want.add(`music:${track!.src}`); setLayer(`music:${track!.src}`, track!.src, m.volume); }
      if (want.size) { audio(); setLocked(audioLocked()); } // eslint-disable-line react-hooks/set-state-in-effect
    }
    stopLayersExcept(want);
  }, [ambience, playing, track, m.volume, anything, level]);

  useEffect(() => { setMasterVolume(level); if (el.current) el.current.volume = Math.min(1, m.volume * level); }, [level, m.volume]);

  // audio file tracks
  useEffect(() => {
    if (!playing || track!.kind !== "audio" || level === 0) { el.current?.pause(); return; }
    let a = el.current;
    if (!a || a.dataset.src !== track!.src) {
      a?.pause();
      a = new Audio(track!.src);
      a.loop = true;
      a.preload = "auto";
      a.dataset.src = track!.src;
      el.current = a;
    }
    const sync = () => {
      const pos = Math.max(0, (Date.now() - m.startedAt) / 1000);
      if (a!.duration && Number.isFinite(a!.duration)) a!.currentTime = pos % a!.duration;
    };
    a.volume = Math.min(1, m.volume * level);
    if (a.readyState >= 1) sync(); else a.addEventListener("loadedmetadata", sync, { once: true });
    a.play().then(() => setLocked(false)).catch(() => setLocked(true));
  }, [playing, track, m.startedAt, m.volume, level]);

  useEffect(() => () => { el.current?.pause(); }, []);

  // YouTube volume follows the mix once the player is ready
  const ytCommand = (func: string, args: unknown[] = []) => yt.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
  useEffect(() => { ytCommand("setVolume", [Math.round(m.volume * level * 100)]); }, [m.volume, level]);

  const unlock = async () => {
    await unlockAudio();
    if (el.current && playing && track?.kind === "audio") await el.current.play().catch(() => undefined);
    setLocked(audioLocked() && !(el.current && !el.current.paused));
  };

  // any click on the page counts as permission to play
  useEffect(() => {
    if (!locked) return;
    const go = () => void unlock();
    window.addEventListener("pointerdown", go, { once: true });
    window.addEventListener("keydown", go, { once: true });
    return () => { window.removeEventListener("pointerdown", go); window.removeEventListener("keydown", go); };
  }, [locked]); // eslint-disable-line react-hooks/exhaustive-deps

  // the embed starts where the table is right now; it remounts only when the track or start changes
  const audible = level > 0;
  const trackId = track?.id;
  // eslint-disable-next-line react-hooks/purity, react-hooks/exhaustive-deps
  const ytStart = useMemo(() => Math.floor(Math.max(0, (Date.now() - m.startedAt) / 1000)), [trackId, m.startedAt, playing, audible]);
  const ytSrc = playing && track!.kind === "youtube" && level > 0
    ? `https://www.youtube-nocookie.com/embed/${track!.src}?autoplay=1&start=${ytStart}&loop=1&playlist=${track!.src}&controls=0&enablejsapi=1&playsinline=1`
    : null;

  if (!anything) return null;
  return (
    <div className="relative">
      {ytSrc && (
        <iframe key={`${track!.id}-${m.startedAt}`} ref={yt} src={ytSrc} title="Table music" allow="autoplay; encrypted-media"
          className="pointer-events-none fixed -left-[400px] top-0 h-[200px] w-[300px] opacity-0" aria-hidden="true" tabIndex={-1}
          onLoad={() => setTimeout(() => ytCommand("setVolume", [Math.round(m.volume * level * 100)]), 800)} />
      )}
      {locked && level > 0 ? (
        <button className="music-pill locked" onClick={() => void unlock()} title="Your browser waits for a click before playing sound">
          <Icon name="bolt" size={14} /> <span className="max-sm:hidden">Tap to hear the table</span><span className="sm:hidden">Listen</span>
        </button>
      ) : (
        <button className={clsx("music-pill", listen.muted && "muted")} onClick={() => setOpen(!open)} aria-expanded={open} title={describe(m)}>
          <span className={clsx("music-eq", (listen.muted || !anything) && "still")} aria-hidden="true"><i /><i /><i /></span>
          <span className="max-w-[12rem] truncate max-sm:hidden">{describe(m)}</span>
        </button>
      )}
      {open && (
        <div className="vtt-flyout absolute right-0 top-full z-50 mt-1.5 w-64 space-y-2 p-3 text-sm" onPointerLeave={() => setOpen(false)}>
          <div className="text-xs text-faint">{role === "gm" ? "Playing for your table" : "The GM is playing"}</div>
          <div className="font-semibold">{describe(m) || "Nothing"}</div>
          <label className="flex items-center gap-2 text-xs text-dim">Volume for me
            <input type="range" min={0} max={1} step={0.05} value={listen.volume} onChange={(e) => listen.set({ volume: Number(e.target.value), muted: false })} className="flex-1" aria-label="Your volume" />
          </label>
          <button className="btn small w-full" onClick={() => listen.set({ muted: !listen.muted })}>{listen.muted ? "Unmute" : "Mute for me"}</button>
        </div>
      )}
    </div>
  );
}
