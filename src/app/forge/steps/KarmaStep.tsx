"use client";
import { ATTRIBUTES, ATTR_LABEL, KARMA, METATYPES, SKILLS, SKILL_BY_ID, skillAvailable } from "@/lib/sr6/data";
import { budget, derive, karmaForRanks } from "@/lib/sr6/derive";
import { Budget, Note, StepHeader, Stepper, type StepProps } from "../ui";

export function KarmaStep({ c, patch }: StepProps) {
  const b = budget(c);
  const d = derive(c);
  const meta = METATYPES[c.metatype];
  const skillsOwned = SKILLS.filter((s) => skillAvailable(s, c.magicType));
  const perKarma = b.nuyen.fromKarma && c.karmaToNuyen ? b.nuyen.fromKarma / c.karmaToNuyen : KARMA.nuyenPerKarma;

  return (
    <div>
      <StepHeader title="Spend your Karma" lead={`You have ${b.karma.base} Karma, plus any bonus from negative qualities. Use it to raise attributes and skills past your priority points, or turn it into cash. You may begin play with at most ${KARMA.maxUnspent} unspent.`} rule={/^Spend Customization Karma$/i} />
      <div className="mb-6 grid max-w-3xl gap-4 sm:grid-cols-2">
        <Budget label="Karma left" left={b.karma.left} total={b.karma.base + b.karma.negativeBonus} />
        <div className="text-xs text-dim">
          <div>Attributes <b className="num text-fg">{b.karma.cost.attributes + b.karma.cost.edgeMagic}</b> · Skills <b className="num text-fg">{b.karma.cost.skills}</b> · Qualities <b className="num text-fg">{b.karma.cost.qualities}</b></div>
          <div>Knowledge <b className="num text-fg">{b.karma.cost.knowledge}</b> · Cash <b className="num text-fg">{b.karma.cost.nuyen}</b> · Negative bonus <b className="num text-fg">+{b.karma.negativeBonus}</b></div>
        </div>
      </div>
      {b.karma.left > KARMA.maxUnspent && <div className="mb-4"><Note tone="warn">You still have {b.karma.left} Karma. Spend it down to {KARMA.maxUnspent} or fewer.</Note></div>}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel quiet p-4">
          <h3 className="mb-3 text-lg font-semibold">Attributes</h3>
          <ul className="space-y-2.5">
            {ATTRIBUTES.map((a) => {
              const kar = c.attrKar[a] ?? 0;
              const baseRank = 1 + (c.attrPts[a] ?? 0) + (c.adjRacial[a] ?? 0);
              const next = baseRank + kar + 1;
              const room = d.attrMax[a] - d.attrs[a];
              return (
                <li key={a} className="flex items-center justify-between gap-3">
                  <div><span className="font-display">{ATTR_LABEL[a]}</span> <span className="num text-sm text-dim">{d.attrs[a]} / {d.attrMax[a]}</span>{kar > 0 && <span className="num ml-2 text-xs text-accent">+{kar} for {karmaForRanks(baseRank, kar, KARMA.attributeRank)}</span>}</div>
                  <div className="flex items-center gap-2"><span className="num text-xs text-faint">next {KARMA.attributeRank(next)}</span>
                    <Stepper size="sm" label={`${ATTR_LABEL[a]} Karma ranks`} value={kar} min={0} max={kar + Math.max(0, room)} disableUp={b.karma.left < KARMA.attributeRank(next) || room <= 0} onChange={(v) => patch((x) => { x.attrKar[a] = v; })} />
                  </div>
                </li>
              );
            })}
            <li className="flex items-center justify-between gap-3 border-t border-line pt-2.5">
              <div><span className="font-display">Edge</span> <span className="num text-sm text-dim">{d.edge} / {meta.ranges.edge[1]}</span></div>
              <Stepper size="sm" label="Edge Karma ranks" value={c.karEdge} min={0} max={c.karEdge + Math.max(0, meta.ranges.edge[1] - d.edge)} disableUp={b.karma.left < KARMA.attributeRank(d.edge + 1) || d.edge >= meta.ranges.edge[1]} onChange={(v) => patch((x) => { x.karEdge = v; })} />
            </li>
            {c.magicType !== "mundane" && (
              <li className="flex items-center justify-between gap-3">
                <div><span className="font-display">{c.magicType === "technomancer" ? "Resonance" : "Magic"}</span> <span className="num text-sm text-dim">{c.magicType === "technomancer" ? d.resonance : d.magic} / 6</span></div>
                <Stepper size="sm" label="Magic Karma ranks" value={c.karMagic} min={0} max={c.karMagic + Math.max(0, 6 - (c.magicType === "technomancer" ? d.resonance : d.magic))} disableUp={b.karma.left < KARMA.attributeRank((c.magicType === "technomancer" ? d.resonance : d.magic) + 1) || (c.magicType === "technomancer" ? d.resonance : d.magic) >= 6} onChange={(v) => patch((x) => { x.karMagic = v; })} />
              </li>
            )}
          </ul>
        </section>

        <section className="panel quiet p-4">
          <h3 className="mb-3 text-lg font-semibold">Skills</h3>
          <ul className="space-y-2.5">
            {skillsOwned.map((s) => {
              const e = c.skills[s.id] ?? { pts: 0, kar: 0 };
              const rank = e.pts + e.kar;
              const max = c.qualities.some((x) => x.name.startsWith("Aptitude") && x.note === s.id) ? 7 : 6;
              return (
                <li key={s.id} className="flex items-center justify-between gap-3">
                  <div><span className="font-display">{s.name}</span> <span className="num text-sm text-dim">rank {rank}</span>{e.kar > 0 && <span className="num ml-2 text-xs text-accent">+{e.kar} for {karmaForRanks(e.pts, e.kar, KARMA.skillRank)}</span>}</div>
                  <div className="flex items-center gap-2"><span className="num text-xs text-faint">next {KARMA.skillRank(rank + 1)}</span>
                    <Stepper size="sm" label={`${s.name} Karma ranks`} value={e.kar} min={0} max={max - e.pts} disableUp={b.karma.left < KARMA.skillRank(rank + 1) || rank >= max}
                      onChange={(v) => patch((x) => { const en = x.skills[s.id] ?? { pts: 0, kar: 0 }; en.kar = v; if (en.pts + en.kar <= 0) delete x.skills[s.id]; else x.skills[s.id] = en; })} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-faint">Specializations bought here cost {KARMA.specialization} Karma. Pick them on a skill that has at least 1 rank:</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {Object.entries(c.skills).filter(([, e]) => e.pts + e.kar > 0 && !e.spec).map(([id]) => {
              const def = SKILL_BY_ID[id];
              return def.specs.length ? (
                <li key={id}>
                  <select className="field w-52" aria-label={`${def.name} specialization for Karma`} value="" disabled={b.karma.left < KARMA.specialization}
                    onChange={(ev) => ev.target.value && patch((x) => { const en = x.skills[id]; if (en) { en.spec = ev.target.value; en.specVia = "karma"; } })}>
                    <option value="">{def.name} specialization ({KARMA.specialization} K)</option>
                    {def.specs.map((sp) => <option key={sp}>{sp}</option>)}
                  </select>
                </li>
              ) : null;
            })}
          </ul>
        </section>

        <section className="panel quiet p-4 lg:col-span-2">
          <h3 className="mb-1 text-lg font-semibold">Cash</h3>
          <p className="mb-3 text-sm text-dim">Each Karma point turns into {perKarma.toLocaleString("en-US")}¥ of starting nuyen.</p>
          <div className="flex items-center gap-4">
            <Stepper label="Karma converted to nuyen" value={c.karmaToNuyen} min={0} max={Math.max(0, c.karmaToNuyen + b.karma.left)} disableUp={b.karma.left <= 0} onChange={(v) => patch((x) => { x.karmaToNuyen = v; })} />
            <span className="num text-dim">= +{b.nuyen.fromKarma.toLocaleString("en-US")}¥</span>
          </div>
        </section>
      </div>
    </div>
  );
}
