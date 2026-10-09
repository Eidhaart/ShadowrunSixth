"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import clsx from "clsx";
import { Page } from "@/components/Page";
import { Icon } from "@/components/Icon";
import { MODULES } from "@/lib/academy/modules";
import { useAcademy } from "@/lib/academy/progress";
import type { ModuleId } from "@/lib/academy/types";

export default function ModuleMap() {
  const { module: id } = useParams<{ module: string }>();
  const m = MODULES[id as ModuleId];
  const lessons = useAcademy((s) => s.lessons);
  const sim = useAcademy((s) => s.sims[id as ModuleId]);
  const exam = useAcademy((s) => s.examBest[id as ModuleId]);
  const reset = useAcademy((s) => s.reset);
  if (!m)
    return (
      <Page title="Not found" kicker="That module does not exist."><Link href="/learn" className="btn">Back to the Academy</Link></Page>
    );
  const firstOpen = m.lessons.findIndex((l) => !lessons[`${m.id}/${l.id}`]);
  return (
    <Page title={m.title} kicker={m.intro} actions={<Link href="/learn" className="btn small ghost"><Icon name="back" size={14} /> Academy</Link>}>
      <ol className="relative max-w-3xl space-y-3 before:absolute before:bottom-4 before:left-[1.05rem] before:top-4 before:w-px before:bg-line-hi">
        {m.lessons.map((l, i) => {
          const done = !!lessons[`${m.id}/${l.id}`];
          return (
            <li key={l.id} className="relative pl-11">
              <span className={clsx("absolute left-0 top-3 grid size-9 place-items-center border font-mono text-sm", done ? "border-ok bg-bg text-ok" : i === firstOpen ? "border-accent bg-bg text-accent glow" : "border-line-hi bg-bg text-faint")}>
                {done ? <Icon name="check" size={16} /> : i + 1}
              </span>
              <Link href={`/learn/${m.id}/${l.id}`} className="panel quiet block p-3 transition-colors hover:border-accent">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-lg font-semibold">{l.title}</h3>
                  <span className="num text-xs text-faint">{l.minutes} min</span>
                </div>
                <p className="text-sm text-dim">{l.blurb}</p>
              </Link>
            </li>
          );
        })}
        <li className="relative pl-11">
          <span className="absolute left-0 top-3 grid size-9 place-items-center border border-accent bg-bg text-accent"><Icon name="bolt" size={16} /></span>
          <Link href={`/learn/${m.id}/sim`} className="panel block p-4 transition-colors hover:border-accent">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-lg font-semibold">Run: {m.sim.title}</h3>
              <span className="num text-xs text-faint">{m.sim.minutes} min</span>
            </div>
            <p className="text-sm text-dim">{m.sim.blurb}</p>
            {sim && <p className="mt-1 text-xs text-accent num">{sim.runs} run{sim.runs === 1 ? "" : "s"} · best {"★".repeat(sim.bestStars)}{"☆".repeat(4 - sim.bestStars)}</p>}
          </Link>
        </li>
        <li className="relative pl-11">
          <span className="absolute left-0 top-3 grid size-9 place-items-center border border-line-hi bg-bg text-dim"><Icon name="star" size={16} /></span>
          <Link href={`/learn/${m.id}/exam`} className="panel quiet block p-3 transition-colors hover:border-accent">
            <h3 className="text-lg font-semibold">Final exam</h3>
            <p className="text-sm text-dim">{m.exam.length} questions mixing everything. {exam !== undefined ? `Best so far: ${exam}/${m.exam.length}.` : "No pressure, you can retake it."}</p>
          </Link>
        </li>
      </ol>
      <button className="btn small ghost mt-6" onClick={() => { if (confirm("Clear your progress for this module?")) reset(m.id); }}>Reset progress</button>
    </Page>
  );
}
