"use client";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { useRulebook } from "@/lib/store/rulebook";
import { LIFESTYLES } from "@/lib/sr6/data";
import { budget } from "@/lib/sr6/derive";
import { sfxUi } from "@/lib/sound";
import { BookText } from "../wizard/BookText";
import { buzz } from "../wizard/fx";
import { Stepper, type StepProps } from "../ui";
import { isFakeSin } from "./SinsPage";

const yen = (n: number) => `${n.toLocaleString("en-US")}¥`;
const TIER = ["▁", "▂", "▃", "▅", "▆", "█"];

export function LifestylePage({ c, patch }: StepProps) {
  const book = useRulebook((s) => s.book);
  const b = budget(c);
  const cur = LIFESTYLES.find((l) => l.id === c.lifestyle) ?? LIFESTYLES[0];
  const section = book?.sections.find((s) => s.parent === "Lifestyles" && s.title === cur.name);
  const real = c.qualities.some((q) => /^sinner/i.test(q.name));
  const sins = c.gear.filter(isFakeSin);
  const monthly = cur.cost > 0 && c.lifestyleMonths > 0 ? b.nuyen.lifestyle / c.lifestyleMonths : cur.cost;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {LIFESTYLES.map((l, i) => {
            const on = l.id === c.lifestyle;
            return (
              <button key={l.id} type="button" aria-pressed={on} style={{ animationDelay: `${i * 40}ms` }}
                onClick={() => { patch((x) => { x.lifestyle = l.id; if (l.id !== "street" && x.lifestyleMonths === 0) x.lifestyleMonths = 1; }); sfxUi("add"); buzz(); }}
                className={clsx("wz-rise relative border p-3 text-left transition-colors", on ? "border-accent bg-accent/[.08]" : "border-line hover:border-linehi")}>
                {on && <span className="absolute right-0 top-0 grid size-6 place-items-center bg-accent text-accentink" aria-hidden><Icon name="check" size={12} /></span>}
                <div className="flex items-baseline gap-2"><span className="text-accent" aria-hidden>{TIER[i]}</span><span className={clsx("font-display text-lg font-bold", on && "text-accent")}>{l.name}</span></div>
                <div className="num text-sm text-dim">{l.cost ? `${yen(l.cost)} / month` : "Free"}</div>
              </button>
            );
          })}
        </div>

        <section className="mt-5 grid gap-4 border border-line p-4 sm:grid-cols-2">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-dim">Months paid in advance</div>
            <div className="mt-1 flex items-center gap-3">
              <Stepper label="Months prepaid" value={c.lifestyleMonths} min={0} max={24} onChange={(v) => patch((x) => { x.lifestyleMonths = v; })} />
              <span className="num text-sm text-dim">= <b className="text-fg">{yen(b.nuyen.lifestyle)}</b></span>
            </div>
            {monthly !== cur.cost && cur.cost > 0 && <p className="mt-1 text-xs text-faint">{yen(Math.round(monthly))} a month with SINner taxes.</p>}
            {cur.id !== "street" && c.lifestyleMonths === 0 && <p className="mt-1 text-xs text-accent">With no month paid you start on the street.</p>}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-dim">Rented under</div>
            <select className="field mt-1" value={c.lifestyleSin ?? ""} aria-label="SIN the lifestyle is rented under" onChange={(e) => patch((x) => { if (e.target.value) x.lifestyleSin = e.target.value; else delete x.lifestyleSin; })}>
              <option value="">{cur.id === "street" ? "Nobody: no address" : "Cash, no SIN on file"}</option>
              {real && <option value="real">Your own SIN</option>}
              {sins.map((g, i) => <option key={g.id} value={g.id}>{g.notes || `Fake SIN ${i + 1}`} (rating {g.rating ?? "?"})</option>)}
            </select>
            {!real && sins.length === 0 && cur.id !== "street" && <p className="mt-1 text-xs text-faint">Without a SIN, landlords ask questions. Buy a fake one on the SINs page.</p>}
          </div>
        </section>
        <p className="mt-3 text-xs text-faint">Nuyen left after gear and lifestyle: <b className={clsx("num", b.nuyen.left < 0 ? "text-danger" : "text-fg")}>{yen(b.nuyen.left)}</b></p>
      </div>
      <aside className="sel-pane sel-desc self-start">
        <div className="sel-head"><span>{cur.name}</span><span className="num normal-case tracking-normal">{cur.cost ? `${yen(cur.cost)}/mo` : "free"}</span></div>
        <div key={cur.id} className="wz-rise p-4"><BookText section={section} /></div>
      </aside>
    </div>
  );
}
