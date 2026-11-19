"use client";
import clsx from "clsx";
import { ATTRIBUTES, ATTR_ABBR, ATTR_LABEL, KARMA, METATYPES, specialRacialAttrs, type AttrKey } from "@/lib/sr6/data";
import { budget, derive, karmaForRanks } from "@/lib/sr6/derive";
import { Note, Segments, Stepper, type StepProps } from "../ui";

const HINT: Record<AttrKey, string> = {
  body: "Soak, toughness, Physical track", agility: "Shooting, stealth, finesse", reaction: "Initiative, defense, piloting", strength: "Melee damage, lifting, climbing",
  willpower: "Stun track, drain, fear", logic: "Hacking, tech, knowledge points", intuition: "Initiative, perception, astral", charisma: "Social tests, contacts, conjuring",
};

interface Cell { value: number; max: number; up?: boolean; label: string; set: (v: number) => void }

/**
 * One row of the attribute table: adjustment points, attribute points and Karma side by side, the way
 * a priority build spends them. Columns that do not apply to a row show a dash.
 */
function Row({ name, abbr, hint, adj, pts, kar, value, max, karmaCost, nextCost, atMax, special }: {
  name: string; abbr: string; hint: string; adj?: Cell; pts?: Cell; kar?: Cell; value: number; max: number; karmaCost: number; nextCost: number; atMax: boolean; special?: boolean;
}) {
  const cell = (c: Cell | undefined, tag: string) => (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-faint md:hidden">{tag}</span>
      {c ? <Stepper size="sm" label={c.label} value={c.value} min={0} max={c.max} disableUp={c.up === false} onChange={c.set} /> : <span className="grid h-9 place-items-center text-faint" aria-hidden>—</span>}
    </div>
  );
  return (
    <li className={clsx("grid grid-cols-3 items-center gap-x-2 gap-y-2 border-b border-line/60 py-2.5 md:grid-cols-[minmax(10rem,1.4fr)_repeat(3,minmax(6.5rem,auto))_minmax(9rem,1fr)]", atMax && "bg-accent/[.04]")}>
      <div className="col-span-2 min-w-0 md:col-span-1">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-base font-semibold">{name}</span>
          <span className="num text-xs text-faint">{abbr}</span>
          {special && <span className="text-[10px] uppercase tracking-wider text-cyan">special</span>}
        </div>
        <div className="truncate text-xs text-dim">{hint}</div>
      </div>
      <div className="flex items-baseline justify-end gap-1 md:hidden"><span className="wz-num">{value}</span><span className="num text-xs text-faint">/ {max}</span></div>
      {cell(adj, "Adj")}
      {cell(pts, "Points")}
      {cell(kar, "Karma")}
      <div className="col-span-3 flex items-center gap-3 md:col-span-1">
        <Segments value={value} max={max} base={Math.min(6, max)} />
        <span className="max-md:hidden"><span className="wz-num">{value}</span><span className="num text-xs text-faint"> / {max}</span></span>
        {atMax && <span className="text-[10px] font-bold uppercase tracking-wider text-accent">max</span>}
        <span className="num ml-auto text-[11px] text-faint" title="Karma spent here, and the price of the next rank">{karmaCost ? `${karmaCost} K · ` : ""}next {nextCost}</span>
      </div>
    </li>
  );
}

export function AttributesPage({ c, patch }: StepProps) {
  const b = budget(c);
  const d = derive(c);
  const meta = METATYPES[c.metatype];
  const special = specialRacialAttrs(c.metatype);
  const hasMagic = c.magicType !== "mundane";
  const techno = c.magicType === "technomancer";
  const magicValue = techno ? d.resonance : d.magic;
  const adjLeft = b.adjustment.left;
  const kLeft = b.karma.left;
  const edgeMax = meta.ranges.edge[1];

  const atMaxPhysMental = ATTRIBUTES.filter((a) => d.natural[a] >= d.attrMax[a]);

  return (
    <div>
      {!c.priorities.attributes && <div className="mb-3"><Note tone="warn">Choose an Attributes priority to get points to spend.</Note></div>}
      {atMaxPhysMental.length > 1 && <div className="mb-3"><Note tone="error">{atMaxPhysMental.map((a) => ATTR_LABEL[a]).join(" and ")} are both at their maximum. Only one attribute may be at its maximum at creation.</Note></div>}
      <div className="hidden grid-cols-[minmax(10rem,1.4fr)_repeat(3,minmax(6.5rem,auto))_minmax(9rem,1fr)] gap-x-2 border-b border-line pb-1.5 text-[10px] uppercase tracking-widest text-dim md:grid">
        <span>Attribute</span><span className="text-center">Adjustment <b className="num text-fg">{adjLeft}</b></span><span className="text-center">Points <b className="num text-fg">{b.attributes.left}</b></span><span className="text-center">Karma <b className="num text-fg">{kLeft}</b></span><span>Rating</span>
      </div>
      <h3 className="wz-code mt-4 text-[11px] uppercase text-accent">Special</h3>
      <ul>
        <Row name="Edge" abbr="EDG" hint="Luck, rerolls, edge actions" value={d.edge} max={edgeMax} special atMax={d.edge >= edgeMax}
          adj={{ label: "Edge adjustment points", value: c.adjEdge, max: Math.max(0, edgeMax - 1 - c.karEdge), up: adjLeft > 0, set: (v) => patch((x) => { x.adjEdge = v; }) }}
          kar={{ label: "Edge Karma ranks", value: c.karEdge, max: c.karEdge + Math.max(0, edgeMax - d.edge), up: kLeft >= KARMA.attributeRank(d.edge + 1) && d.edge < edgeMax, set: (v) => patch((x) => { x.karEdge = v; }) }}
          karmaCost={karmaForRanks(1 + c.adjEdge, c.karEdge, KARMA.attributeRank)} nextCost={KARMA.attributeRank(d.edge + 1)} />
        {hasMagic && (
          <Row name={techno ? "Resonance" : "Magic"} abbr={techno ? "RES" : "MAG"} hint={`Starts at ${d.magicPriorityRating} from priority`} value={magicValue} max={6} special atMax={magicValue >= 6}
            adj={{ label: `${techno ? "Resonance" : "Magic"} adjustment points`, value: c.adjMagic, max: Math.max(0, 6 - d.magicPriorityRating - c.karMagic), up: adjLeft > 0, set: (v) => patch((x) => { x.adjMagic = v; }) }}
            kar={{ label: `${techno ? "Resonance" : "Magic"} Karma ranks`, value: c.karMagic, max: c.karMagic + Math.max(0, 6 - magicValue), up: kLeft >= KARMA.attributeRank(magicValue + 1) && magicValue < 6, set: (v) => patch((x) => { x.karMagic = v; }) }}
            karmaCost={karmaForRanks(d.magicPriorityRating + c.adjMagic, c.karMagic, KARMA.attributeRank)} nextCost={KARMA.attributeRank(magicValue + 1)} />
        )}
      </ul>
      {(["Physical", "Mental"] as const).map((g) => (
        <div key={g}>
          <h3 className="wz-code mt-5 text-[11px] uppercase text-accent">{g}</h3>
          <ul>
            {ATTRIBUTES.filter((a) => (g === "Physical" ? ["body", "agility", "reaction", "strength"] : ["willpower", "logic", "intuition", "charisma"]).includes(a)).map((a) => {
              const pts = c.attrPts[a] ?? 0;
              const adj = c.adjRacial[a] ?? 0;
              const kar = c.attrKar[a] ?? 0;
              const room = d.attrMax[a] - d.natural[a];
              const isSpecial = special.includes(a);
              return (
                <Row key={a} name={ATTR_LABEL[a]} abbr={ATTR_ABBR[a]} hint={HINT[a]} value={d.attrs[a]} max={meta.ranges[a][1]} special={isSpecial} atMax={d.natural[a] >= d.attrMax[a]}
                  adj={isSpecial ? { label: `${ATTR_LABEL[a]} adjustment points`, value: adj, max: Math.max(0, meta.ranges[a][1] - 1 - pts - kar), up: adjLeft > 0, set: (v) => patch((x) => { if (v <= 0) delete x.adjRacial[a]; else x.adjRacial[a] = v; }) } : undefined}
                  pts={{ label: `${ATTR_LABEL[a]} attribute points`, value: pts, max: Math.max(0, d.attrMax[a] - 1 - adj - kar), up: b.attributes.left > 0, set: (v) => patch((x) => { x.attrPts[a] = v; }) }}
                  kar={{ label: `${ATTR_LABEL[a]} Karma ranks`, value: kar, max: kar + Math.max(0, room), up: kLeft >= KARMA.attributeRank(d.natural[a] + 1) && room > 0, set: (v) => patch((x) => { x.attrKar[a] = v; }) }}
                  karmaCost={karmaForRanks(1 + pts + adj, kar, KARMA.attributeRank)} nextCost={KARMA.attributeRank(d.natural[a] + 1)} />
              );
            })}
          </ul>
        </div>
      ))}
      <p className="mt-4 max-w-3xl text-xs text-faint">Every attribute starts at 1. Adjustment points go only to Edge, {hasMagic ? `${techno ? "Resonance" : "Magic"} and ` : ""}attributes your metatype can push past the human range. Karma buys a rank for 5 × the new rating.</p>
    </div>
  );
}
