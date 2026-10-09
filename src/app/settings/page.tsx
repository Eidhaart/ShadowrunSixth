"use client";
import clsx from "clsx";
import { Page } from "@/components/Page";
import { Icon } from "@/components/Icon";
import { ACCENT_PRESETS, useSettings } from "@/lib/store/settings";
import { useRulebook } from "@/lib/store/rulebook";
import { sfxBlip } from "@/lib/sound";
import {
  FONTS, GLYPHS, HEADS, MOTIFS, ORNAMENTS, PACKS, THEMES, THEME_GROUPS, VOICES, fontVars, packMatches,
  type OrnamentId, type PackDef, type PackSettings,
} from "@/lib/style/catalog";

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-sm"><span>{label}</span><span className="num text-dim">{fmt ? fmt(value) : value}</span></span>
      <input type="range" className="w-full accent-[var(--accent)]" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; name: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <div className="mb-1 text-sm">{label}</div>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o.id} role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)} className={clsx("chip min-h-9", value === o.id && "on")}>{o.name}</button>
        ))}
      </div>
    </div>
  );
}

function Section({ id, title, lead, children, right }: { id: string; title: string; lead?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section id={id} className="panel scroll-mt-28 p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {lead && <p className="mt-0.5 text-sm text-dim">{lead}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

const glyphText = (g: string) => (g ? `${g}︎` : "");
const textGlyph = { fontVariantEmoji: "text" } as React.CSSProperties;

/** A card that carries its own palette and fonts, so it previews the pack before you pick it. */
function PackCard({ p, on, onPick }: { p: PackDef; on: boolean; onPick: () => void }) {
  const fv = fontVars(p.s.font, p.s.theme);
  const style = { "--ff-display": fv.display, "--ff-sans": fv.body, fontFamily: "var(--ff-sans)" } as React.CSSProperties;
  return (
    <button
      data-theme={p.s.theme}
      onClick={onPick}
      aria-pressed={on}
      style={style}
      className={clsx("group relative flex flex-col overflow-hidden border-2 bg-bg p-3 text-left text-fg transition-transform hover:-translate-y-0.5", on ? "border-accent" : "border-line hover:border-linehi")}
    >
      <span className="motif mini" data-m={p.s.backdrop} aria-hidden="true" />
      <span className="relative z-[1] block border border-line bg-panel">
        <span className="flex items-center gap-1.5 border-b border-line px-2.5 py-1.5 text-sm" style={{ fontFamily: "var(--ff-display)", backgroundImage: "linear-gradient(90deg, color-mix(in oklab, var(--head-tint, transparent) 22%, transparent), transparent 75%)" }}>
          {p.s.glyph && <span className="text-[color:var(--accent-2,var(--accent))]" style={textGlyph}>{glyphText(p.s.glyph)}</span>}
          <span className="min-w-0 flex-1 truncate">Condition</span>
          <span className="num whitespace-nowrap text-xs text-[color:var(--num,var(--fg))] max-sm:hidden">9 / 10</span>
        </span>
        <span className="flex items-center gap-1.5 px-2.5 py-2">
          <span className="h-3 w-6 bg-accent" />
          <span className="h-3 w-4 bg-[var(--accent-2,var(--cyan))]" />
          <span className="h-3 w-3 bg-[var(--accent-3,var(--astral))]" />
          <span className="ml-auto inline-flex h-6 items-center whitespace-nowrap bg-accent px-2 text-[11px] font-semibold text-accentink" style={{ fontFamily: "var(--ff-display)" }}>Roll</span>
        </span>
      </span>
      <span className="relative z-[1] mt-2.5 block text-lg font-bold leading-tight" style={{ fontFamily: "var(--ff-display)", color: "var(--title, var(--fg))" }}>{p.name}</span>
      <span className="relative z-[1] block text-xs text-dim">{p.blurb}</span>
      {on && <span className="absolute right-2 top-2 z-[1] grid size-6 place-items-center bg-accent text-accentink"><Icon name="check" size={14} /></span>}
    </button>
  );
}

/** Small drawings of each panel ornament. */
function OrnamentIcon({ id }: { id: OrnamentId }) {
  const a = "var(--accent)", b = "var(--accent-2, var(--accent))", c = "var(--accent-3, var(--accent))";
  return (
    <svg viewBox="0 0 64 40" className="h-9 w-14" aria-hidden="true">
      <rect x="6" y="6" width="52" height="28" fill="var(--panel)" stroke="var(--line-hi)" strokeWidth={id === "rivets" ? 2 : 1} />
      {id === "brackets" && <path d="M6 13V6h7M58 27v7h-7" fill="none" stroke={a} strokeWidth="2" />}
      {id === "tape" && <><rect x="9" y="2" width="16" height="6" fill={c} opacity=".7" transform="rotate(-6 17 5)" /><rect x="40" y="2" width="16" height="6" fill={b} opacity=".7" transform="rotate(5 48 5)" /></>}
      {id === "rivets" && [[10, 10], [54, 10], [10, 30], [54, 30]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" fill={a} />)}
      {id === "seal" && <rect x="51" y="27" width="10" height="10" fill={a} transform="rotate(6 56 32)" />}
      {id === "filigree" && <><rect x="9" y="9" width="46" height="22" fill="none" stroke={a} strokeOpacity=".5" /><rect x="3" y="3" width="6" height="6" fill={a} transform="rotate(45 6 6)" /><rect x="55" y="31" width="6" height="6" fill={a} transform="rotate(45 58 34)" /></>}
      {id === "stitch" && <><rect x="10" y="10" width="44" height="20" fill="none" stroke={a} strokeDasharray="2 2" /><circle cx="14" cy="14" r="1.6" fill={b} /><circle cx="19" cy="14" r="1.6" fill={c} /></>}
      {id === "traces" && <><rect x="12" y="5" width="14" height="2.5" fill={a} /><rect x="29" y="5" width="9" height="2.5" fill={b} /><rect x="40" y="32.5" width="14" height="2.5" fill={a} /></>}
      {id === "hazard" && <><rect x="6" y="5" width="52" height="2" fill={b} /><path d="M44 7h4l-6 7h-4zM50 7h4l-6 7h-4zM56 7h2v2l-4 5h-4z" fill={a} /><line x1="6" y1="14" x2="58" y2="14" stroke="var(--line-hi)" /></>}
      {id === "frame" && <><rect x="9" y="9" width="46" height="22" fill="none" stroke={a} strokeOpacity=".35" /><rect x="6" y="5" width="40" height="2" fill={a} /></>}
    </svg>
  );
}

const NAV = [["packs", "Packs"], ["palette", "Palette"], ["type", "Type"], ["panels", "Panels"], ["background", "Background"], ["headings", "Headings"], ["voice", "Voice"], ["screen", "Screen"], ["table", "Table"]] as const;

export default function SettingsPage() {
  const s = useSettings();
  const clearBook = useRulebook((r) => r.clear);
  const bookStatus = useRulebook((r) => r.status);
  const cur: PackSettings = { theme: s.theme, font: s.font, ornament: s.ornament, backdrop: s.backdrop, glyph: s.glyph, heads: s.heads, voice: s.voice, corners: s.corners };
  const activePack = PACKS.find((p) => packMatches(p, cur));
  const voice = VOICES.find((v) => v.id === s.voice) ?? VOICES[0];

  const surprise = () => {
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
    s.set({
      theme: pick(THEMES).id, font: pick(FONTS).id, ornament: pick(ORNAMENTS).id, backdrop: pick(MOTIFS).id,
      glyph: pick(GLYPHS), heads: pick(HEADS).id, voice: pick(VOICES).id, corners: pick(["cut", "square", "round"] as const), customAccent: null,
    });
  };

  return (
    <Page wide title="Settings" kicker="Make the deck yours. Start from a pack that fits your runner, then change any piece. Everything is saved on this device.">
      <nav className="sticky top-12 z-20 -mx-4 mb-5 flex gap-1.5 overflow-x-auto border-b border-line bg-bg/90 px-4 py-2 backdrop-blur md:-mx-8 md:px-8" aria-label="Settings sections">
        {NAV.map(([id, label]) => <a key={id} href={`#${id}`} className="chip shrink-0 hover:border-accent hover:text-accent">{label}</a>)}
      </nav>

      <div className="space-y-5">
        <Section id="packs" title="Style packs" lead={activePack ? `Wearing ${activePack.name}. Change anything below to make your own mix.` : "Your own mix. Pick a pack to start again from one."}
          right={<div className="flex gap-2"><button className="btn small" onClick={surprise}><Icon name="dice" size={14} /> Surprise me</button><button className="btn small ghost" onClick={() => s.set({ ...PACKS[0].s, customAccent: null })}>Back to classic</button></div>}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {PACKS.map((p) => <PackCard key={p.id} p={p} on={activePack?.id === p.id} onPick={() => s.set({ ...p.s, customAccent: null })} />)}
          </div>
        </Section>

        <Section id="palette" title="Palette" lead="Each palette spends its second and third colours on panel headers, numbers, brackets and the background.">
          <div className="space-y-4">
            {THEME_GROUPS.map((g) => (
              <div key={g}>
                <div className="mb-1.5 text-xs text-dim">{g}</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                  {THEMES.filter((t) => t.group === g).map((t) => (
                    <button key={t.id} data-theme={t.id} onClick={() => s.set({ theme: t.id })} aria-pressed={s.theme === t.id}
                      className={clsx("border-2 bg-bg p-2.5 text-left text-fg", s.theme === t.id ? "border-accent" : "border-line hover:border-linehi")}>
                      <span className="mb-2 flex h-7 overflow-hidden border border-line">
                        <span className="flex-[3] bg-panel" />
                        <span className="flex-[2] bg-accent" />
                        <span className="flex-[1.5] bg-[var(--accent-2,var(--cyan))]" />
                        <span className="flex-1 bg-[var(--accent-3,var(--astral))]" />
                      </span>
                      <span className="block font-display font-semibold" style={{ color: "var(--title, var(--fg))" }}>{t.name}{t.light && <span className="ml-1.5 text-[10px] font-normal text-faint">light</span>}</span>
                      <span className="block text-[11px] leading-snug text-dim">{t.blurb}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <div className="mb-2 text-sm">Accent colour</div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => s.set({ customAccent: null })} aria-pressed={!s.customAccent} className={clsx("chip min-h-9", !s.customAccent && "on")}>Palette default</button>
              {ACCENT_PRESETS.map((c) => (
                <button key={c} onClick={() => s.set({ customAccent: c })} aria-label={`Accent ${c}`} aria-pressed={s.customAccent === c} className={clsx("size-9 border-2 transition-transform hover:scale-110", s.customAccent === c ? "border-fg" : "border-line-hi")} style={{ background: c }} />
              ))}
              <label className="flex items-center gap-2 text-sm text-dim">
                Custom
                <input type="color" value={s.customAccent ?? "#ffae3d"} onChange={(e) => s.set({ customAccent: e.target.value })} className="h-9 w-12 cursor-pointer border border-line bg-transparent" aria-label="Custom accent colour" />
              </label>
            </div>
          </div>
        </Section>

        <Section id="type" title="Typeface" lead="Headings use the first face, text the second.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" role="radiogroup" aria-label="Typeface">
            {FONTS.map((f) => (
              <button key={f.id} role="radio" aria-checked={s.font === f.id} onClick={() => s.set({ font: f.id })} className={clsx("border p-3 text-left transition-colors", s.font === f.id ? "border-accent" : "border-line hover:border-linehi")}>
                <div className={clsx("truncate text-xl", s.font === f.id && "text-accent")} style={{ fontFamily: f.display }}>{f.name}</div>
                <div className="text-xs text-dim" style={{ fontFamily: f.body }}>{f.blurb}. 12 hits, Edge 4.</div>
              </button>
            ))}
          </div>
          <div className="mt-4 max-w-sm"><Slider label="Text size" value={s.fontScale} min={0.9} max={1.25} step={0.05} onChange={(v) => s.set({ fontScale: v })} fmt={(v) => `${Math.round(v * 100)}%`} /></div>
        </Section>

        <Section id="panels" title="Panels" lead="How every box on the deck is dressed. This page changes as you pick.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Ornament">
            {ORNAMENTS.map((o) => (
              <button key={o.id} role="radio" aria-checked={s.ornament === o.id} onClick={() => s.set({ ornament: o.id })} className={clsx("flex flex-col items-center gap-1 border p-2 text-center", s.ornament === o.id ? "border-accent text-accent" : "border-line text-dim hover:border-linehi hover:text-fg")}>
                <OrnamentIcon id={o.id} />
                <span className="text-xs font-semibold">{o.name}</span>
                <span className="text-[10px] text-faint">{o.blurb}</span>
              </button>
            ))}
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Seg label="Corners" value={s.corners} onChange={(v) => s.set({ corners: v })} options={[{ id: "cut", name: "Cut" }, { id: "square", name: "Square" }, { id: "round", name: "Round" }]} />
            <Seg label="Density (tablet and desktop)" value={s.density} onChange={(v) => s.set({ density: v })} options={[{ id: "comfortable", name: "Comfortable" }, { id: "compact", name: "Compact" }]} />
          </div>
        </Section>

        <Section id="background" title="Background" lead="A motif behind everything, drawn in your palette's second colour.">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6" role="radiogroup" aria-label="Background motif">
            {MOTIFS.map((m) => (
              <button key={m.id} role="radio" aria-checked={s.backdrop === m.id} onClick={() => s.set({ backdrop: m.id })} className={clsx("relative h-20 overflow-hidden border-2 bg-bg text-left", s.backdrop === m.id ? "border-accent" : "border-line hover:border-linehi")}>
                {m.id === "grid" && <span className="absolute inset-0 opacity-60" style={{ background: "linear-gradient(var(--line) 1px, transparent 1px) 0 0 / 100% 12px, linear-gradient(90deg, var(--line) 1px, transparent 1px) 0 0 / 12px 100%" }} />}
                {m.id === "glow" && <span className="absolute inset-0" style={{ background: "radial-gradient(80% 90% at 10% 0%, var(--halo-a), transparent), radial-gradient(70% 80% at 100% 100%, var(--halo-b), transparent)" }} />}
                {!["grid", "glow", "flat"].includes(m.id) && <span className="motif mini" data-m={m.id} aria-hidden="true" />}
                <span className="absolute inset-x-0 bottom-0 bg-bg/80 px-1.5 py-0.5 text-[11px] font-semibold">{m.name}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 max-w-sm"><Slider label="Motif strength" value={s.motifStrength} min={0} max={2} step={0.1} onChange={(v) => s.set({ motifStrength: v })} fmt={(v) => `${Math.round(v * 100)}%`} /></div>
        </Section>

        <Section id="headings" title="Headings and symbols" lead="Title treatment, and a symbol in front of every panel title.">
          <Seg label="Title style" value={s.heads} onChange={(v) => s.set({ heads: v })} options={HEADS} />
          <div className="mt-4">
            <div className="mb-1 text-sm">Panel symbol</div>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Panel symbol">
              {GLYPHS.map((g) => (
                <button key={g || "none"} role="radio" aria-checked={s.glyph === g} onClick={() => s.set({ glyph: g })} aria-label={g ? `Symbol ${g}` : "No symbol"}
                  className={clsx("grid size-10 place-items-center border text-lg", s.glyph === g ? "border-accent text-accent" : "border-line text-dim hover:border-linehi hover:text-fg")} style={textGlyph}>
                  {g ? glyphText(g) : <span className="text-xs">none</span>}
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section id="voice" title="Voice and names" lead="How the deck talks to you on the home screen and at boot.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" role="radiogroup" aria-label="Voice">
            {VOICES.map((v) => (
              <button key={v.id} role="radio" aria-checked={s.voice === v.id} onClick={() => s.set({ voice: v.id })} className={clsx("border p-2.5 text-left", s.voice === v.id ? "border-accent" : "border-line hover:border-linehi")}>
                <div className={clsx("text-xs font-semibold", s.voice === v.id ? "text-accent" : "text-dim")}>{v.name}</div>
                <div className="font-display text-sm leading-snug">{v.greet(s.handle)}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto border-l-2 border-accent bg-bg2/60 p-3 font-mono text-xs text-dim">
            {voice.boot("mounting rulebook ...... ok", (s.deckName || "Sixthdeck").toUpperCase()).map((l, i, a) => <div key={i} className={clsx("whitespace-pre", i === a.length - 1 && "text-accent")}>{i === a.length - 1 ? "> " : "  "}{l}</div>)}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="block text-sm">Your handle
              <input className="field mt-1" placeholder="Name shown on rolls and in chat" value={s.handle} onChange={(e) => s.set({ handle: e.target.value })} />
            </label>
            <label className="block text-sm">Deck name
              <input className="field mt-1" maxLength={18} placeholder="Sixthdeck" value={s.deckName} onChange={(e) => s.set({ deckName: e.target.value })} />
              <span className="mt-1 block text-xs text-faint">On the phone header and the boot screen.</span>
            </label>
            <label className="block text-sm">Logo tag
              <input className="field num mt-1" maxLength={4} placeholder="S6" value={s.deckTag} onChange={(e) => s.set({ deckTag: e.target.value.toUpperCase() })} />
              <span className="mt-1 block text-xs text-faint">Up to four characters in the corner square. Your tag, your crew.</span>
            </label>
          </div>
        </Section>

        <div className="grid gap-5 lg:grid-cols-2">
          <Section id="screen" title="Screen">
            <div className="space-y-4">
              <Slider label="Scanlines" value={s.scanlines} min={0} max={1} step={0.05} onChange={(v) => s.set({ scanlines: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
              <Slider label="Vignette" value={s.vignette} min={0} max={1} step={0.05} onChange={(v) => s.set({ vignette: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
              <Slider label="Neon glow" value={s.glow} min={0} max={1.5} step={0.05} onChange={(v) => s.set({ glow: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--accent)]" checked={s.flicker} onChange={(e) => s.set({ flicker: e.target.checked })} /> Occasional screen flicker</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--accent)]" checked={s.motion === "reduced"} onChange={(e) => s.set({ motion: e.target.checked ? "reduced" : "full" })} /> Reduce motion</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--accent)]" checked={s.skipBoot} onChange={(e) => s.set({ skipBoot: e.target.checked })} /> Skip the boot sequence</label>
            </div>
          </Section>

          <Section id="table" title="Table">
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-[var(--accent)]" checked={s.sound} onChange={(e) => { s.set({ sound: e.target.checked }); if (e.target.checked) setTimeout(sfxBlip, 50); }} />
                Sound effects for dice and results
              </label>
              <div>
                <h3 className="mb-2 text-base font-semibold">Rulebook</h3>
                <p className="mb-2 text-sm text-dim">Status: {bookStatus === "ready" ? "mounted on this device" : "not mounted"}.</p>
                <button className="btn danger small" disabled={bookStatus !== "ready"} onClick={() => { if (confirm("Remove the imported rulebook from this device? You can import it again later.")) void clearBook(); }}>
                  <Icon name="trash" size={14} /> Remove rulebook from this device
                </button>
              </div>
              <button className="btn small ghost" onClick={() => { if (confirm("Reset all display settings?")) s.reset(); }}>Reset display settings</button>
            </div>
          </Section>
        </div>
      </div>
    </Page>
  );
}
