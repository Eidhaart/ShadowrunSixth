"use client";
import clsx from "clsx";
import {
  ATTR_LABEL, MAGIC_TYPE_LABEL, METATYPES, METATYPE_ORDER, PRIORITY_TABLE, specialRacialAttrs,
  type MagicType, type MetatypeId,
} from "@/lib/sr6/data";
import { budget, derive, reconcile } from "@/lib/sr6/derive";
import { Budget, Note, Segments, StepHeader, Stepper, type StepProps } from "../ui";

const MAGIC_BLURB: Record<MagicType, string> = {
  mundane: "No Magic or Resonance. Spend the points elsewhere.",
  full: "Spells, summoning and enchanting, with full astral access.",
  aspected: "Mastery of one branch: sorcery, conjuring or enchanting.",
  mystic: "Splits Magic between adept powers and spells.",
  adept: "Magic turned inward: physical powers, no spellcasting.",
  technomancer: "Resonance instead of Magic: complex forms and sprites.",
};

export function Origin({ c, patch }: StepProps) {
  const b = budget(c);
  const d = derive(c);
  const mp = c.priorities.metatype;
  const gp = c.priorities.magic;
  const allowed = mp ? PRIORITY_TABLE[mp].metatypes : METATYPE_ORDER;
  const magicRow = gp ? PRIORITY_TABLE[gp] : null;
  const meta = METATYPES[c.metatype];
  const racial = specialRacialAttrs(c.metatype);
  const magicLabel = c.magicType === "technomancer" ? "Resonance" : "Magic";
  const hasMagic = c.magicType !== "mundane";

  const setMeta = (m: MetatypeId) => patch((x) => { x.metatype = m; reconcile(x); });
  const setMagic = (t: MagicType) => patch((x) => {
    x.magicType = t;
    x.adjMagic = 0;
    x.karMagic = 0;
    if (t === "mundane" || t === "technomancer") { x.spells = []; x.adeptPowers = []; }
    if (t !== "technomancer") x.complexForms = [];
    if (t === "adept") x.spells = [];
    for (const id of ["sorcery", "conjuring", "enchanting", "astral", "tasking"]) delete x.skills[id];
  });

  const edgeCap = meta.ranges.edge[1] - 1; // ranks above the free 1
  const magicCap = 6 - d.magicPriorityRating;

  return (
    <div>
      <StepHeader title="Metatype and magic" lead="Choose what you are and how you reach beyond the physical. Your priorities decide what is on offer." rule={/^Character Metatypes$/i} />

      {!mp && <div className="mb-4"><Note tone="warn">Pick a Metatype priority first to see your adjustment points.</Note></div>}

      <h3 className="mb-2 text-lg font-semibold">Metatype</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {METATYPE_ORDER.map((m) => {
          const def = METATYPES[m];
          const ok = allowed.includes(m);
          const on = c.metatype === m;
          return (
            <button
              key={m}
              disabled={!ok}
              aria-pressed={on}
              onClick={() => setMeta(m)}
              className={clsx("panel quiet p-3 text-left transition-colors", on ? "border-accent bg-accent/10" : "hover:border-linehi", !ok && "cursor-not-allowed opacity-35")}
            >
              <div className={clsx("font-display text-lg font-semibold", on && "text-accent")}>{def.name}</div>
              <div className="mt-1 text-xs text-dim">{def.racial.length ? def.racial.join(", ") : "No racial qualities"}</div>
              {!ok && mp && <div className="mt-1 text-xs text-danger">Not at Priority {mp}</div>}
            </button>
          );
        })}
      </div>

      <h3 className="mb-2 mt-8 text-lg font-semibold">Magic or Resonance</h3>
      {!gp && <div className="mb-3"><Note tone="warn">Pick a Magic or Resonance priority to unlock these options.</Note></div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(MAGIC_TYPE_LABEL) as MagicType[]).map((t) => {
          const rating = magicRow?.magic[t];
          const ok = magicRow ? rating !== undefined : t === "mundane";
          const on = c.magicType === t;
          return (
            <button key={t} disabled={!ok} aria-pressed={on} onClick={() => setMagic(t)}
              className={clsx("panel quiet p-3 text-left transition-colors", on ? "border-accent bg-accent/10" : "hover:border-linehi", !ok && "cursor-not-allowed opacity-35")}>
              <div className="flex items-baseline justify-between gap-2">
                <span className={clsx("font-display text-lg font-semibold", on && "text-accent")}>{MAGIC_TYPE_LABEL[t]}</span>
                {ok && rating ? <span className="num text-sm text-dim">{t === "technomancer" ? "Resonance" : "Magic"} {rating}</span> : null}
              </div>
              <div className="mt-1 text-xs text-dim">{MAGIC_BLURB[t]}</div>
            </button>
          );
        })}
      </div>

      <h3 className="mb-1 mt-8 text-lg font-semibold">Adjustment points</h3>
      <p className="mb-3 max-w-2xl text-sm text-dim">Spend your Metatype points on Edge, {hasMagic ? `${magicLabel}, ` : ""}and any attribute your metatype can push past 6. Edge starts at 1 and each point adds a rank.</p>
      <div className="mb-4 max-w-md"><Budget label="Adjustment points left" left={b.adjustment.left} total={b.adjustment.total} /></div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="panel quiet flex items-center justify-between gap-3 p-3">
          <div>
            <div className="font-display font-semibold">Edge</div>
            <Segments value={d.edge} max={meta.ranges.edge[1]} base={meta.ranges.edge[1]} />
          </div>
          <Stepper label="Edge" value={c.adjEdge} min={0} max={edgeCap} disableUp={b.adjustment.left <= 0} onChange={(v) => patch((x) => { x.adjEdge = v; })} />
        </div>
        {hasMagic && (
          <div className="panel quiet flex items-center justify-between gap-3 p-3">
            <div>
              <div className="font-display font-semibold">{magicLabel}</div>
              <Segments value={c.magicType === "technomancer" ? d.resonance : d.magic} max={6} base={6} />
            </div>
            <Stepper label={magicLabel} value={c.adjMagic} min={0} max={Math.max(0, magicCap)} disableUp={b.adjustment.left <= 0} onChange={(v) => patch((x) => { x.adjMagic = v; })} />
          </div>
        )}
        {racial.map((a) => (
          <div key={a} className="panel quiet flex items-center justify-between gap-3 p-3">
            <div>
              <div className="font-display font-semibold">{ATTR_LABEL[a]} <span className="text-xs font-normal text-cyan">special for {meta.name}</span></div>
              <Segments value={d.attrs[a]} max={meta.ranges[a][1]} />
            </div>
            <Stepper label={ATTR_LABEL[a]} value={c.adjRacial[a] ?? 0} min={0} max={Math.max(0, meta.ranges[a][1] - 1 - (c.attrPts[a] ?? 0))} disableUp={b.adjustment.left <= 0}
              onChange={(v) => patch((x) => { if (v <= 0) delete x.adjRacial[a]; else x.adjRacial[a] = v; })} />
          </div>
        ))}
      </div>
      {racial.length === 0 && <p className="mt-3 text-sm text-dim">Humans have no special racial attributes; their points go to Edge{hasMagic ? ` and ${magicLabel}` : ""}.</p>}
    </div>
  );
}
