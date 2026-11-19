"use client";
import { ATTRIBUTES, ATTR_LABEL, METATYPES, SKILL_BY_ID, MAGIC_TYPE_LABEL } from "@/lib/sr6/data";
import { budget, derive, validate } from "@/lib/sr6/derive";
import { Note, type StepProps } from "../ui";
import { issuePage, PAGE_LABEL, useGo } from "../wizard/nav";
import { useMemo } from "react";
import { useRulebook } from "@/lib/store/rulebook";
import { parseQualities } from "@/lib/sr6/qualities";
import { QualityRow } from "@/components/QualityRow";

export function Review({ c }: StepProps) {
  const book = useRulebook((s) => s.book);
  const qdefs = useMemo(() => parseQualities(book), [book]);
  const d = derive(c);
  const b = budget(c);
  const issues = validate(c);
  const errors = issues.filter((i) => i.level === "error");
  const warns = issues.filter((i) => i.level === "warn");
  const go = useGo();
  const where = (i: (typeof issues)[number]) => {
    const id = issuePage(i);
    if (id === "review") return <b>{i.where}:</b>;
    const label = PAGE_LABEL[id] ?? i.where;
    return <button type="button" className="font-bold underline decoration-dotted underline-offset-2 hover:text-accent" onClick={() => go(id)}>{label}:</button>;
  };

  return (
    <div>
      {errors.length === 0 && <div className="mb-4"><Note>Everything checks out. Saving creates a live character sheet with all your numbers automated.</Note></div>}
      {errors.length > 0 && (
        <section className="mb-4" aria-label="Problems">
          <h3 className="mb-2 text-lg font-semibold text-danger">Fix these</h3>
          <ul className="space-y-1.5">{errors.map((i, k) => <li key={k}><Note tone="error">{where(i)} {i.text}</Note></li>)}</ul>
        </section>
      )}
      {warns.length > 0 && (
        <section className="mb-6" aria-label="Warnings">
          <h3 className="mb-2 text-lg font-semibold">Worth a look</h3>
          <ul className="space-y-1.5">{warns.map((i, k) => <li key={k}><Note tone="warn">{where(i)} {i.text}</Note></li>)}</ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel quiet p-4">
          <h3 className="mb-2 text-lg font-semibold">{c.alias || c.name || "Unnamed runner"}</h3>
          <p className="text-sm text-dim">{METATYPES[c.metatype].name}{c.magicType !== "mundane" ? `, ${MAGIC_TYPE_LABEL[c.magicType].toLowerCase()}` : ", mundane"}. {c.concept}</p>
          <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
            {ATTRIBUTES.map((a) => <div key={a} className="border border-line py-1"><dt className="text-[11px] text-faint">{ATTR_LABEL[a]}</dt><dd className="num text-lg font-semibold">{d.attrs[a]}</dd></div>)}
          </dl>
        </section>
        <section className="panel quiet p-4">
          <h3 className="mb-2 text-lg font-semibold">Skills</h3>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {d.skills.map((s) => <li key={s.id} className="flex justify-between"><span>{SKILL_BY_ID[s.id]?.name}{s.spec ? ` (${s.spec})` : ""}</span><span className="num text-dim">{s.rank} / pool {s.pool}</span></li>)}
            {d.skills.length === 0 && <li className="text-dim">No skills chosen.</li>}
          </ul>
        </section>
        <section className="panel quiet p-4">
          <h3 className="mb-2 flex items-baseline justify-between text-lg font-semibold">Qualities<span className="text-xs font-normal text-faint">tap one to read it</span></h3>
          <ul className="divide-y divide-line">
            {c.qualities.map((q, i) => <li key={i}><QualityRow compact q={q} def={qdefs.find((d) => d.id === q.id)} /></li>)}
            {c.qualities.length === 0 && <li className="text-dim">None.</li>}
          </ul>
        </section>
        <section className="panel quiet p-4">
          <h3 className="mb-2 text-lg font-semibold">Gear and funds</h3>
          <ul className="text-sm">
            {c.gear.map((g) => <li key={g.id} className="flex justify-between"><span>{g.name}{g.qty > 1 ? ` ×${g.qty}` : ""}</span><span className="num text-dim">{(g.cost * g.qty).toLocaleString("en-US")}¥</span></li>)}
            {c.gear.length === 0 && <li className="text-dim">No gear.</li>}
          </ul>
          <div className="mt-2 border-t border-line pt-2 text-sm">Starting nuyen after purchases: <b className="num">{b.nuyen.left.toLocaleString("en-US")}¥</b></div>
        </section>
      </div>
    </div>
  );
}
