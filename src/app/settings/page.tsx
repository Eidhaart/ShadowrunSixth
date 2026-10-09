"use client";
import clsx from "clsx";
import { Page } from "@/components/Page";
import { Icon } from "@/components/Icon";
import { THEMES, useSettings } from "@/lib/store/settings";
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
                <div className="font-display font-semibold">{t.name}</div>
                <div className="text-xs text-dim">{t.blurb}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              Accent override
              <input type="color" value={s.customAccent ?? "#ffae3d"} onChange={(e) => s.set({ customAccent: e.target.value })} className="h-8 w-12 cursor-pointer border border-line bg-transparent" aria-label="Accent colour" />
            </label>
            {s.customAccent && <button className="btn small ghost" onClick={() => s.set({ customAccent: null })}>Use theme accent</button>}
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
