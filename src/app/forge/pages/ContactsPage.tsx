"use client";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { useRulebook } from "@/lib/store/rulebook";
import { uid } from "@/lib/sr6/character";
import { budget, derive } from "@/lib/sr6/derive";
import { sfxUi } from "@/lib/sound";
import { BookText } from "../wizard/BookText";
import { buzz } from "../wizard/fx";
import { Field, Note, Stepper, type StepProps } from "../ui";

const ROLES = ["Fixer", "Street Doc", "Talismonger", "Mechanic", "Bartender", "Beat Cop", "Mr. Johnson", "Mafia Consigliere", "Decker", "Gang leader", "Arms dealer", "Smuggler", "Corporate wageslave", "Journalist"];

function Pips({ n, max, tone }: { n: number; max: number; tone: string }) {
  return <span className="inline-flex gap-[2px]" aria-hidden>{Array.from({ length: max }, (_, i) => <i key={i} className={clsx("h-2.5 w-1.5", i < n ? tone : "bg-line")} />)}</span>;
}

export function ContactsPage({ c, patch }: StepProps) {
  const book = useRulebook((s) => s.book);
  const b = budget(c);
  const cap = Math.max(1, Math.min(12, derive(c).natural.charisma));
  const [focus, setFocus] = useState<string | null>(c.contacts[0]?.id ?? null);
  const [sheet, setSheet] = useState(false);
  const sel = c.contacts.find((k) => k.id === focus);
  const sample = useMemo(() => (sel && book ? book.sections.find((s) => s.parent === "Sample Contacts" && s.title.toLowerCase() === sel.role.trim().toLowerCase()) : undefined), [book, sel]);
  const samples = useMemo(() => (book?.sections ?? []).filter((s) => s.parent === "Sample Contacts" && !/chart|table/i.test(s.title)).map((s) => s.title), [book]);
  const set = (fn: (k: (typeof c.contacts)[number]) => void) => patch((x) => { const k = x.contacts.find((y) => y.id === focus); if (k) fn(k); });
  const add = () => {
    const id = uid("ct");
    patch((x) => { x.contacts.push({ id, name: "", role: "", connection: 1, loyalty: 1 }); });
    setFocus(id); sfxUi("add"); buzz();
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches) setSheet(true);
  };
  const remove = (id: string) => { patch((x) => { x.contacts = x.contacts.filter((k) => k.id !== id); }); if (focus === id) setFocus(null); setSheet(false); sfxUi("remove"); };

  const editor = sel ? (
    <div key={sel.id} className="wz-rise space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input className="field" autoFocus={!sel.name} value={sel.name} onChange={(e) => set((k) => { k.name = e.target.value; })} placeholder="What you call them" /></Field>
        <Field label="Who they are"><input className="field" list="contact-roles" value={sel.role} onChange={(e) => set((k) => { k.role = e.target.value; })} placeholder="Fixer, street doc…" /></Field>
      </div>
      <datalist id="contact-roles">{[...new Set([...samples, ...ROLES])].map((r) => <option key={r} value={r} />)}</datalist>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-dim">Connection: what they can do</div>
          <div className="mt-1 flex items-center gap-3"><Stepper label="Connection" value={sel.connection} min={1} max={cap} disableUp={b.contacts.left <= 0} onChange={(v) => set((k) => { k.connection = v; })} /><Pips n={sel.connection} max={cap} tone="bg-cyan" /></div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-dim">Loyalty: how much they care</div>
          <div className="mt-1 flex items-center gap-3"><Stepper label="Loyalty" value={sel.loyalty} min={1} max={cap} disableUp={b.contacts.left <= 0} onChange={(v) => set((k) => { k.loyalty = v; })} /><Pips n={sel.loyalty} max={cap} tone="bg-accent" /></div>
        </div>
      </div>
      <Field label="Notes"><textarea className="field min-h-20 text-sm" value={sel.notes ?? ""} onChange={(e) => set((k) => { k.notes = e.target.value || undefined; })} placeholder="How you met, what they owe you, what you owe them" /></Field>
      <button className="btn small danger" onClick={() => remove(sel.id)}><Icon name="trash" size={14} /> Remove contact</button>
      {sample && <div className="border-t border-line pt-4"><div className="mb-2 text-[10px] uppercase tracking-widest text-dim">Sample contact</div><BookText section={sample} /></div>}
    </div>
  ) : <div className="grid h-full min-h-48 place-items-center text-sm text-faint">Pick a contact, or add one.</div>;

  return (
    <div>
      <p className="mb-3 max-w-3xl text-sm text-dim">Contacts are free: Charisma × 6 = <b className="num text-fg">{b.contacts.total}</b> points over Connection and Loyalty. Neither can be higher than your Charisma ({cap}) at creation.</p>
      {b.contacts.left < 0 && <div className="mb-3"><Note tone="error">{-b.contacts.left} points over. Lower a rating or drop a contact.</Note></div>}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section className="sel-pane self-start" aria-label="Contacts">
          <div className="sel-head"><span>Contacts</span><span className="num normal-case tracking-normal">{b.contacts.spent} / {b.contacts.total}</span></div>
          <ul className="sel-list" role="listbox">
            {c.contacts.map((k) => (
              <li key={k.id} data-row tabIndex={0} role="option" aria-selected={focus === k.id} className="sel-row items-center"
                onClick={() => { setFocus(k.id); if (!window.matchMedia("(min-width: 1024px)").matches) setSheet(true); }}>
                <span className="grid size-9 shrink-0 place-items-center border border-linehi font-display text-sm">{(k.name || "?").slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display font-semibold">{k.name || <span className="text-faint">Unnamed</span>}</div>
                  <div className="truncate text-xs text-dim">{k.role || "—"}</div>
                </div>
                <span className="num shrink-0 text-xs"><span className="text-cyan">C{k.connection}</span> <span className="text-accent">L{k.loyalty}</span></span>
              </li>
            ))}
            {c.contacts.length === 0 && <li className="p-4 text-sm text-dim">No contacts yet. Most runners start with a fixer.</li>}
          </ul>
          <div className="border-t border-line p-2"><button className="btn w-full" onClick={add}><Icon name="plus" size={14} /> New contact</button></div>
        </section>
        <section className="sel-pane sel-desc max-lg:hidden"><div className="sel-head"><span>Details</span></div><div className="p-4">{editor}</div></section>
      </div>
      {sheet && sel && (
        <div className="fixed inset-0 z-[70] bg-black/60 lg:hidden" onClick={() => setSheet(false)} role="presentation">
          <div className="sel-sheet absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto border-t border-accent bg-bg p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Contact">
            <button className="btn small ghost absolute right-2 top-2 z-10" onClick={() => setSheet(false)} aria-label="Close"><Icon name="x" size={16} /></button>
            {editor}
          </div>
        </div>
      )}
    </div>
  );
}
