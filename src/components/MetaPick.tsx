"use client";
import { useState } from "react";

/** A pick list from the core book with room for a name from another book. */
export function MetaPick({ value, onChange, options, thing, optional }: { value: string; onChange: (v: string) => void; options: string[]; thing: string; optional?: boolean }) {
  const known = options.some((o) => o.toLowerCase() === value.trim().toLowerCase());
  const [other, setOther] = useState(!!value && !known);
  const typing = other || (!!value && !known);
  return (
    <span className="flex min-w-48 flex-1 flex-wrap gap-2">
      <select className="field !w-auto min-w-40 flex-1" aria-label={thing} value={typing ? "__other" : known ? options.find((o) => o.toLowerCase() === value.trim().toLowerCase()) : ""}
        onChange={(e) => { const v = e.target.value; if (v === "__other") { setOther(true); onChange(""); } else { setOther(false); onChange(v); } }}>
        <option value="">{optional ? `No ${thing.toLowerCase()} yet` : `Choose ${/^[aeiou]/i.test(thing) ? "an" : "a"} ${thing.toLowerCase()}`}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value="__other">From another book…</option>
      </select>
      {typing && <input className="field min-w-36 flex-1" value={value} onChange={(e) => onChange(e.target.value)} placeholder={`${thing} name`} aria-label={`${thing} name`} />}
    </span>
  );
}
