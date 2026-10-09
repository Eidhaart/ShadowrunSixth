/** Exact and sampled odds for pools of d6 where 5 and 6 are hits (p = 1/3). */

export function binomPmf(n: number): number[] {
  const p = 1 / 3;
  const out: number[] = [];
  let c = 1;
  for (let k = 0; k <= n; k++) {
    out.push(c * p ** k * (1 - p) ** (n - k));
    c = (c * (n - k)) / (k + 1);
  }
  return out;
}

/** Odds that `you` beat, tie or lose to `them` on hits, plus the average net hits when you win. */
export function opposedOdds(you: number, them: number) {
  const a = binomPmf(Math.max(0, Math.floor(you)));
  const b = binomPmf(Math.max(0, Math.floor(them)));
  let win = 0, tie = 0, lose = 0, netSum = 0, hitsYou = 0, hitsThem = 0;
  a.forEach((pa, i) => (hitsYou += pa * i));
  b.forEach((pb, j) => (hitsThem += pb * j));
  a.forEach((pa, i) =>
    b.forEach((pb, j) => {
      const p = pa * pb;
      if (i > j) { win += p; netSum += p * (i - j); }
      else if (i === j) tie += p;
      else lose += p;
    }),
  );
  return { win, tie, lose, avgNetWhenWin: win > 0 ? netSum / win : 0, hitsYou, hitsThem };
}

/** Probability of at least `k` hits on `n` dice. */
export function atLeast(n: number, k: number): number {
  if (k <= 0) return 1;
  return binomPmf(Math.max(0, Math.floor(n))).slice(k).reduce((s, x) => s + x, 0);
}

export type Rng = () => number;

/** Sample hits on n dice. */
export function sampleHits(n: number, rng: Rng = Math.random): number {
  let h = 0;
  for (let i = 0; i < n; i++) if (rng() * 6 >= 4) h++;
  return h;
}

export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

export interface EntryParams {
  /** Cracking + Logic. */
  pool: number;
  attack: number;
  sleaze: number;
  firewall: number;
  /** Spider Willpower, or 0 for an unwatched host. */
  willpower: number;
  /** Rounds you will stay inside after you get in. */
  stay: number;
}

export interface EntryResult {
  /** Overwatch Score when the job is done. */
  os: number;
  /** Elapsed seconds spent getting in. */
  seconds: number;
}

const defPool = (p: EntryParams, plus = 0) => (p.willpower > 0 ? p.willpower + p.firewall + plus : (p.firewall + plus) * 2);

/** Brute Force straight to Admin, one try per round, then hold illegal Admin access. */
export function bruteRun(p: EntryParams, rng: Rng = Math.random): EntryResult {
  const penalty = p.attack < p.sleaze ? p.sleaze - p.attack : 0;
  const mine = Math.max(0, p.pool - penalty);
  const theirs = defPool(p, 2);
  let os = 0, tries = 0;
  for (;;) {
    tries++;
    const a = sampleHits(mine, rng), d = sampleHits(theirs, rng);
    os += d;
    if (a > d || tries > 200) break;
  }
  os += 3 * p.stay;
  return { os, seconds: tries * 3 };
}

/** Probe (one try per minute), then Backdoor Entry (one try per round, bonus dice from the Probe's net hits). */
export function probeRun(p: EntryParams, rng: Rng = Math.random): EntryResult {
  const penalty = p.sleaze < p.attack ? p.attack - p.sleaze : 0;
  const mine = Math.max(0, p.pool - penalty);
  const theirs = defPool(p);
  let os = 0, seconds = 0, bonus = 0, guard = 0;
  while (guard++ < 200) {
    let net = 0;
    for (;;) {
      seconds += 60;
      const a = sampleHits(mine, rng), d = sampleHits(theirs, rng);
      os += d;
      if (a > d) { net = a - d; break; }
      if (seconds > 60 * 200) break;
    }
    bonus = net;
    const a = sampleHits(mine + bonus, rng), d = sampleHits(theirs, rng);
    seconds += 3;
    os += d;
    if (a > d) break; // Admin through a backdoor: it does not count as illegal Admin
  }
  return { os, seconds };
}

export function summarize(runs: EntryResult[]) {
  const os = runs.map((r) => r.os).sort((a, b) => a - b);
  const sec = runs.map((r) => r.seconds).sort((a, b) => a - b);
  return {
    osMedian: percentile(os, 0.5),
    osBad: percentile(os, 0.9),
    convergence: os.filter((x) => x >= 40).length / Math.max(1, os.length),
    secMedian: percentile(sec, 0.5),
  };
}

/** Distribution of drain damage: index k is the chance of taking exactly k damage. */
export function drainDist(pool: number, dv: number): number[] {
  const p = binomPmf(Math.max(0, Math.floor(pool)));
  const out = Array.from({ length: Math.max(0, dv) + 1 }, () => 0);
  p.forEach((pk, hits) => { out[Math.max(0, dv - hits)] += pk; });
  return out;
}
