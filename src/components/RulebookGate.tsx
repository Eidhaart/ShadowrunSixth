"use client";
import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useRulebook } from "@/lib/store/rulebook";

/** Shown wherever rules are needed and no book has been mounted yet. */
export function RulebookGate({ compact }: { compact?: boolean }) {
  const { status, progress, error, importPdf } = useRulebook();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const busy = status === "importing";

  const take = (f?: File | null) => {
    if (f && /\.pdf$/i.test(f.name)) void importPdf(f);
  };

  return (
    <div
      className={`panel ${compact ? "p-4" : "p-6 md:p-10"} ${drag ? "border-accent" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files[0]); }}
    >
      <h2 className="text-2xl font-semibold">Insert your rulebook chip</h2>
      <p className="mt-2 max-w-xl text-dim">
        Drop your copy of the Sixth World core rulebook PDF here. Sixthdeck reads it inside your browser, splits it into searchable sections and keeps it on this device only. Nothing is uploaded.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button className="btn primary" disabled={busy} onClick={() => input.current?.click()}>
          <Icon name="upload" size={18} /> {busy ? "Reading book" : "Choose PDF"}
        </button>
        <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => take(e.target.files?.[0])} />
        {busy && progress && (
          <div className="min-w-56 flex-1">
            <div className="h-1.5 w-full bg-line">
              <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.round((progress.page / progress.total) * 100)}%` }} />
            </div>
            <div className="mt-1 text-xs text-dim num">page {progress.page} of {progress.total}</div>
          </div>
        )}
      </div>
      {status === "error" && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
