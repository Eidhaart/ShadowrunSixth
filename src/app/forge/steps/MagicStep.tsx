"use client";
import { useMemo, useState } from "react";
import { useRulebook } from "@/lib/store/rulebook";
import { adeptPowerList, complexFormList, ritualList, spellList, type BookEntry } from "@/lib/sr6/bookLists";
import { budget, canLearnSpells, canSelectRituals, derive } from "@/lib/sr6/derive";
import { POWER_POINT } from "@/lib/sr6/advance";
import { rules } from "@/lib/house/rules";
import { Budget, Note, StepHeader, Stepper, type StepProps } from "../ui";

function Picker({ label, entries, picked, onAdd, onRemove, limit, used = picked.length, canAdd = true, karmaLeft }: {
  label: string; entries: BookEntry[]; picked: string[]; onAdd: (name: string) => void; onRemove: (name: string) => void; limit: number; used?: number; canAdd?: boolean; karmaLeft: number;
}) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const groups = useMemo(() => Array.from(new Set(entries.map((e) => e.group))), [entries]);
  const shown = entries.filter((e) => (!q || e.name.toLowerCase().includes(q.toLowerCase())) && (!group || e.group === group)).slice(0, 80);
  // past the free picks each one is bought with 5 Karma, like any advancement
  const full = used >= limit;
  const blocked = !canAdd || (full && (!rules().buyCreationMagicWithKarma || karmaLeft < 5));
  const addLabel = full && rules().buyCreationMagicWithKarma ? "Add · 5 Karma" : "Add";
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <div className="mb-2 flex flex-wrap gap-2">
          <input className="field min-w-40 flex-1" placeholder={`Search ${label.toLowerCase()}`} value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Search ${label}`} />
          {groups.length > 1 && (
            <select className="field w-40" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Category">
              <option value="">All types</option>
              {groups.map((g) => <option key={g}>{g}</option>)}
            </select>
          )}
        </div>
        {entries.length === 0 && <Note>You can enter a name below.</Note>}
        <ul className="max-h-[26rem] divide-y divide-line overflow-auto border border-line">
          {shown.map((e) => {
            const on = picked.includes(e.name);
            return (
              <li key={e.id} className="flex items-start gap-3 p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="font-display font-semibold">{e.name} <span className="text-xs font-normal text-faint">{e.group} · p.{e.page}</span></div>
                  <div className="line-clamp-2 text-xs text-dim">{e.summary}</div>
                </div>
                <button className="btn small" disabled={on || blocked} onClick={() => onAdd(e.name)}>{on ? "Added" : addLabel}</button>
              </li>
            );
          })}
        </ul>
        <form className="mt-2 flex gap-2" onSubmit={(e) => {
          e.preventDefault();
          const name = String(new FormData(e.currentTarget).get("free") ?? "").trim();
          if (!blocked && name && !picked.some((n) => n.toLowerCase() === name.toLowerCase())) {
            onAdd(name);
            e.currentTarget.reset();
          }
        }}>
          <input name="free" className="field" placeholder="Or type a name" aria-label={`Custom ${label.toLowerCase()} name`} />
          <button className="btn" type="submit" disabled={blocked}>{addLabel}</button>
        </form>
      </div>
      <div>
        <div className="mb-2 font-display font-semibold">Your {label.toLowerCase()} ({picked.length})</div>
        {picked.length === 0 && <p className="text-sm text-dim">Nothing chosen yet.</p>}
        <ul className="flex flex-wrap gap-2">
          {picked.map((n) => (
            <li key={n} className="chip on">{n}<button className="ml-1 hover:text-danger" onClick={() => onRemove(n)} aria-label={`Remove ${n}`}>×</button></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Karma for grade g, as on the advancement table (house rules can scale it). */
const gradeCost = (g: number) => Math.max(1, Math.round(((10 + g) * rules().karmaCostPct) / 100));

/**
 * Initiation (or submersion for technomancers) bought with creation Karma. Each grade costs 10 +
 * the new grade, raises the Magic or Resonance ceiling by one and brings a metamagic or echo; adepts
 * and mystic adepts may take a Power Point instead.
 */
function Initiation({ c, patch }: StepProps) {
  const techno = c.magicType === "technomancer";
  const grade = c.startGrade ?? 0;
  const meta = c.startMeta ?? [];
  const canPP = c.magicType === "adept" || c.magicType === "mystic";
  const word = techno ? "Submersion" : "Initiation";
  const thing = techno ? "echo" : "metamagic";
  const total = Array.from({ length: grade }, (_, i) => gradeCost(i + 1)).reduce((a, b) => a + b, 0);
  const setMeta = (i: number, v: string) => patch((x) => { const m = [...(x.startMeta ?? [])]; m[i] = v; x.startMeta = m; });
  return (
    <section className="mb-10">
      <h3 className="mb-1 text-xl font-semibold">{word}</h3>
      <p className="mb-3 max-w-2xl text-sm text-dim">
        Optional. Each grade costs 10 + the new grade in Karma, lets {techno ? "Resonance" : "Magic"} go one higher than 6 and brings one {thing}{canPP ? " or a Power Point" : ""}.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button className="vtt-mini !size-8" disabled={grade <= 0} aria-label="One grade less"
            onClick={() => patch((x) => { x.startGrade = Math.max(0, grade - 1); x.startMeta = (x.startMeta ?? []).slice(0, Math.max(0, grade - 1)); })}>−</button>
          <span className="num w-20 text-center">Grade {grade}</span>
          <button className="vtt-mini !size-8" aria-label="One grade more"
            onClick={() => patch((x) => { x.startGrade = grade + 1; x.startMeta = [...(x.startMeta ?? []).slice(0, grade), ""]; })}>+</button>
        </div>
        <span className="text-sm text-dim">{grade ? <>Costs <b className="num text-fg">{total}</b> Karma{grade > 1 ? ` (${Array.from({ length: grade }, (_, i) => gradeCost(i + 1)).join(" + ")})` : ""}. Next grade: {gradeCost(grade + 1)}.</> : `First grade: ${gradeCost(1)} Karma.`}</span>
      </div>
      {grade > 0 && (
        <ul className="max-w-2xl space-y-1.5">
          {Array.from({ length: grade }, (_, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <span className="num w-16 text-sm text-dim">Grade {i + 1}</span>
              {canPP && (
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={/^power point$/i.test(meta[i] ?? "")} onChange={(e) => setMeta(i, e.target.checked ? POWER_POINT : "")} /> Power Point
                </label>
              )}
              {!/^power point$/i.test(meta[i] ?? "") && (
                <input className="field min-w-48 flex-1" value={meta[i] ?? ""} onChange={(e) => setMeta(i, e.target.value)}
                  placeholder={techno ? "Echo, for example Overclocking" : "Metamagic, for example Centering"} aria-label={`${thing} for grade ${i + 1}`} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MagicStep({ c, patch }: StepProps) {
  const book = useRulebook((s) => s.book);
  const d = derive(c);
  const karmaLeft = budget(c).karma.left;
  const rituals = useMemo(() => ritualList(book), [book]);
  const selectedRituals = c.rituals ?? [];
  const spellPicks = c.spells.length + selectedRituals.length;
  const spellcaster = canLearnSpells(c);
  const canAddRitual = canSelectRituals(c.magicType);
  const spells = useMemo(() => spellList(book), [book]);
  const forms = useMemo(() => complexFormList(book), [book]);
  const powers = useMemo(() => adeptPowerList(book), [book]);
  const spent = c.adeptPowers.reduce((s, p) => s + p.cost, 0);
  const [pq, setPq] = useState("");

  return (
    <div>
      <StepHeader title="Spells, powers and forms" lead="Your free picks come from the Magic or Resonance priority. They use the rating on the priority table, not what you raise it to with Karma." rule={/^Magic Basics$/i} />

      {(canAddRitual || spellPicks > 0) && (
        <section className="mb-10">
          <h3 className="mb-1 text-xl font-semibold">Spells and rituals</h3>
          {!spellcaster && <div className="mb-3"><Note>Spells require a rank in Sorcery or Enchanting.</Note></div>}
          <div className="mb-3 max-w-sm"><Budget label="Shared free picks left" left={d.slots.spells - spellPicks} total={d.slots.spells} /></div>
          <Picker label="Spells" entries={spells} picked={c.spells} limit={d.slots.spells} used={spellPicks} canAdd={spellcaster} karmaLeft={karmaLeft} onAdd={(n) => patch((x) => { x.spells.push(n); })} onRemove={(n) => patch((x) => { x.spells = x.spells.filter((s) => s !== n); })} />
          <h4 className="mb-2 mt-5 font-semibold">Rituals</h4>
          <Picker label="Rituals" entries={rituals} picked={selectedRituals} limit={d.slots.spells} used={spellPicks} canAdd={canAddRitual} karmaLeft={karmaLeft} onAdd={(n) => patch((x) => { (x.rituals ??= []).push(n); })} onRemove={(n) => patch((x) => { x.rituals = (x.rituals ?? []).filter((r) => r !== n); })} />
        </section>
      )}

      {(c.magicType === "adept" || c.magicType === "mystic" || c.adeptPowers.length > 0) && (
        <section className="mb-10">
          <h3 className="mb-1 text-xl font-semibold">Adept powers</h3>
          {c.magicType === "mystic" && (
            <div className="mb-3 max-w-sm">
              <Stepper label="Priority Magic allocated to Power Points" value={c.mysticPriorityPP ?? d.slots.mysticPriorityPP}
                min={0} max={d.slots.mysticPriorityMax} onChange={(n) => patch((x) => { x.mysticPriorityPP = n; })} />
              <p className="mt-1 text-xs text-dim">Each point left in priority Magic gives two spell or ritual picks.</p>
            </div>
          )}
          <div className="mb-3 max-w-sm"><Budget label="Power points left" left={+(d.slots.powerPoints - spent).toFixed(2)} total={d.slots.powerPoints} /></div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <input className="field mb-2" placeholder="Search powers" value={pq} onChange={(e) => setPq(e.target.value)} aria-label="Search powers" />
              <ul className="max-h-[26rem] divide-y divide-line overflow-auto border border-line">
                {powers.filter((p) => !pq || p.name.toLowerCase().includes(pq.toLowerCase())).map((p) => {
                  const have = c.adeptPowers.find((x) => x.name === p.name);
                  return (
                    <li key={p.id} className="flex items-start gap-3 p-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="font-display font-semibold">{p.name} <span className="num text-xs font-normal text-accent">{p.pp} PP{p.perLevel ? " / level" : ""}</span></div>
                        <div className="line-clamp-2 text-xs text-dim">{p.summary}</div>
                      </div>
                      <button className="btn small" disabled={!!have && !p.perLevel || spent + (p.pp ?? 0) > d.slots.powerPoints + 1e-9 || (have?.level ?? 0) >= (p.maxLevel ?? 1)}
                        onClick={() => patch((x) => {
                          const cur = x.adeptPowers.find((y) => y.name === p.name);
                          if (cur) { cur.level = (cur.level ?? 1) + 1; cur.cost = +(cur.cost + (p.pp ?? 0)).toFixed(2); }
                          else x.adeptPowers.push({ name: p.name, cost: p.pp ?? 0, level: 1, effect: p.effect });
                        })}>
                        {have ? (p.perLevel ? "Level up" : "Added") : "Add"}
                      </button>
                    </li>
                  );
                })}
                {powers.length === 0 && <li className="p-3 text-sm text-dim">Mount your rulebook to browse the power list.</li>}
              </ul>
            </div>
            <div>
              <div className="mb-2 font-display font-semibold">Your powers</div>
              <ul className="space-y-1.5">
                {c.adeptPowers.map((p) => (
                  <li key={p.name} className="flex items-center justify-between gap-2 border border-line px-3 py-1.5">
                    <span>{p.name}{(p.level ?? 1) > 1 || powers.find((x) => x.name === p.name)?.perLevel ? ` ${p.level ?? 1}` : ""} <span className="num text-xs text-dim">{p.cost} PP</span></span>
                    <button className="hover:text-danger" onClick={() => patch((x) => { x.adeptPowers = x.adeptPowers.filter((y) => y.name !== p.name); })} aria-label={`Remove ${p.name}`}>×</button>
                  </li>
                ))}
                {c.adeptPowers.length === 0 && <p className="text-sm text-dim">No powers yet.</p>}
              </ul>
              {c.adeptPowers.some((p) => p.effect) && <p className="mt-2 text-xs text-ok">Improved Reflexes is applied to your Reaction and Initiative automatically.</p>}
            </div>
          </div>
        </section>
      )}

      {(c.magicType === "technomancer" || c.complexForms.length > 0) && (
        <section className="mb-10">
          <h3 className="mb-1 text-xl font-semibold">Complex forms</h3>
          <div className="mb-3 max-w-sm"><Budget label="Free forms left" left={d.slots.complexForms - c.complexForms.length} total={d.slots.complexForms} /></div>
          <Picker label="Complex forms" entries={forms} picked={c.complexForms} limit={d.slots.complexForms} canAdd={c.magicType === "technomancer"} karmaLeft={karmaLeft} onAdd={(n) => patch((x) => { x.complexForms.push(n); })} onRemove={(n) => patch((x) => { x.complexForms = x.complexForms.filter((s) => s !== n); })} />
        </section>
      )}

      {c.magicType !== "mundane" && <Initiation c={c} patch={patch} />}

      {c.magicType === "mundane" && <Note>Your runner is mundane, so there is nothing to choose here. Skip ahead to qualities.</Note>}
    </div>
  );
}
