"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useRunners } from "@/lib/store/characters";
import { useRulebook } from "@/lib/store/rulebook";
import { printData } from "@/lib/sr6/printData";
import { PrintSheet, type PrintMode } from "./PrintSheet";
import "./print.css";

const KEY = "sixthdeck.print";
type Prefs = { mode: PrintMode; paper: "a4" | "letter"; marks: boolean };
const DEFAULTS: Prefs = { mode: "expanded", paper: "a4", marks: false };

function loadPrefs(): Prefs {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return DEFAULTS; }
}

export default function PrintPage() {
  return <Suspense fallback={null}><PrintView /></Suspense>;
}

function PrintView() {
  const { id } = useParams<{ id: string }>();
  const q = useSearchParams();
  const raw = useRunners((s) => s.runners[id]);
  const book = useRulebook((s) => s.book);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  // remembered per browser; a ?mode= link wins
  useEffect(() => {
    const p = loadPrefs();
    const m = q.get("mode");
    setPrefs(m === "minimal" || m === "expanded" ? { ...p, mode: m } : p); // eslint-disable-line react-hooks/set-state-in-effect
  }, [q]);
  const set = (patch: Partial<Prefs>) => setPrefs((p) => {
    const next = { ...p, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private window */ }
    return next;
  });
  const data = useMemo(() => (raw ? printData(raw, book) : null), [raw, book]);

  useEffect(() => {
    if (data) document.title = `${data.who} · ${prefs.mode === "expanded" ? "Expanded" : "Minimal"} sheet`;
  }, [data, prefs.mode]);

  if (!raw || !data) {
    return (
      <div className="mx-auto max-w-xl p-10">
        <h1 className="text-3xl font-bold">Runner not found</h1>
        <p className="mt-2 text-dim">This runner is stored on the device that created it.</p>
        <Link href="/runners" className="btn mt-4">Back to runners</Link>
      </div>
    );
  }

  return (
    <div className="ps-desk">
      {/* paper size and margins for the printer; page numbers where the browser supports them */}
      <style>{`@page { size: ${prefs.paper === "letter" ? "letter" : "A4"}; margin: ${prefs.mode === "minimal" ? "8mm 8mm 10mm" : "11mm 11mm 13mm"}; @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 7pt sans-serif; color: #8a8a8a; } }`}</style>
      <div className="ps-bar">
        <Link href={`/runners/${id}`} className="btn small ghost"><Icon name="back" size={14} /> Sheet</Link>
        <div className="ps-seg" role="group" aria-label="Layout">
          <button aria-pressed={prefs.mode === "expanded"} onClick={() => set({ mode: "expanded" })} title="Larger type, with the book's descriptions and how each number is made">Expanded</button>
          <button aria-pressed={prefs.mode === "minimal"} onClick={() => set({ mode: "minimal" })} title="Every entry and number, set densely in columns with page references">Minimal</button>
        </div>
        <div className="ps-seg" role="group" aria-label="Paper">
          <button aria-pressed={prefs.paper === "a4"} onClick={() => set({ paper: "a4" })}>A4</button>
          <button aria-pressed={prefs.paper === "letter"} onClick={() => set({ paper: "letter" })}>Letter</button>
        </div>
        <label><input type="checkbox" checked={prefs.marks} onChange={(e) => set({ marks: e.target.checked })} /> Shade current damage and Edge</label>
        <span className="ps-hint max-md:hidden">{prefs.mode === "expanded" ? "Descriptions, breakdowns and stat blocks." : "Same content, set tight. Book text becomes page references."}</span>
        <button className="btn small primary ml-auto" onClick={() => window.print()}><Icon name="print" size={14} /> Print or save as PDF</button>
      </div>
      <PrintSheet p={data} mode={prefs.mode} marks={prefs.marks} paper={prefs.paper} />
    </div>
  );
}
