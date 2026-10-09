"use client";
import { Page } from "@/components/Page";
import { RollLog, Roller } from "@/components/Dice";

export default function DicePage() {
  return (
    <Page wide title="Dice" kicker="Roll a pool of d6. Fives and sixes are hits. More than half ones is a glitch; a glitch with no hits is critical.">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section className="panel h-fit p-5">
          <Roller />
        </section>
        <section className="panel p-5">
          <h2 className="mb-4 text-xl font-semibold">Roll log</h2>
          <RollLog />
        </section>
      </div>
    </Page>
  );
}
