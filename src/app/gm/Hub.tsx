"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { House } from "@/app/house/House";
import { useBinder } from "@/lib/gm/binder";
import { ensureTable } from "@/lib/gm/table";
import { useComms } from "@/lib/store/comms";
import { useVtt } from "@/lib/vtt/store";
import { ScreenBoard } from "./Screen";
import { Binder } from "./Binder";
import { MusicDeck } from "./Music";

type Tab = "screen" | "binder" | "music" | "house";
const TABS: { id: Tab; label: string; icon: string; blurb: string }[] = [
  { id: "screen", label: "Screen", icon: "deck", blurb: "Your panels for running the session" },
  { id: "binder", label: "Binder", icon: "library", blurb: "NPCs, places, factions, clues, sessions and your items" },
  { id: "music", label: "Music", icon: "spark", blurb: "Soundscapes and tracks for the table" },
  { id: "house", label: "House rules", icon: "gavel", blurb: "Your mechanics, gear and rulings" },
];

/** Everything a GM keeps behind the screen, in one place. */
export function Hub() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "screen") as Tab;
  const [entry, setEntry] = useState<string | null>(params.get("entry"));
  const status = useComms((s) => s.status);
  const role = useComms((s) => s.role);
  const room = useComms((s) => s.room);
  const loaded = useVtt((s) => !!s.state);

  useEffect(() => { void useBinder.persist.rehydrate(); ensureTable(); }, []);
  const go = (t: Tab) => router.replace(`/gm?tab=${t}`, { scroll: false });
  const playerSeat = (status === "online" || status === "local") && role !== "gm";

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold md:text-4xl">Behind the screen</h1>
          <p className="mt-1 max-w-2xl text-dim">Your GM screen, your binder, the table&apos;s music and your house rules. Everything here stays on this device unless you show it to the table.</p>
        </div>
        <span className={clsx("vtt-conn", loaded && status !== "off" && "on")}>
          {status === "off" ? "Solo prep: the table is on this device" : playerSeat ? `You sit as a player in ${room}` : `GM of ${room}`}
        </span>
      </header>
      {playerSeat && <p className="mb-4 border border-cyan/40 bg-cyan/5 px-3 py-2 text-sm text-cyan">You are in {room} as a player, so table controls here are off. Switch to the GM seat from the Table&apos;s connection chip to run it.</p>}
      <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-line" role="tablist" aria-label="GM tools">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={clsx("vtt-tab flex shrink-0 items-center gap-1.5 px-3.5 py-2.5 text-sm", tab === t.id && "on")} onClick={() => go(t.id)} title={t.blurb}>
            <Icon name={t.icon} size={16} /> {t.label}
          </button>
        ))}
      </nav>
      {tab === "screen" && <ScreenBoard />}
      {tab === "binder" && <Binder openId={entry} onOpen={setEntry} />}
      {tab === "music" && <div className="max-w-5xl"><MusicDeck /></div>}
      {tab === "house" && <div className="-mx-4 -my-6 md:-mx-8"><House /></div>}
    </div>
  );
}
