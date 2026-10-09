"use client";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { RulebookGate } from "@/components/RulebookGate";
import { CATEGORY_META, type RuleCategory, type RuleSection } from "@/lib/rules/types";
import { useRulebook } from "@/lib/store/rulebook";
import { useSettings } from "@/lib/store/settings";
import { useComms } from "@/lib/store/comms";
import { whoAmI } from "@/lib/actions";

function terms(q: string): string[] {
  return q.toLowerCase().split(/[^a-z0-9']+/).filter((t) => t.length > 1);
}

function Highlight({ text, q }: { text: string; q: string }) {
  const ts = terms(q);
  if (!ts.length) return <>{text}</>;
  const re = new RegExp(`(${ts.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "ig");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <mark key={i} className="hl">{p}</mark> : <span key={i}>{p}</span>))}
    </>
  );
}

function snippet(text: string, q: string, len = 190): string {
  const flat = text.replace(/\s+/g, " ");
  const ts = terms(q);
  const lower = flat.toLowerCase();
  let at = -1;
  for (const t of ts) {
    const i = lower.indexOf(t);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  const start = Math.max(0, (at < 0 ? 0 : at) - 50);
  return (start > 0 ? "…" : "") + flat.slice(start, start + len) + (start + len < flat.length ? "…" : "");
}

export function Library() {
  const router = useRouter();
  const params = useSearchParams();
  const status = useRulebook((s) => s.status);
  const book = useRulebook((s) => s.book);
  const byId = useRulebook((s) => s.byId);
  const search = useRulebook((s) => s.search);
  const { lenses, toggleLens, pins, togglePin, set } = useSettings();
  const send = useComms((s) => s.send);
  const commsStatus = useComms((s) => s.status);

  const selId = params.get("s");
  const [q, setQ] = useState(params.get("q") ?? "");
  const dq = useDeferredValue(q);
  const searchRef = useRef<HTMLInputElement>(null);
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>({});
  const [shared, setShared] = useState(false);

  const order = useMemo(() => new Map((book?.sections ?? []).map((s, i) => [s.id, i])), [book]);

  const hits = useMemo(() => (dq.trim() ? search(dq, lenses, 60) : []), [dq, lenses, search, book]);

  const chapters = useMemo(() => {
    if (!book) return [];
    return book.chapters
      .map((c) => ({
        ...c,
        items: book.sections.filter(
          (s) => s.chapter === c.title && s.level <= 2 && (!lenses.length || s.tags.some((t) => lenses.includes(t))),
        ),
      }))
      .filter((c) => c.items.length);
  }, [book, lenses]);

  const selected = selId ? byId.get(selId) : undefined;

  // The article = selected section plus the deeper sections that follow it.
  const article = useMemo(() => {
    if (!selected || !book) return [];
    const start = order.get(selected.id) ?? 0;
    const out: RuleSection[] = [selected];
    for (let i = start + 1; i < book.sections.length; i++) {
      const s = book.sections[i];
      if (s.level <= selected.level || s.chapter !== selected.chapter) break;
      out.push(s);
      if (out.length > 60) break;
    }
    return out;
  }, [selected, book, order]);

  const go = useCallback((id: string) => {
    router.push(`/rules?s=${encodeURIComponent(id)}`, { scroll: false });
    window.scrollTo({ top: 0 });
  }, [router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" && (e.ctrlKey || e.metaKey) && e.shiftKey) { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const prevNext = useMemo(() => {
    if (!selected || !book) return {};
    const i = order.get(selected.id) ?? -1;
    const sibs = book.sections.filter((s) => s.level <= 2 && s.chapter === selected.chapter);
    const j = sibs.findIndex((s) => s.id === selected.id);
    return { prev: sibs[j - 1], next: sibs[j + 1], i };
  }, [selected, book, order]);

  if (status === "loading" || status === "idle") return <div className="p-8 text-dim">Mounting rulebook</div>;
  if (status !== "ready" || !book) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-8">
        <h1 className="mb-4 text-3xl font-bold">Library</h1>
        <RulebookGate />
      </div>
    );
  }

  const shareRule = () => {
    if (!selected) return;
    const text = `${selected.title} (p. ${selected.page}): ${selected.text.replace(/\s+/g, " ").slice(0, 420)}${selected.text.length > 420 ? "…" : ""}`;
    send({ type: "chat", id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, from: whoAmI(), text, at: Date.now(), source: "deck" });
    setShared(true);
    setTimeout(() => setShared(false), 1800);
  };

  return (
    <div className="grid min-h-[calc(100dvh-3rem)] lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_260px]">
      {/* navigator */}
      <aside className={clsx("border-line bg-bg2/60 lg:sticky lg:top-12 lg:h-[calc(100dvh-3rem)] lg:overflow-auto lg:border-r", selected && "hidden lg:block")}>
        <div className="space-y-3 p-3">
          <div className="relative">
            <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
            <input
              ref={searchRef}
              className="field pl-9"
              placeholder="Search the book"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search rules"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-dim">
              <span>Lenses {lenses.length > 0 && `(${lenses.length})`}</span>
              {lenses.length > 0 && <button className="hover:text-accent" onClick={() => set({ lenses: [] })}>Show everything</button>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(CATEGORY_META) as RuleCategory[]).map((k) => (
                <button key={k} className={clsx("chip", lenses.includes(k) && "on")} onClick={() => toggleLens(k)} aria-pressed={lenses.includes(k)} title={CATEGORY_META[k].blurb}>
                  <span aria-hidden>{CATEGORY_META[k].glyph}</span> {CATEGORY_META[k].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {dq.trim() ? (
          <ul className="border-t border-line">
            <li className="px-3 py-2 text-xs text-dim">{hits.length} result{hits.length === 1 ? "" : "s"}{lenses.length > 0 && " in your lenses"}</li>
            {hits.map(({ section: s }) => (
              <li key={s.id}>
                <button className={clsx("block w-full border-t border-line px-3 py-2.5 text-left hover:bg-panelhi", selId === s.id && "bg-panelhi")} onClick={() => go(s.id)}>
                  <div className="font-display text-sm font-semibold"><Highlight text={s.title} q={dq} /></div>
                  <div className="text-xs text-faint">{s.chapter}{s.parent && s.parent !== s.title ? ` › ${s.parent}` : ""} · p.{s.page}</div>
                  <div className="mt-1 text-xs text-dim"><Highlight text={snippet(s.text, dq)} q={dq} /></div>
                </button>
              </li>
            ))}
            {hits.length === 0 && <li className="px-3 py-6 text-sm text-dim">No matches. Try fewer words, or clear a lens.</li>}
          </ul>
        ) : (
          <nav className="border-t border-line" aria-label="Chapters">
            {chapters.map((c) => {
              const open = openChapters[c.title] ?? (selected?.chapter === c.title);
              return (
                <div key={c.title} className="border-b border-line">
                  <button className="flex w-full items-center justify-between px-3 py-2.5 text-left font-display font-semibold hover:text-accent" onClick={() => setOpenChapters({ ...openChapters, [c.title]: !open })} aria-expanded={open}>
                    <span>{c.title}</span>
                    <span className="flex items-center gap-2 text-xs font-normal text-faint num">p.{c.pageStart}<Icon name="chev" size={14} className={clsx("transition-transform", open && "rotate-90")} /></span>
                  </button>
                  {open && (
                    <ul className="pb-2">
                      {c.items.map((s) => (
                        <li key={s.id}>
                          <button className={clsx("block w-full truncate py-1 pr-3 text-left text-sm hover:text-accent", s.level === 1 ? "pl-5 text-fg" : "pl-8 text-dim", selId === s.id && "bg-panelhi text-accent")} onClick={() => go(s.id)}>
                            {s.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </nav>
        )}
      </aside>

      {/* reader */}
      <section className={clsx("min-w-0 px-4 py-6 md:px-10 md:py-8", !selected && "hidden lg:block")}>
        {!selected ? (
          <div className="mx-auto max-w-2xl pt-10 text-dim">
            <h1 className="mb-3 text-3xl font-bold text-fg">Library</h1>
            <p>Search the whole book from the left, or open a chapter. The lenses narrow everything, including search, to one part of the game: combat only, hacking only, the GM chapters and so on.</p>
            <p className="mt-3 text-sm">Press <span className="kbd">Ctrl K</span> from anywhere to jump straight to a rule.</p>
          </div>
        ) : (
          <article className="mx-auto max-w-3xl">
            <button className="btn small ghost mb-4 lg:hidden" onClick={() => router.push("/rules")}><Icon name="back" size={14} /> Back to list</button>
            <div className="mb-1 text-xs text-faint">{selected.chapter}{selected.parent && selected.parent !== selected.title ? ` › ${selected.parent}` : ""} · page {selected.page}</div>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <h1 className="text-3xl font-bold md:text-4xl">{selected.title}</h1>
              <div className="flex gap-2">
                <button className={clsx("btn small", pins.includes(selected.id) && "primary")} onClick={() => togglePin(selected.id)} aria-pressed={pins.includes(selected.id)}>
                  <Icon name="star" size={14} /> {pins.includes(selected.id) ? "Pinned" : "Pin"}
                </button>
                <button className="btn small" disabled={commsStatus === "off"} onClick={shareRule} title={commsStatus === "off" ? "Join a room in Comms first" : "Post this rule to the table chat"}>
                  <Icon name="comms" size={14} /> {shared ? "Sent" : "Share"}
                </button>
              </div>
            </div>
            <div className="mb-6 flex flex-wrap gap-1.5">
              {selected.tags.map((t) => <span key={t} className="chip">{CATEGORY_META[t].glyph} {CATEGORY_META[t].label}</span>)}
            </div>
            <div className="prose-rules">
              {article.map((s, i) => (
                <div key={s.id} className={clsx(i > 0 && "mt-7")}>
                  {i > 0 && (
                    <h2 className={clsx("mb-2 font-display font-semibold", s.level === 2 ? "text-2xl" : "text-lg text-accent")}>
                      {s.title}
                    </h2>
                  )}
                  {s.text.split(/\n{2,}/).map((p, k) => <p key={k}><Highlight text={p.replace(/\n/g, " ")} q={dq} /></p>)}
                </div>
              ))}
            </div>
            <div className="mt-10 flex justify-between gap-3 border-t border-line pt-4">
              {prevNext.prev ? <button className="btn small" onClick={() => go(prevNext.prev!.id)}><Icon name="back" size={14} /> {prevNext.prev.title}</button> : <span />}
              {prevNext.next ? <button className="btn small" onClick={() => go(prevNext.next!.id)}>{prevNext.next.title} <Icon name="chev" size={14} /></button> : <span />}
            </div>
          </article>
        )}
      </section>

      {/* pinned */}
      <aside className="hidden border-l border-line bg-bg2/60 p-3 xl:sticky xl:top-12 xl:block xl:h-[calc(100dvh-3rem)] xl:overflow-auto">
        <div className="mb-2 font-display text-sm font-semibold text-dim">Pinned rules</div>
        {pins.length === 0 && <p className="text-xs text-faint">Pin a rule to keep it one click away while you play.</p>}
        <ul className="space-y-1">
          {pins.map((id) => {
            const s = byId.get(id);
            if (!s) return null;
            return (
              <li key={id} className="group flex items-start gap-1">
                <button className={clsx("flex-1 py-1 text-left text-sm hover:text-accent", selId === id && "text-accent")} onClick={() => go(id)}>
                  {s.title}<span className="block text-xs text-faint">p.{s.page}</span>
                </button>
                <button className="p-1 text-faint opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100" onClick={() => togglePin(id)} aria-label={`Unpin ${s.title}`}><Icon name="x" size={14} /></button>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}
