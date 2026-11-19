"use client";
import { budget, derive } from "@/lib/sr6/derive";
import { POWER_POINT } from "@/lib/sr6/advance";
import { rules } from "@/lib/house/rules";
import { TRADITIONS, TRADITION_ATTRS, bondKarma, gradeChoices } from "@/lib/sr6/data";
import clsx from "clsx";
import { MetaPick } from "@/components/MetaPick";
import { editExt } from "@/lib/sr6/ext";
import { Stepper, type StepProps } from "../ui";

/** Karma for grade g, as on the advancement table (house rules can scale it). */
const gradeCost = (g: number) => Math.max(1, Math.round(((10 + g) * rules().karmaCostPct) / 100));

/**
 * Initiation (or submersion for technomancers) bought with creation Karma. Each grade costs 10 +
 * the new grade, raises the Magic or Resonance ceiling by one and brings a metamagic or echo; adepts
 * and mystic adepts may take a Power Point instead.
 */
export function Initiation({ c, patch }: StepProps) {
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
export function Tradition({ c, patch }: StepProps) {
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
export function Foci({ c, patch }: StepProps) {
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
export function MysticSplit({ c, patch }: StepProps) {
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
export function PowerPoints({ c }: { c: StepProps["c"] }) {
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
