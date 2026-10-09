"use client";
import { useMemo, useState } from "react";
import { useRulebook } from "@/lib/store/rulebook";
import { adeptPowerList, complexFormList, spellList, type BookEntry } from "@/lib/sr6/bookLists";
import { derive } from "@/lib/sr6/derive";
import { Budget, Note, StepHeader, type StepProps } from "../ui";

function Picker({ label, entries, picked, onAdd, onRemove, limit, allowFree = true }: {
  label: string; entries: BookEntry[]; picked: string[]; onAdd: (name: string) => void; onRemove: (name: string) => void; limit: number; allowFree?: boolean;
}) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const groups = useMemo(() => Array.from(new Set(entries.map((e) => e.group))), [entries]);
  const shown = entries.filter((e) => (!q || e.name.toLowerCase().includes(q.toLowerCase())) && (!group || e.group === group)).slice(0, 80);
  const full = picked.length >= limit;
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
        {entries.length === 0 && <Note>Mount your rulebook to browse the list. You can still type names in by hand below.</Note>}
        <ul className="max-h-[26rem] divide-y divide-line overflow-auto border border-line">
          {shown.map((e) => {
            const on = picked.includes(e.name);
            return (
              <li key={e.id} className="flex items-start gap-3 p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="font-display font-semibold">{e.name} <span className="text-xs font-normal text-faint">{e.group} · p.{e.page}</span></div>
                  <div className="line-clamp-2 text-xs text-dim">{e.summary}</div>
                </div>
                <button className="btn small" disabled={on || full} onClick={() => onAdd(e.name)}>{on ? "Added" : "Add"}</button>
              </li>
            );
          })}
        </ul>
        {allowFree && (
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget).get("free") as string; if (f?.trim() && !full) { onAdd(f.trim()); e.currentTarget.reset(); } }}>
            <input name="free" className="field" placeholder="Or type a name" aria-label="Custom name" />
            <button className="btn" type="submit" disabled={full}>Add</button>
          </form>
        )}
      </div>
      <div>
        <div className="mb-2 font-display font-semibold">Your {label.toLowerCase()} ({picked.length} / {limit})</div>
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

export function MagicStep({ c, patch }: StepProps) {
  const book = useRulebook((s) => s.book);
  const d = derive(c);
  const spells = useMemo(() => spellList(book), [book]);
  const forms = useMemo(() => complexFormList(book), [book]);
  const powers = useMemo(() => adeptPowerList(book), [book]);
  const spent = c.adeptPowers.reduce((s, p) => s + p.cost, 0);
  const [pq, setPq] = useState("");

  return (
    <div>
      <StepHeader title="Spells, powers and forms" lead="Your free picks come from the Magic or Resonance priority. They use the rating on the priority table, not what you raise it to with Karma." rule={/^Magic Basics$/i} />

      {(c.magicType === "full" || c.magicType === "aspected" || c.magicType === "mystic") && (
        <section className="mb-10">
          <h3 className="mb-1 text-xl font-semibold">Spells and rituals</h3>
          {c.magicType === "aspected" && <div className="mb-3"><Note>Aspected magicians use only one branch of magic. Pick spells only if your aspect is sorcery; note your aspect in your concept.</Note></div>}
          <div className="mb-3 max-w-sm"><Budget label="Free spells left" left={d.slots.spells - c.spells.length} total={d.slots.spells} /></div>
          <Picker label="Spells" entries={spells} picked={c.spells} limit={d.slots.spells} onAdd={(n) => patch((x) => { x.spells.push(n); })} onRemove={(n) => patch((x) => { x.spells = x.spells.filter((s) => s !== n); })} />
        </section>
      )}

      {(c.magicType === "adept" || c.magicType === "mystic") && (
        <section className="mb-10">
          <h3 className="mb-1 text-xl font-semibold">Adept powers</h3>
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
          {c.magicType === "mystic" && <p className="mt-3 text-sm text-dim">Mystic adepts buy powers first, then double what is left of the priority Magic rating for spells (currently {d.slots.spells}).</p>}
        </section>
      )}

      {c.magicType === "technomancer" && (
        <section className="mb-10">
          <h3 className="mb-1 text-xl font-semibold">Complex forms</h3>
          <div className="mb-3 max-w-sm"><Budget label="Free forms left" left={d.slots.complexForms - c.complexForms.length} total={d.slots.complexForms} /></div>
          <Picker label="Complex forms" entries={forms} picked={c.complexForms} limit={d.slots.complexForms} onAdd={(n) => patch((x) => { x.complexForms.push(n); })} onRemove={(n) => patch((x) => { x.complexForms = x.complexForms.filter((s) => s !== n); })} />
        </section>
      )}

      {c.magicType === "mundane" && <Note>Your runner is mundane, so there is nothing to choose here. Skip ahead to qualities.</Note>}
    </div>
  );
}
