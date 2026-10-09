"use client";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { uid, type KnowledgeSkill } from "@/lib/sr6/character";
import { ATTR_ABBR, SKILLS, skillAvailable, type SkillDef } from "@/lib/sr6/data";
import { budget, derive } from "@/lib/sr6/derive";
import { Budget, Field, Note, StepHeader, Stepper, type StepProps } from "../ui";

const GROUPS: { id: SkillDef["group"]; label: string }[] = [
  { id: "combat", label: "Combat" },
  { id: "physical", label: "Physical" },
  { id: "social", label: "Social" },
  { id: "tech", label: "Technical" },
  { id: "mental", label: "Awareness" },
  { id: "vehicle", label: "Vehicles" },
  { id: "magic", label: "Magic" },
];

export function Skills({ c, patch }: StepProps) {
  const b = budget(c);
  const d = derive(c);
  const [q, setQ] = useState("");
  const [kn, setKn] = useState("");
  const [kind, setKind] = useState<KnowledgeSkill["kind"]>("knowledge");

  const maxFor = (id: string) => (c.qualities.some((x) => x.name.startsWith("Aptitude") && x.note === id) ? 7 : 6);
  const entry = (id: string) => c.skills[id] ?? { pts: 0, kar: 0 };

  const list = useMemo(() => SKILLS.filter((s) => skillAvailable(s, c.magicType) && (!q || s.name.toLowerCase().includes(q.toLowerCase()))), [c.magicType, q]);
  const hiddenMagic = SKILLS.filter((s) => !skillAvailable(s, c.magicType)).map((s) => s.name);
  const knowledgeUsed = c.knowledge.filter((k) => !k.native).length;

  const setPts = (id: string, v: number) =>
    patch((x) => {
      const e = x.skills[id] ?? { pts: 0, kar: 0 };
      e.pts = v;
      if (e.pts + e.kar <= 0) delete x.skills[id]; else x.skills[id] = e;
    });
  const setSpec = (id: string, spec: string) =>
    patch((x) => {
      const e = x.skills[id];
      if (!e) return;
      if (spec) { e.spec = spec; e.specVia = e.specVia ?? "points"; } else { delete e.spec; delete e.specVia; }
    });

  return (
    <div>
      <StepHeader title="Skills" lead="One skill point buys one rank, or one specialization (+2 dice when it applies). Rank 6 is the creation maximum for a single skill (7 with Aptitude); a skill can carry only one specialization." rule={/^Skills$/i} />
      <div className="mb-4 grid max-w-2xl gap-4 sm:grid-cols-2">
        <Budget label="Skill points left" left={b.skills.left} total={b.skills.total} />
        <input className="field" placeholder="Filter skills" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter skills" />
      </div>
      {!c.priorities.skills && <div className="mb-4"><Note tone="warn">Choose a Skills priority to get points to spend.</Note></div>}
      {hiddenMagic.length > 0 && <p className="mb-4 text-xs text-faint">Hidden for your magic type: {hiddenMagic.join(", ")}.</p>}

      <div className="space-y-6">
        {GROUPS.map((g) => {
          const items = list.filter((s) => s.group === g.id);
          if (!items.length) return null;
          return (
            <section key={g.id}>
              <h3 className="mb-2 font-display text-lg font-semibold text-dim">{g.label}</h3>
              <ul className="grid gap-2 xl:grid-cols-2">
                {items.map((s) => {
                  const e = entry(s.id);
                  const rank = e.pts + e.kar;
                  const attrVal = s.attr === "magic" ? d.magic : s.attr === "resonance" ? d.resonance : d.attrs[s.attr];
                  const pool = rank > 0 ? rank + attrVal : 0;
                  return (
                    <li key={s.id} className={clsx("panel quiet grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 p-3", rank > 0 && "border-linehi")}>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-display font-semibold">{s.name}</span>
                          <span className="num text-xs text-faint">{ATTR_ABBR[s.attr]}{s.untrained ? "" : " · no default"}</span>
                          {rank > 0 && <span className="num text-xs text-accent">pool {pool}{e.spec ? ` (${pool + 2} with ${e.spec})` : ""}</span>}
                        </div>
                        {s.alt && <div className="text-xs text-faint">{s.alt}</div>}
                      </div>
                      <Stepper
                        label={s.name}
                        value={e.pts}
                        min={0}
                        max={maxFor(s.id) - e.kar}
                        disableUp={b.skills.left <= 0}
                        onChange={(v) => setPts(s.id, v)}
                      />
                      {rank > 0 && (
                        <div className="col-span-2">
                          {s.specs.length > 0 ? (
                            <select
                              className="field"
                              aria-label={`${s.name} specialization`}
                              value={e.spec ?? ""}
                              onChange={(ev) => setSpec(s.id, ev.target.value)}
                              disabled={!e.spec && b.skills.left <= 0}
                            >
                              <option value="">No specialization</option>
                              {s.specs.map((sp) => <option key={sp}>{sp}</option>)}
                            </select>
                          ) : (
                            <input className="field" placeholder="Specialization (costs 1 point)" value={e.spec ?? ""} onChange={(ev) => setSpec(s.id, ev.target.value)} aria-label={`${s.name} specialization`} />
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <section className="mt-10">
        <h3 className="mb-1 text-xl font-semibold">Knowledge and languages</h3>
        <p className="mb-3 max-w-2xl text-sm text-dim">You get {d.free.knowledge} free (equal to Logic) plus one free native language. Extra ones cost 3 Karma each.</p>
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="min-w-56 flex-1"><Field label="New entry"><input className="field" value={kn} onChange={(e) => setKn(e.target.value)} placeholder="Urban brawl, Seattle gangs, Japanese..." /></Field></div>
          <div className="w-44"><Field label="Type"><select className="field" value={kind} onChange={(e) => setKind(e.target.value as KnowledgeSkill["kind"])}><option value="knowledge">Knowledge</option><option value="language">Language</option></select></Field></div>
          <div className="self-end"><button className="btn" disabled={!kn.trim()} onClick={() => { patch((x) => { x.knowledge.push({ id: uid("k"), name: kn.trim(), kind, native: kind === "language" && !x.knowledge.some((k) => k.native) }); }); setKn(""); }}>Add</button></div>
        </div>
        <ul className="flex flex-wrap gap-2">
          {c.knowledge.map((k) => (
            <li key={k.id} className="chip on">
              {k.name} <span className="text-xs opacity-70">{k.kind === "language" ? (k.native ? "native" : "language") : "knowledge"}</span>
              <button className="ml-1 hover:text-danger" onClick={() => patch((x) => { x.knowledge = x.knowledge.filter((y) => y.id !== k.id); })} aria-label={`Remove ${k.name}`}>×</button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-faint">{knowledgeUsed} of {d.free.knowledge} free slots used{knowledgeUsed > d.free.knowledge ? `, ${knowledgeUsed - d.free.knowledge} cost Karma` : ""}.</p>
      </section>
    </div>
  );
}
