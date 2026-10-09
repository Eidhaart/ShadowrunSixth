import type { Character } from "@/lib/sr6/character";
import type { Derived } from "@/lib/sr6/derive";

/**
 * Export a runner as a Foundry VTT actor document. The authoritative data lives in
 * flags.sixthdeck so the bridge module (or any system) can read it; `system` carries a
 * neutral, flat copy of the numbers most sheets want. Import it with the SixthDeck Bridge
 * module ("Import runner JSON") or Foundry's own actor import.
 */
export function runnerToFoundry(c: Character, d: Derived) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const bio = [
    `<p><strong>${esc(c.name || c.alias || "Unnamed runner")}</strong>${c.alias ? ` “${esc(c.alias)}”` : ""} — ${esc(c.metatype)}${c.archetype ? `, ${esc(c.archetype)}` : ""}</p>`,
    c.concept && `<p>${esc(c.concept)}</p>`,
    c.background && `<p>${esc(c.background).replace(/\n/g, "<br>")}</p>`,
  ]
    .filter(Boolean)
    .join("");
  return {
    name: c.alias || c.name || "Runner",
    type: "character",
    img: "icons/svg/mystery-man.svg",
    system: {
      attributes: d.attrs,
      edge: { value: d.edgeMax - c.edgeBurned, max: d.edgeMax },
      magic: d.magic,
      resonance: d.resonance,
      essence: d.essence,
      initiative: d.initiative,
      condition: {
        physical: { value: c.damage.physical, max: d.condition.physical },
        stun: { value: c.damage.stun, max: d.condition.stun },
        overflow: { value: c.damage.overflow, max: d.condition.overflow },
      },
      defenseRating: d.defenseRating,
      skills: Object.fromEntries(d.skills.map((s) => [s.id, { name: s.name, rank: s.rank, attr: s.attr, pool: s.pool, spec: s.spec ?? null, specPool: s.specPool ?? null }])),
      biography: { value: bio },
    },
    flags: { sixthdeck: { version: 1, exportedAt: new Date().toISOString(), character: c, derived: d } },
    items: [
      ...c.gear.map((g) => ({ name: g.name, type: "equipment", system: { category: g.category, qty: g.qty, dv: g.dv ?? null, ar: g.ar ?? null, armor: g.armor ?? null, description: { value: g.notes ?? "" } } })),
      ...c.qualities.map((q) => ({ name: q.name, type: "feature", system: { kind: q.kind, level: q.level, description: { value: q.note ?? "" } } })),
      ...c.spells.map((s) => ({ name: s, type: "spell", system: {} })),
      ...c.complexForms.map((s) => ({ name: s, type: "feature", system: { kind: "complex form" } })),
    ],
  };
}
