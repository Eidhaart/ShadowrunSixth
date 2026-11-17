"use client";
import { useMemo, useState } from "react";
import { useRulebook } from "@/lib/store/rulebook";
import { adeptPowerList, complexFormList, spellList, type BookEntry } from "@/lib/sr6/bookLists";
import { budget, derive } from "@/lib/sr6/derive";
import { POWER_POINT } from "@/lib/sr6/advance";
import { rules } from "@/lib/house/rules";
import { TRADITIONS, TRADITION_ATTRS, bondKarma, gradeChoices } from "@/lib/sr6/data";
import clsx from "clsx";
import { MetaPick } from "@/components/MetaPick";
import { editExt } from "@/lib/sr6/ext";
import { Budget, Note, Stepper, StepHeader, type StepProps } from "../ui";

function Picker({ label, entries, picked, onAdd, onRemove, limit, allowFree = true }: {
  label: string; entries: BookEntry[]; picked: string[]; onAdd: (name: string) => void; onRemove: (name: string) => void; limit: number; allowFree?: boolean;
}) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const groups = useMemo(() => Array.from(new Set(entries.map((e) => e.group))), [entries]);
  const shown = entries.filter((e) => (!q || e.name.toLowerCase().includes(q.toLowerCase())) && (!group || e.group === group)).slice(0, 80);
  // the starting allowance is the limit: new spells and forms cannot be bought during creation (p. 68)
  const full = picked.length >= limit;
  const why = limit === 0 ? `No free ${label.toLowerCase()} with this build` : `All ${limit} starting ${label.toLowerCase()} are picked. More can be learned in play, not bought at creation.`;
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
                <button className="btn small" disabled={on || full} title={full && !on ? why : undefined} onClick={() => onAdd(e.name)}>{on ? "Added" : "Add"}</button>
              </li>
            );
          })}
        </ul>
        {allowFree && (
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget).get("free") as string; if (f?.trim()) { onAdd(f.trim()); e.currentTarget.reset(); } }}>
            <input name="free" className="field" placeholder="Or type a name" aria-label="Custom name" />
            <button className="btn" type="submit" disabled={full} title={full ? why : undefined}>Add</button>
          </form>
        )}
      </div>
      <div>
        <div className="mb-2 font-display font-semibold">Your {label.toLowerCase()} ({picked.length} / {limit} free){picked.length > limit && <span className="ml-1 text-xs font-normal text-accent">{(picked.length - limit) * 5} Karma for the extra {picked.length - limit}</span>}</div>
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
                <MetaPick value={meta[i] ?? ""} onChange={(v) => setMeta(i, v)} options={gradeChoices(c.magicType)} thing={techno ? "Echo" : "Metamagic"} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const ATTR_NAME: Record<string, string> = { logic: "Logic", charisma: "Charisma", intuition: "Intuition", willpower: "Willpower" };

/** Hermetic or shamanic, the two traditions in the core book, or one from another book with its own attribute. */
function Tradition({ c, patch }: StepProps) {
  const d = derive(c);
  const attr = (c.tradition || "logic") as (typeof TRADITION_ATTRS)[number];
  const custom = c.traditionName != null;
  const pool = (a: string) => d.attrs.willpower + (a === "willpower" ? d.attrs.willpower : d.attrs[a as "logic"]);
  const pick = (name: string | undefined, a: string) => patch((x) => { x.tradition = a; if (name == null) delete x.traditionName; else x.traditionName = name; });
  return (
    <section className="mb-10">
      <h3 className="mb-1 text-xl font-semibold">Tradition</h3>
      <p className="mb-3 max-w-2xl text-sm text-dim">How your runner understands magic. The tradition attribute is rolled with Willpower to resist drain, and added to Magic for astral Attack Rating.</p>
      <div className="grid max-w-4xl gap-3 sm:grid-cols-3">
        {TRADITIONS.map((t) => {
          const on = !custom && attr === t.attr;
          return (
            <button key={t.name} type="button" aria-pressed={on} onClick={() => pick(undefined, t.attr)}
              className={clsx("flex flex-col items-start justify-start rounded border p-3 text-left transition", on ? "border-accent bg-accent/10" : "border-line hover:border-accent/50")}>
              <div className="font-display text-lg font-semibold">{t.name}</div>
              <div className="text-xs text-dim">{ATTR_NAME[t.attr]} + Willpower · <b className="num text-fg">{pool(t.attr)}</b> dice vs drain</div>
              <p className="mt-2 text-sm text-dim">{t.blurb}</p>
            </button>
          );
        })}
        <div className={clsx("rounded border p-3", custom ? "border-accent bg-accent/10" : "border-line")}>
          <button type="button" aria-pressed={custom} className="text-left" onClick={() => pick(c.traditionName ?? "", attr)}>
            <div className="font-display text-lg font-semibold">From another book</div>
            <div className="text-xs text-dim">Any other tradition, with its own attribute</div>
          </button>
          {custom && (
            <div className="mt-2 space-y-2">
              <input className="field" value={c.traditionName ?? ""} placeholder="Tradition name" aria-label="Tradition name" onChange={(e) => pick(e.target.value, attr)} />
              <select className="field" aria-label="Tradition attribute" value={attr} onChange={(e) => pick(c.traditionName ?? "", e.target.value)}>
                {TRADITION_ATTRS.map((a) => <option key={a} value={a}>{ATTR_NAME[a]} ({pool(a)} dice)</option>)}
              </select>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Foci bought on the gear step. Bonding one costs Karma: Force times the type's cost on the Magical Goods table. */
function Foci({ c, patch }: StepProps) {
  const d = derive(c);
  const foci = c.ext?.foci ?? [];
  if (!foci.length) return null;
  const bonded = foci.filter((f) => f.bonded);
  const force = bonded.reduce((n, f) => n + f.rating, 0);
  const karmaLeft = budget(c).karma.left;
  return (
    <section className="mb-10">
      <h3 className="mb-1 text-xl font-semibold">Foci</h3>
      <p className="mb-3 max-w-2xl text-sm text-dim">A focus does nothing until it is bonded. Bonding costs Karma; you can bond up to your Magic in foci, none with a Force above your Magic, and Magic × 5 Force in all.</p>
      <ul className="max-w-2xl divide-y divide-line border-y border-line">
        {foci.map((f) => {
          const cost = bondKarma(f);
          const why = f.bonded ? "" : bonded.length >= d.magic ? `You already have ${bonded.length} bonded ${bonded.length === 1 ? "focus" : "foci"}; the limit is your Magic (${d.magic}).`
            : f.rating > d.magic ? `Force ${f.rating} is above your Magic (${d.magic}).`
            : force + f.rating > d.magic * 5 ? `Bonded Force would be ${force + f.rating}; the limit is Magic × 5 (${d.magic * 5}).`
            : karmaLeft < cost ? `Bonding costs ${cost} Karma; you have ${Math.max(0, karmaLeft)} left.` : "";
          const item = c.gear.find((g) => g.id === f.gearId);
          const weapon = f.kind === "Weapon" && item?.inId ? c.gear.find((g) => g.id === item.inId) : undefined;
          return (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
              <span>
                <b className="font-display">{f.name}</b> <span className="num text-xs text-dim">bond {cost} Karma · {(item?.cost ?? 0).toLocaleString("en-US")}¥</span>
                {f.kind === "Weapon" && <span className="block text-xs text-dim">{weapon ? `Part of your ${weapon.name}` : "Not part of a weapon yet: pick the melee weapon on the gear step"}</span>}
                {why && <span className="block text-xs text-danger">{why}</span>}
              </span>
              <button className={f.bonded ? "btn small primary" : "btn small"} aria-pressed={f.bonded} disabled={!!why} title={why || undefined}
                onClick={() => patch((x) => editExt(x, (ex) => { const t = ex.foci.find((q) => q.id === f.id); if (t) { t.bonded = !t.bonded; if (!t.bonded) t.active = false; } }))}>
                {f.bonded ? "Bonded" : "Bond"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Mystic adepts split the Magic rating from the Priority table: each point is one Power Point or two
 * starting spells (pp. 66, 158). Adjustment points and Karma raise final Magic, not this pool.
 */
function MysticSplit({ c, patch }: StepProps) {
  const d = derive(c);
  const sl = d.slots;
  const toSpells = sl.mysticMagic - sl.mysticPP;
  // keep what is already picked: powers need their points, picked spells need theirs
  const minPP = Math.max(0, Math.ceil(sl.ppSpent - sl.ppExtra - 1e-9));
  const maxPP = Math.max(0, sl.mysticMagic - Math.ceil(c.spells.length / 2));
  const set = (v: number) => patch((x) => { x.mysticPP = v; });
  return (
    <section className="mb-10">
      <h3 className="mb-1 text-xl font-semibold">Split your Magic</h3>
      <p className="mb-3 max-w-2xl text-sm text-dim">
        Your Magic from the Priority table is <b className="num text-fg">{sl.mysticMagic}</b>. Each point goes either to adept powers (1 Power Point) or to spellcasting (2 starting spells).
        {d.magic !== sl.mysticMagic && <> Your final Magic is <b className="num text-fg">{d.magic}</b>; adjustment points and Karma do not add to this split.</>}
      </p>
      <div className="panel quiet flex max-w-2xl flex-wrap items-center gap-x-6 gap-y-3 p-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-dim">Adept powers</div>
          <div className="flex items-center gap-2">
            <Stepper label="Magic points to adept powers" value={sl.mysticPP} min={0} max={sl.mysticMagic} disableDown={sl.mysticPP <= minPP} disableUp={sl.mysticPP >= maxPP} onChange={set} />
            <span className="num text-sm">= {sl.mysticPP} PP</span>
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-dim">Spellcasting</div>
          <div className="num py-1.5 text-sm"><b className="text-fg">{toSpells}</b> points = {toSpells * 2} spells</div>
        </div>
        <div className="flex h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className="bg-accent" style={{ width: `${(sl.mysticPP / Math.max(1, sl.mysticMagic)) * 100}%` }} />
          <div className="bg-cyan" style={{ width: `${(toSpells / Math.max(1, sl.mysticMagic)) * 100}%` }} />
        </div>
      </div>
      {(sl.mysticPP <= minPP && minPP > 0) || (sl.mysticPP >= maxPP && maxPP < sl.mysticMagic) ? (
        <p className="mt-2 max-w-2xl text-xs text-dim">
          {sl.mysticPP <= minPP && minPP > 0 ? `Your powers use ${sl.ppSpent} PP, so at least ${minPP} ${minPP === 1 ? "point stays" : "points stay"} with powers. ` : ""}
          {sl.mysticPP >= maxPP && maxPP < sl.mysticMagic ? `Your ${c.spells.length} spells need ${Math.ceil(c.spells.length / 2)} ${Math.ceil(c.spells.length / 2) === 1 ? "point" : "points"} of spellcasting. ` : ""}
          Remove some to move points across.
        </p>
      ) : null}
    </section>
  );
}

/** Allocated, spent and left Power Points, with extras from initiation and Karma shown apart. */
function PowerPoints({ c }: { c: StepProps["c"] }) {
  const sl = derive(c).slots;
  const cell = (label: string, v: number, tone = "") => (
    <div className="min-w-20"><div className="text-xs uppercase tracking-wide text-dim">{label}</div><div className={`num text-lg font-semibold ${tone}`}>{+v.toFixed(2)}</div></div>
  );
  return (
    <div className="panel quiet mb-3 flex max-w-xl flex-wrap gap-x-6 gap-y-2 p-3">
      {cell(c.magicType === "mystic" ? "Allocated" : "From Magic", sl.ppStart)}
      {sl.ppExtra > 0 && cell("Initiation", sl.ppExtra)}
      {cell("Spent", sl.ppSpent)}
      {cell("Left", sl.ppLeft, sl.ppLeft < 0 ? "text-danger" : sl.ppLeft > 0 ? "text-ok" : "")}
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

      {(c.magicType === "full" || c.magicType === "aspected" || c.magicType === "mystic") && <Tradition c={c} patch={patch} />}

      {c.magicType === "mystic" && <MysticSplit c={c} patch={patch} />}

      {(c.magicType === "full" || c.magicType === "aspected" || c.magicType === "mystic") && (
        <section className="mb-10">
          <h3 className="mb-1 text-xl font-semibold">Spells and rituals</h3>
          {c.magicType === "aspected" && <div className="mb-3"><Note>Aspected magicians use only one branch of magic. Pick spells only if your aspect is sorcery; note your aspect in your concept.</Note></div>}
          <div className="mb-3 max-w-sm"><Budget label="Starting spells left" left={d.slots.spells - c.spells.length} total={d.slots.spells} /></div>
          <p className="mb-3 max-w-2xl text-sm text-dim">{c.magicType === "mystic" ? "Two spells for each Magic point given to spellcasting." : "Twice your Magic from the Priority table."} New spells cannot be bought with Karma during creation; after creation they are learned for 5 Karma each on the Advance tab.</p>
          <Picker label="Spells" entries={spells} picked={c.spells} limit={d.slots.spells} onAdd={(n) => patch((x) => { x.spells.push(n); })} onRemove={(n) => patch((x) => { x.spells = x.spells.filter((s) => s !== n); })} />
        </section>
      )}

      {(c.magicType === "adept" || c.magicType === "mystic") && (
        <section className="mb-10">
          <h3 className="mb-1 text-xl font-semibold">Adept powers</h3>
          <PowerPoints c={c} />
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
                        title={spent + (p.pp ?? 0) > d.slots.powerPoints + 1e-9 ? `Needs ${p.pp} PP; you have ${+(d.slots.powerPoints - spent).toFixed(2)} left${c.magicType === "mystic" ? ". Give another Magic point to adept powers above" : ""}.` : (have?.level ?? 0) >= (p.maxLevel ?? 1) && p.perLevel ? "At its highest level" : undefined}
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

      {c.magicType === "technomancer" && (
        <section className="mb-10">
          <h3 className="mb-1 text-xl font-semibold">Complex forms</h3>
          <div className="mb-3 max-w-sm"><Budget label="Starting forms left" left={d.slots.complexForms - c.complexForms.length} total={d.slots.complexForms} /></div>
          <p className="mb-3 max-w-2xl text-sm text-dim">Twice your Resonance from the Priority table. New forms cannot be bought with Karma during creation.</p>
          <Picker label="Complex forms" entries={forms} picked={c.complexForms} limit={d.slots.complexForms} onAdd={(n) => patch((x) => { x.complexForms.push(n); })} onRemove={(n) => patch((x) => { x.complexForms = x.complexForms.filter((s) => s !== n); })} />
        </section>
      )}

      {c.magicType !== "mundane" && c.magicType !== "technomancer" && <Foci c={c} patch={patch} />}
      {c.magicType !== "mundane" && <Initiation c={c} patch={patch} />}

      {c.magicType === "mundane" && <Note>Your runner is mundane, so there is nothing to choose here. Skip ahead to qualities.</Note>}
    </div>
  );
}
