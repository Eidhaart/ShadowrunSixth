"use client";
import clsx from "clsx";
import { ATTRIBUTES, ATTR_LABEL, METATYPES, SKILL_BY_ID, MAGIC_TYPE_LABEL } from "@/lib/sr6/data";
import { budget, derive, validate } from "@/lib/sr6/derive";
import { Note, StepHeader, type StepProps } from "../ui";

export function Review({ c }: StepProps) {
  const d = derive(c);
  const b = budget(c);
  const issues = validate(c);
  const errors = issues.filter((i) => i.level === "error");
  const warns = issues.filter((i) => i.level === "warn");

  return (
    <div>
      <StepHeader title="Review and finish" lead="Every rule is checked against the book. Fix the red items before you save. Amber items are worth a look but will not stop you." />
      {errors.length === 0 && <div className="mb-4"><Note>Everything checks out. Saving creates a live character sheet with all your numbers automated.</Note></div>}
      {errors.length > 0 && (
        <section className="mb-4" aria-label="Problems">
          <h3 className="mb-2 text-lg font-semibold text-danger">Fix these</h3>
          <ul className="space-y-1.5">{errors.map((i, k) => <li key={k}><Note tone="error"><b>{i.where}:</b> {i.text}</Note></li>)}</ul>
        </section>
      )}
      {warns.length > 0 && (
        <section className="mb-6" aria-label="Warnings">
          <h3 className="mb-2 text-lg font-semibold">Worth a look</h3>
          <ul className="space-y-1.5">{warns.map((i, k) => <li key={k}><Note tone="warn"><b>{i.where}:</b> {i.text}</Note></li>)}</ul>
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
          <h3 className="mb-2 text-lg font-semibold">Qualities</h3>
          <ul className="text-sm">
            {c.qualities.map((q, i) => <li key={i} className="flex justify-between"><span>{q.name}{q.level > 1 ? ` ${q.level}` : ""}{q.note ? ` (${SKILL_BY_ID[q.note]?.name ?? q.note})` : ""}</span><span className={clsx("num", q.kind === "positive" ? "text-dim" : "text-cyan")}>{q.kind === "positive" ? "-" : "+"}{q.karma * q.level} K</span></li>)}
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
