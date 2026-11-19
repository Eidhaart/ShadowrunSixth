"use client";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { KARMA } from "@/lib/sr6/data";
import { rules } from "@/lib/house/rules";
import { RuleLink } from "../ui";

const METHODS = [
  { id: "priority", name: "Priority", blurb: "Rank five areas A to E: metatype, attributes, magic or resonance, skills and resources. What you rank high, you get a lot of.", core: true },
  { id: "pointbuy", name: "Point Buy", blurb: "Spend a single pool of points on everything." },
  { id: "sum10", name: "Sum to Ten", blurb: "Priorities as numbers that add up to ten, repeats allowed." },
  { id: "karma", name: "Karma", blurb: "Buy every rank with Karma." },
  { id: "lifepath", name: "Life Modules", blurb: "Build a life story stage by stage." },
];

/** First page: the generator. The core rulebook has one; the others live in later books. */
export function Method() {
  const r = rules();
  const facts: [string, string][] = [
    ["Starting Karma", `${KARMA.customization}`],
    ["Karma left over at most", `${KARMA.maxUnspent}`],
    ["Qualities at most", `${KARMA.maxQualities}`],
    ["Karma from negative qualities at most", `${KARMA.maxQualityKarma}`],
    ["Highest Availability", `${r.creationAvail}`],
    ["Karma to nuyen", `${KARMA.nuyenPerKarma.toLocaleString("en-US")}¥ each`],
    ["Nuyen carried into play at most", "5,000¥"],
    ["Skill rank at most", "6 (7 with Aptitude), only one at the top"],
  ];
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="grid gap-3 sm:grid-cols-2">
        {METHODS.map((m, i) => (
          <div key={m.id} aria-current={m.core ? "true" : undefined} style={{ animationDelay: `${i * 60}ms` }}
            className={clsx("wz-rise relative border p-4", m.core ? "border-accent bg-accent/[.07] sm:col-span-2" : "border-line opacity-55")}>
            <div className="flex items-center justify-between gap-2">
              <span className={clsx("font-display text-xl font-bold", m.core && "text-accent")}>{m.name}</span>
              {m.core ? <span className="chip on !py-0.5 text-xs"><Icon name="check" size={12} /> In use</span> : <span className="text-[10px] uppercase tracking-widest text-faint">Not in the core book</span>}
            </div>
            <p className="mt-1.5 text-sm text-dim">{m.blurb}</p>
            {m.core && <RuleLink match={/^Select Character Priorities$/i} />}
          </div>
        ))}
      </div>
      <section className="panel quiet p-4">
        <h3 className="wz-code mb-3 text-xs uppercase text-accent">Build parameters</h3>
        <dl className="divide-y divide-line">
          {facts.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 py-2 text-sm">
              <dt className="text-dim">{k}</dt><dd className="num text-right font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-faint">House rules in Settings can change Karma and Availability. Everything else follows the book.</p>
      </section>
    </div>
  );
}
