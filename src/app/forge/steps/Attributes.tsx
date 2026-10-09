"use client";
import { ATTRIBUTES, ATTR_ABBR, ATTR_LABEL, METATYPES, specialRacialAttrs, type AttrKey } from "@/lib/sr6/data";
import { budget, derive } from "@/lib/sr6/derive";
import { Budget, Note, Segments, StepHeader, Stepper, type StepProps } from "../ui";

const GROUP: Record<AttrKey, "Physical" | "Mental"> = {
  body: "Physical", agility: "Physical", reaction: "Physical", strength: "Physical",
  willpower: "Mental", logic: "Mental", intuition: "Mental", charisma: "Mental",
};
const HINT: Record<AttrKey, string> = {
  body: "Soaking damage, toughness, physical condition",
  agility: "Combat accuracy, stealth, athletics",
  reaction: "Initiative, defense, piloting",
  strength: "Melee damage, lifting, athletics",
  willpower: "Stun track, resisting drain and fear",
  logic: "Hacking, tech, medicine, knowledge skills",
  intuition: "Initiative, perception, astral",
  charisma: "Social tests, many spells and traditions",
};

export function Attributes({ c, patch }: StepProps) {
  const b = budget(c);
  const d = derive(c);
  const meta = METATYPES[c.metatype];
  const special = specialRacialAttrs(c.metatype);
  const cap = (a: AttrKey) => Math.min(6, meta.ranges[a][1]);

  return (
    <div>
      <StepHeader title="Attributes" lead="Every attribute starts at 1 for free. Spend your attribute points to raise them; priority points can take an attribute to 6, never beyond. Only one attribute may sit at its metatype maximum." rule={/^Attributes$/i} />
      <div className="mb-5 max-w-md"><Budget label="Attribute points left" left={b.attributes.left} total={b.attributes.total} /></div>
      {!c.priorities.attributes && <div className="mb-4"><Note tone="warn">Choose an Attributes priority to get points to spend.</Note></div>}
      <div className="grid gap-3 lg:grid-cols-2">
        {(["Physical", "Mental"] as const).map((g) => (
          <section key={g} className="panel quiet p-4">
            <h3 className="mb-3 text-lg font-semibold">{g}</h3>
            <ul className="space-y-4">
              {ATTRIBUTES.filter((a) => GROUP[a] === g).map((a) => {
                const pts = c.attrPts[a] ?? 0;
                const atCap = 1 + pts >= cap(a);
                return (
                  <li key={a} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-display text-base font-semibold">{ATTR_LABEL[a]}</span>
                        <span className="num text-xs text-faint">{ATTR_ABBR[a]}</span>
                        {special.includes(a) && <span className="text-xs text-cyan">up to {meta.ranges[a][1]}</span>}
                      </div>
                      <div className="text-xs text-dim">{HINT[a]}</div>
                    </div>
                    <Stepper
                      label={ATTR_LABEL[a]}
                      value={d.attrs[a] - (c.attrKar[a] ?? 0) - (c.adjRacial[a] ?? 0)}
                      min={1}
                      max={cap(a)}
                      disableUp={b.attributes.left <= 0 || atCap}
                      onChange={(v) => patch((x) => { x.attrPts[a] = v - 1; })}
                    />
                    <div className="col-span-2"><Segments value={d.attrs[a]} max={meta.ranges[a][1]} /></div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
