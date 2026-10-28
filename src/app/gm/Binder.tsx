"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { ItemMaker } from "@/components/compendium/ItemMaker";
import { NpcEditor } from "@/app/table/Dialogs";
import { useHouse } from "@/lib/house/store";
import type { HouseItem } from "@/lib/house/rules";
import { KIND, KINDS, linkTargets, useBinder, type BinderEntry, type EntryKind } from "@/lib/gm/binder";
import { putOnTable, shareAsHandout } from "@/lib/gm/table";
import { loadImage } from "@/lib/vtt/images";
import { useVtt } from "@/lib/vtt/store";

type Filter = EntryKind | "all" | "items" | "pinned";

/** Body text with [[links]] to other entries and simple bullets. */
export function Rich({ text, onLink }: { text: string; onLink: (title: string) => void }) {
  const entries = useBinder((s) => s.entries);
  const titles = useMemo(() => new Set(Object.values(entries).map((e) => e.title.toLowerCase())), [entries]);
  if (!text.trim()) return <p className="text-sm text-faint">Nothing written yet.</p>;
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {text.split(/\n{2,}/).map((para, i) => {
        const lines = para.split("\n");
        const bullets = lines.every((l) => /^\s*[-*] /.test(l));
        const render = (s: string) => s.split(/(\[\[[^\]]+\]\])/g).map((part, j) => {
          const m = /^\[\[([^\]]+)\]\]$/.exec(part);
          if (!m) return <span key={j}>{part}</span>;
          const known = titles.has(m[1].trim().toLowerCase());
          return <button key={j} className={clsx("binder-link", !known && "new")} onClick={() => onLink(m[1].trim())} title={known ? "Open" : "Create this entry"}>{m[1]}</button>;
        });
        return bullets
          ? <ul key={i} className="list-disc space-y-0.5 pl-5">{lines.map((l, j) => <li key={j}>{render(l.replace(/^\s*[-*] /, ""))}</li>)}</ul>
          : <p key={i} className="whitespace-pre-wrap">{render(para)}</p>;
      })}
    </div>
  );
}

function Portrait({ e, big }: { e: BinderEntry; big?: boolean }) {
  const k = KIND[e.kind];
  return e.img
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={e.img} alt="" className={clsx("shrink-0 border border-line object-cover", big ? "h-48 w-40" : "size-10")} style={{ objectPosition: "50% 20%" }} />
    : <span className={clsx("grid shrink-0 place-items-center border border-line bg-bg2", big ? "h-48 w-40" : "size-10")} style={{ color: k.hue }}><Icon name={k.icon} size={big ? 40 : 18} /></span>;
}

function EntryView({ e, onOpen }: { e: BinderEntry; onOpen: (id: string) => void }) {
  const b = useBinder();
  const tableLoaded = useVtt((s) => !!s.state && s.me.gm);
  const [edit, setEdit] = useState(e.body === "" && e.title.startsWith("New "));
  const [msg, setMsg] = useState<string | null>(null);
  const upd = (fn: (x: BinderEntry) => void) => b.update(e.id, fn);
  const k = KIND[e.kind];
  const backlinks = Object.values(b.entries).filter((x) => x.id !== e.id && linkTargets(x.body).some((t) => t.toLowerCase() === e.title.toLowerCase()));
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 3000); return () => clearTimeout(t); }, [msg]);

  const follow = (title: string) => {
    const hit = Object.values(b.entries).find((x) => x.title.toLowerCase() === title.toLowerCase());
    onOpen(hit ? hit.id : b.create("note", { title }));
  };
  const pic = async (f?: File) => { if (!f) return; const a = await loadImage(f, "handout"); upd((x) => { x.img = a.data; }); };

  return (
    <article className="binder-page min-w-0 space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap gap-4">
        <label className={clsx("relative", edit && "cursor-pointer")} title={edit ? "Change picture" : undefined}>
          <Portrait e={e} big />
          {edit && <input type="file" accept="image/*" className="sr-only" onChange={(ev) => void pic(ev.target.files?.[0])} />}
          {edit && <span className="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-center text-xs">Picture</span>}
        </label>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="text-xs font-semibold" style={{ color: k.hue }}>{k.name}</div>
          {edit ? (
            <>
              <input className="w-full bg-transparent font-display text-3xl font-bold outline-none" value={e.title} onChange={(ev) => upd((x) => { x.title = ev.target.value.slice(0, 80); })} aria-label="Title" autoFocus />
              <input className="field" value={e.sub ?? ""} onChange={(ev) => upd((x) => { x.sub = ev.target.value.slice(0, 120); })} placeholder={e.kind === "npc" ? "Role: Ares security chief, fixer, street doc" : e.kind === "place" ? "Where: Redmond Barrens, under the monorail" : "One line"} aria-label="Subtitle" />
              <input className="field" value={e.tags.join(", ")} onChange={(ev) => upd((x) => { x.tags = ev.target.value.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10); })} placeholder="Tags: ares, run 3, contacts" aria-label="Tags" />
            </>
          ) : (
            <>
              <h2 className="font-display text-3xl font-bold leading-tight">{e.title}</h2>
              {e.sub && <p className="text-dim">{e.sub}</p>}
              {e.tags.length > 0 && <div className="flex flex-wrap gap-1">{e.tags.map((t) => <span key={t} className="chip !text-[11px]">{t}</span>)}</div>}
            </>
          )}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button className={clsx("btn small", edit && "primary")} onClick={() => setEdit(!edit)}><Icon name={edit ? "check" : "forge"} size={14} /> {edit ? "Done" : "Edit"}</button>
            <button className={clsx("btn small", e.pinned && "primary")} onClick={() => upd((x) => { x.pinned = !x.pinned; })} title="Pinned entries sit at the top and on the GM screen"><Icon name="star" size={14} /> {e.pinned ? "Pinned" : "Pin"}</button>
            {e.kind === "npc" && <button className="btn small" disabled={!tableLoaded} title={tableLoaded ? "Drop this NPC in the middle of your current scene" : "Open the Table as GM first"} onClick={() => setMsg(putOnTable(e) ?? `${e.title} is on the table.`)}><Icon name="map" size={14} /> Put on table</button>}
            <button className="btn small" disabled={!tableLoaded} title={tableLoaded ? "Show the players this entry as a handout" : "Open the Table as GM first"} onClick={() => setMsg(shareAsHandout(e) ?? "Shared with the players as a handout.")}><Icon name="eye" size={14} /> Show players</button>
            <button className="btn small ghost" onClick={() => { const id = b.create(e.kind, { ...structuredClone(e), title: `${e.title} copy`, pinned: false }); onOpen(id); }}><Icon name="copy" size={14} /></button>
            <button className="btn small ghost text-danger" onClick={() => { if (confirm(`Delete ${e.title}?`)) b.remove(e.id); }} aria-label="Delete"><Icon name="trash" size={14} /></button>
          </div>
          {msg && <p role="status" className="text-xs text-accent">{msg}</p>}
        </div>
      </header>

      {edit ? (
        <label className="block text-xs text-dim">Notes. Link other entries with [[Their name]]; start lines with &quot;- &quot; for a list.
          <textarea className="field mt-1 min-h-56 font-sans text-sm leading-relaxed" value={e.body} onChange={(ev) => upd((x) => { x.body = ev.target.value; })} placeholder={e.kind === "npc" ? "Wants, fears, what they know, how they talk. Owes [[Mr. Johnson]] a favor." : "Write it down."} />
        </label>
      ) : <Rich text={e.body} onLink={follow} />}

      {e.kind === "npc" && e.npc && (
        <section className="space-y-2 border-t border-line pt-3">
          <h3 className="font-semibold">Stat block</h3>
          {edit ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                {(["physical", "stun", "edge"] as const).map((m) => (
                  <label key={m} className="text-xs capitalize text-dim">{m === "edge" ? "Edge" : `${m} boxes`}
                    <input className="field num" type="number" min={0} max={30} value={e.monitor?.[m] ?? (m === "edge" ? 2 : 10)} onChange={(ev) => upd((x) => { x.monitor = { physical: 10, stun: 10, edge: 2, ...x.monitor, [m]: Math.max(0, Number(ev.target.value) || 0) }; })} />
                  </label>
                ))}
              </div>
              <NpcEditor npc={e.npc} onChange={(npc) => upd((x) => { x.npc = npc; })} />
            </>
          ) : (
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="num text-dim">Init <b className="text-fg">{e.npc.init.base}+{e.npc.init.dice}D6</b> · DR <b className="text-fg">{e.npc.dr}</b> · Defend <b className="text-fg">{e.npc.defend ?? "?"}</b> · Soak <b className="text-fg">{e.npc.soak ?? "?"}</b></div>
              <div className="num text-dim">Physical <b className="text-fg">{e.monitor?.physical ?? 10}</b> · Stun <b className="text-fg">{e.monitor?.stun ?? 10}</b> · Edge <b className="text-fg">{e.monitor?.edge ?? 2}</b></div>
              <div className="flex flex-wrap gap-1 sm:col-span-2">
                {(e.npc.weapons ?? []).map((w, i) => <span key={i} className="chip">{w.name} <b className="num">{w.pool}</b> · {w.dv}{w.type}</span>)}
                {e.npc.pools.map((p, i) => <span key={i} className="chip">{p.label} <b className="num">{p.dice}</b></span>)}
              </div>
            </div>
          )}
        </section>
      )}

      {backlinks.length > 0 && (
        <section className="border-t border-line pt-3 text-sm">
          <h3 className="mb-1 text-xs text-faint">Mentioned in</h3>
          <div className="flex flex-wrap gap-1.5">{backlinks.map((x) => <button key={x.id} className="binder-link" onClick={() => onOpen(x.id)}>{x.title}</button>)}</div>
        </section>
      )}
    </article>
  );
}

function ItemsPane() {
  const mine = useHouse((s) => s.mine);
  const remove = useHouse((s) => s.removeMine);
  const [maker, setMaker] = useState<{ initial?: HouseItem } | null>(null);
  return (
    <div className="space-y-3 p-4 md:p-6">
      {maker && <ItemMaker onClose={() => setMaker(null)} initial={maker.initial} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-3xl font-bold">Custom items</h2>
          <p className="text-sm text-dim">Your weapons, armor and gear. They are in your Compendium marked Mine; add them to a house ruleset to hand them to your whole table.</p>
        </div>
        <button className="btn primary" onClick={() => setMaker({})}><Icon name="plus" size={15} /> Make an item</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {mine.map((it) => (
          <article key={it.id} className="panel flex gap-2 p-3">
            <button className="min-w-0 flex-1 text-left" onClick={() => setMaker({ initial: it })}>
              <b className="block truncate font-display">{it.name}</b>
              <span className="num block text-xs text-dim">{it.group}{it.dv ? ` · DV ${it.dv}` : ""}{it.ar?.some((v) => v != null) ? ` · AR ${it.ar.map((v) => v ?? "–").join("/")}` : ""}{it.armor ? ` · +${it.armor} DR` : ""}{it.essence ? ` · ${it.essence} Ess` : ""}</span>
              <span className="num text-xs">{it.cost != null ? `${it.cost.toLocaleString()}¥` : ""}</span>
            </button>
            <button className="btn small ghost !px-1.5" onClick={() => { if (confirm(`Delete ${it.name}?`)) remove(it.id); }} aria-label={`Delete ${it.name}`}><Icon name="trash" size={14} /></button>
          </article>
        ))}
      </div>
      {mine.length === 0 && <p className="text-dim">No items yet.</p>}
    </div>
  );
}

/** The GM's binder: a searchable, linked notebook for the campaign. */
export function Binder({ openId, onOpen }: { openId: string | null; onOpen: (id: string | null) => void }) {
  const b = useBinder();
  const mineCount = useHouse((s) => s.mine.length);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const all = useMemo(() => Object.values(b.entries).sort((a, z) => Number(!!z.pinned) - Number(!!a.pinned) || z.updatedAt - a.updatedAt), [b.entries]);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = all.filter((e) => (filter === "all" || (filter === "pinned" ? e.pinned : e.kind === filter)) && words.every((w) => `${e.title} ${e.sub ?? ""} ${e.body} ${e.tags.join(" ")}`.toLowerCase().includes(w)));
  const open = openId && b.entries[openId] ? b.entries[openId] : null;
  const count = (k: EntryKind) => all.filter((e) => e.kind === k).length;

  const exportAll = () => {
    const data = { kind: "sixthdeck-binder", version: 1, entries: b.entries, tracks: b.tracks, items: useHouse.getState().mine };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
    a.download = `gm-binder-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importAll = async (f?: File) => {
    if (!f) return;
    try {
      const raw = JSON.parse(await f.text());
      const n = b.importAll(raw);
      for (const it of Array.isArray(raw.items) ? raw.items : []) if (it?.name) useHouse.getState().addMine(it);
      setMsg(`Imported ${n} entries.`);
    } catch { setMsg("That file is not a binder export."); }
  };

  return (
    <div className="binder grid min-h-[70vh] border border-line bg-panel lg:grid-cols-[19rem_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-line max-lg:border-b lg:border-r">
        <div className="space-y-2 border-b border-line p-3">
          <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the binder" aria-label="Search the binder" />
          <div className="flex flex-wrap gap-1">
            <button className={clsx("chip !text-[11px]", filter === "all" && "on")} onClick={() => setFilter("all")}>All {all.length}</button>
            <button className={clsx("chip !text-[11px]", filter === "pinned" && "on")} onClick={() => setFilter("pinned")}>Pinned</button>
            {KINDS.map((k) => <button key={k.id} className={clsx("chip !text-[11px]", filter === k.id && "on")} onClick={() => setFilter(k.id)}>{k.plural} {count(k.id) || ""}</button>)}
            <button className={clsx("chip !text-[11px]", filter === "items" && "on")} onClick={() => { setFilter("items"); onOpen(null); }}>Items {mineCount || ""}</button>
          </div>
        </div>
        {filter !== "items" && (
          <div className="flex flex-wrap gap-1 border-b border-line p-2">
            {KINDS.map((k) => (
              <button key={k.id} className="btn small !min-h-0 !px-2 !py-1 text-xs" onClick={() => { onOpen(b.create(k.id)); setFilter("all"); setQ(""); }} title={`New ${k.name.toLowerCase()}: ${k.blurb}`}>
                <Icon name="plus" size={12} /> {k.name}
              </button>
            ))}
          </div>
        )}
        <ul className="min-h-0 flex-1 overflow-y-auto max-lg:max-h-72">
          {filter !== "items" && list.map((e) => (
            <li key={e.id}>
              <button className={clsx("binder-row flex w-full items-center gap-2.5 px-3 py-2 text-left", open?.id === e.id && "on")} onClick={() => onOpen(e.id)} style={{ ["--k" as string]: KIND[e.kind].hue }}>
                <Portrait e={e} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1"><b className="truncate text-sm">{e.title}</b>{e.pinned && <Icon name="star" size={11} className="shrink-0 text-accent" />}</span>
                  <span className="block truncate text-xs text-dim">{e.sub || KIND[e.kind].name}</span>
                </span>
              </button>
            </li>
          ))}
          {filter !== "items" && list.length === 0 && <li className="p-4 text-sm text-dim">{all.length ? "Nothing matches." : "An empty binder. Start with the NPC your runners will meet first."}</li>}
        </ul>
        <div className="flex flex-wrap gap-1.5 border-t border-line p-2">
          <button className="btn small ghost" onClick={exportAll}><Icon name="download" size={14} /> Export</button>
          <button className="btn small ghost" onClick={() => file.current?.click()}><Icon name="upload" size={14} /> Import</button>
          <input ref={file} type="file" accept=".json,application/json" className="sr-only" onChange={(e) => { void importAll(e.target.files?.[0]); e.target.value = ""; }} />
          {msg && <span className="self-center text-xs text-accent">{msg}</span>}
        </div>
      </aside>
      <div className="min-w-0">
        {filter === "items" ? <ItemsPane /> : open ? <EntryView key={open.id} e={open} onOpen={onOpen} /> : (
          <div className="grid h-full place-items-center p-8 text-center">
            <div className="max-w-md space-y-3">
              <h2 className="font-display text-2xl font-bold">Your binder</h2>
              <p className="text-dim">NPCs with stat blocks you can drop on the table, places, factions, clues and session notes. Link them with [[names]], pin the ones you need tonight, and show any of them to your players as a handout.</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {KINDS.slice(0, 4).map((k) => <button key={k.id} className="btn small" onClick={() => onOpen(b.create(k.id))}><Icon name="plus" size={14} /> {k.name}</button>)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
