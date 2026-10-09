"use client";
import Link from "next/link";
import { Page } from "@/components/Page";
import { Icon } from "@/components/Icon";
import { MODULE_LIST } from "@/lib/academy/modules";
import { useAcademy } from "@/lib/academy/progress";
import type { ModuleDef } from "@/lib/academy/types";

function Art({ id }: { id: ModuleDef["id"] }) {
  if (id === "matrix")
    return (
      <svg viewBox="0 0 320 140" className="h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="mx" x1="0" x2="1"><stop offset="0" stopColor="var(--cyan)" stopOpacity=".05" /><stop offset="1" stopColor="var(--cyan)" stopOpacity=".5" /></linearGradient>
        </defs>
        {Array.from({ length: 9 }, (_, i) => <line key={i} x1={20 + i * 36} y1="0" x2={20 + i * 36} y2="140" stroke="var(--cyan)" strokeOpacity=".13" />)}
        {Array.from({ length: 5 }, (_, i) => <line key={i} x1="0" y1={20 + i * 28} x2="320" y2={20 + i * 28} stroke="var(--cyan)" strokeOpacity=".13" />)}
        <path d="M20 112 H92 V76 H152 V104 H214 V44 H300" fill="none" stroke="url(#mx)" strokeWidth="2.5" />
        <path d="M20 40 H70 V20 H130 V60 H190 V28 H300" fill="none" stroke="var(--accent)" strokeOpacity=".5" strokeWidth="1.5" />
        {[[92, 76], [152, 104], [214, 44], [130, 60], [190, 28]].map(([x, y], i) => <rect key={i} x={x - 5} y={y - 5} width="10" height="10" fill="var(--bg)" stroke="var(--cyan)" />)}
        <rect x="262" y="26" width="38" height="36" fill="none" stroke="var(--accent)" strokeWidth="2" />
        <path d="M270 44 h22 M281 34 v20" stroke="var(--accent)" strokeWidth="2" />
      </svg>
    );
  return (
    <svg viewBox="0 0 320 140" className="h-full w-full" aria-hidden>
      <g fill="none" stroke="var(--astral)" strokeOpacity=".6">
        <circle cx="160" cy="70" r="52" strokeWidth="1.5" />
        <circle cx="160" cy="70" r="36" strokeOpacity=".35" />
        <path d="M160 18 L205 96 H115 Z" strokeWidth="1.6" />
        <path d="M160 122 L115 44 H205 Z" strokeWidth="1.6" stroke="var(--accent)" />
      </g>
      {Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2;
        return <circle key={i} cx={+(160 + Math.cos(a) * 64).toFixed(2)} cy={+(70 + Math.sin(a) * 64).toFixed(2)} r={i % 3 === 0 ? 2.4 : 1.2} fill="var(--accent)" fillOpacity=".7" />;
      })}
      <circle cx="160" cy="70" r="5" fill="var(--astral)" />
    </svg>
  );
}

function ModuleCard({ m }: { m: ModuleDef }) {
  const lessons = useAcademy((s) => s.lessons);
  const sim = useAcademy((s) => s.sims[m.id]);
  const exam = useAcademy((s) => s.examBest[m.id]);
  const done = m.lessons.filter((l) => lessons[`${m.id}/${l.id}`]).length;
  const next = m.lessons.find((l) => !lessons[`${m.id}/${l.id}`]);
  const minutes = m.lessons.reduce((a, l) => a + l.minutes, 0);
  const pct = Math.round((done / m.lessons.length) * 100);
  return (
    <article className="panel flex flex-col overflow-hidden">
      <div className="h-36 border-b border-line bg-bg2"><Art id={m.id} /></div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h2 className="text-3xl font-bold">{m.title}</h2>
          <p className="mt-1 text-dim">{m.tagline}</p>
        </div>
        <p className="text-sm text-dim">{m.lessons.length} short lessons · about {minutes} minutes · a playable run at the end</p>
        <div>
          <div className="mb-1 flex justify-between text-xs text-dim num"><span>{done}/{m.lessons.length} lessons</span><span>{pct}%</span></div>
          <div className="meter"><i style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="chip">{sim ? `Run ${"★".repeat(sim.bestStars)}${"☆".repeat(4 - sim.bestStars)}` : "Run not tried"}</span>
          <span className="chip">{exam !== undefined ? `Exam best ${exam}/${m.exam.length}` : "Exam not taken"}</span>
        </div>
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Link className="btn primary" href={next ? `/learn/${m.id}/${next.id}` : `/learn/${m.id}/sim`}>
            <Icon name="chev" size={16} /> {done === 0 ? "Start" : next ? "Continue" : "Run the simulation"}
          </Link>
          <Link className="btn" href={`/learn/${m.id}`}>Lesson map</Link>
        </div>
      </div>
    </article>
  );
}

export default function LearnHub() {
  return (
    <Page wide title="Academy" kicker="The two parts of Shadowrun that trip everyone up, explained in plain words. Read a little, play with the numbers, then run a mission.">
      <div className="grid gap-5 lg:grid-cols-2">
        {MODULE_LIST.map((m) => <ModuleCard key={m.id} m={m} />)}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ["1", "Read", "Each lesson is a few minutes. Dotted words explain themselves when you tap them."],
          ["2", "Play", "Every lesson has a toy you can poke: change a number, roll the dice, see what happens."],
          ["3", "Run it", "A full scenario with the real rules and real dice. Mistakes cost you, and the debrief tells you why."],
        ].map(([n, h, t]) => (
          <div key={n} className="panel quiet p-4">
            <div className="mb-1 flex items-center gap-2 font-display text-lg font-semibold"><span className="num text-accent">{n}</span> {h}</div>
            <p className="text-sm text-dim">{t}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 max-w-2xl text-sm text-faint">These lessons are written in our own words to teach the Sixth World rules. Where a rule has exact wording or tables, use the Library with your own imported book.</p>
    </Page>
  );
}
