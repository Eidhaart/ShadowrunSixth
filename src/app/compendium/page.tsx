"use client";
import { Suspense, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { Page } from "@/components/Page";
import { Icon } from "@/components/Icon";
import { Portrait } from "@/components/Portrait";
import { GearBrowser, useGearDrop } from "@/components/compendium/GearBrowser";
import { useRunners } from "@/lib/store/characters";
import { addToRunner, useGearList, type AddResult } from "@/lib/compendium/catalog";
import type { CompItem } from "@/lib/compendium/types";

function Dock({ runnerId, setRunnerId, pay, setPay, last, onItem }: {
  runnerId: string; setRunnerId: (id: string) => void; pay: boolean; setPay: (b: boolean) => void; last: AddResult | null; onItem: (i: CompItem, qty: number) => void;
}) {
  const map = useRunners((s) => s.runners);
  const runners = useMemo(() => Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt), [map]);
  const r = map[runnerId];
  const { over, props } = useGearDrop((i) => onItem(i, 1));
  if (!runners.length) {
    return (
      <div className="panel p-4 text-sm text-dim">
        No runners yet. <Link href="/forge" className="text-accent hover:underline">Build one in the Forge</Link> and you can drag gear straight onto them here.
      </div>
    );
  }
  return (
    <div {...props} className={clsx("panel p-4 transition-colors", over && "drop-over")} aria-label="Drop gear here">
      <label className="block text-xs text-dim">Shopping for
        <select className="field mt-1" value={runnerId} onChange={(e) => setRunnerId(e.target.value)}>
          {runners.map((x) => <option key={x.id} value={x.id}>{x.alias || x.name || "Unnamed runner"}</option>)}
        </select>
      </label>
      {r && (
        <>
          <div className="mt-3 flex items-center gap-3 max-md:hidden">
            <Portrait src={r.portrait} name={r.alias || r.name} className="w-14 text-lg" />
            <div className="min-w-0">
              <div className="truncate font-display text-lg font-semibold">{r.alias || r.name || "Unnamed runner"}</div>
              <div className="num text-sm text-dim">{r.nuyen.toLocaleString("en-US")}¥ on hand</div>
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--accent)]" checked={pay} onChange={(e) => setPay(e.target.checked)} /> Pay from their nuyen</label>
          <div className={clsx("mt-3 grid min-h-24 place-items-center border border-dashed p-3 text-center text-sm max-md:hidden", over ? "border-accent text-accent" : "border-line-hi text-faint")}>
            <span><Icon name="crate" size={22} className="mx-auto mb-1" />Drag gear here</span>
          </div>
          {last && <p className={clsx("mt-3 text-sm", last.ok ? "text-ok" : "text-danger")} role="status">{last.msg}</p>}
          {r && <p className="num mt-2 text-sm text-dim md:hidden">{r.nuyen.toLocaleString("en-US")}¥ on hand · carrying {r.gear.length}</p>}
          <div className="mt-3 text-xs text-faint max-md:hidden">Carrying {r.gear.length} item{r.gear.length === 1 ? "" : "s"}</div>
          <ul className="mt-1 max-h-56 divide-y max-md:hidden divide-line overflow-y-auto text-sm">
            {[...r.gear].reverse().slice(0, 12).map((g) => <li key={g.id} className="flex justify-between gap-2 py-1"><span className="truncate">{g.name}</span><span className="num shrink-0 text-xs text-dim">{g.qty > 1 ? `×${g.qty}` : ""}</span></li>)}
          </ul>
          <Link href={`/runners/${r.id}`} className="btn small mt-3 w-full max-md:hidden">Open their sheet</Link>
        </>
      )}
    </div>
  );
}

function Source() {
  const { imported, fileName, importedAt, importFile, clear } = useGearList();
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel quiet p-4 text-sm">
      <h2 className="mb-1 text-base font-semibold">Gear list</h2>
      {imported ? (
        <p className="text-dim">Using your copy, <b className="text-fg">{fileName}</b>, imported {new Date(importedAt).toLocaleDateString()}: {imported.length} items with wireless bonuses and notes. It stays on this device.</p>
      ) : (
        <p className="text-dim">Prices and statistics come from the community 6th World Gear List. Import your copy of the .xlsx to add each item&apos;s wireless bonus and notes, and to pick up rows added in newer versions of the list. It is read on this device and stays here.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn small" disabled={busy} onClick={() => input.current?.click()}><Icon name="upload" size={14} /> {imported ? "Import a newer version" : "Import gear list"}</button>
        {imported && <button className="btn small ghost" onClick={() => { clear(); setMsg("Back to the built-in list."); }}>Remove import</button>}
      </div>
      {msg && <p className="mt-2 text-xs text-dim" role="status">{msg}</p>}
      <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = "";
        if (!f) return;
        setBusy(true);
        try { const n = await importFile(f); setMsg(`Imported ${n} items.`); } catch (err) { setMsg(err instanceof Error ? err.message : "Could not read that file."); } finally { setBusy(false); }
      }} />
    </section>
  );
}

function Compendium() {
  const q = useSearchParams().get("q") ?? "";
  const map = useRunners((s) => s.runners);
  const update = useRunners((s) => s.update);
  const newest = useMemo(() => Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? "", [map]);
  const [picked, setPicked] = useState("");
  const runnerId = picked && map[picked] ? picked : newest;
  const [pay, setPay] = useState(true);
  const [last, setLast] = useState<AddResult | null>(null);
  const r = map[runnerId];

  const add = (i: CompItem, qty: number) => {
    if (!r) { setLast({ ok: false, msg: "Pick a runner first." }); return; }
    const res = addToRunner(JSON.parse(JSON.stringify(r)), i, { pay, qty }); // dry run on a copy
    if (res.ok) update(r.id, (x) => { addToRunner(x, i, { pay, qty }); });
    setLast(res);
  };

  return (
    <Page wide title="Compendium" kicker="Every piece of gear on the street, with prices, availability and stats. Drag an item onto a runner, or tap + to add it.">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="order-2 min-w-0 xl:order-1">
          <section className="panel p-4">
            <GearBrowser key={q} initialQuery={q} onAdd={add} addLabel={r ? `Add to ${r.alias || r.name || "runner"}` : "Add"} nuyen={pay ? r?.nuyen : undefined} hint={r ? undefined : "Build a runner to start adding gear."} />
          </section>
          <div className="mt-5"><Source /></div>
        </div>
        <aside className="order-1 xl:order-2">
          <div className="xl:sticky xl:top-16">
            <Dock runnerId={runnerId} setRunnerId={setPicked} pay={pay} setPay={setPay} last={last} onItem={add} />
          </div>
        </aside>
      </div>
    </Page>
  );
}

export default function CompendiumPage() {
  return (
    <Suspense fallback={<div className="p-8 text-dim">Opening the compendium</div>}>
      <Compendium />
    </Suspense>
  );
}
