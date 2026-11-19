"use client";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { uid, type KnowledgeSkill } from "@/lib/sr6/character";
import { ASPECT_SKILLS, ATTR_ABBR, FREE_SPEC_SKILLS, KARMA, SKILLS, skillAvailable, type SkillDef } from "@/lib/sr6/data";
import { budget, derive, karmaForRanks, knowledgePoints } from "@/lib/sr6/derive";
import { sfxUi } from "@/lib/sound";
import { Field, Note, Stepper, type StepProps } from "../ui";

const GROUPS: { id: SkillDef["group"]; label: string }[] = [
  { id: "combat", label: "Combat" }, { id: "physical", label: "Physical" }, { id: "social", label: "Social" }, { id: "tech", label: "Technical" },
  { id: "mental", label: "Awareness" }, { id: "vehicle", label: "Vehicles" }, { id: "magic", label: "Magic and Resonance" },
];

export function SkillsPage({ c, patch }: StepProps) {
  const b = budget(c);
  const d = derive(c);
  const [q, setQ] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [kn, setKn] = useState("");
  const [kind, setKind] = useState<KnowledgeSkill["kind"]>("knowledge");
  const maxFor = (id: string) => (c.qualities.some((x) => x.name.startsWith("Aptitude") && x.note === id) ? 7 : 6);
  const closed = (s: SkillDef) => (c.magicType === "aspected" && c.aspect && (ASPECT_SKILLS as readonly string[]).includes(s.id) && s.id !== c.aspect ? `Your aspect is ${c.aspect}` : undefined);
  const list = useMemo(() => SKILLS.filter((s) => skillAvailable(s, c.magicType, c.adeptPowers)
    && (!q || s.name.toLowerCase().includes(q.toLowerCase()) || s.specs.some((x) => x.toLowerCase().includes(q.toLowerCase())))
    && (!onlyMine || (c.skills[s.id]?.pts ?? 0) + (c.skills[s.id]?.kar ?? 0) > 0)), [c.magicType, c.adeptPowers, c.skills, q, onlyMine]);
  const hidden = SKILLS.filter((s) => !skillAvailable(s, c.magicType, c.adeptPowers)).map((s) => s.name);
  const topRank = Object.entries(c.skills).filter(([id, e]) => e.pts + e.kar >= maxFor(id)).map(([id]) => id);
  const knowledgeUsed = knowledgePoints(c);

  const set = (id: string, fn: (e: { pts: number; kar: number; spec?: string; specVia?: "points" | "karma" }) => void) =>
    patch((x) => {
      const e = x.skills[id] ?? { pts: 0, kar: 0 };
      fn(e);
      if (e.pts + e.kar <= 0) delete x.skills[id]; else x.skills[id] = e;
    });

  const setSpec = (id: string, spec: string) => set(id, (e) => {
    if (!spec) { delete e.spec; delete e.specVia; return; }
    if (!e.spec) e.specVia = FREE_SPEC_SKILLS.includes(id) ? "points" : b.skills.left > 0 ? "points" : "karma";
    e.spec = spec;
    sfxUi("add");
  });

  return (
    <div>
      {!c.priorities.skills && <div className="mb-3"><Note tone="warn">Choose a Skills priority to get points to spend.</Note></div>}
      {topRank.length > 1 && <div className="mb-3"><Note tone="error">Only one skill can sit at the creation maximum. Lower one of: {topRank.map((id) => SKILLS.find((s) => s.id === id)?.name).join(", ")}.</Note></div>}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-sm">
          <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input className="field !pl-8" placeholder="Filter skills or specializations" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter skills" />
        </div>
        <label className="flex items-center gap-2 text-sm text-dim"><input type="checkbox" className="accent-[var(--accent)]" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Only skills I have</label>
      </div>

      <div className="hidden grid-cols-[minmax(10rem,1.3fr)_repeat(2,minmax(6.5rem,auto))_3.5rem_minmax(10rem,1fr)_4.5rem] gap-x-2 border-b border-line pb-1.5 text-[10px] uppercase tracking-widest text-dim md:grid">
        <span>Skill</span><span className="text-center">Points <b className="num text-fg">{b.skills.left}</b></span><span className="text-center">Karma <b className="num text-fg">{b.karma.left}</b></span><span className="text-center">Rank</span><span>Specialization</span><span className="text-right">Pool</span>
      </div>
      {GROUPS.map((g) => {
        const items = list.filter((s) => s.group === g.id);
        if (!items.length) return null;
        return (
          <section key={g.id}>
            <h3 className="wz-code mt-5 text-[11px] uppercase text-accent">{g.label}</h3>
            <ul>
              {items.map((s) => {
                const e = c.skills[s.id] ?? { pts: 0, kar: 0 };
                const rank = e.pts + e.kar;
                const max = maxFor(s.id);
                const attr = s.attr === "magic" ? d.magic : s.attr === "resonance" ? d.resonance : d.attrs[s.attr];
                const pool = rank > 0 ? rank + attr : s.untrained ? Math.max(0, attr - 1) : 0;
                const shut = closed(s);
                const kCost = karmaForRanks(e.pts, e.kar, KARMA.skillRank);
                return (
                  <li key={s.id} className={clsx("grid grid-cols-2 items-center gap-x-2 gap-y-2 border-b border-line/60 py-2.5 md:grid-cols-[minmax(10rem,1.3fr)_repeat(2,minmax(6.5rem,auto))_3.5rem_minmax(10rem,1fr)_4.5rem]", rank > 0 && "bg-accent/[.03]", shut && "opacity-45")}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-display font-semibold">{s.name}</span>
                        <span className="num text-xs text-faint">{ATTR_ABBR[s.attr]}{s.untrained ? "" : " · no default"}</span>
                      </div>
                      <div className="truncate text-xs text-dim">{shut ?? (kCost ? `${kCost} Karma spent` : s.alt ?? "")}</div>
                    </div>
                    <div className="flex items-baseline justify-end gap-2 md:hidden"><span className="text-xs text-faint">rank</span><span className="wz-num">{rank}</span><span className="text-xs text-faint">pool</span><span className="num font-semibold text-accent">{pool}</span></div>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] uppercase tracking-widest text-faint md:hidden">Points</span>
                      <Stepper size="sm" label={`${s.name} points`} value={e.pts} min={0} max={max - e.kar} disableUp={b.skills.left <= 0 || !!shut} onChange={(v) => set(s.id, (x) => { x.pts = v; })} />
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] uppercase tracking-widest text-faint md:hidden">Karma</span>
                      <Stepper size="sm" label={`${s.name} Karma ranks`} value={e.kar} min={0} max={max - e.pts} disableUp={b.karma.left < KARMA.skillRank(rank + 1) || rank >= max || !!shut} onChange={(v) => set(s.id, (x) => { x.kar = v; })} />
                    </div>
                    <div className="wz-num text-center max-md:hidden">{rank || <span className="text-faint">0</span>}</div>
                    <div className="col-span-2 md:col-span-1">
                      {rank > 0 ? (
                        <div className="flex items-center gap-1.5">
                          {s.specs.length > 0 ? (
                            <select className="field !py-1.5 text-sm" aria-label={`${s.name} specialization`} value={e.spec ?? ""} onChange={(ev) => setSpec(s.id, ev.target.value)}
                              disabled={!e.spec && b.skills.left <= 0 && b.karma.left < KARMA.specialization}>
                              <option value="">No specialization</option>
                              {s.specs.map((sp) => <option key={sp}>{sp}</option>)}
                            </select>
                          ) : (
                            <input className="field !py-1.5 text-sm" placeholder={FREE_SPEC_SKILLS.includes(s.id) ? "Weapon (free, required)" : "Specialization"} value={e.spec ?? ""} onChange={(ev) => setSpec(s.id, ev.target.value)} aria-label={`${s.name} specialization`} />
                          )}
                          {e.spec && !FREE_SPEC_SKILLS.includes(s.id) && (
                            <button type="button" className="chip shrink-0 !py-0.5 text-[11px]" title="Pay for this specialization with a skill point or with Karma"
                              onClick={() => set(s.id, (x) => { x.specVia = x.specVia === "karma" ? "points" : "karma"; })}>
                              {e.specVia === "karma" ? `${KARMA.specialization} K` : "1 pt"}
                            </button>
                          )}
                        </div>
                      ) : <span className="text-xs text-faint max-md:hidden">Needs a rank first</span>}
                    </div>
                    <div className="num text-right font-semibold text-accent max-md:hidden" title={e.spec ? `${pool + 2} with ${e.spec}` : undefined}>{pool}{e.spec ? <span className="text-xs text-dim"> ({pool + 2})</span> : null}</div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {hidden.length > 0 && <p className="mt-3 text-xs text-faint">Hidden for your magic type: {hidden.join(", ")}.</p>}

      <section className="mt-10">
        <h3 className="mb-1 text-xl font-semibold">Knowledge and languages</h3>
        <p className="mb-3 max-w-2xl text-sm text-dim">{d.free.knowledge} free points (your Logic) plus one native language. A knowledge skill takes a point; another language takes 1, Specialist 2, Expert 3. Extra points cost {KARMA.knowledge} Karma each.</p>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1"><Field label="New entry"><input className="field" value={kn} onChange={(e) => setKn(e.target.value)} placeholder="Seattle gangs, Sperethiel, Corporate security…"
            onKeyDown={(e) => { if (e.key === "Enter" && kn.trim()) { patch((x) => { x.knowledge.push({ id: uid("k"), name: kn.trim(), kind, native: kind === "language" && !x.knowledge.some((k) => k.native) }); }); setKn(""); sfxUi("add"); } }} /></Field></div>
          <div className="w-40"><Field label="Type"><select className="field" value={kind} onChange={(e) => setKind(e.target.value as KnowledgeSkill["kind"])}><option value="knowledge">Knowledge</option><option value="language">Language</option></select></Field></div>
          <button className="btn" disabled={!kn.trim()} onClick={() => { patch((x) => { x.knowledge.push({ id: uid("k"), name: kn.trim(), kind, native: kind === "language" && !x.knowledge.some((k) => k.native) }); }); setKn(""); sfxUi("add"); }}>Add</button>
        </div>
        <ul className="flex flex-wrap gap-2">
          {c.knowledge.map((k) => (
            <li key={k.id} className="chip on sel-in">
              {k.name}
              {k.kind === "language" && !k.native ? (
                <select className="bg-transparent text-xs opacity-80" value={k.level ?? 1} aria-label={`${k.name} level`} onChange={(e) => patch((x) => { const y = x.knowledge.find((z) => z.id === k.id); if (y) y.level = Number(e.target.value); })}>
                  <option value={1}>language, 1 pt</option><option value={2}>Specialist, 2 pts</option><option value={3}>Expert, 3 pts</option>
                </select>
              ) : <span className="text-xs opacity-70">{k.native ? "native" : "knowledge"}</span>}
              <button className="ml-1 hover:text-danger" onClick={() => { patch((x) => { x.knowledge = x.knowledge.filter((y) => y.id !== k.id); }); sfxUi("remove"); }} aria-label={`Remove ${k.name}`}>×</button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-faint">{knowledgeUsed} of {d.free.knowledge} free points used{knowledgeUsed > d.free.knowledge ? `; ${knowledgeUsed - d.free.knowledge} cost ${(knowledgeUsed - d.free.knowledge) * KARMA.knowledge} Karma` : ""}.</p>
      </section>
    </div>
  );
}
