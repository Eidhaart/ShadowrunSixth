"use client";
import clsx from "clsx";
import { Page } from "@/components/Page";
import { Icon } from "@/components/Icon";
import { ACCENT_PRESETS, FONTS, THEMES, useSettings } from "@/lib/store/settings";
import { useRulebook } from "@/lib/store/rulebook";
import { sfxBlip } from "@/lib/sound";

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

export default function SettingsPage() {
  const s = useSettings();
  const clearBook = useRulebook((r) => r.clear);
  const bookStatus = useRulebook((r) => r.status);

  return (
    <Page title="Settings" kicker="Make the deck yours. Everything here is saved on this device.">
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel p-5 lg:col-span-2">
          <h2 className="mb-3 text-xl font-semibold">Skin</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => s.set({ theme: t.id })}
                aria-pressed={s.theme === t.id}
                className={clsx("panel quiet p-3 text-left transition-colors", s.theme === t.id ? "border-accent" : "hover:border-linehi")}
              >
                <div className="mb-2 flex h-10 overflow-hidden border border-line">
                  <span className="flex-[3]" style={{ background: t.swatch[0] }} />
                  <span className="flex-[2]" style={{ background: t.swatch[1] }} />
                  <span className="flex-1" style={{ background: t.swatch[2] }} />
                </div>
                <div className="font-display font-semibold">{t.name}{t.light && <span className="ml-2 text-xs font-normal text-faint">light</span>}</div>
                <div className="text-xs text-dim">{t.blurb}</div>
              </button>
            ))}
          </div>
          <div className="mt-5">
            <div className="mb-2 text-sm">Accent colour</div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => s.set({ customAccent: null })} aria-pressed={!s.customAccent} className={clsx("chip min-h-9", !s.customAccent && "on")}>Theme default</button>
              {ACCENT_PRESETS.map((c) => (
                <button key={c} onClick={() => s.set({ customAccent: c })} aria-label={`Accent ${c}`} aria-pressed={s.customAccent === c} className={clsx("size-9 border-2 transition-transform hover:scale-110", s.customAccent === c ? "border-fg" : "border-line-hi")} style={{ background: c }} />
              ))}
              <label className="flex items-center gap-2 text-sm text-dim">
                Custom
                <input type="color" value={s.customAccent ?? "#ffae3d"} onChange={(e) => s.set({ customAccent: e.target.value })} className="h-9 w-12 cursor-pointer border border-line bg-transparent" aria-label="Custom accent colour" />
              </label>
            </div>
          </div>
        </section>

        <section className="panel space-y-5 p-5 lg:col-span-2">
          <h2 className="text-xl font-semibold">Look and feel</h2>
          <div>
            <div className="mb-2 text-sm">Typeface</div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" role="radiogroup" aria-label="Typeface">
              {FONTS.map((f) => (
                <button key={f.id} role="radio" aria-checked={s.font === f.id} onClick={() => s.set({ font: f.id })} className={clsx("panel quiet p-3 text-left transition-colors", s.font === f.id ? "border-accent" : "hover:border-linehi")}>
                  <div className="text-lg font-semibold" style={{ fontFamily: f.css }}>{f.name}</div>
                  <div className="text-xs text-dim" style={{ fontFamily: f.css }}>{f.blurb}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Seg label="Corners" value={s.corners} onChange={(v) => s.set({ corners: v })} options={[{ id: "cut", name: "Cut" }, { id: "square", name: "Square" }, { id: "round", name: "Round" }]} />
            <Seg label="Density (tablet and desktop)" value={s.density} onChange={(v) => s.set({ density: v })} options={[{ id: "comfortable", name: "Comfortable" }, { id: "compact", name: "Compact" }]} />
            <Seg label="Background" value={s.backdrop} onChange={(v) => s.set({ backdrop: v })} options={[{ id: "grid", name: "Grid and glow" }, { id: "glow", name: "Glow only" }, { id: "flat", name: "Flat" }]} />
            <div>
              <div className="mb-1 text-sm">Panels</div>
              <label className="flex min-h-9 items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--accent)]" checked={s.brackets} onChange={(e) => s.set({ brackets: e.target.checked })} /> HUD corner brackets</label>
              <p className="text-xs text-faint">Not shown with round corners.</p>
            </div>
          </div>
        </section>

        <section className="panel space-y-4 p-5">
          <h2 className="text-xl font-semibold">Screen</h2>
          <Slider label="Scanlines" value={s.scanlines} min={0} max={1} step={0.05} onChange={(v) => s.set({ scanlines: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Vignette" value={s.vignette} min={0} max={1} step={0.05} onChange={(v) => s.set({ vignette: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Neon glow" value={s.glow} min={0} max={1.5} step={0.05} onChange={(v) => s.set({ glow: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Text size" value={s.fontScale} min={0.9} max={1.25} step={0.05} onChange={(v) => s.set({ fontScale: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--accent)]" checked={s.flicker} onChange={(e) => s.set({ flicker: e.target.checked })} /> Occasional screen flicker</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--accent)]" checked={s.motion === "reduced"} onChange={(e) => s.set({ motion: e.target.checked ? "reduced" : "full" })} /> Reduce motion</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--accent)]" checked={s.skipBoot} onChange={(e) => s.set({ skipBoot: e.target.checked })} /> Skip the boot sequence</label>
        </section>

        <section className="panel space-y-4 p-5">
          <h2 className="text-xl font-semibold">Table</h2>
          <div>
            <label className="mb-1 block text-sm" htmlFor="handle">Your handle</label>
            <input id="handle" className="field" placeholder="Name shown on rolls and in chat" value={s.handle} onChange={(e) => s.set({ handle: e.target.value })} />
          </div>
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
        </section>
      </div>
    </Page>
  );
}
