"use client";
import { useSettings } from "@/lib/store/settings";

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function enabled() {
  return useSettings.getState().sound;
}

function noiseBurst(c: AudioContext, at: number, dur: number, freq: number, gain: number) {
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = 1.2;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(c.destination);
  src.start(at);
}

/** A handful of plastic clacks, one per die up to a cap. */
export function sfxRoll(dice: number) {
  if (!enabled()) return;
  const c = ac();
  if (!c) return;
  const n = Math.min(10, Math.max(2, Math.round(dice / 2)));
  for (let i = 0; i < n; i++) noiseBurst(c, c.currentTime + i * 0.045 + Math.random() * 0.03, 0.06, 1400 + Math.random() * 1800, 0.18);
}

function tone(c: AudioContext, at: number, freq: number, dur: number, type: OscillatorType, gain: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

export function sfxResult(kind: "hit" | "miss" | "glitch" | "crit") {
  if (!enabled()) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime + 0.35;
  if (kind === "hit") { tone(c, t, 660, 0.12, "triangle", 0.12); tone(c, t + 0.09, 990, 0.18, "triangle", 0.1); }
  else if (kind === "miss") tone(c, t, 220, 0.2, "triangle", 0.1);
  else if (kind === "glitch") { tone(c, t, 180, 0.2, "sawtooth", 0.08); tone(c, t + 0.05, 150, 0.25, "square", 0.05); }
  else { tone(c, t, 120, 0.5, "sawtooth", 0.12); tone(c, t + 0.1, 90, 0.5, "square", 0.08); }
}

export function sfxBlip() {
  if (!enabled()) return;
  const c = ac();
  if (!c) return;
  tone(c, c.currentTime, 880, 0.05, "square", 0.04);
}
