/**
 * Shadowrun 6e dice engine.
 *  - d6 pool, 5 and 6 are hits
 *  - Glitch: more than half the pool shows 1s. Critical glitch: glitch with zero hits.
 *  - Edge 4 boost: add Edge to the pool and 6s explode (1s on exploded dice never count toward glitches)
 *  - Edge boosts after the roll: reroll one die, +1 to a die, buy a hit, reroll failed dice
 *  - Initiative: rank + Nd6, no hit counting
 */

export interface Die {
  value: number;
  hit: boolean;
  /** true if this die came from an exploding 6 */
  exploded?: boolean;
  /** true if this die was replaced/rerolled and kept for display */
  rerolled?: boolean;
  /** true if +1 Edge adjustment was applied */
  bumped?: boolean;
}

export interface RollSpec {
  label: string;
  pool: number;
  /** Edge 4 boost: +Edge dice and exploding 6s. */
  explode?: boolean;
  /** Pre-roll boost spent by the target: 2s also count toward glitches. */
  glitchOn2?: boolean;
  /** Threshold for a simple test. */
  threshold?: number;
  /** Flat extra hits (e.g. 3 Edge automatic hit). */
  autoHits?: number;
  /** Free-text note shown in logs. */
  note?: string;
}

export interface RollResult {
  id: string;
  at: number;
  spec: RollSpec;
  dice: Die[];
  /** Number of dice that count for glitch maths (excludes exploded dice). */
  baseCount: number;
  hits: number;
  autoHits: number;
  totalHits: number;
  glitchDice: number;
  glitch: boolean;
  critGlitch: boolean;
  success?: boolean;
  edgeSpent: number;
  /** Which post-roll boosts have been used, to enforce one Edge expenditure per action. */
  postBoost?: string;
}

const rng = (): number => {
  const c: Crypto | undefined = globalThis.crypto;
  if (c?.getRandomValues) {
    const buf = new Uint32Array(1);
    // rejection sampling for an unbiased d6
    const limit = Math.floor(0x100000000 / 6) * 6;
    do {
      c.getRandomValues(buf);
    } while (buf[0] >= limit);
    return (buf[0] % 6) + 1;
  }
  return Math.floor(Math.random() * 6) + 1;
};

export const d6 = rng;

const mkDie = (value = rng(), exploded = false): Die => ({ value, hit: value >= 5, exploded });

let seq = 0;
const nextId = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`;

export function tally(
  dice: Die[],
  spec: RollSpec,
  baseCount: number,
  autoHits: number,
  edgeSpent: number,
  keep?: Partial<RollResult>,
): RollResult {
  const live = dice.filter((d) => !d.rerolled);
  const hits = live.filter((d) => d.hit).length;
  const glitchDice = live.filter(
    (d) => !d.exploded && (d.value === 1 || (spec.glitchOn2 && d.value === 2)),
  ).length;
  const glitch = glitchDice > baseCount / 2;
  const totalHits = hits + autoHits;
  const critGlitch = glitch && totalHits === 0;
  return {
    id: keep?.id ?? nextId(),
    at: keep?.at ?? Date.now(),
    spec,
    dice,
    baseCount,
    hits,
    autoHits,
    totalHits,
    glitchDice,
    glitch,
    critGlitch,
    success: spec.threshold !== undefined ? totalHits >= spec.threshold : undefined,
    edgeSpent,
    postBoost: keep?.postBoost,
  };
}

export function roll(spec: RollSpec, edge = 0): RollResult {
  const pool = Math.max(0, Math.floor(spec.pool));
  const total = spec.explode ? pool + Math.max(0, edge) : pool;
  const dice: Die[] = [];
  for (let i = 0; i < total; i++) {
    let d = mkDie();
    dice.push(d);
    if (spec.explode) {
      let guard = 0;
      while (d.value === 6 && guard++ < 50) {
        d = mkDie(rng(), true);
        dice.push(d);
      }
    }
  }
  return tally(dice, { ...spec, pool: total }, total, spec.autoHits ?? 0, spec.explode ? 4 : 0);
}

/** Post-roll Edge boosts. Each returns a new result and consumes Edge cost. */
export type PostBoost = "rerollOne" | "plusOne" | "autoHit" | "rerollFailed";

export const BOOST_COST: Record<PostBoost, number> = {
  rerollOne: 1,
  plusOne: 2,
  autoHit: 3,
  rerollFailed: 4,
};

export const BOOST_LABEL: Record<PostBoost, string> = {
  rerollOne: "Reroll one die",
  plusOne: "+1 to one die",
  autoHit: "Buy one hit",
  rerollFailed: "Reroll failed dice",
};

export function canPostBoost(r: RollResult, boost: PostBoost): boolean {
  if (r.postBoost) return false;
  if (boost === "rerollFailed" && r.glitch) return false;
  if (boost === "plusOne") return r.dice.some((d) => !d.rerolled && d.value < 6);
  return true;
}

/** Index of the die a "smart" boost would target, so the UI can preselect it. */
export function bestTarget(r: RollResult, boost: PostBoost): number {
  const live = r.dice.map((d, i) => ({ d, i })).filter((x) => !x.d.rerolled);
  if (boost === "plusOne") {
    const c = live.find((x) => x.d.value === 4) ?? live.find((x) => x.d.value === 1) ?? live.find((x) => x.d.value < 5);
    return c ? c.i : -1;
  }
  if (boost === "rerollOne") {
    const c = live.find((x) => x.d.value === 1) ?? live.find((x) => !x.d.hit);
    return c ? c.i : -1;
  }
  return -1;
}

export function applyPostBoost(r: RollResult, boost: PostBoost, dieIndex?: number): RollResult {
  if (!canPostBoost(r, boost)) return r;
  const dice = r.dice.map((d) => ({ ...d }));
  let autoHits = r.autoHits;
  switch (boost) {
    case "rerollOne": {
      const i = dieIndex ?? bestTarget(r, boost);
      if (i < 0 || !dice[i]) return r;
      dice[i].rerolled = true;
      dice.push(mkDie(rng(), dice[i].exploded));
      break;
    }
    case "plusOne": {
      const i = dieIndex ?? bestTarget(r, boost);
      if (i < 0 || !dice[i] || dice[i].value >= 6) return r;
      dice[i].value += 1;
      dice[i].hit = dice[i].value >= 5;
      dice[i].bumped = true;
      break;
    }
    case "autoHit":
      autoHits += 1;
      break;
    case "rerollFailed": {
      const fresh: Die[] = [];
      for (const d of dice) {
        if (!d.rerolled && !d.hit) {
          d.rerolled = true;
          fresh.push(mkDie(rng(), d.exploded));
        }
      }
      dice.push(...fresh);
      break;
    }
  }
  return tally(dice, r.spec, r.baseCount, autoHits, r.edgeSpent + BOOST_COST[boost], {
    id: r.id,
    at: r.at,
    postBoost: boost,
  });
}

/** Initiative: base rank + Nd6 (the sum of dice, not hits). */
export interface InitiativeResult {
  id: string;
  at: number;
  label: string;
  base: number;
  dice: number[];
  bonus: number;
  score: number;
}

export function rollInitiative(label: string, base: number, diceCount: number, bonus = 0): InitiativeResult {
  const n = Math.max(1, Math.min(5, diceCount));
  const dice = Array.from({ length: n }, () => rng());
  return {
    id: nextId(),
    at: Date.now(),
    label,
    base,
    dice,
    bonus,
    score: base + bonus + dice.reduce((a, b) => a + b, 0),
  };
}

/** Opposed test: ties go to the attacker/active party. */
export function opposed(active: RollResult, passive: RollResult) {
  const net = active.totalHits - passive.totalHits;
  return { net, activeWins: net >= 0, margin: Math.abs(net) };
}

/** Damage after soak: modified DV = DV + net hits, minus the resistance hits. */
export function damageAfterSoak(dv: number, netHits: number, soakHits: number) {
  const modified = dv + Math.max(0, netHits);
  return { modified, taken: Math.max(0, modified - soakHits) };
}

/** Odds helper for the pool picker: probability of >= k hits in n dice (hit chance 1/3). */
export function hitOdds(pool: number, atLeast: number): number {
  if (atLeast <= 0) return 1;
  if (pool < atLeast) return 0;
  const p = 1 / 3;
  let sum = 0;
  const choose = (n: number, k: number) => {
    let c = 1;
    for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
    return c;
  };
  for (let k = atLeast; k <= pool; k++) sum += choose(pool, k) * p ** k * (1 - p) ** (pool - k);
  return sum;
}

/** Probability of a glitch for a pool (more than half ones, p = 1/6). */
export function glitchOdds(pool: number): number {
  if (pool <= 0) return 0;
  const p = 1 / 6;
  const need = Math.floor(pool / 2) + 1;
  let sum = 0;
  const choose = (n: number, k: number) => {
    let c = 1;
    for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
    return c;
  };
  for (let k = need; k <= pool; k++) sum += choose(pool, k) * p ** k * (1 - p) ** (pool - k);
  return sum;
}
