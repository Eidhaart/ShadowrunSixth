"use client";
import { useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { uid, type GearItem } from "@/lib/sr6/character";
import { budget } from "@/lib/sr6/derive";
import { useCatalog } from "@/lib/compendium/catalog";
import { sfxUi } from "@/lib/sound";
import { buzz } from "../wizard/fx";
import { Note, RuleLink, type StepProps } from "../ui";

export const isFakeSin = (g: GearItem) => /^fake sin\b/i.test(g.name);
export const isLicense = (g: GearItem) => /^fake licen[sc]e\b/i.test(g.name);
const ratingOf = (g: GearItem) => g.rating ?? Number(/rating (\d+)/i.exec(g.name)?.[1] ?? 1);
const yen = (n: number) => `${n.toLocaleString("en-US")}¥`;

/** Licenses people usually need, as suggestions. The rating is what is tested, not the wording. */
const LICENSE_IDEAS = ["Concealed carry", "Firearms", "Cyberware", "Driver’s license", "Pilot’s license", "Rigger control console", "Magic user", "Talismonger", "Hunting", "Restricted gear"];

export function SinsPage({ c, patch }: StepProps) {
  const catalog = useCatalog();
  const b = budget(c);
  const real = c.qualities.some((q) => /^sinner/i.test(q.name));
  const sins = c.gear.filter(isFakeSin);
  const licenses = c.gear.filter(isLicense);
  const restricted = c.gear.filter((g) => g.legal === "L" && !isFakeSin(g) && !isLicense(g));
  const illegal = c.gear.filter((g) => g.legal === "I" && !isFakeSin(g) && !isLicense(g));
  const [newRating, setNewRating] = useState(3);
  const [newName, setNewName] = useState("");

  const item = (kind: "sin" | "license", r: number) => catalog.find((i) => i.id === `identity-fake-${kind}-r${r}`);
  const make = (kind: "sin" | "license", r: number, extra: Partial<GearItem>): GearItem | null => {
    const i = item(kind, r);
    if (!i) return null;
    return { ...(JSON.parse(JSON.stringify(i.gear)) as Omit<GearItem, "id">), id: uid("g"), qty: 1, rating: r, legal: i.legal, avail: i.avail, ...extra };
  };
  const rerate = (g: GearItem, kind: "sin" | "license", r: number) => {
    const i = item(kind, r);
    if (!i) return;
    patch((x) => { const t = x.gear.find((y) => y.id === g.id); if (t) { t.name = i.gear.name; t.cost = i.gear.cost; t.rating = r; } });
  };
  const buySin = () => {
    const g = make("sin", newRating, { notes: newName.trim() || undefined });
    if (!g) return;
    patch((x) => { x.gear.push(g); });
    setNewName("");
    sfxUi("add"); buzz();
  };
  const addLicense = (sinId: string) => {
    const g = make("license", Math.min(4, ratingOf(c.gear.find((y) => y.id === sinId) ?? ({ rating: 3 } as GearItem))), { sinId, notes: "" });
    if (!g) return;
    patch((x) => { x.gear.push(g); });
    sfxUi("add"); buzz();
  };
  const drop = (id: string) => { patch((x) => { x.gear = x.gear.filter((g) => g.id !== id && g.sinId !== id); if (x.lifestyleSin === id) delete x.lifestyleSin; }); sfxUi("remove"); };

  const identities: { id: string; title: string; sub: string; g?: GearItem }[] = [
    ...(real ? [{ id: "real", title: "Your own SIN", sub: "From the SINner quality. Legal, taxed and on file." }] : []),
    ...sins.map((g) => ({ id: g.id, title: g.notes || `Fake SIN ${sins.indexOf(g) + 1}`, sub: `Rating ${ratingOf(g)} · ${yen(g.cost)}`, g })),
  ];

  return (
    <div>
      <p className="mb-4 max-w-3xl text-sm text-dim">Most runners are SINless. A fake SIN lets you rent, travel and pay like a citizen, until a check rolls against its rating. Licenses are attached to a SIN, one per kind of restricted gear.</p>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          {identities.length === 0 && <Note>No SIN yet. Buy a fake one below, or take the SINner quality if your runner has a real one.</Note>}
          {identities.map((s, n) => {
            const mine = licenses.filter((l) => l.sinId === s.id);
            return (
              <article key={s.id} className="wz-rise border border-line bg-panel/60" style={{ animationDelay: `${n * 50}ms` }}>
                <header className="flex flex-wrap items-center gap-3 border-b border-line p-3">
                  <span className={clsx("grid size-9 place-items-center border font-display text-xs", s.id === "real" ? "border-ok text-ok" : "border-accent text-accent")} aria-hidden>{s.id === "real" ? "SIN" : `R${ratingOf(s.g!)}`}</span>
                  <div className="min-w-0 flex-1">
                    {s.g ? (
                      <input className="w-full bg-transparent font-display text-lg font-semibold outline-none focus:text-accent" value={s.g.notes ?? ""} placeholder={s.title}
                        aria-label="Identity name" onChange={(e) => patch((x) => { const t = x.gear.find((y) => y.id === s.id); if (t) t.notes = e.target.value || undefined; })} />
                    ) : <div className="font-display text-lg font-semibold">{s.title}</div>}
                    <div className="text-xs text-dim">{s.sub}</div>
                  </div>
                  {s.g && (
                    <>
                      <label className="flex items-center gap-1.5 text-xs text-dim">Rating
                        <select className="field !w-16 !py-1" value={ratingOf(s.g)} onChange={(e) => rerate(s.g!, "sin", Number(e.target.value))} aria-label="Fake SIN rating">
                          {[1, 2, 3, 4, 5, 6].filter((r) => item("sin", r)).map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </label>
                      <button className="btn small ghost hover:text-danger" onClick={() => drop(s.id)} aria-label={`Remove ${s.title}`}><Icon name="trash" size={14} /></button>
                    </>
                  )}
                </header>
                <ul className="divide-y divide-line/60">
                  {mine.map((l) => (
                    <li key={l.id} className="sel-in flex flex-wrap items-center gap-2 px-3 py-2">
                      <Icon name="gavel" size={14} className="text-faint" />
                      <input className="field min-w-40 flex-1 !py-1.5 text-sm" list="license-ideas" placeholder="What it covers" value={l.notes ?? ""} aria-label="License covers"
                        onChange={(e) => patch((x) => { const t = x.gear.find((y) => y.id === l.id); if (t) t.notes = e.target.value; })} />
                      <select className="field !w-16 !py-1" value={ratingOf(l)} onChange={(e) => rerate(l, "license", Number(e.target.value))} aria-label="License rating">
                        {[1, 2, 3, 4, 5, 6].filter((r) => item("license", r)).map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <span className="num w-16 text-right text-xs text-dim">{yen(l.cost)}</span>
                      <button className="btn small ghost !px-2 hover:text-danger" onClick={() => drop(l.id)} aria-label="Remove license"><Icon name="x" size={14} /></button>
                    </li>
                  ))}
                  <li className="px-3 py-2"><button className="btn small" onClick={() => addLicense(s.id)}><Icon name="plus" size={13} /> Add a license</button></li>
                </ul>
              </article>
            );
          })}
          <datalist id="license-ideas">{LICENSE_IDEAS.map((x) => <option key={x} value={x} />)}</datalist>
          {licenses.some((l) => !l.sinId || !identities.some((s) => s.id === l.sinId)) && (
            <Note tone="warn">Some licenses are not attached to a SIN: {licenses.filter((l) => !l.sinId || !identities.some((s) => s.id === l.sinId)).map((l) => l.name).join(", ")}.
              {identities[0] && <button className="ml-2 underline" onClick={() => patch((x) => { for (const g of x.gear) if (isLicense(g) && (!g.sinId || !identities.some((s) => s.id === g.sinId))) g.sinId = identities[0].id; })}>Attach to {identities[0].title}</button>}
            </Note>
          )}

          <section className="border border-dashed border-linehi p-3">
            <h3 className="mb-2 font-display font-semibold">New fake SIN</h3>
            <div className="flex flex-wrap items-end gap-2">
              <input className="field min-w-40 flex-1" placeholder="Name on the SIN (optional)" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="Name on the new SIN" />
              <label className="text-xs text-dim">Rating
                <select className="field mt-1 !w-20" value={newRating} onChange={(e) => setNewRating(Number(e.target.value))} aria-label="New SIN rating">
                  {[1, 2, 3, 4, 5, 6].filter((r) => item("sin", r)).map((r) => <option key={r} value={r}>{r} · {yen(item("sin", r)!.cost ?? 0)}</option>)}
                </select>
              </label>
              <button className="btn primary" onClick={buySin} disabled={!item("sin", newRating)}><Icon name="plus" size={14} /> Buy</button>
            </div>
            <p className="mt-2 text-xs text-faint">Nuyen left: <b className="num">{yen(b.nuyen.left)}</b></p>
          </section>
        </div>

        <aside className="space-y-3">
          <section className="border border-line p-3">
            <h3 className="mb-1 font-display font-semibold">Gear that needs a license</h3>
            {restricted.length === 0 ? <p className="text-sm text-dim">Nothing you own is restricted.</p> : (
              <ul className="space-y-1 text-sm">{restricted.map((g) => <li key={g.id} className="flex justify-between gap-2"><span>{g.name}</span><span className="num text-xs text-accent">{g.avail ?? ""}L</span></li>)}</ul>
            )}
            {restricted.length > 0 && licenses.length === 0 && <p className="mt-2 text-xs text-accent">No license yet: add one to a SIN for each kind of restricted gear.</p>}
          </section>
          {illegal.length > 0 && (
            <section className="border border-danger/50 p-3">
              <h3 className="mb-1 font-display font-semibold text-danger">Illegal</h3>
              <p className="mb-1 text-xs text-dim">No license covers these. Keep them hidden.</p>
              <ul className="space-y-1 text-sm">{illegal.map((g) => <li key={g.id}>{g.name}</li>)}</ul>
            </section>
          )}
          <RuleLink match={/^Fake SINs?$|^SINs?$/i} />
        </aside>
      </div>
    </div>
  );
}
