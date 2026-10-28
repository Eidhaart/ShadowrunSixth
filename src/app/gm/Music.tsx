"use client";
import { useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { AMBIENT, unlockAudio } from "@/lib/audio/ambient";
import { ambientTrack, describe, musicOf, pauseMusic, playTrack, resumeMusic, setAmbience, setMusicVolume, silenceAll, stopMusic, trackFromUrl } from "@/lib/audio/table";
import { useBinder } from "@/lib/gm/binder";
import { useVtt } from "@/lib/vtt/store";
import type { MusicTrack } from "@/lib/vtt/types";

/** The GM's mixing desk: one music track for the table plus soundscapes layered under it. */
export function MusicDeck({ compact }: { compact?: boolean }) {
  const music = useVtt((s) => s.state?.music);
  const has = useVtt((s) => !!s.state);
  const gm = useVtt((s) => s.me.gm);
  const tracks = useBinder((s) => s.tracks);
  const addTrack = useBinder((s) => s.addTrack);
  const removeTrack = useBinder((s) => s.removeTrack);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const m = musicOf(music);
  const playing = !!m.track && !m.paused;
  const can = has && gm;
  const go = (t: MusicTrack) => { void unlockAudio(); playTrack(t); };

  const add = () => {
    const t = trackFromUrl(url, title);
    if ("error" in t) { setErr(t.error); return; }
    addTrack(t); setUrl(""); setTitle(""); setErr(null);
  };

  if (!has) return <p className="p-3 text-sm text-dim">Connecting to your table…</p>;
  if (!gm) return <p className="p-3 text-sm text-dim">Only the GM controls the table&apos;s sound. Use the speaker in the top bar to set your own volume.</p>;

  return (
    <div className={clsx("space-y-4", compact ? "p-3" : "")}>
      <section className={clsx("music-now flex flex-wrap items-center gap-3 p-3", playing && "on")}>
        <span className={clsx("music-eq", !playing && "still")} aria-hidden="true"><i /><i /><i /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-faint">{playing ? "Playing for the table" : m.track ? "Paused" : Object.keys(m.ambience).length ? "Soundscapes only" : "Silence"}</div>
          <div className="truncate font-display font-semibold">{describe(m) || "Pick something below"}</div>
        </div>
        <div className="flex items-center gap-1">
          {m.track && (playing
            ? <button className="vtt-tool" onClick={pauseMusic} title="Pause" aria-label="Pause"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg></button>
            : <button className="vtt-tool" onClick={() => { void unlockAudio(); resumeMusic(); }} title="Resume" aria-label="Resume"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5l12 7-12 7z" /></svg></button>)}
          {m.track && <button className="vtt-tool" onClick={stopMusic} title="Stop the track" aria-label="Stop"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" /></svg></button>}
          {(m.track || Object.keys(m.ambience).length > 0) && <button className="btn small ghost" onClick={silenceAll}>Silence</button>}
        </div>
        <label className="flex w-full items-center gap-2 text-xs text-dim">Music volume
          <input type="range" min={0} max={1} step={0.05} value={m.volume} onChange={(e) => setMusicVolume(Number(e.target.value))} className="flex-1" disabled={!can} />
        </label>
      </section>

      <section>
        <h3 className="mb-1.5 text-sm font-semibold">Soundscapes</h3>
        <p className="mb-2 text-xs text-faint">Made live in every player&apos;s browser, nothing to upload. Play one as the track, or layer several under it.</p>
        <div className={clsx("grid gap-1.5", compact ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-3")}>
          {AMBIENT.map((a) => {
            const isTrack = m.track?.kind === "ambient" && m.track.src === a.id && !m.paused;
            const layer = m.ambience[a.id];
            return (
              <div key={a.id} className={clsx("music-card p-2.5", (isTrack || layer) && "on")} style={{ ["--hue" as string]: a.hue }}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-sm">{a.name}</b>
                    {!compact && <span className="block text-xs text-dim">{a.blurb}</span>}
                  </div>
                  <button className={clsx("btn small !min-h-0 !px-2 !py-1", isTrack && "primary")} onClick={() => (isTrack ? stopMusic() : go(ambientTrack(a.id)))} title={isTrack ? "Stop" : "Play as the table's track"}>{isTrack ? "Stop" : "Play"}</button>
                  <button className={clsx("btn small !min-h-0 !px-2 !py-1", layer && "primary")} onClick={() => { void unlockAudio(); setAmbience(a.id, layer ? 0 : 0.5); }} title="Layer it under the music">{layer ? "Layered" : "Layer"}</button>
                </div>
                {layer ? (
                  <input type="range" min={0.05} max={1} step={0.05} value={layer} onChange={(e) => setAmbience(a.id, Number(e.target.value))} className="mt-1.5 w-full" aria-label={`${a.name} layer volume`} />
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-1.5 text-sm font-semibold">Your tracks</h3>
        <ul className="space-y-1">
          {tracks.map((t) => {
            const on = m.track?.id === t.id && !m.paused;
            return (
              <li key={t.id} className={clsx("music-card flex items-center gap-2 p-2", on && "on")}>
                <Icon name={t.kind === "youtube" ? "eye" : "spark"} size={14} className="shrink-0 text-faint" />
                <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                <span className="text-[10px] text-faint">{t.kind === "youtube" ? "YouTube" : "Audio"}</span>
                <button className={clsx("btn small !min-h-0 !px-2 !py-1", on && "primary")} onClick={() => (on ? pauseMusic() : go(t))}>{on ? "Pause" : "Play"}</button>
                <button className="btn small ghost !min-h-0 !px-1.5 !py-1" onClick={() => removeTrack(t.id)} aria-label={`Remove ${t.title}`}><Icon name="x" size={12} /></button>
              </li>
            );
          })}
        </ul>
        <form className="mt-2 space-y-1.5" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input className="field" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="YouTube link or https link to an mp3" aria-label="Track link" />
          <div className="flex gap-1.5">
            <input className="field flex-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" aria-label="Track title" />
            <button className="btn small primary" disabled={!url.trim()}><Icon name="plus" size={14} /> Add</button>
          </div>
          {err && <p className="text-xs text-danger">{err}</p>}
          {!compact && <p className="text-xs text-faint">Everyone hears the same moment of the track. YouTube plays through a hidden player; audio links must allow playback from other sites (Dropbox and most hosting links with direct download do).</p>}
        </form>
      </section>
    </div>
  );
}
