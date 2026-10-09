"use client";
import { Portrait } from "@/components/Portrait";
import { useMemo } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Page } from "@/components/Page";
import { RollLog, Roller } from "@/components/Dice";
import { RulebookGate } from "@/components/RulebookGate";
import { CATEGORY_META, type RuleCategory } from "@/lib/rules/types";
import { useRulebook } from "@/lib/store/rulebook";
import { useRunners } from "@/lib/store/characters";
import { useSettings } from "@/lib/store/settings";
import { derive } from "@/lib/sr6/derive";
import { METATYPES } from "@/lib/sr6/data";

export default function DeckHome() {
  const status = useRulebook((s) => s.status);
  const book = useRulebook((s) => s.book);
  const runnerMap = useRunners((s) => s.runners);
  const runners = useMemo(() => Object.values(runnerMap), [runnerMap]);
  const draft = useRunners((s) => s.draft);
  const handle = useSettings((s) => s.handle);
  const toggleLens = useSettings((s) => s.toggleLens);

  const counts = new Map<RuleCategory, number>();
  book?.sections.forEach((s) => s.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));

  return (
    <Page
      wide
      title={handle ? `Jacked in, ${handle}` : "Jacked in"}
      kicker="Rules, dice, runners and the table chat in one place. Everything stays on your device unless you link a room."
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          {status === "ready" ? (
            <section className="panel p-5">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-xl font-semibold">Library</h2>
                <span className="text-sm text-dim num">{book?.sections.length.toLocaleString()} sections · {book?.source.pages} pages</span>
              </div>
              <p className="mb-3 text-sm text-dim">Pick a lens to see only the rules for one part of the game. Lenses stay on until you turn them off.</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(CATEGORY_META) as RuleCategory[]).filter((k) => counts.get(k)).map((k) => (
                  <Link key={k} href="/rules" onClick={() => { useSettings.getState().set({ lenses: [] }); toggleLens(k); }} className="chip hover:border-accent hover:text-accent">
                    <span aria-hidden>{CATEGORY_META[k].glyph}</span> {CATEGORY_META[k].label}
                    <span className="num text-faint">{counts.get(k)}</span>
                  </Link>
                ))}
              </div>
              <div className="mt-4"><Link href="/rules" className="btn"><Icon name="library" size={17} /> Open the library</Link></div>
            </section>
          ) : (
            status !== "loading" && status !== "idle" && <RulebookGate />
          )}

          <section className="panel p-5">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-xl font-semibold">Academy</h2>
              <Link href="/learn" className="btn small"><Icon name="learn" size={14} /> Open</Link>
            </div>
            <p className="mb-3 text-sm text-dim">Hacking and magic are the hard parts. Learn them in plain words, then run a mission.</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/learn/matrix" className="btn">Hacking for Dummies</Link>
              <Link href="/learn/magic" className="btn">Magic for Dummies</Link>
            </div>
          </section>

          <section className="panel p-5">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-xl font-semibold">Runners</h2>
              <Link href="/forge" className="btn small primary"><Icon name="plus" size={14} /> New runner</Link>
            </div>
            {draft && (
              <Link href="/forge" className="mb-3 flex items-center justify-between border border-dashed border-accent px-3 py-2 text-sm hover:bg-panelhi">
                <span>Unfinished build: <b>{draft.alias || draft.name || "Unnamed runner"}</b></span>
                <span className="text-accent">Continue</span>
              </Link>
            )}
            {runners.length === 0 && !draft && (
              <p className="text-sm text-dim">No runners yet. The Forge walks you through priorities, attributes, skills, qualities and gear, and checks every rule as you go.</p>
            )}
            <ul className="divide-y divide-line">
              {runners.slice(0, 6).map((r) => {
                const d = derive(r);
                return (
                  <li key={r.id}>
                    <Link href={`/runners/${r.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-accent">
                      <span className="flex min-w-0 items-center gap-3">
                        <Portrait src={r.portrait} name={r.alias || r.name} className="w-9 text-xs" />
                        <span className="min-w-0">
                          <span className="block truncate font-display font-semibold">{r.alias || r.name || "Unnamed runner"}</span>
                          <span className="text-xs text-dim">{METATYPES[r.metatype].name}{r.archetype ? ` · ${r.archetype}` : ""}</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-dim num">Init {d.initiative.rank}+{d.initiative.dice}D6 · DR {d.defenseRating}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div className="space-y-5">
          <section className="panel p-5">
            <h2 className="mb-3 text-xl font-semibold">Quick roll</h2>
            <Roller compact />
          </section>
          <section className="panel p-5">
            <h2 className="mb-3 text-xl font-semibold">Recent rolls</h2>
            <RollLog limit={3} compact />
          </section>
        </div>
      </div>
    </Page>
  );
}
