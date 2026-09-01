/**
 * VENDORED — Strata's semantic compiler (Layer 0), verbatim in contract.
 *
 * The malleable layer is a *client* of this function, never a peer. Nothing
 * here is edited to make an override work; if a value cannot be reached by
 * moving a seed, that is a fact about the system and gets reported as one.
 *
 * Only the parts the resolver needs are vendored: seeds in, token map out.
 * Colour roles are carried through unchanged so the harness renders true.
 */

export interface ThemeSeeds {
  /** Accent hue, 0–360 (OKLCH hue wheel) */
  hue: number
  /** Accent chroma, 0–0.25. Low = muted, high = electric. */
  chroma: number
  /** −1 (cool slate) … 0 (neutral) … 1 (warm paper). Tints all neutrals. */
  warmth: number
  /** 0 (calm, slow, gentle) … 1 (kinetic, snappy, springy). Drives motion AND shape. */
  energy: number
  /** 0.85 (compact) … 1.15 (airy). Scales controls, padding, gaps. */
  density: number
  appearance: 'dark' | 'light'
}

export const OBSIDIAN: ThemeSeeds = {
  hue: 168,
  chroma: 0.155,
  warmth: 0,
  energy: 0.5,
  density: 1,
  appearance: 'dark',
}

export const SEED_RANGE: Record<string, [number, number]> = {
  hue: [0, 360],
  chroma: [0, 0.25],
  warmth: [-1, 1],
  energy: [0, 1],
  density: [0.85, 1.15],
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const oklch = (l: number, c: number, h: number, a?: number) =>
  a === undefined
    ? `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`
    : `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)} / ${a.toFixed(2)})`

export function generateTheme(seeds: ThemeSeeds): Record<string, string> {
  const hue = ((seeds.hue % 360) + 360) % 360
  const chroma = clamp(seeds.chroma, 0, 0.25)
  const warmth = clamp(seeds.warmth, -1, 1)
  const energy = clamp(seeds.energy, 0, 1)
  const density = clamp(seeds.density, 0.85, 1.15)
  const dark = seeds.appearance === 'dark'

  const neutralHue = warmth >= 0 ? lerp(200, 95, warmth) : lerp(200, 260, -warmth)
  const neutralChroma = 0.006 + Math.abs(warmth) * 0.014

  const t: Record<string, string> = {}

  if (dark) {
    t['--surface-page'] = oklch(0.17, neutralChroma, neutralHue)
    t['--surface-sunken'] = oklch(0.14, neutralChroma * 0.9, neutralHue)
    t['--surface-raised'] = oklch(0.21, neutralChroma * 1.1, neutralHue)
    t['--surface-overlay'] = oklch(0.24, neutralChroma * 1.2, neutralHue)
    t['--surface-veil'] = oklch(0.1, neutralChroma, neutralHue, 0.62)
    t['--ink'] = oklch(0.94, 0.008, neutralHue)
    t['--ink-muted'] = oklch(0.72, 0.012, neutralHue)
    t['--ink-faint'] = oklch(0.54, 0.012, neutralHue)
    t['--ink-inverse'] = oklch(0.16, 0.01, neutralHue)
    const accentL = lerp(0.84, 0.78, chroma / 0.25)
    t['--accent'] = oklch(accentL, chroma, hue)
    t['--accent-strong'] = oklch(accentL + 0.06, chroma * 1.1, hue)
    t['--accent-ink'] = oklch(0.16, Math.min(chroma * 0.35, 0.06), hue)
    t['--accent-soft'] = oklch(accentL, chroma, hue, 0.14)
    t['--accent-line'] = oklch(accentL, chroma, hue, 0.45)
    t['--line'] = oklch(0.94, 0.008, neutralHue, 0.12)
    t['--line-strong'] = oklch(0.94, 0.008, neutralHue, 0.24)
    t['--focus-ring'] = oklch(accentL, chroma, hue, 0.7)
    t['--positive'] = oklch(0.78, 0.16, 150)
    t['--warning'] = oklch(0.82, 0.15, 80)
    t['--danger'] = oklch(0.68, 0.19, 22)
    t['--positive-soft'] = oklch(0.78, 0.16, 150, 0.15)
    t['--warning-soft'] = oklch(0.82, 0.15, 80, 0.15)
    t['--danger-soft'] = oklch(0.68, 0.19, 22, 0.15)
    t['--shadow-color'] = oklch(0.05, 0.01, neutralHue, 0.5)
  } else {
    t['--surface-page'] = oklch(0.97, neutralChroma, neutralHue)
    t['--surface-sunken'] = oklch(0.94, neutralChroma * 1.1, neutralHue)
    t['--surface-raised'] = oklch(0.995, neutralChroma * 0.5, neutralHue)
    t['--surface-overlay'] = oklch(1, 0, 0)
    t['--surface-veil'] = oklch(0.3, 0.01, neutralHue, 0.4)
    t['--ink'] = oklch(0.24, 0.015, neutralHue)
    t['--ink-muted'] = oklch(0.45, 0.015, neutralHue)
    t['--ink-faint'] = oklch(0.6, 0.012, neutralHue)
    t['--ink-inverse'] = oklch(0.97, 0.005, neutralHue)
    const accentL = lerp(0.58, 0.52, chroma / 0.25)
    const accentC = chroma * 0.87
    t['--accent'] = oklch(accentL, accentC, hue)
    t['--accent-strong'] = oklch(accentL - 0.08, accentC, hue)
    t['--accent-ink'] = oklch(0.98, 0.01, hue)
    t['--accent-soft'] = oklch(accentL, accentC, hue, 0.12)
    t['--accent-line'] = oklch(accentL, accentC, hue, 0.4)
    t['--line'] = oklch(0.24, 0.015, neutralHue, 0.13)
    t['--line-strong'] = oklch(0.24, 0.015, neutralHue, 0.28)
    t['--focus-ring'] = oklch(accentL, accentC, hue, 0.65)
    t['--positive'] = oklch(0.6, 0.15, 150)
    t['--warning'] = oklch(0.66, 0.14, 75)
    t['--danger'] = oklch(0.55, 0.19, 22)
    t['--positive-soft'] = oklch(0.6, 0.15, 150, 0.13)
    t['--warning-soft'] = oklch(0.66, 0.14, 75, 0.15)
    t['--danger-soft'] = oklch(0.55, 0.19, 22, 0.12)
    t['--shadow-color'] = oklch(0.3, 0.02, neutralHue, 0.18)
  }

  const speed = lerp(1.5, 0.65, energy)
  t['--motion-instant'] = `${Math.round(80 * speed)}ms`
  t['--motion-fast'] = `${Math.round(160 * speed)}ms`
  t['--motion-base'] = `${Math.round(260 * speed)}ms`
  t['--motion-slow'] = `${Math.round(480 * speed)}ms`
  t['--motion-ease'] = energy > 0.6 ? 'var(--strata-ease-spring)' : 'var(--strata-ease-out)'
  t['--motion-ease-emphasis'] =
    energy > 0.3 ? 'var(--strata-ease-spring)' : 'var(--strata-ease-in-out)'

  t['--density'] = density.toFixed(3)

  const radius = lerp(0.375, 0.75, energy)
  t['--radius-interactive'] = `${radius.toFixed(3)}rem`
  t['--radius-surface'] = `${(radius * 1.5).toFixed(3)}rem`
  t['--radius-overlay'] = `${(radius * 2.4).toFixed(3)}rem`

  // Density-derived rhythm. In Strata these live as `calc()` in semantic.css;
  // the resolver needs them as numbers, so they are computed here from the
  // same primitives and the same seed. Same arithmetic, one authority.
  t['--control-h-sm'] = `${(2 * density).toFixed(4)}rem`
  t['--control-h-md'] = `${(2.5 * density).toFixed(4)}rem`
  t['--control-h-lg'] = `${(3 * density).toFixed(4)}rem`
  t['--control-pad-x'] = `${(1 * density).toFixed(4)}rem`
  t['--surface-pad'] = `${(1.5 * density).toFixed(4)}rem`
  t['--stack-gap'] = `${(1 * density).toFixed(4)}rem`

  return t
}

/** Apply a seed set to a root element. */
export function applyTheme(seeds: ThemeSeeds, root: HTMLElement) {
  root.dataset.theme = seeds.appearance
  const tokens = generateTheme(seeds)
  for (const [prop, value] of Object.entries(tokens)) root.style.setProperty(prop, value)
}
