// Small numeric helpers for the token radar: least squares by normal equations
// (solved with plain Gaussian elimination) and a Nelder-Mead optimiser.
// Standard library only, no randomness anywhere in this file.

/** Solve A x = b for a small square matrix A by Gaussian elimination with partial pivoting. */
export function solveLinear(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    if (pivot !== col) {
      const tmp = m[col]!;
      m[col] = m[pivot]!;
      m[pivot] = tmp;
    }
    const diag = m[col]![col]!;
    if (Math.abs(diag) < 1e-12) throw new Error('solveLinear: singular matrix');
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = m[r]![col]! / diag;
      for (let c = col; c <= n; c++) m[r]![c] = m[r]![c]! - factor * m[col]![c]!;
    }
  }
  return m.map((row, i) => row[n]! / row[i]!);
}

/** Ordinary least squares: beta minimising ||X beta - y||^2, via the normal equations. */
export function ols(x: number[][], y: number[]): number[] {
  const p = x[0]!.length;
  const ata: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const aty: number[] = new Array<number>(p).fill(0);
  for (let i = 0; i < x.length; i++) {
    const row = x[i]!;
    for (let j = 0; j < p; j++) {
      aty[j] = aty[j]! + row[j]! * y[i]!;
      for (let k = 0; k < p; k++) ata[j]![k] = ata[j]![k]! + row[j]! * row[k]!;
    }
  }
  return solveLinear(ata, aty);
}

/** Median of a list of numbers (a copy is sorted; the input is untouched). */
export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return NaN;
  return n % 2 === 1 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
}

/** The p-th percentile (0..100) of a list, linear interpolation between neighbours. */
export function percentile(values: number[], p: number): number {
  const s = [...values].sort((a, b) => a - b);
  if (s.length === 0) return NaN;
  if (s.length === 1) return s[0]!;
  const rank = (p / 100) * (s.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return s[lo]! + (s[hi]! - s[lo]!) * (rank - lo);
}

/** Mean of a list. */
export function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Sample standard deviation (denominator n-1; 0 for a single value). */
export function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mu = mean(values);
  const ss = values.reduce((a, v) => a + (v - mu) * (v - mu), 0);
  return Math.sqrt(ss / (values.length - 1));
}

/** A tiny deterministic PRNG (mulberry32) for the bootstrap refits. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Nelder-Mead minimisation of f over `start` (a list of starting points is tried
 * in order; the best result wins). Deterministic: no random restarts.
 * Returns { point, value }.
 */
export function nelderMead(
  f: (x: number[]) => number,
  starts: number[][],
  maxIter = 4000,
): { point: number[]; value: number } {
  let best: { point: number[]; value: number } | null = null;
  for (const start of starts) {
    const n = start.length;
    const simplex: number[][] = [ [...start] ];
    for (let i = 0; i < n; i++) {
      const p = [...start];
      p[i] = p[i]! + (Math.abs(p[i]!) > 1e-9 ? 0.1 * Math.abs(p[i]!) : 0.1);
      simplex.push(p);
    }
    const vals = simplex.map((p) => f(p));
    for (let iter = 0; iter < maxIter; iter++) {
      // order simplex by value
      const order = vals.map((v, i) => i).sort((a, b) => vals[a]! - vals[b]!);
      const s2 = order.map((i) => simplex[i]!);
      const v2 = order.map((i) => vals[i]!);
      for (let i = 0; i <= n; i++) {
        simplex[i] = s2[i]!;
        vals[i] = v2[i]!;
      }
      // spread check
      let spread = 0;
      for (let i = 1; i <= n; i++) spread = Math.max(spread, Math.abs(vals[i]! - vals[0]!));
      if (spread < 1e-7) break;
      // centroid of the best n points
      const centroid = new Array<number>(n).fill(0);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) centroid[j] = centroid[j]! + simplex[i]![j]! / n;
      const reflect = centroid.map((c, j) => c + (c - simplex[n]![j]!));
      const fr = f(reflect);
      if (fr < vals[0]!) {
        const expand = centroid.map((c, j) => c + 2 * (c - simplex[n]![j]!));
        const fe = f(expand);
        if (fe < fr) {
          simplex[n] = expand;
          vals[n] = fe;
        } else {
          simplex[n] = reflect;
          vals[n] = fr;
        }
      } else if (fr < vals[n - 1]!) {
        simplex[n] = reflect;
        vals[n] = fr;
      } else {
        const contract = centroid.map((c, j) => c + 0.5 * (simplex[n]![j]! - c));
        const fc = f(contract);
        if (fc < vals[n]!) {
          simplex[n] = contract;
          vals[n] = fc;
        } else {
          for (let i = 1; i <= n; i++) {
            simplex[i] = simplex[i]!.map((v, j) => simplex[0]![j]! + 0.5 * (v - simplex[0]![j]!));
            vals[i] = f(simplex[i]!);
          }
        }
      }
    }
    let bi = 0;
    for (let i = 1; i < vals.length; i++) if (vals[i]! < vals[bi]!) bi = i;
    const cand = { point: simplex[bi]!, value: vals[bi]! };
    if (best === null || cand.value < best.value) best = cand;
  }
  return best!;
}
