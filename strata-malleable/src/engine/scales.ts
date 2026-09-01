/**
 * Primitive scales (Strata Tier 1) plus the only unit arithmetic in the repo.
 *
 * The resolver compares values numerically — to snap, to detect redundancy,
 * to invert a seed. Everything therefore has to land in one unit. px is that
 * unit, and 1rem = 16px is stated once, here, rather than assumed six times.
 */

export const ROOT_PX = 16

/**
 * Every token the resolver can evaluate that the seed engine does not derive:
 * Tier 1 primitives, plus the handful of semantic roles that are static by
 * design. Seed-derived tokens come from generateTheme and are never listed here.
 */
export const PRIMITIVES: Record<string, string> = {
  '--radius-pill': '999px',
  '--strata-space-1': '0.25rem',
  '--strata-space-2': '0.5rem',
  '--strata-space-3': '0.75rem',
  '--strata-space-4': '1rem',
  '--strata-space-5': '1.5rem',
  '--strata-space-6': '2rem',
  '--strata-space-7': '3rem',
  '--strata-space-8': '4rem',
  '--strata-radius-0': '0',
  '--strata-radius-1': '0.25rem',
  '--strata-radius-2': '0.5rem',
  '--strata-radius-3': '0.75rem',
  '--strata-radius-4': '1.25rem',
  '--strata-radius-round': '999px',
}

/** A length in px, or null when the value is not a length this repo can compare. */
export function toPx(value: string): number | null {
  const v = value.trim()
  if (v === '0') return 0
  const m = /^(-?\d*\.?\d+)(px|rem|em)?$/.exec(v)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n)) return null
  switch (m[2]) {
    case undefined:
      return null // a bare number is not a length
    case 'px':
      return n
    case 'rem':
    case 'em':
      return n * ROOT_PX
  }
  return null
}

/** px → the shortest exact CSS literal. Whole numbers stay px; the rest round to 0.001rem. */
export function fromPx(px: number): string {
  const r = Math.round(px * 1000) / 1000
  return `${r}px`
}
