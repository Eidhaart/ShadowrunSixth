/**
 * The printed runner sheet. Pure: everything comes in through props, so it renders the same on screen,
 * on paper and in tests. Both layouts carry every entry and every number; Expanded adds the book's text,
 * the working behind each number and stat blocks, Minimal sets the same content densely in columns.
 */
import type { ReactNode } from "react";
import clsx from "clsx";
import { isPortrait } from "@/lib/portrait";
import { RANGES, type PrintData } from "@/lib/sr6/printData";

export type PrintMode = "expanded" | "minimal";

const yen = (n: number) => `${Math.round(n).toLocaleString("en-US")}¥`;
const ess = (n: number) => (+n.toFixed(3)).toString();
const ar = (v: (number | null)[]) => v.map((x) => (x == null ? "–" : x)).join("/");

function Sec({ title, aside, children, flow }: { title: string; aside?: ReactNode; children: ReactNode; flow?: boolean }) {
  return (
    <section className={clsx("ps-sec", flow && "flow")}>
      <h2>{title}{aside != null && <span className="aside">{aside}</span>}</h2>
      {children}
    </section>
  );
}

/** Condition boxes in rows of three, the wound modifier at the end of each full row. */
function Track({ label, boxes, filled, wounds, edge }: { label: string; boxes: number; filled: number; wounds?: boolean; edge?: boolean }) {
  const rows = Math.ceil(boxes / 3);
  return (
    <div className="ps-track">
      <div className="t"><span>{label}</span>{!edge && <span className="n faint">{boxes}</span>}</div>
      {edge ? (
        <div className="ps-row">{Array.from({ length: boxes }, (_, i) => <span key={i} className={clsx("ps-box edge", i < filled && "on")} />)}</div>
      ) : (
        Array.from({ length: rows }, (_, r) => {
          const n = Math.min(3, boxes - r * 3);
          return (
            <div key={r} className="ps-row">
              {Array.from({ length: n }, (_, k) => <span key={k} className={clsx("ps-box", r * 3 + k < filled && "on")} />)}
              {wounds && n === 3 && <span className="wm">−{r + 1}</span>}
            </div>
          );
        })
      )}
    </div>
  );
}

/** A book description: the summary in Expanded, the page reference in both. */
function Book({ text, page, x }: { text?: string; page?: number; x: boolean }) {
  if (!text && !page) return null;
  if (!x) return page ? <span className="faint"> p.{page}</span> : null;
  return <div className="desc">{text}{page ? <span className="p"> (p.{page})</span> : null}</div>;
}

export function PrintSheet({ p, mode, marks, paper }: { p: PrintData; mode: PrintMode; marks: boolean; paper: "a4" | "letter" }) {
  const x = mode === "expanded";
  const { c, d } = p;
  const physFilled = marks ? c.damage.physical : 0;
  const stunFilled = marks ? c.damage.stun : 0;
  const overFilled = marks ? c.damage.overflow : 0;
  const edgeFilled = marks ? c.edgeCurrent : 0;
  const printed = new Date().toISOString().slice(0, 10);

  const head = (
    <header className="ps-head">
      {(isPortrait(c.portrait) || /^\/portraits\//.test(String(c.portrait ?? ""))) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ps-portrait" src={c.portrait} alt="" />
      )}
      <div style={{ minWidth: 0 }}>
        <h1>{p.who}</h1>
        <div className="sub">{p.subtitle}</div>
        {c.concept && <div className="concept">{c.concept}</div>}
        {p.magic?.tradition && <div className="concept">Tradition: {p.magic.tradition}</div>}
      </div>
      <div className="meta">
        <div className="mark">SIXTHDECK</div>
        {c.player && <div>Player: {c.player}</div>}
        <div>{c.stage === "complete" ? "In play" : "Draft build"}</div>
        <div>Printed {printed}</div>
      </div>
    </header>
  );

  const attributes = (
    <Sec title="Attributes" aside={x ? "augmented value; natural and maximum underneath" : undefined}>
      <div className="ps-attrs">
        {p.attrs.map((a) => (
          <div key={a.key}>
            <div className="k">{a.abbr}</div>
            <div className="v">{a.value}</div>
            <div className="x">{a.value !== a.natural ? `nat ${a.natural} · ` : ""}max {a.max}</div>
          </div>
        ))}
        {p.specials.map((s) => (
          <div key={s.label} className="sp">
            <div className="k">{s.label}</div>
            <div className="v">{s.value}</div>
            <div className="x">{s.note ?? " "}</div>
          </div>
        ))}
        {Array.from({ length: Math.max(0, 12 - p.attrs.length - p.specials.length) }, (_, i) => <div key={`pad${i}`} />)}
      </div>
    </Sec>
  );

  const derived = (
    <Sec title="Derived">
      <div className="ps-stats">
        {p.derived.map((s) => (
          <div key={s.label} className="ps-stat">
            <span>{s.label}</span><b>{s.value}</b>
            {x && <span className="why">{s.why}</span>}
          </div>
        ))}
        {c.poolMod ? <div className="ps-stat"><span>Sheet dice modifier</span><b>{c.poolMod > 0 ? `+${c.poolMod}` : c.poolMod}</b></div> : null}
      </div>
    </Sec>
  );

  const condition = (
    <Sec title="Condition" aside={marks ? "current damage shaded" : "fill in at the table"}>
      <div className="ps-tracks">
        <Track label="Physical" boxes={d.condition.physical} filled={physFilled} wounds />
        <Track label="Stun" boxes={d.condition.stun} filled={stunFilled} wounds />
        <Track label="Overflow" boxes={d.condition.overflow} filled={overFilled} />
        <Track label={`Edge (rating ${d.edge})`} boxes={7} filled={edgeFilled} edge />
      </div>
      {x && <div className="desc">Every full row of Physical or Stun is −1 die on all tests except Damage Resistance. A full Stun monitor knocks you out and spills over into Physical; Overflow past Body x 2 is death. Edge above your rating is lost at the end of a confrontation.</div>}
      {c.statuses.length > 0 && <div className="note">Statuses: {c.statuses.join(", ")}</div>}
    </Sec>
  );

  const skills = (
    <Sec title="Skills" aside={x ? "rank + attribute; specialization +2, expertise +3" : undefined}>
      {p.skills.length === 0 ? <div className="ps-empty">No skills.</div> : (
        <table>
          <thead><tr><th>Skill</th><th className="r">Rank</th><th>Attr</th><th className="r">Pool</th><th>Specialization</th></tr></thead>
          <tbody>
            {p.skills.map((s) => (
              <tr key={s.id}>
                <td className="name">{s.name}</td>
                <td className="n r">{s.rank}</td>
                <td className="n">{s.attr.slice(0, 3).toUpperCase()} {s.attrValue}</td>
                <td className="n r"><b>{s.pool}</b></td>
                <td>{s.spec ? <>{s.spec}{s.expert ? " (expertise)" : ""} <span className="n">{s.specPool}</span></> : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Sec>
  );

  const knowledge = p.knowledge.length > 0 && (
    <Sec title="Knowledge and languages">
      <ul className="list">{p.knowledge.map((k, i) => <li key={i}><span className="name">{k.name}</span> <span className="soft">· {k.detail}</span></li>)}</ul>
    </Sec>
  );

  const qualities = (
    <Sec title="Qualities" aside={`${p.qualities.filter((q) => q.q.kind === "positive").length} positive, ${p.qualities.filter((q) => q.q.kind === "negative").length} negative`}>
      {p.qualities.length === 0 ? <div className="ps-empty">None.</div> : (
        <ul className="list">
          {p.qualities.map(({ q, def, target }, i) => {
            const long = q.note && !target ? q.note.trim() : "";
            return (
              <li key={i}>
                <span className="name">{q.name}</span>
                {q.level > 1 && <span className="n"> {q.level}</span>}
                {target && <span className="soft"> · {target}</span>}
                <span className={clsx("tag", q.kind === "negative" && "hot")}>{q.kind === "positive" ? "−" : "+"}{q.karma * q.level} K</span>
                <Book text={def?.effectText || def?.blurb} page={def?.page} x={x} />
                {long && (x ? <div className="note">{long}</div> : <div className="soft">{long}</div>)}
              </li>
            );
          })}
        </ul>
      )}
    </Sec>
  );

  const weapons = (
    <Sec title="Weapons" aside={x ? `AR by range: ${RANGES.join(" / ")}` : "AR C/N/M/F/E"}>
      <table>
        <thead><tr><th>Weapon</th><th className="r">Pool</th><th>DV</th><th>AR</th>{x && <th>Skill</th>}</tr></thead>
        <tbody>
          <tr>
            <td className="name">Unarmed</td>
            <td className="n r"><b>{Math.max(0, (d.skills.find((s) => s.id === "close-combat")?.pool ?? d.attrs.agility - 1))}</b></td>
            <td className="n">{Math.ceil(d.attrs.strength / 2)}{d.unarmedPhysical ? "P" : "S"}</td>
            <td className="n">{d.unarmedAR}/–/–/–/–</td>
            {x && <td>Close Combat</td>}
          </tr>
          {p.weapons.map((w) => (
            <WeaponRows key={w.g.id} w={w} x={x} />
          ))}
        </tbody>
      </table>
      {p.ammo.length > 0 && (
        <>
          <h3>Ammunition</h3>
          <ul className="list">{p.ammo.map((a) => <li key={a.id}><span className="n">{a.qty}×</span> {a.name}{a.notes ? <span className="soft"> · {a.notes}</span> : null}</li>)}</ul>
        </>
      )}
    </Sec>
  );

  const armor = p.armor.length > 0 && (
    <Sec title="Armor">
      <table>
        <tbody>
          {p.armor.map((g) => (
            <GearRows key={g.id} g={g} p={p} x={x} right={<>{g.armor ? <b className="n">+{g.armor}</b> : null}{g.worn === false ? <span className="tag">not worn</span> : null}{g.capacity ? <span className="faint n"> cap {g.capacity}</span> : null}</>} />
          ))}
        </tbody>
      </table>
    </Sec>
  );

  const augments = p.augments.length > 0 && (
    <Sec title="Augmentations" aside={`Essence ${ess(d.essence)} left`}>
      <table>
        <thead><tr><th>Implant</th><th className="r">Essence</th>{x && <th className="r">Cost</th>}</tr></thead>
        <tbody>
          {p.augments.map((g) => {
            const kids = p.kidsOf(g);
            return [
              <tr key={g.id}>
                <td><span className="name">{g.name}</span>{g.capacity ? <span className="faint n"> cap {kids.reduce((n, k) => n + (k.capCost ?? 0), 0)}/{g.capacity}</span> : null}{x && g.notes ? <div className="note">{g.notes}</div> : null}</td>
                <td className="n r">{g.essence ? ess(g.essence * (g.qty || 1)) : "–"}</td>
                {x && <td className="n r">{yen(g.cost * (g.qty || 1))}</td>}
              </tr>,
              ...kids.map((k) => (
                <tr key={k.id} className="kid">
                  <td>{k.name}{k.capCost ? <span className="faint n"> [{k.capCost}]</span> : null}</td>
                  <td className="n r faint">in host</td>
                  {x && <td className="n r">{yen(k.cost * (k.qty || 1))}</td>}
                </tr>
              )),
            ];
          })}
        </tbody>
      </table>
    </Sec>
  );

  const m = p.magic;
  const magic = m && (
    <Sec title={`Magic · ${m.type}`} aside={`Magic ${d.magic}${m.grade ? ` · initiate grade ${m.grade}` : ""}`} flow>
      <div className="ps-kv">
        {m.tradition && <><dt>Tradition</dt><dd>{m.tradition}</dd></>}
        {m.drain && <><dt>Drain resistance</dt><dd><b className="n">{m.drain.pool}</b>{x && <span className="soft"> · {m.drain.why}</span>}</dd></>}
        {m.pp && <><dt>Power Points</dt><dd><span className="n">{m.pp.spent} spent of {+(m.pp.start + m.pp.extra).toFixed(2)}</span>{m.pp.extra ? <span className="soft"> ({m.pp.start} from {m.pp.split ? "the split" : "Magic"}, {m.pp.extra} from initiation)</span> : null}{m.pp.left ? <span className="soft"> · {m.pp.left} left</span> : null}</dd></>}
        {m.pp?.split && <><dt>Magic split</dt><dd>{m.pp.split}</dd></>}
        {m.grade > 0 && <><dt>Metamagic</dt><dd>{m.metamagic.length ? m.metamagic.join(", ") : "none chosen"}</dd></>}
      </div>
      {m.spells.length > 0 && (
        <>
          <h3>{m.spells.some((s) => s.ritual) ? "Spells and rituals" : "Spells"} <span className="faint">({m.spells.length})</span></h3>
          <table>
            <thead><tr><th>Spell</th><th>Cat</th><th>Type</th><th>Range</th><th>Dur</th><th className="r">DV</th></tr></thead>
            <tbody>
              {m.spells.flatMap((s) => [
                <tr key={s.name} className={x && s.book ? "sub-row" : undefined}>
                  <td><span className="name">{s.name}</span>{s.sustained && <span className="tag hot">sustained</span>}{s.ritual && <span className="tag">ritual</span>}{!x && s.book ? <span className="faint"> p.{s.book.page}</span> : null}</td>
                  <td>{s.def?.cat ?? s.book?.group ?? ""}</td>
                  <td>{s.def ? `${s.def.type}${s.def.kind ? `, ${s.def.kind === "direct" ? "D" : "I"}` : ""}` : ""}</td>
                  <td>{s.def?.range ?? ""}</td>
                  <td>{s.def?.dur ?? ""}</td>
                  <td className="n r">{s.def?.dv ?? ""}{s.def?.dmg ?? ""}</td>
                </tr>,
                ...(x && s.book ? [<tr key={`${s.name}-d`}><td colSpan={6}><Book text={s.book.summary} page={s.book.page} x /></td></tr>] : []),
              ])}
            </tbody>
          </table>
        </>
      )}
      {m.powers.length > 0 && (
        <>
          <h3>Adept powers <span className="faint">({m.powers.length})</span></h3>
          <table>
            <thead><tr><th>Power</th><th className="r">Level</th><th className="r">PP</th></tr></thead>
            <tbody>
              {m.powers.flatMap((pw, i) => [
                <tr key={i} className={x && pw.book ? "sub-row" : undefined}>
                  <td><span className="name">{pw.name}</span>{!x && pw.book ? <span className="faint"> p.{pw.book.page}</span> : null}</td>
                  <td className="n r">{pw.level && pw.level > 1 ? pw.level : ""}</td>
                  <td className="n r">{+(pw.cost).toFixed(2)}</td>
                </tr>,
                ...(x && pw.book ? [<tr key={`${i}-d`}><td colSpan={3}><Book text={pw.book.summary} page={pw.book.page} x /></td></tr>] : []),
              ])}
            </tbody>
          </table>
        </>
      )}
      {m.foci.length > 0 && (
        <>
          <h3>Foci</h3>
          <ul className="list">
            {m.foci.map((f, i) => (
              <li key={i}>
                <span className="name">{f.name}</span> <span className="soft">· {f.kind}, Force {f.force}</span>
                {f.bonded ? <span className="tag">bonded</span> : <span className="tag hot">not bonded</span>}
                {f.active && <span className="tag">active</span>}
                {f.on && <span className="soft"> · part of {f.on}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      {m.spirits.length > 0 && (
        <>
          <h3>Spirits</h3>
          <ul className="list">
            {m.spirits.map((s, i) => (
              <li key={i}>
                <span className="name">{s.name}</span> <span className="soft">· Force {s.force}, {s.services} {s.services === 1 ? "service" : "services"}{s.bound ? ", bound" : ""}{s.damage ? `, ${s.damage} damage` : ""}</span>
                {s.block && (x
                  ? <div className="block">Init {s.block.init}+{s.block.initDice}D6 · Astral {s.block.astralInit}+3D6 · DR {s.block.defense} · AR {s.block.attackRating} · Monitor {s.block.boxes} · {s.block.attack.name} {s.block.attack.dv}{s.block.attack.dmg}<br />B/A/R/S/W/L/I/C {s.block.attrs.join("/")} · {s.block.powers}</div>
                  : <div className="block">Init {s.block.init}+{s.block.initDice}D6 · DR {s.block.defense} · AR {s.block.attackRating} · {s.block.attack.dv}{s.block.attack.dmg} · B/A/R/S/W/L/I/C {s.block.attrs.join("/")}</div>)}
                {s.note && <div className="soft">{s.note}</div>}
              </li>
            ))}
          </ul>
        </>
      )}
    </Sec>
  );

  const r = p.resonance;
  const resonance = r && (
    <Sec title="Resonance" aside={`Resonance ${d.resonance}${r.grade ? ` · submersion grade ${r.grade}` : ""}`} flow>
      <div className="ps-kv">
        <dt>Fading resistance</dt><dd><b className="n">{r.fade.pool}</b>{x && <span className="soft"> · {r.fade.why}</span>}</dd>
        {r.grade > 0 && <><dt>Echoes</dt><dd>{r.echoes.length ? r.echoes.join(", ") : "none chosen"}</dd></>}
      </div>
      {r.forms.length > 0 && (
        <>
          <h3>Complex forms <span className="faint">({r.forms.length})</span></h3>
          <table>
            <thead><tr><th>Form</th><th>Dur</th><th className="r">Fade</th></tr></thead>
            <tbody>
              {r.forms.flatMap((f) => [
                <tr key={f.name} className={x && (f.note || f.book) ? "sub-row" : undefined}>
                  <td><span className="name">{f.name}</span>{f.sustained && <span className="tag hot">sustained</span>}{!x && f.book ? <span className="faint"> p.{f.book.page}</span> : null}</td>
                  <td>{f.dur ?? ""}</td>
                  <td className="n r">{f.fade ?? ""}</td>
                </tr>,
                ...(x && (f.note || f.book) ? [<tr key={`${f.name}-d`}><td colSpan={3}><Book text={f.book?.summary || f.note} page={f.book?.page} x /></td></tr>] : []),
              ])}
            </tbody>
          </table>
        </>
      )}
      {r.sprites.length > 0 && (
        <>
          <h3>Sprites</h3>
          <ul className="list">
            {r.sprites.map((s, i) => (
              <li key={i}>
                <span className="name">{s.name}</span> <span className="soft">· Level {s.level}, {s.tasks} {s.tasks === 1 ? "task" : "tasks"}{s.registered ? ", registered" : ""}{s.damage ? `, ${s.damage} damage` : ""}</span>
                {s.block && <div className="block">A/S/D/F {s.block.attack}/{s.block.sleaze}/{s.block.dp}/{s.block.fw} · Init {s.block.init}+{s.block.initDice}D6 · Monitor {s.block.boxes}{x ? ` · AR ${s.block.attackRating} · DR ${s.block.defenseRating}` : ""}</div>}
                {s.note && <div className="soft">{s.note}</div>}
              </li>
            ))}
          </ul>
        </>
      )}
    </Sec>
  );

  const mx = p.matrix;
  const matrix = mx && (
    <Sec title="Matrix" aside={mx.m.source === "none" ? "no device" : `${mx.m.name}${mx.m.rating ? `, rating ${mx.m.rating}` : ""}`}>
      {mx.m.source !== "none" && (
        <table>
          <thead><tr><th className="c">Attack</th><th className="c">Sleaze</th><th className="c">Data P.</th><th className="c">Firewall</th><th className="c">AR</th><th className="c">DR</th><th className="c">Monitor</th></tr></thead>
          <tbody><tr>
            {[mx.m.attack, mx.m.sleaze, mx.m.dp, mx.m.fw, mx.m.attackRating, mx.m.defenseRating, mx.m.boxes || "Stun"].map((v, i) => <td key={i} className="n c"><b>{v}</b></td>)}
          </tr></tbody>
        </table>
      )}
      {mx.m.source !== "none" && (
        <div className="ps-kv" style={{ marginTop: "1.2mm" }}>
          <dt>Interface</dt><dd>{mx.mode} · initiative {mx.m.init.rank} + {mx.m.init.dice}D6</dd>
          <dt>Program slots</dt><dd className="n">{mx.m.slotsUsed} / {mx.m.slots}</dd>
          {mx.m.boxes > 0 && <><dt>Device damage</dt><dd><div className="ps-row">{Array.from({ length: mx.m.boxes }, (_, i) => <span key={i} className={clsx("ps-box", marks && i < c.ext!.matrixDamage && "on")} />)}</div></dd></>}
        </div>
      )}
      {mx.programs.length > 0 && (
        <>
          <h3>Programs</h3>
          <ul className="list">{mx.programs.map((pr, i) => <li key={i}><span className="name">{pr.name}</span>{pr.active && <span className="tag">running</span>}{x && pr.note ? <div className="desc">{pr.note}</div> : null}</li>)}</ul>
        </>
      )}
    </Sec>
  );

  const rigging = (p.vehicles.length > 0 || p.rcc) && (
    <Sec title="Vehicles and drones" aside={p.rcc ? `RCC: ${p.rcc}` : undefined} flow>
      {p.vehicles.map(({ v, s, boxes }) => (
        <div key={v.id} style={{ breakInside: "avoid", marginBottom: "2mm" }}>
          <div><span className="name">{v.name}</span> <span className="soft">· {v.kind}</span></div>
          <table>
            <thead><tr><th className="c">Hand</th><th className="c">Accel</th><th className="c">Spd Int</th><th className="c">Top</th><th className="c">Body</th><th className="c">Armor</th><th className="c">Pilot</th><th className="c">Sensor</th><th className="c">Seats</th></tr></thead>
            <tbody><tr>{[`${v.handlingOn}/${v.handlingOff}`, v.accel, v.speedInterval, v.topSpeed, v.body, v.armor, v.pilot, v.sensor, v.seats].map((val, i) => <td key={i} className="n c">{val}</td>)}</tr></tbody>
          </table>
          {x && <div className="desc">Attack Rating {s.attackRating} · Defense Rating {s.defenseRating} · ram {s.ramDamage}P · piloting {s.pilotPool.base} ({s.pilotPool.label}) · Maneuvering {v.maneuver}, Targeting {v.targeting}</div>}
          <div className="ps-row" style={{ marginTop: ".8mm" }}>{Array.from({ length: boxes }, (_, i) => <span key={i} className={clsx("ps-box", marks && i < v.damage && "on")} />)}<span className="faint" style={{ marginLeft: "1mm" }}>{boxes} boxes</span></div>
          {v.note && <div className="soft">{v.note}</div>}
        </div>
      ))}
    </Sec>
  );

  const gear = (
    <Sec title="Gear" aside={`${p.gear.length} ${p.gear.length === 1 ? "item" : "items"}`} flow>
      {p.gear.length === 0 ? <div className="ps-empty">Nothing else.</div> : (
        <table>
          {x && <thead><tr><th>Item</th><th className="r">Qty</th><th className="r">Cost</th></tr></thead>}
          <tbody>{p.gear.map(({ g }) => <GearRows key={g.id} g={g} p={p} x={x} />)}</tbody>
        </table>
      )}
    </Sec>
  );

  const identity = p.identity.length > 0 && (
    <Sec title="SINs and licenses">
      <ul className="list">{p.identity.map((g) => <li key={g.id}><span className="name">{g.name}</span>{g.qty > 1 ? <span className="n"> ×{g.qty}</span> : null}{g.notes ? <span className="soft"> · {g.notes}</span> : null}</li>)}</ul>
    </Sec>
  );

  const contacts = (
    <Sec title="Contacts" aside={x ? "Connection / Loyalty" : "C/L"}>
      {c.contacts.length === 0 ? <div className="ps-empty">None.</div> : (
        <ul className="list">
          {c.contacts.map((k) => (
            <li key={k.id}>
              <span className="name">{k.name || "Unnamed"}</span> <span className="soft">· {k.role}</span> <span className="tag n">{k.connection}/{k.loyalty}</span>
              {k.notes && <div className="soft">{k.notes}</div>}
            </li>
          ))}
        </ul>
      )}
    </Sec>
  );

  const money = (
    <Sec title="Resources">
      <div className="ps-kv">{p.money.flatMap((r) => [<dt key={`${r.label}-k`}>{r.label}</dt>, <dd key={`${r.label}-v`}>{r.value}</dd>])}</div>
    </Sec>
  );

  const story = (c.background || c.notes) && (
    <Sec title="Background and notes" flow>
      {c.background && <><h3>Background</h3><div className="prose">{c.background}</div></>}
      {c.notes && <><h3>Notes</h3><div className="prose">{c.notes}</div></>}
    </Sec>
  );

  const log = p.log.length > 0 && (
    <Sec title="Karma log" aside={`${p.log.reduce((n, l) => n + l.cost, 0)} Karma`} flow>
      {x ? (
        <table className="ps-log"><tbody>{p.log.map((l, i) => <tr key={i}><td className="n faint">{new Date(l.at).toISOString().slice(0, 10)}</td><td>{l.label}</td><td className="n r">{l.cost}</td></tr>)}</tbody></table>
      ) : (
        <div className="soft">{p.log.map((l) => `${l.label} (${l.cost})`).join(" · ")}</div>
      )}
    </Sec>
  );

  const bookNote = !p.hasBook && <div className="faint" style={{ marginBottom: "3mm" }}>Rulebook not mounted on this device: book descriptions and page references are missing.</div>;
  const foot = <footer className="ps-foot"><span>{p.who} · {mode === "expanded" ? "Expanded" : "Minimal"} sheet</span><span>SixthDeck · Shadowrun Sixth World</span></footer>;

  return (
    <article className={clsx("ps", mode, paper)} aria-label={`${p.who}, printable sheet`}>
      {head}
      {x && bookNote}
      {attributes}
      {x ? (
        <>
          <div className="ps-cols two">{condition}{derived}</div>
          <div className="ps-cols two">{skills}<div>{knowledge}{qualities}</div></div>
          {weapons}
          <div className="ps-cols two"><div>{armor}{identity}</div><div>{augments}</div></div>
          {magic}
          {resonance}
          {matrix}
          {rigging}
          {gear}
          <div className="ps-cols two">{contacts}{money}</div>
          {story}
          {log}
        </>
      ) : (
        <>
          <div className="ps-flow">
            {condition}{derived}{skills}{knowledge}{qualities}{weapons}{armor}{augments}{magic}{resonance}{matrix}{rigging}{gear}{identity}{contacts}{money}{story}{log}
          </div>
          {bookNote}
        </>
      )}
      {foot}
    </article>
  );
}

function WeaponRows({ w, x }: { w: PrintData["weapons"][number]; x: boolean }) {
  const detail = [x ? `pool ${w.poolWhy}` : "", w.arWhy ? `AR ${w.arWhy}` : "", ...w.extras].filter(Boolean);
  return (
    <>
      <tr className={detail.length ? "sub-row" : undefined}>
        <td><span className="name">{w.g.name}</span>{w.g.qty > 1 ? <span className="n"> ×{w.g.qty}</span> : null}{!x && <span className="soft"> {w.skill}</span>}</td>
        <td className="n r"><b>{w.pool}</b></td>
        <td className="n">{w.g.dv ?? ""}</td>
        <td className="n">{ar(w.ar)}</td>
        {x && <td>{w.skill}</td>}
      </tr>
      {detail.length > 0 && <tr><td colSpan={x ? 5 : 4} className="soft" style={{ fontSize: ".9em" }}>{detail.join(" · ")}</td></tr>}
    </>
  );
}

function GearRows({ g, p, x, right }: { g: PrintData["c"]["gear"][number]; p: PrintData; x: boolean; right?: ReactNode }) {
  const kids = p.kidsOf(g);
  return (
    <>
      <tr>
        <td>
          <span className="name">{g.name}</span>
          {g.legal && <span className={clsx("tag", g.legal === "I" && "hot")}>{g.legal === "L" ? "license" : "illegal"}</span>}
          {g.capacity && !right ? <span className="faint n"> cap {kids.reduce((n, k) => n + (k.capCost ?? 0) * (k.qty || 1), 0)}/{g.capacity}</span> : null}
          {g.notes ? (x ? <div className="note">{g.notes}</div> : <span className="soft"> · {g.notes}</span>) : null}
        </td>
        {right ? <td className="r">{right}</td> : <td className="n r">{g.qty > 1 || x ? `×${g.qty}` : ""}</td>}
        {x && !right && <td className="n r">{yen(g.cost * (g.qty || 1))}</td>}
      </tr>
      {kids.map((k) => (
        <tr key={k.id} className="kid">
          <td>{k.name}{k.capCost ? <span className="faint n"> [{k.capCost}]</span> : null}{k.notes ? <span className="soft"> · {k.notes}</span> : null}</td>
          <td className="n r">{k.qty > 1 ? `×${k.qty}` : ""}</td>
          {x && !right && <td className="n r">{yen(k.cost * (k.qty || 1))}</td>}
        </tr>
      ))}
    </>
  );
}
