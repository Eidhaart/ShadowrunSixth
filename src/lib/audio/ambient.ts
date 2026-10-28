"use client";
/**
 * Ambient soundscapes made on the spot with Web Audio: no files to host, nothing to download, and
 * every player's browser builds the same mood from the same recipe. Each preset wires noise,
 * oscillators and a small step sequencer into one output and returns a function that stops it.
 */

export interface AmbientPreset {
  id: string;
  name: string;
  blurb: string;
  /** Accent color for its card. */
  hue: string;
  build: (ctx: AudioContext, out: AudioNode) => () => void;
}

// ───────────────────────── building blocks ─────────────────────────

const buffers = new WeakMap<AudioContext, Record<string, AudioBuffer>>();

function noise(ctx: AudioContext, kind: "white" | "pink" | "brown"): AudioBuffer {
  const cache = buffers.get(ctx) ?? {};
  buffers.set(ctx, cache);
  if (cache[kind]) return cache[kind];
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === "white") d[i] = w * 0.5;
      else if (kind === "pink") {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
  }
  cache[kind] = buf;
  return buf;
}

function loopNoise(ctx: AudioContext, kind: "white" | "pink" | "brown") {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx, kind);
  src.loop = true;
  src.loopStart = Math.random();
  src.start(ctx.currentTime, Math.random() * 3);
  return src;
}

function filter(ctx: AudioContext, type: BiquadFilterType, freq: number, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  return f;
}

function gain(ctx: AudioContext, v: number) { const g = ctx.createGain(); g.gain.value = v; return g; }

/** A slow wobble on any parameter. */
function lfo(ctx: AudioContext, rate: number, depth: number, target: AudioParam, type: OscillatorType = "sine") {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = rate;
  const g = gain(ctx, depth); o.connect(g); g.connect(target); o.start();
  return o;
}

/** A feedback delay used as a cheap room or echo. */
function echo(ctx: AudioContext, time: number, fb: number, wet: number, out: AudioNode) {
  const input = gain(ctx, 1), d = ctx.createDelay(2), f = gain(ctx, fb), w = gain(ctx, wet), lp = filter(ctx, "lowpass", 3500);
  d.delayTime.value = time;
  input.connect(d); d.connect(lp); lp.connect(f); f.connect(d); lp.connect(w); w.connect(out); input.connect(out);
  return input;
}

/** Look-ahead scheduler: calls fn with the exact audio time of each step. */
function steps(ctx: AudioContext, stepSec: number, fn: (t: number, i: number) => void) {
  let next = ctx.currentTime + 0.1, i = 0;
  const id = setInterval(() => {
    while (next < ctx.currentTime + 0.25) { fn(next, i++); next += stepSec; }
  }, 40);
  return () => clearInterval(id);
}

/** Random events, roughly every min..max seconds. */
function sometimes(ctx: AudioContext, min: number, max: number, fn: (t: number) => void) {
  let timer: ReturnType<typeof setTimeout>;
  const go = () => { fn(ctx.currentTime + 0.05); timer = setTimeout(go, (min + Math.random() * (max - min)) * 1000); };
  timer = setTimeout(go, (min * 0.3 + Math.random() * min) * 1000);
  return () => clearTimeout(timer);
}

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(ctx: AudioContext, out: AudioNode, t: number, o: { type?: OscillatorType; f: number; f2?: number; peak: number; attack?: number; decay: number; slide?: number }) {
  const osc = ctx.createOscillator(); osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.slide ?? o.decay));
  const g = gain(ctx, 0); osc.connect(g); g.connect(out);
  env(g, t, o.peak, o.attack ?? 0.005, o.decay);
  osc.start(t); osc.stop(t + (o.attack ?? 0.005) + o.decay + 0.05);
}

function burst(ctx: AudioContext, out: AudioNode, t: number, o: { type: BiquadFilterType; f: number; q?: number; peak: number; decay: number; kind?: "white" | "pink" }) {
  const src = ctx.createBufferSource(); src.buffer = noise(ctx, o.kind ?? "white");
  const f = filter(ctx, o.type, o.f, o.q ?? 1), g = gain(ctx, 0);
  src.connect(f); f.connect(g); g.connect(out);
  env(g, t, o.peak, 0.002, o.decay);
  src.start(t, Math.random() * 3); src.stop(t + o.decay + 0.05);
}

const stopAll = (things: (AudioScheduledSourceNode | (() => void))[]) => () => {
  for (const x of things) { try { if (typeof x === "function") x(); else x.stop(); } catch { /* already stopped */ } }
};

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

// ───────────────────────── the soundscapes ─────────────────────────

export const AMBIENT: AmbientPreset[] = [
  {
    id: "rain", name: "Rain on neon", blurb: "Steady acid rain, gutters and a far storm.", hue: "#1fe3f0",
    build: (ctx, out) => {
      const rain = loopNoise(ctx, "pink"), hp = filter(ctx, "highpass", 500), lp = filter(ctx, "lowpass", 7000), g = gain(ctx, 0.55);
      rain.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out);
      const sw = lfo(ctx, 0.07, 0.12, g.gain);
      const drips = sometimes(ctx, 0.04, 0.35, (t) => burst(ctx, out, t, { type: "bandpass", f: 1800 + Math.random() * 3500, q: 8, peak: 0.04 + Math.random() * 0.05, decay: 0.03 }));
      const thunder = sometimes(ctx, 25, 60, (t) => {
        const src = ctx.createBufferSource(); src.buffer = noise(ctx, "brown");
        const f = filter(ctx, "lowpass", 140), gg = gain(ctx, 0);
        src.connect(f); f.connect(gg); gg.connect(out);
        gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.9, t + 0.6); gg.gain.exponentialRampToValueAtTime(0.0001, t + 6);
        src.start(t); src.stop(t + 6.2);
      });
      return stopAll([rain, sw, drips, thunder]);
    },
  },
  {
    id: "sprawl", name: "Sprawl at night", blurb: "Traffic hum, power lines, a siren somewhere.", hue: "#ffae3d",
    build: (ctx, out) => {
      const hum = loopNoise(ctx, "brown"), lp = filter(ctx, "lowpass", 320), g = gain(ctx, 0.5);
      hum.connect(lp); lp.connect(g); g.connect(out);
      const traffic = loopNoise(ctx, "pink"), bp = filter(ctx, "bandpass", 700, 0.6), tg = gain(ctx, 0.08);
      traffic.connect(bp); bp.connect(tg); tg.connect(out);
      const sw = lfo(ctx, 0.05, 0.07, tg.gain);
      const mains = ctx.createOscillator(); mains.frequency.value = 60; const mg = gain(ctx, 0.025); mains.connect(mg); mg.connect(out); mains.start();
      const siren = sometimes(ctx, 35, 80, (t) => {
        const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = 850;
        const wob = lfo(ctx, 0.6, 180, o.frequency, "triangle");
        const f = filter(ctx, "lowpass", 1500), gg = gain(ctx, 0);
        o.connect(f); f.connect(gg); gg.connect(out);
        gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.025, t + 4); gg.gain.exponentialRampToValueAtTime(0.0001, t + 11);
        o.start(t); o.stop(t + 11.2); wob.stop(t + 11.2);
      });
      return stopAll([hum, traffic, sw, mains, siren]);
    },
  },
  {
    id: "barrens", name: "Barrens wind", blurb: "Wind through broken concrete and loose sheet metal.", hue: "#c8a27a",
    build: (ctx, out) => {
      const w = loopNoise(ctx, "white"), bp = filter(ctx, "bandpass", 500, 1.6), g = gain(ctx, 0.9);
      w.connect(bp); bp.connect(g); g.connect(out);
      const sweep = lfo(ctx, 0.09, 350, bp.frequency);
      const gust = lfo(ctx, 0.13, 0.4, g.gain);
      const rattle = sometimes(ctx, 6, 18, (t) => { for (let k = 0; k < 4; k++) burst(ctx, out, t + k * 0.07, { type: "bandpass", f: 2600, q: 3, peak: 0.05, decay: 0.05 }); });
      return stopAll([w, sweep, gust, rattle]);
    },
  },
  {
    id: "matrix", name: "Matrix hum", blurb: "Resonant data hum and passing packets. For hosts and hacking.", hue: "#22f59a",
    build: (ctx, out) => {
      const room = echo(ctx, 0.36, 0.45, 0.35, out);
      const pad = [110, 110.7, 164.8].map((f) => { const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f; const g = gain(ctx, 0.05); o.connect(g); g.connect(out); o.start(); return o; });
      const scale = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79];
      const seq = steps(ctx, 0.2, (t) => {
        if (Math.random() < 0.38) tone(ctx, room, t, { type: Math.random() < 0.5 ? "square" : "triangle", f: midi(scale[Math.floor(Math.random() * scale.length)]), peak: 0.025, decay: 0.12 });
      });
      return stopAll([...pad, seq]);
    },
  },
  {
    id: "club", name: "Underground club", blurb: "Four to the floor through a concrete wall. 124 bpm.", hue: "#ff3b5c",
    build: (ctx, out) => {
      const wall = filter(ctx, "lowpass", 2400); const g = gain(ctx, 0.35); wall.connect(g); g.connect(out);
      const bass = [36, 36, 39, 36, 43, 36, 41, 39];
      const s16 = 60 / 124 / 4;
      const seq = steps(ctx, s16, (t, i) => {
        const p = i % 16;
        if (p % 4 === 0) tone(ctx, wall, t, { f: 150, f2: 42, peak: 0.9, decay: 0.28, slide: 0.12 });
        if (p % 4 === 2) burst(ctx, wall, t, { type: "highpass", f: 7000, peak: 0.12, decay: 0.05 });
        if (p === 4 || p === 12) burst(ctx, wall, t, { type: "bandpass", f: 1900, q: 0.8, peak: 0.18, decay: 0.12, kind: "pink" });
        if (p % 2 === 0) tone(ctx, wall, t, { type: "sawtooth", f: midi(bass[(p / 2) % 8]), peak: 0.12, decay: s16 * 1.6 });
      });
      return stopAll([seq]);
    },
  },
  {
    id: "tension", name: "Tension", blurb: "Low drone and a heartbeat. Before the door goes in.", hue: "#c39bff",
    build: (ctx, out) => {
      const lp = filter(ctx, "lowpass", 220, 2); const g = gain(ctx, 0.18); lp.connect(g); g.connect(out);
      const drones = [55, 55.35, 82.4].map((f) => { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.connect(lp); o.start(); return o; });
      const sweep = lfo(ctx, 0.04, 120, lp.frequency);
      const beat = steps(ctx, 60 / 68, (t) => {
        tone(ctx, out, t, { f: 70, f2: 38, peak: 0.55, decay: 0.22 });
        tone(ctx, out, t + 0.24, { f: 60, f2: 34, peak: 0.35, decay: 0.2 });
      });
      const room = echo(ctx, 0.5, 0.55, 0.5, out);
      const ping = sometimes(ctx, 9, 22, (t) => tone(ctx, room, t, { f: 1760 + Math.random() * 400, peak: 0.03, decay: 1.6 }));
      return stopAll([...drones, sweep, beat, ping]);
    },
  },
  {
    id: "firefight", name: "Firefight", blurb: "Driving drums and a distorted pulse. 140 bpm.", hue: "#ff6a2b",
    build: (ctx, out) => {
      const shaper = ctx.createWaveShaper();
      const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = (i / 512) - 1; curve[i] = Math.tanh(x * 4); }
      shaper.curve = curve;
      const bassLp = filter(ctx, "lowpass", 380); const bg = gain(ctx, 0.14); shaper.connect(bassLp); bassLp.connect(bg); bg.connect(out);
      const s16 = 60 / 140 / 4;
      const toms = [0, 3, 6, 10, 12, 14];
      const seq = steps(ctx, s16, (t, i) => {
        const p = i % 16;
        if (p === 0 || p === 8 || p === 11) tone(ctx, out, t, { f: 130, f2: 45, peak: 0.8, decay: 0.25, slide: 0.1 });
        if (p === 4 || p === 12) { burst(ctx, out, t, { type: "bandpass", f: 1800, q: 0.7, peak: 0.3, decay: 0.14 }); tone(ctx, out, t, { f: 210, peak: 0.12, decay: 0.08 }); }
        if (toms.includes(p) && i % 64 >= 48) tone(ctx, out, t, { f: 180 - p * 6, f2: 90, peak: 0.35, decay: 0.18 });
        if (p % 2 === 0) tone(ctx, shaper, t, { type: "square", f: midi(p % 8 === 6 ? 31 : 28), peak: 0.6, decay: s16 * 1.4 });
        burst(ctx, out, t, { type: "highpass", f: 9000, peak: p % 4 === 2 ? 0.06 : 0.025, decay: 0.03 });
      });
      return stopAll([seq]);
    },
  },
  {
    id: "astral", name: "Astral plane", blurb: "Shimmering, slow and strange. For spirits and the astral.", hue: "#7ab8ff",
    build: (ctx, out) => {
      const room = echo(ctx, 0.62, 0.62, 0.6, out);
      const chord = [57, 64, 67, 71, 74].map((n, k) => {
        const o = ctx.createOscillator(); o.type = k % 2 ? "triangle" : "sine"; o.frequency.value = midi(n);
        const g = gain(ctx, 0.022); o.connect(g); g.connect(room); o.start();
        const v = lfo(ctx, 0.1 + k * 0.03, 2.5, o.frequency); const a = lfo(ctx, 0.05 + k * 0.02, 0.015, g.gain);
        return [o, v, a];
      }).flat();
      const wash = loopNoise(ctx, "pink"), hp = filter(ctx, "highpass", 3000), wg = gain(ctx, 0.03);
      wash.connect(hp); hp.connect(wg); wg.connect(room);
      const bells = sometimes(ctx, 3, 9, (t) => tone(ctx, room, t, { f: midi([81, 83, 86, 88, 91][Math.floor(Math.random() * 5)]), peak: 0.03, attack: 0.02, decay: 2.5 }));
      return stopAll([...chord, wash, bells]);
    },
  },
  {
    id: "lobby", name: "Corp lobby", blurb: "Polished marble, soft synth and a reception chime.", hue: "#e9e5da",
    build: (ctx, out) => {
      const room = echo(ctx, 0.42, 0.4, 0.4, out);
      const lp = filter(ctx, "lowpass", 1400); lp.connect(room);
      const chords = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]];
      const seq = steps(ctx, 4, (t, i) => {
        for (const n of chords[i % 4]) tone(ctx, lp, t, { type: "triangle", f: midi(n), peak: 0.09, attack: 1.2, decay: 3 });
      });
      const chime = sometimes(ctx, 20, 45, (t) => { tone(ctx, room, t, { f: midi(84), peak: 0.05, decay: 1.4 }); tone(ctx, room, t + 0.35, { f: midi(79), peak: 0.05, decay: 1.6 }); });
      const air = loopNoise(ctx, "pink"), al = filter(ctx, "lowpass", 600), ag = gain(ctx, 0.1);
      air.connect(al); al.connect(ag); ag.connect(out);
      return stopAll([seq, chime, air]);
    },
  },
];

export const AMBIENT_BY_ID: Record<string, AmbientPreset> = Object.fromEntries(AMBIENT.map((a) => [a.id, a]));

// ───────────────────────── the engine ─────────────────────────

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const layers = new Map<string, { g: GainNode; stop: () => void; vol: number }>();

export function audio(): { ctx: AudioContext; master: GainNode } | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
  }
  return { ctx, master: master! };
}

/** Browsers only start sound after a click or key press on the page. */
export const audioLocked = () => !ctx || ctx.state !== "running";
export async function unlockAudio() { const a = audio(); if (a && a.ctx.state !== "running") await a.ctx.resume().catch(() => undefined); return !audioLocked(); }

export function setMasterVolume(v: number) {
  const a = audio(); if (!a) return;
  a.master.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), a.ctx.currentTime, 0.1);
}

/** Start, fade or stop one soundscape layer. Key lets the same preset run as music and ambience. */
export function setLayer(key: string, presetId: string, vol: number) {
  const a = audio(); if (!a) return;
  const cur = layers.get(key);
  const t = a.ctx.currentTime;
  if (vol <= 0) {
    if (!cur) return;
    cur.g.gain.setTargetAtTime(0, t, 0.5);
    const stop = cur.stop;
    layers.delete(key);
    setTimeout(() => { stop(); cur.g.disconnect(); }, 2500);
    return;
  }
  if (cur) { cur.g.gain.setTargetAtTime(vol, t, 0.3); cur.vol = vol; return; }
  const p = AMBIENT_BY_ID[presetId]; if (!p) return;
  const g = a.ctx.createGain(); g.gain.value = 0; g.connect(a.master);
  const stop = p.build(a.ctx, g);
  g.gain.setTargetAtTime(vol, t, 0.8);
  layers.set(key, { g, stop, vol });
}

export const activeLayers = () => [...layers.keys()];
export function stopLayersExcept(keep: Set<string>) { for (const k of [...layers.keys()]) if (!keep.has(k)) setLayer(k, "", 0); }
