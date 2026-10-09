"use client";
import { useId } from "react";

/**
 * Silhouette scenes for the three ways into the Forge. Drawn from simple shapes and coloured with the
 * active palette's variables, so every skin gets matching art.
 */

type Pose = "rifle" | "pistol" | "coat" | "idle";

const BODY = "M-8 -212 L8 -212 L30 -206 C36 -204 38 -200 38 -194 L34 -178 L27 -142 L28 -122 L25 -66 L23 -8 L30 0 L7 0 L6 -10 L5 -66 L1 -112 L-1 -112 L-5 -66 L-6 -10 L-7 0 L-30 0 L-23 -8 L-25 -66 L-28 -122 L-27 -142 L-34 -178 L-38 -194 C-38 -200 -36 -204 -30 -206 Z";
const ARM_L = "M-36 -200 L-44 -152 L-47 -114 L-43 -104 L-37 -108 L-36 -150 L-31 -182 Z";
const ARM_R = "M36 -200 L44 -152 L47 -114 L43 -104 L37 -108 L36 -150 L31 -182 Z";
const COAT = "M-34 -180 L-44 -56 L-14 -66 L0 -112 L14 -66 L44 -56 L34 -180 Z";

/** A standing figure, feet at (x, y), about 250 units tall at s = 1. */
function Figure({ x, y, s = 1, pose = "idle", flip = false, fill }: { x: number; y: number; s?: number; pose?: Pose; flip?: boolean; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} style={{ fill }}>
      {pose === "coat" && <path d={COAT} />}
      <path d={BODY} />
      <circle cx="0" cy="-230" r="15" />
      {pose !== "rifle" && <path d={ARM_L} />}
      {pose === "rifle" ? (
        <>
          <path d="M-31 -204 L-39 -196 L-40 -168 L-30 -158 L-24 -166 L-30 -176 Z" />
          <path d="M33 -202 L41 -194 L30 -170 L18 -172 Z" />
          <path d="M46 -196 L48 -184 L-76 -156 L-78 -168 Z" />
          <path d="M-2 -174 L6 -176 L10 -156 L2 -154 Z" />
          <path d="M8 -186 L26 -191 L28 -185 L10 -180 Z" />
        </>
      ) : pose === "pistol" ? (
        <>
          <path d="M31 -204 L41 -199 L52 -252 L52 -276 L44 -278 L41 -254 Z" />
          <path d="M44 -278 L54 -278 L55 -306 L47 -306 Z" />
          <path d="M53 -284 L58 -284 L58 -276 L53 -276 Z" />
        </>
      ) : (
        <path d={ARM_R} />
      )}
    </g>
  );
}

const STOP = (c: string, o = 1) => ({ stopColor: c, stopOpacity: o });

/** Two runners in front of a neon skyline. */
export function PremadeArt() {
  const id = useId().replace(/:/g, "");
  const towers = [[0, 140, 46], [40, 90, 34], [70, 170, 40], [104, 120, 30], [128, 210, 38], [162, 150, 42], [200, 110, 30], [226, 190, 44], [266, 130, 34]];
  return (
    <svg viewBox="0 0 300 440" className="size-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={STOP("var(--bg)")} />
          <stop offset=".55" style={STOP("var(--accent-2, var(--cyan))", 0.55)} />
          <stop offset=".8" style={STOP("var(--accent)", 0.85)} />
          <stop offset="1" style={STOP("var(--bg)")} />
        </linearGradient>
        <pattern id={`${id}win`} width="8" height="10" patternUnits="userSpaceOnUse">
          <rect x="2" y="2" width="3" height="4" style={{ fill: "var(--accent-3, var(--accent))", opacity: 0.55 }} />
        </pattern>
        <radialGradient id={`${id}sun`}>
          <stop offset="0" style={STOP("var(--accent)", 0.9)} />
          <stop offset="1" style={STOP("var(--accent)", 0)} />
        </radialGradient>
      </defs>
      <rect width="300" height="440" fill={`url(#${id}sky)`} />
      <circle cx="210" cy="250" r="120" fill={`url(#${id}sun)`} />
      {towers.map(([x, h, w], i) => (
        <g key={i}>
          <rect x={x} y={330 - h} width={w} height={h + 20} style={{ fill: "var(--panel)" }} />
          <rect x={x + 3} y={334 - h} width={w - 6} height={h - 10} fill={`url(#${id}win)`} />
        </g>
      ))}
      {/* low car */}
      <path d="M150 352 L170 334 L232 330 L262 342 L290 346 L292 362 L150 364 Z" style={{ fill: "var(--bg-2)" }} />
      <path d="M176 336 L228 333 L244 341 L172 344 Z" style={{ fill: "var(--accent-2, var(--cyan))", opacity: 0.5 }} />
      <rect x="0" y="360" width="300" height="80" style={{ fill: "var(--bg)" }} />
      <line x1="0" y1="360" x2="300" y2="360" style={{ stroke: "var(--accent)", strokeWidth: 2, opacity: 0.8 }} />
      <Figure x={112} y={408} s={1.08} pose="rifle" fill="var(--bg)" />
      <Figure x={214} y={414} s={0.94} pose="pistol" fill="var(--bg)" />
    </svg>
  );
}

/** A blueprint figure with measurements: the numbers are already there. */
export function TemplateArt() {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 300 440" className="size-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <pattern id={`${id}grid`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" style={{ stroke: "var(--accent-2, var(--cyan))", strokeWidth: 0.6, opacity: 0.35 }} />
        </pattern>
        <clipPath id={`${id}half`}><rect x="150" y="0" width="150" height="440" /></clipPath>
      </defs>
      <rect width="300" height="440" style={{ fill: "var(--bg-2)" }} />
      <rect width="300" height="440" fill={`url(#${id}grid)`} />
      <g style={{ fill: "none", stroke: "var(--accent-2, var(--cyan))", strokeWidth: 1.6 }}>
        <Figure x={150} y={392} s={1.15} pose="idle" fill="none" />
      </g>
      <g clipPath={`url(#${id}half)`}><Figure x={150} y={392} s={1.15} pose="idle" fill="var(--accent)" /></g>
      {/* dimension lines */}
      <g style={{ stroke: "var(--accent-3, var(--accent))", strokeWidth: 1, fill: "none" }}>
        <path d="M44 104 V392 M38 104 H50 M38 392 H50" />
        <path d="M96 420 H204 M96 414 V426 M204 414 V426" />
        <path d="M210 150 L250 120 H290" />
        <path d="M200 270 L240 250 H290" />
        <path d="M100 210 L60 190 H12" />
      </g>
      <g style={{ fill: "var(--accent-3, var(--accent))", fontFamily: "var(--font-mono)", fontSize: 11 }}>
        <text x="254" y="114">BOD 5</text>
        <text x="254" y="244">AGI 6</text>
        <text x="14" y="184">LOG 3</text>
        <text x="48" y="250" transform="rotate(-90 48 250)">EDGE 4</text>
        <text x="132" y="438">A · B · C · D · E</text>
      </g>
    </svg>
  );
}

/** An empty outline over a hologram projector: nothing decided yet. */
export function BlankArt() {
  const id = useId().replace(/:/g, "");
  const motes = [[96, 300, 2], [206, 286, 1.6], [120, 230, 1.3], [196, 210, 2], [84, 170, 1.2], [226, 150, 1.5], [110, 120, 1.1], [190, 96, 1.4], [150, 70, 1.2], [70, 250, 1.6], [236, 250, 1.1]];
  return (
    <svg viewBox="0 0 300 440" className="size-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}beam`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" style={STOP("var(--accent-2, var(--cyan))", 0.45)} />
          <stop offset="1" style={STOP("var(--accent-2, var(--cyan))", 0)} />
        </linearGradient>
        <radialGradient id={`${id}pad`} cx=".5" cy=".5" r=".5">
          <stop offset="0" style={STOP("var(--accent)", 0.8)} />
          <stop offset="1" style={STOP("var(--accent)", 0)} />
        </radialGradient>
        <pattern id={`${id}scan`} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="1.2" style={{ fill: "var(--accent-2, var(--cyan))", opacity: 0.18 }} />
        </pattern>
      </defs>
      <rect width="300" height="440" style={{ fill: "var(--bg)" }} />
      <path d="M78 368 L118 60 H182 L222 368 Z" fill={`url(#${id}beam)`} />
      <path d="M78 368 L118 60 H182 L222 368 Z" fill={`url(#${id}scan)`} />
      <g style={{ fill: "none", stroke: "var(--accent-2, var(--cyan))", strokeWidth: 1.6, strokeDasharray: "6 4" }}>
        <Figure x={150} y={360} s={1.12} pose="idle" fill="none" />
      </g>
      {motes.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} style={{ fill: i % 3 ? "var(--accent-2, var(--cyan))" : "var(--accent-3, var(--accent))" }} />)}
      <ellipse cx="150" cy="372" rx="96" ry="22" fill={`url(#${id}pad)`} />
      <ellipse cx="150" cy="372" rx="74" ry="13" style={{ fill: "var(--panel-hi)", stroke: "var(--accent)", strokeWidth: 2 }} />
      <ellipse cx="150" cy="370" rx="44" ry="6" style={{ fill: "none", stroke: "var(--accent-2, var(--cyan))", strokeWidth: 1.2, strokeDasharray: "3 4" }} />
      <rect x="0" y="392" width="300" height="48" style={{ fill: "var(--bg)" }} />
    </svg>
  );
}

/** Small line icons for archetypes. */
export function ArchetypeIcon({ id, size = 22 }: { id: string; size?: number }) {
  const d: Record<string, string> = {
    samurai: "M12 3v4M12 17v4M3 12h4M17 12h4M12 8a4 4 0 100 8 4 4 0 000-8z",
    decker: "M4 6h16v10H4zM8 20h8M12 16v4M7 10l2 2-2 2M11 14h4",
    mage: "M12 2l2.4 6.6L21 9l-5 4.4L17.6 21 12 17.3 6.4 21 8 13.4 3 9l6.6-.4z",
    shaman: "M15 4a8 8 0 100 16 6.5 6.5 0 010-16z",
    face: "M4 7c3-2 13-2 16 0 0 8-4 12-8 12S4 15 4 7zM8 11h2M14 11h2M9 15c2 1.300 4 1.300 6 0",
    technomancer: "M2 12c2.500-5 5-5 7.500 0s5 5 7.500 0S22 7 22 12M2 17c2.500-5 5-5 7.500 0",
    rigger: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 9a3 3 0 100 6 3 3 0 000-6zM12 3v6M4.300 16.500l5.200-3M19.700 16.500l-5.200-3",
    adept: "M8 11V5a1.500 1.500 0 013 0v5M11 10V4a1.500 1.500 0 013 0v6M14 10V5.500a1.500 1.500 0 013 0V14a7 7 0 01-7 7 6 6 0 01-5.200-3L3 14.500a1.500 1.500 0 012.500-1.700L8 15",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d[id] ?? d.samurai} />
    </svg>
  );
}

/** Head-and-shoulders silhouette for runners without a portrait, lit in the palette's colours. */
export function Bust({ seed, className }: { seed: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  const n = [...seed].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const hair = ["M22 22 Q32 6 42 22", "M21 24 Q22 10 32 10 Q44 10 43 24 L43 18 Q32 2 21 18 Z", "M24 14 L28 6 L32 13 L36 5 L40 14", "M20 26 Q20 8 32 8 Q44 8 44 26 L46 40 L40 30 Q32 14 24 30 L18 40 Z"][n % 4];
  return (
    <svg viewBox="0 0 64 80" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={STOP("var(--accent-2, var(--cyan))", 0.55)} />
          <stop offset="1" style={STOP("var(--accent)", 0.75)} />
        </linearGradient>
      </defs>
      <rect width="64" height="80" fill={`url(#${id}b)`} />
      <g style={{ fill: "var(--bg)" }}>
        <path d="M6 80 Q8 56 22 52 L27 46 L37 46 L42 52 Q56 56 58 80 Z" />
        <rect x="27" y="38" width="10" height="12" />
        <ellipse cx="32" cy="28" rx="11" ry="13" />
        <path d={hair} style={{ fill: n % 2 ? "var(--bg)" : "none", stroke: "var(--bg)", strokeWidth: 3 }} />
      </g>
      <rect x="22" y="25" width="20" height="3" style={{ fill: "var(--accent-3, var(--accent))", opacity: n % 3 === 0 ? 0.9 : 0 }} />
    </svg>
  );
}
