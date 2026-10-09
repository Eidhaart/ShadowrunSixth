"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import clsx from "clsx";
import { Page } from "@/components/Page";
import { Icon } from "@/components/Icon";
import { GlossaryCtx } from "@/components/academy/Prose";
import { LessonView } from "@/components/academy/LessonView";
import { Quiz } from "@/components/academy/Quiz";
import { WIDGETS } from "@/components/academy/registry";
import { MatrixSim } from "@/components/academy/sims/MatrixSim";
import { MagicSim } from "@/components/academy/sims/MagicSim";
import { MODULES, nextStep } from "@/lib/academy/modules";
import { useAcademy } from "@/lib/academy/progress";
import type { ModuleDef, ModuleId } from "@/lib/academy/types";

function Exam({ m }: { m: ModuleDef }) {
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [finished, setFinished] = useState(false);
  const record = useAcademy((s) => s.recordExam);
  const q = m.exam[i];
  const best = useAcademy((s) => s.examBest[m.id]);

  if (finished) {
    const pct = score / m.exam.length;
    return (
      <div className="panel space-y-3 p-6 text-center">
        <div className="num text-5xl font-bold text-accent glow">{score}/{m.exam.length}</div>
        <p className="text-lg">{pct === 1 ? "Flawless. You could teach this table." : pct >= 0.7 ? "Solid. You know your way around." : "A decent start. Reread the lessons you missed and try again."}</p>
        <p className="text-sm text-dim">Best score: {Math.max(best ?? 0, score)}/{m.exam.length}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn" onClick={() => { setI(0); setScore(0); setAnswered(false); setFinished(false); }}>Retake</button>
          <Link className="btn primary" href={`/learn/${m.id}`}>Back to the map</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-dim num"><span>Question {i + 1} of {m.exam.length}</span><span>Score {score}</span></div>
      <div className="meter"><i style={{ width: `${(i / m.exam.length) * 100}%` }} /></div>
      <Quiz key={q.id} q={q} onAnswer={(ok) => { setAnswered(true); if (ok) setScore((s) => s + 1); }} />
      {answered && (
        <button
          className="btn primary"
          onClick={() => {
            if (i + 1 >= m.exam.length) {
              const final = score;
              record(m.id, final);
              setFinished(true);
            } else {
              setI(i + 1);
              setAnswered(false);
            }
          }}
        >
          {i + 1 >= m.exam.length ? "See my score" : "Next question"}
        </button>
      )}
    </div>
  );
}

export default function LessonPage() {
  const { module: id, lesson: lid } = useParams<{ module: string; lesson: string }>();
  const router = useRouter();
  const m = MODULES[id as ModuleId];
  const done = useAcademy((s) => s.lessons);
  const finish = useAcademy((s) => s.finishLesson);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [lid]);

  if (!m) return <Page title="Not found" kicker="That module does not exist."><Link href="/learn" className="btn">Back to the Academy</Link></Page>;

  const crumb = (
    <Link href={`/learn/${m.id}`} className="btn small ghost"><Icon name="back" size={14} /> {m.title}</Link>
  );

  if (lid === "sim")
    return (
      <Page wide title={m.sim.title} kicker={m.sim.blurb} actions={crumb}>
        {m.id === "matrix" ? <MatrixSim /> : <MagicSim />}
      </Page>
    );
  if (lid === "exam")
    return (
      <Page title="Final exam" kicker={`${m.title}. Pick the best answer; you see the reason after each one.`} actions={crumb}>
        <div className="max-w-3xl"><Exam m={m} /></div>
      </Page>
    );

  const idx = m.lessons.findIndex((l) => l.id === lid);
  const lesson = m.lessons[idx];
  if (!lesson) return <Page title="Lesson not found" kicker="" actions={crumb}><Link href={`/learn/${m.id}`} className="btn">Lesson map</Link></Page>;
  const nxt = nextStep(m, lesson.id);
  const isDone = !!done[`${m.id}/${lesson.id}`];

  return (
    <GlossaryCtx.Provider value={m.glossary}>
      <Page title={lesson.title} kicker={lesson.blurb} actions={crumb}>
        <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <nav aria-label="Lessons" className="hidden lg:block">
            <ol className="sticky top-4 space-y-1">
              {m.lessons.map((l, i) => (
                <li key={l.id}>
                  <Link href={`/learn/${m.id}/${l.id}`} className={clsx("flex items-start gap-2 border-l-2 px-3 py-1.5 text-sm", l.id === lesson.id ? "border-accent text-fg" : "border-line text-dim hover:text-fg")}>
                    <span className={clsx("num mt-0.5 text-xs", done[`${m.id}/${l.id}`] ? "text-ok" : "text-faint")}>{done[`${m.id}/${l.id}`] ? "✓" : i + 1}</span>
                    {l.title}
                  </Link>
                </li>
              ))}
              <li><Link href={`/learn/${m.id}/sim`} className="flex items-center gap-2 border-l-2 border-line px-3 py-1.5 text-sm text-accent hover:border-accent"><Icon name="bolt" size={13} /> Run the simulation</Link></li>
            </ol>
          </nav>
          <article className="min-w-0">
            <div className="mb-4 flex items-center gap-3 text-xs text-faint num">
              <span>Lesson {idx + 1} of {m.lessons.length}</span><span>·</span><span>{lesson.minutes} min</span>
              <div className="meter ml-2 w-32"><i style={{ width: `${((idx + 1) / m.lessons.length) * 100}%` }} /></div>
            </div>
            <LessonView blocks={lesson.blocks} widgets={WIDGETS[m.id]} />
            <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              {idx > 0 ? <Link href={`/learn/${m.id}/${m.lessons[idx - 1].id}`} className="btn ghost"><Icon name="back" size={15} /> Previous</Link> : <span />}
              <button className="btn primary" onClick={() => { finish(m.id, lesson.id); router.push(nxt.href); }}>
                {isDone ? "Next" : "Got it, next"}: {nxt.label} <Icon name="chev" size={15} />
              </button>
            </div>
          </article>
        </div>
      </Page>
    </GlossaryCtx.Provider>
  );
}
