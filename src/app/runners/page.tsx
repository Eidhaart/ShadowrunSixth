"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Page } from "@/components/Page";
import { Portrait } from "@/components/Portrait";
import { isPortrait } from "@/lib/portrait";
import { useRunners } from "@/lib/store/characters";
import { derive } from "@/lib/sr6/derive";
import { withAdv } from "@/lib/sr6/advance";
import { MAGIC_TYPE_LABEL, METATYPES } from "@/lib/sr6/data";
import type { Character } from "@/lib/sr6/character";

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function RunnersPage() {
  const map = useRunners((s) => s.runners);
  const draft = useRunners((s) => s.draft);
  const { importOne, remove } = useRunners();
  const runners = useMemo(() => Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt), [map]);
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");

  const onFile = async (f?: File | null) => {
    if (!f) return;
    try {
      const raw = JSON.parse(await f.text());
      const list: Character[] = Array.isArray(raw) ? raw : raw?.runners ?? [raw];
      let n = 0;
      for (const c of list) {
        if (c && c.version === 1 && c.metatype && c.attrPts) { if (c.portrait && !isPortrait(c.portrait)) delete c.portrait; importOne(c); n++; }
      }
      setMsg(n ? `Imported ${n} runner${n === 1 ? "" : "s"}.` : "That file does not contain Sixthdeck runners.");
    } catch {
      setMsg("Could not read that file.");
    }
  };

  return (
    <Page
      title="Runners"
      kicker="Your saved characters. Sheets are automated: damage, wound penalties, pools and Edge all update as you play."
      actions={
        <>
          <Link href="/forge" className="btn primary"><Icon name="plus" size={16} /> New runner</Link>
          <button className="btn" onClick={() => input.current?.click()}><Icon name="upload" size={16} /> Import</button>
          <button className="btn" disabled={!runners.length} onClick={() => download("sixthdeck-runners.json", { runners })}><Icon name="download" size={16} /> Export all</button>
          <input ref={input} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
        </>
      }
    >
      {msg && <p className="mb-4 text-sm text-dim" role="status">{msg}</p>}
      {draft && (
        <Link href="/forge" className="panel quiet mb-4 flex items-center justify-between gap-3 border-dashed border-accent p-4 hover:bg-panelhi">
          <span>Unfinished build: <b className="font-display">{draft.alias || draft.name || "Unnamed runner"}</b></span>
          <span className="text-accent">Continue in the Forge</span>
        </Link>
      )}
      {runners.length === 0 ? (
        <div className="panel p-8 text-dim">No runners saved yet. Build one in the Forge, or import a file exported from another device.</div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {runners.map((r) => {
            const d = derive(withAdv(r));
            return (
              <li key={r.id} className="panel flex flex-col p-4">
                <Link href={`/runners/${r.id}`} className="group block">
                  <div className="flex items-start gap-3">
                    <Portrait src={r.portrait} name={r.alias || r.name} className="w-14 text-xl" />
                    <div className="min-w-0">
                      <div className="font-display text-xl font-bold group-hover:text-accent">{r.alias || r.name || "Unnamed runner"}</div>
                      <div className="text-sm text-dim">{METATYPES[r.metatype].name}{r.magicType !== "mundane" ? ` · ${MAGIC_TYPE_LABEL[r.magicType]}` : ""}{r.archetype ? ` · ${r.archetype}` : ""}</div>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-4 gap-1.5 text-center text-xs">
                    <div className="border border-line py-1"><dt className="text-faint">Init</dt><dd className="num text-base font-semibold">{d.initiative.rank}+{d.initiative.dice}</dd></div>
                    <div className="border border-line py-1"><dt className="text-faint">DR</dt><dd className="num text-base font-semibold">{d.defenseRating}</dd></div>
                    <div className="border border-line py-1"><dt className="text-faint">Edge</dt><dd className="num text-base font-semibold">{d.edge}</dd></div>
                    <div className="border border-line py-1"><dt className="text-faint">Cond</dt><dd className="num text-base font-semibold">{d.condition.physical}/{d.condition.stun}</dd></div>
                  </dl>
                </Link>
                <div className="mt-4 flex flex-wrap gap-2 pt-1">
                  <Link href={`/runners/${r.id}`} className="btn small">Open sheet</Link>
                  <Link href={`/forge?edit=${r.id}`} className="btn small ghost">Edit build</Link>
                  <button className="btn small ghost" onClick={() => download(`${(r.alias || r.name || "runner").replace(/\W+/g, "-")}.json`, r)}>Export</button>
                  <button className="btn small ghost danger ml-auto" onClick={() => { if (confirm(`Delete ${r.alias || r.name || "this runner"}? This cannot be undone.`)) remove(r.id); }} aria-label="Delete runner"><Icon name="trash" size={14} /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
