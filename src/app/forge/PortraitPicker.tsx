"use client";
import { useRef, useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { Portrait } from "@/components/Portrait";
import { processPortrait } from "@/lib/portrait";

/** Upload, frame and remove a runner portrait. The original file is never stored, only the 360×450 crop. */
export function PortraitPicker({ value, name, onChange }: { value?: string; name: string; onChange: (v: string | undefined) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [frame, setFrame] = useState({ zoom: 1, fx: 0.5, fy: 0.3 });

  const run = async (f: File, fr = frame) => {
    setBusy(true); setErr("");
    try { onChange(await processPortrait(f, fr)); setFile(f); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not use that image."); }
    finally { setBusy(false); }
  };
  const pick = (f?: File | null) => { if (!f) return; const fr = { zoom: 1, fx: 0.5, fy: 0.3 }; setFrame(fr); void run(f, fr); };
  const reframe = (p: Partial<typeof frame>) => { const fr = { ...frame, ...p }; setFrame(fr); if (file) void run(file, fr); };

  return (
    <div
      className={clsx("w-full max-w-[13rem] max-md:max-w-none", over && "outline outline-2 outline-offset-4 outline-[var(--accent)]")}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files?.[0]); }}
    >
      <div className="flex gap-3 md:block">
        <button type="button" onClick={() => input.current?.click()} className="group relative block w-28 shrink-0 text-left md:w-full" aria-label={value ? "Replace portrait" : "Upload portrait"}>
          <Portrait src={value} name={name} className="w-full text-4xl" />
          {!value && <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-bg/80 py-1.5 text-xs font-semibold text-accent"><Icon name="upload" size={13} /> Upload</span>}
        </button>
        <div className="min-w-0 flex-1 md:mt-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn small" disabled={busy} onClick={() => input.current?.click()}><Icon name="upload" size={14} /> {value ? "Replace" : "Upload portrait"}</button>
            {value && <button type="button" className="btn small ghost danger" onClick={() => { onChange(undefined); setFile(null); setErr(""); }}>Remove</button>}
          </div>
          <p className="mt-2 text-xs text-faint">{busy ? "Processing…" : "Optional. Pick a photo or drop one here; on a phone you can use the camera. It is cropped and shrunk on this device."}</p>
        </div>
      </div>
      {file && value && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-dim">Adjust the crop</summary>
          <div className="mt-2 space-y-2 text-xs text-dim">
            <label className="block">Zoom<input type="range" className="w-full accent-[var(--accent)]" min={1} max={3} step={0.05} value={frame.zoom} onChange={(e) => reframe({ zoom: Number(e.target.value) })} /></label>
            <label className="block">Left / right<input type="range" className="w-full accent-[var(--accent)]" min={0} max={1} step={0.02} value={frame.fx} onChange={(e) => reframe({ fx: Number(e.target.value) })} /></label>
            <label className="block">Up / down<input type="range" className="w-full accent-[var(--accent)]" min={0} max={1} step={0.02} value={frame.fy} onChange={(e) => reframe({ fy: Number(e.target.value) })} /></label>
          </div>
        </details>
      )}
      {err && <p className="mt-2 text-xs text-danger" role="alert">{err}</p>}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
