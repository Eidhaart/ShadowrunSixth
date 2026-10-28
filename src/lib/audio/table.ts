"use client";
import { useVtt } from "@/lib/vtt/store";
import type { MusicState, MusicTrack } from "@/lib/vtt/types";
import { AMBIENT_BY_ID } from "./ambient";

/** GM controls for the table's sound. Every change goes into the table state, so players follow. */

export const EMPTY_MUSIC: MusicState = { track: null, startedAt: 0, paused: true, pos: 0, volume: 0.8, ambience: {} };
export const musicOf = (m: MusicState | null | undefined): MusicState => ({ ...EMPTY_MUSIC, ...(m ?? {}), ambience: m?.ambience ?? {} });

const put = (v: Partial<MusicState>) => {
  const { state, dispatch } = useVtt.getState();
  if (!state) return false;
  dispatch([{ k: "set", p: ["music"], v: { ...musicOf(state.music), ...v } }]);
  return true;
};
const cur = () => musicOf(useVtt.getState().state?.music);

export const playTrack = (track: MusicTrack) => put({ track, startedAt: Date.now(), paused: false, pos: 0 });
export const pauseMusic = () => { const m = cur(); if (m.track && !m.paused) put({ paused: true, pos: (Date.now() - m.startedAt) / 1000 }); };
export const resumeMusic = () => { const m = cur(); if (m.track && m.paused) put({ paused: false, startedAt: Date.now() - m.pos * 1000 }); };
export const stopMusic = () => put({ track: null, paused: true, pos: 0 });
export const setMusicVolume = (volume: number) => put({ volume: Math.max(0, Math.min(1, volume)) });
export const setAmbience = (id: string, vol: number) => {
  const amb = { ...cur().ambience };
  if (vol <= 0) delete amb[id]; else amb[id] = Math.max(0, Math.min(1, vol));
  return put({ ambience: amb });
};
export const silenceAll = () => put({ track: null, paused: true, pos: 0, ambience: {} });

/** "https://youtu.be/abc", "youtube.com/watch?v=abc", "/shorts/abc" → "abc". */
export function youtubeId(url: string): string | null {
  const m = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/.exec(url.trim());
  return m ? m[1] : /^[\w-]{11}$/.test(url.trim()) ? url.trim() : null;
}

/** Turn whatever the GM pasted into a track, or explain why not. */
export function trackFromUrl(url: string, title?: string): MusicTrack | { error: string } {
  const u = url.trim();
  const id = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const yt = youtubeId(u);
  if (yt) return { id, kind: "youtube", src: yt, title: title?.trim() || "YouTube track" };
  if (/^https:\/\/\S+$/i.test(u)) return { id, kind: "audio", src: u, title: title?.trim() || decodeURIComponent(u.split("/").pop()?.split("?")[0] ?? "Track") };
  if (/^http:\/\//i.test(u)) return { error: "Use an https link; browsers block plain http audio on a secure page." };
  return { error: "Paste a YouTube link or a direct https link to an audio file (mp3, ogg, m4a)." };
}

export const ambientTrack = (presetId: string): MusicTrack => ({ id: `amb-${presetId}`, kind: "ambient", src: presetId, title: AMBIENT_BY_ID[presetId]?.name ?? presetId });

export function describe(m: MusicState): string {
  const amb = Object.keys(m.ambience).map((id) => AMBIENT_BY_ID[id]?.name ?? id);
  const parts = [m.track && !m.paused ? m.track.title : m.track ? `${m.track.title} (paused)` : null, ...amb].filter(Boolean);
  return parts.join(" + ");
}
