"use client";
import clsx from "clsx";
import { ATTRIBUTES, ATTR_ABBR, METATYPES, MAGIC_TYPE_LABEL } from "@/lib/sr6/data";
import type { Character } from "@/lib/sr6/character";
import { budget, derive, validate } from "@/lib/sr6/derive";
import { Budget } from "./ui";

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="border border-line px-2.5 py-1.5">
      <div className="text-[11px] text-faint">{label}</div>
      <div className="num text-lg font-semibold leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-dim">{sub}</div>}
    </div>
  );
}

export function Readout({ c }: { c: Character }) {
  const d = derive(c);
  const b = budget(c);
  const issues = validate(c);
  const errors = issues.filter((i) => i.level === "error").length;
  const meta = METATYPES[c.metatype];

  return (
    <aside className="panel p-4" aria-label="Runner readout">
      <div className="mb-3">
        <div className="font-display text-xl font-bold leading-tight">{c.alias || c.name || "Unnamed runner"}</div>
        <div className="text-sm text-dim">{meta.name}{c.magicType !== "mundane" ? ` · ${MAGIC_TYPE_LABEL[c.magicType]}` : ""}{c.archetype ? ` · ${c.archetype}` : ""}</div>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-1 text-center">
        {ATTRIBUTES.map((a) => (
          <div key={a} className="border border-line py-1">
            <div className="text-[10px] text-faint">{ATTR_ABBR[a]}</div>
            <div className="num text-lg font-semibold">{d.attrs[a]}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-1.5">
        <Stat label="Initiative" value={`${d.initiative.rank} + ${d.initiative.dice}D6`} />
        <Stat label="Defense Rating" value={d.defenseRating} />
        <Stat label="Condition" value={`${d.condition.physical} / ${d.condition.stun}`} sub="Physical / Stun" />
        <Stat label="Edge" value={d.edge} />
        <Stat label="Essence" value={d.essence.toFixed(1)} />
        {c.magicType !== "mundane" && <Stat label={c.magicType === "technomancer" ? "Resonance" : "Magic"} value={c.magicType === "technomancer" ? d.resonance : d.magic} />}
      </div>

      <div className="space-y-2.5">
        <Budget label="Attribute points" left={b.attributes.left} total={b.attributes.total} />
        <Budget label="Adjustment points" left={b.adjustment.left} total={b.adjustment.total} />
        <Budget label="Skill points" left={b.skills.left} total={b.skills.total} />
        <Budget label="Karma" left={b.karma.left} total={b.karma.base + b.karma.negativeBonus} />
        <div>
          <div className="flex items-baseline justify-between text-xs text-dim"><span>Nuyen left</span><span className={clsx("num", b.nuyen.left < 0 && "text-danger")}>{b.nuyen.left.toLocaleString("en-US")}¥</span></div>
        </div>
      </div>

      <div className={clsx("mt-4 border-l-2 px-3 py-2 text-sm", errors ? "border-danger bg-danger/10" : "border-ok bg-ok/10")}>
        {errors ? `${errors} rule problem${errors === 1 ? "" : "s"} to fix` : "Every rule check passes"}
      </div>
    </aside>
  );
}
