/**
 * SYSTEM SCOPE. Widening a change to the whole system does not write a token —
 * it asks the engine what seed would have produced that value, and reports what
 * else moves when the seed moves.
 *
 * Nothing here hand-derives the engine's algebra. Which seed drives a token is
 * discovered by perturbing seeds and watching; the seed value that hits a target
 * is found by bisecting the engine itself. If the engine's arithmetic changes,
 * this follows without an edit, because the engine stays the only author.
 */
import {
  generateTheme,
  SEED_RANGE,
  clamp,
  type ThemeSeeds,
} from './generateTheme'
import { toPx } from './scales'

export type NumericSeed = 'hue' | 'chroma' | 'warmth' | 'energy' | 'density'
const NUMERIC_SEEDS: NumericSeed[] = ['hue', 'chroma', 'warmth', 'energy', 'density']

const tokenPx = (seeds: ThemeSeeds, token: string): number | null => {
  const v = generateTheme(seeds)[token]
  return v === undefined ? null : toPx(v)
}

/**
 * Which seed moves this token, found empirically. Returns null when no seed
 * moves it (a static role) and picks the strongest when several do — with the
 * others returned so the caller can say so out loud.
 */
export function leverFor(
  seeds: ThemeSeeds,
  token: string,
): { seed: NumericSeed; alsoMovedBy: NumericSeed[] } | null {
  const base = tokenPx(seeds, token)
  if (base === null) return null
  const movers: Array<{ seed: NumericSeed; delta: number }> = []
  for (const seed of NUMERIC_SEEDS) {
    const [lo, hi] = SEED_RANGE[seed]
    const probe = (v: number) => tokenPx({ ...seeds, [seed]: clamp(v, lo, hi) }, token)
    const at = [probe(lo), probe(hi)]
    const spread = at.every((x) => x !== null)
      ? Math.abs((at[1] as number) - (at[0] as number))
      : 0
    if (spread > 1e-9) movers.push({ seed, delta: spread })
  }
  if (movers.length === 0) return null
  movers.sort((a, b) => b.delta - a.delta)
  return { seed: movers[0].seed, alsoMovedBy: movers.slice(1).map((m) => m.seed) }
}

export interface SeedProposal {
  token: string
  seed: NumericSeed
  from: number
  to: number
  targetPx: number
  /** What the token actually becomes. Differs from target when the seed clamps. */
  achievedPx: number
  /** False when the seed's range cannot reach the requested value. */
  exact: boolean
  /** Every other token the seed change moves. The cost of going system-wide. */
  sideEffects: Array<{ token: string; from: string; to: string }>
  seeds: ThemeSeeds
}

/**
 * Bisect the engine for the seed value that makes `token` equal `targetPx`.
 * Assumes monotonicity in the seed, which holds for every length the engine
 * derives; where it would not, the returned `exact: false` is the honest answer.
 */
export function solveSeed(
  seeds: ThemeSeeds,
  token: string,
  targetPx: number,
): SeedProposal | null {
  const lever = leverFor(seeds, token)
  if (!lever) return null
  const { seed } = lever
  const [lo, hi] = SEED_RANGE[seed]

  const f = (v: number) => tokenPx({ ...seeds, [seed]: v }, token)
  const fLo = f(lo)
  const fHi = f(hi)
  if (fLo === null || fHi === null) return null

  const ascending = fHi >= fLo
  const min = Math.min(fLo, fHi)
  const max = Math.max(fLo, fHi)
  const reachable = targetPx >= min - 1e-6 && targetPx <= max + 1e-6

  let a = lo
  let b = hi
  for (let i = 0; i < 60; i++) {
    const mid = (a + b) / 2
    const v = f(mid)
    if (v === null) break
    if (ascending ? v < targetPx : v > targetPx) a = mid
    else b = mid
  }

  // The engine rounds its lengths to 0.001rem, so the token is a staircase in
  // the seed, not a line. Bisection finds the step; this picks which point on
  // it to report. Coarsest wins: `energy 0.50 → 1.00` is a sentence a designer
  // can hold, and `0.9992` is not — so a rounder seed is preferred whenever it
  // lands on the same pixel.
  const solved = clamp((a + b) / 2, lo, hi)
  const candidates = new Set<number>([solved, lo, hi])
  for (const digits of [1, 2, 3, 4]) {
    const q = 10 ** digits
    candidates.add(clamp(Math.round(solved * q) / q, lo, hi))
    candidates.add(clamp(Math.ceil(solved * q) / q, lo, hi))
    candidates.add(clamp(Math.floor(solved * q) / q, lo, hi))
  }
  const decimals = (n: number) => (String(n).split('.')[1] ?? '').length
  let to = solved
  let bestErr = Infinity
  let bestDecimals = Infinity
  for (const c of [...candidates].sort((x, y) => decimals(x) - decimals(y))) {
    const v = f(c)
    if (v === null) continue
    const err = Math.abs(v - targetPx)
    // A strictly better pixel always wins; an equal pixel goes to the rounder seed.
    if (err < bestErr - 1e-9 || (err <= bestErr + 1e-9 && decimals(c) < bestDecimals)) {
      to = c
      bestErr = err
      bestDecimals = decimals(c)
    }
  }

  const next = { ...seeds, [seed]: to }
  const achievedPx = tokenPx(next, token) ?? targetPx

  const before = generateTheme(seeds)
  const after = generateTheme(next)
  const sideEffects = Object.keys(after)
    .filter((k) => k !== token && before[k] !== after[k])
    .map((k) => ({ token: k, from: before[k], to: after[k] }))

  return {
    token,
    seed,
    from: seeds[seed] as number,
    to,
    targetPx,
    achievedPx,
    // One quantum is 0.001rem = 0.016px. Anything inside it is the same pixel;
    // calling that inexact would be pedantry reported as failure.
    exact: reachable && Math.abs(achievedPx - targetPx) <= 0.02,
    sideEffects,
    seeds: next,
  }
}
