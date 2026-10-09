"use client";
import { useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { ATTR_CHOICES, PRESETS, THRESHOLDS, attrName, describeCheck, sanitizeCheck } from "@/lib/checks";
import { SKILLS } from "@/lib/sr6/data";
import { sendCall } from "@/lib/actions";
import { useComms } from "@/lib/store/comms";
import type { CheckSpec } from "@/lib/comms";

const sortedSkills = [...SKILLS].sort((a, b) => a.name.localeCompare(b.name));

/** GM tool: pick a check, set the stakes, call it. Players only have to accept. */
export function CallComposer({ onClose }: { onClose: () => void }) {
  const users = useComms((s) => s.users);
  const handle = useComms((s) => s.handle);
  const players = users.filter((u) => u.role !== "gm" && u.handle !== handle);
  const [label, setLabel] = useState("Haggle");
  const [skill, setSkill] = useState<string>("con");
  const [attr, setAttr] = useState("charisma");
  const [attr2, setAttr2] = useState<string>("");
  const [threshold, setThreshold] = useState(2);
  const [opp, setOpp] = useState(false);
  const [oppLabel, setOppLabel] = useState("");
  const [oppPool, setOppPool] = useState(8);
  const [note, setNote] = useState("");
  const [to, setTo] = useState<string[]>([]);
  const [preset, setPreset] = useState<string>("haggle");

  const spec: CheckSpec = sanitizeCheck({
    label,
    skill: skill || undefined,
    attr,
    attr2: skill ? undefined : attr2 || undefined,
    threshold: opp ? undefined : threshold,
    opposed: opp ? { label: oppLabel, pool: oppPool } : undefined,
    note,
  });

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPreset(id);
    setLabel(p.spec.label);
    setSkill(p.spec.skill ?? "");
    setAttr(p.spec.attr);
    setAttr2(p.spec.attr2 ?? "");
  };
  const toggle = (h: string) => setTo((t) => (t.includes(h) ? t.filter((x) => x !== h) : [...t, h]));
  const call = () => {
    sendCall(spec, to.filter((h) => players.some((p) => p.handle === h)));
    onClose();
  };

  return (
    <div className="panel space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Icon name="bolt" size={18} className="text-accent" />
        <h2 className="text-lg font-semibold">Call for a check</h2>
        <button className="btn ghost small ml-auto" onClick={onClose} aria-label="Close"><Icon name="x" size={14} /></button>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Presets">
        {PRESETS.map((p) => (
          <button key={p.id} className={clsx("chip cursor-pointer", preset === p.id && "!border-accent !text-accent")} onClick={() => applyPreset(p.id)}>{p.label}</button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-dim">Name shown in chat
          <input className="field mt-1" value={label} onChange={(e) => { setLabel(e.target.value); setPreset(""); }} maxLength={60} />
        </label>
        <label className="block text-xs text-dim">Skill
          <select className="field mt-1" value={skill} onChange={(e) => { setSkill(e.target.value); setPreset(""); }}>
            <option value="">No skill: two attributes</option>
            {sortedSkills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="block text-xs text-dim">{skill ? "Attribute" : "First attribute"}
          <select className="field mt-1" value={attr} onChange={(e) => { setAttr(e.target.value); setPreset(""); }}>
            {ATTR_CHOICES.map((a) => <option key={a} value={a}>{attrName(a)}</option>)}
          </select>
        </label>
        {!skill && (
          <label className="block text-xs text-dim">Second attribute
            <select className="field mt-1" value={attr2} onChange={(e) => { setAttr2(e.target.value); setPreset(""); }}>
              <option value="">None</option>
              {ATTR_CHOICES.map((a) => <option key={a} value={a}>{attrName(a)}</option>)}
            </select>
          </label>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex gap-2 text-sm">
          <button className={clsx("btn small", !opp && "primary")} onClick={() => setOpp(false)}>Against a threshold</button>
          <button className={clsx("btn small", opp && "primary")} onClick={() => setOpp(true)}>Opposed roll</button>
        </div>
        {!opp ? (
          <div className="flex flex-wrap gap-1.5">
            {THRESHOLDS.map((t) => (
              <button key={t.v} title={t.hint} className={clsx("chip cursor-pointer", threshold === t.v && "!border-accent !text-accent")} onClick={() => setThreshold(t.v)}>
                {t.label}{t.v ? ` · ${t.v}` : ""}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="block text-xs text-dim">Opposition
              <input className="field mt-1" value={oppLabel} onChange={(e) => setOppLabel(e.target.value)} placeholder="Fixer's negotiation" maxLength={40} />
            </label>
            <div className="text-xs text-dim">Dice
              <div className="mt-1 flex items-center gap-2">
                <button className="btn small" onClick={() => setOppPool((n) => Math.max(1, n - 1))} aria-label="Fewer dice"><Icon name="minus" size={14} /></button>
                <b className="w-7 text-center font-mono text-lg text-fg">{oppPool}</b>
                <button className="btn small" onClick={() => setOppPool((n) => Math.min(30, n + 1))} aria-label="More dice"><Icon name="plus" size={14} /></button>
              </div>
            </div>
            <p className="text-xs text-dim sm:col-span-2">The runner&apos;s client rolls both sides. Most hits wins, a tie is yours to call.</p>
          </div>
        )}
      </div>

      <label className="block text-xs text-dim">Scene note, shown on the card (optional)
        <input className="field mt-1" value={note} onChange={(e) => setNote(e.target.value)} maxLength={240} placeholder="Mr. Johnson leans back and names a price twice what you hoped." />
      </label>

      <div>
        <p className="mb-1.5 text-xs text-dim">Who rolls</p>
        <div className="flex flex-wrap gap-1.5">
          <button className={clsx("chip cursor-pointer", to.length === 0 && "!border-accent !text-accent")} onClick={() => setTo([])}>Everyone</button>
          {players.map((p) => (
            <button key={p.handle} className={clsx("chip cursor-pointer", to.includes(p.handle) && "!border-accent !text-accent")} onClick={() => toggle(p.handle)}>{p.handle}</button>
          ))}
          {players.length === 0 && <span className="text-xs text-faint">Nobody else is here yet.</span>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <p className="font-mono text-xs text-dim">{spec.label}: {describeCheck(spec)}</p>
        <button className="btn primary ml-auto" onClick={call}><Icon name="bolt" size={16} /> Call it</button>
      </div>
    </div>
  );
}
