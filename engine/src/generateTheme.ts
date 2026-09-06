/**
 * STRATA THEME ENGINE — the single author of the semantic tier.
 * ------------------------------------------------------------
 * A theme is not a stylesheet — it is seven numbers. From these seeds every
 * semantic role is derived, in OKLCH, so any generated theme stays
 * perceptually coherent.
 *
 * This is the "AI-native" contract: an agent (or a person, or a slider)
 * retunes the whole system by emitting a new seed set.
 *
 * ONE MODULE, NOT TWO. This file used to exist twice — once here and once
 * vendored into the malleable layer, 134 diff lines apart — and two copies of
 * a compiler are two authors of the semantic tier, which is the one thing
 * `layer0.engine-only-author` says there must never be. The vendored copy also
 * carried a second reason to diverge: the resolver needs *numbers* where the
 * stylesheet wants an expression, and copying the arithmetic was how the two
 * were kept in step. That is what `form` is for now:
 *
 *   form: 'css'        --control-h-md: calc(2.5rem * var(--density))
 *   form: 'computed'   --control-h-md: 2.5000rem
 *
 * Same table, same multipliers, one authority. The stylesheet keeps the
 * `calc()` so a hand that moves `--density` alone still moves the rhythm; the
 * resolver gets a number it can compare a dragged pixel value against.
 *
 * Nothing here reads the ledger, the record, or the filesystem. A cut is
 * applied *after* this — by the projection, and by `applyTheme`'s `cuts` —
 * because deciding whether a token stands is a judgement and this file only
 * derives.
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
  /**
   * −1 (deeper) … 0 (the house ground) … 1 (lifted). Where the ground sits
   * within its appearance: a dark theme from OLED black to charcoal, a light
   * one from bone to paper-white. Optional, because the record's seed
   * decisions were six numbers before it existed, and absent means the house.
   */
  lightness?: number
}

/**
 * The house theme: monochrome by default, colour by choice. Chroma 0 means
 * the one filled action on a screen is ink, not a hue. Warmth 0 and lightness
 * 1 are Visionary's own: its production ground is #010102 — black, and its
 * engine says "the page is black; warmth is a cast on it, never a lift off
 * it" — and its house theme is warmth 0. The first reading of that palette
 * lifted the ground to 0.17 and cast it slate at warmth −0.6, which is a dark
 * teal, because there was no lightness seed to say otherwise and the 260°
 * it measured was the hue of Visionary's muted ink, not of its ground. The
 * seventh seed is what lets the house say black.
 *
 * The ground is paper: the house decided on 2026-09-05 that the identity's
 * field drawn on a light ground is the default (`seed` decision on the
 * record). Dark is the same seven numbers with one bit flipped and lightness
 * mirrored — `flipAppearance` — so black and white are one theme.
 *
 * The constant keeps the name it had when the ground was dark, because the
 * malleable layer's ship verb addresses the seed constant by this name and
 * the record, not the identifier, holds the appearance.
 */
export const OBSIDIAN: ThemeSeeds = {
  hue: 250,
  chroma: 0,
  warmth: 0,
  energy: 0.35,
  density: 1,
  appearance: 'light',
  lightness: 1,
}

/** The other ground of the same theme: the appearance bit flipped, and lightness mirrored, so black becomes white and charcoal becomes bone. */
export const flipAppearance = (s: ThemeSeeds): ThemeSeeds => ({ ...s, appearance: s.appearance === 'dark' ? 'light' : 'dark', lightness: -(s.lightness ?? 0) || 0 })

/** The two grounds of the house theme, by name: Obsidian is the dark pole, Gallery the paper. */
export const PRESETS: Record<string, ThemeSeeds> = {
  Obsidian: flipAppearance(OBSIDIAN),
  Gallery: { ...OBSIDIAN },
  Ember: { hue: 40, chroma: 0.17, warmth: 0.8, energy: 0.75, density: 1, appearance: 'dark' },
  Ultraviolet: { hue: 300, chroma: 0.2, warmth: -0.6, energy: 0.9, density: 0.95, appearance: 'dark' },
  Meadow: { hue: 135, chroma: 0.12, warmth: 0.5, energy: 0.3, density: 1.1, appearance: 'light' },
  Glacier: { hue: 220, chroma: 0.1, warmth: -0.8, energy: 0.2, density: 1.05, appearance: 'light' },
}

export const SEED_RANGE: Record<string, [number, number]> = {
  hue: [0, 360],
  chroma: [0, 0.25],
  warmth: [-1, 1],
  energy: [0, 1],
  density: [0.85, 1.15],
  lightness: [-1, 1],
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const oklch = (l: number, c: number, h: number, a?: number) =>
  a === undefined
    ? `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`
    : `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)} / ${a.toFixed(2)})`

/**
 * The roles that scale with density. The multiplier is the authority; the two
 * forms are renderings of it. `primitive` is the Tier‑1 custom property the
 * stylesheet multiplies, so the `calc()` keeps reading in terms a person can
 * follow, and `rem` is what that primitive is worth when a number is needed.
 */
const RHYTHM: Array<{ role: string; primitive: string; rem: number }> = [
  { role: '--control-h-sm', primitive: '2rem', rem: 2 },
  { role: '--control-h-md', primitive: '2.5rem', rem: 2.5 },
  { role: '--control-h-lg', primitive: '3rem', rem: 3 },
  { role: '--control-pad-x', primitive: 'var(--strata-space-4)', rem: 1 },
  { role: '--surface-pad', primitive: 'var(--strata-space-5)', rem: 1.5 },
  { role: '--stack-gap', primitive: 'var(--strata-space-4)', rem: 1 },
]

/**
 * The roles that name a Tier‑1 primitive rather than compute anything. They
 * were hand-written into the emitter for a year, which meant six semantic
 * roles had no origin in the engine, did not appear in the ledger, and could
 * not be cut, kept or explained like every other role. They are the engine's
 * now: a proposal like any other, and a hand decides them.
 */
const PRIMITIVE_ROLES: Array<[string, string]> = [
  ['--radius-pill', 'var(--strata-radius-round)'],
  ['--font-display', 'var(--strata-font-display)'],
  ['--font-body', 'var(--strata-font-body)'],
  ['--font-mono', 'var(--strata-font-mono)'],
  ['--shadow-raised', 'var(--strata-shadow-1) var(--shadow-color)'],
  ['--shadow-floating', 'var(--strata-shadow-2) var(--shadow-color)'],
  ['--shadow-overlay', 'var(--strata-shadow-3) var(--shadow-color)'],
]

/** Every role whose value references a primitive or the density seed, in emission order. */
export const ROLES_AGAINST_PRIMITIVES: readonly string[] = [...RHYTHM.map((r) => r.role), ...PRIMITIVE_ROLES.map(([r]) => r)]

export interface ThemeForm {
  /**
   * `css` (the default) keeps `calc()` and `var()` so the stylesheet stays
   * readable and a hand that moves one primitive moves everything under it.
   * `computed` resolves the density arithmetic to a number, for a resolver
   * comparing a dragged value against a role.
   */
  form?: 'css' | 'computed'
}

/**
 * Derive the full semantic token map from seeds. Returns CSS custom
 * properties ready to set on a root element.
 */
export function generateTheme(seeds: ThemeSeeds, opts: ThemeForm = {}): Record<string, string> {
  const hue = ((seeds.hue % 360) + 360) % 360
  const chroma = clamp(seeds.chroma, 0, 0.25)
  const warmth = clamp(seeds.warmth, -1, 1)
  const energy = clamp(seeds.energy, 0, 1)
  const density = clamp(seeds.density, 0.85, 1.15)
  const lightness = clamp(seeds.lightness ?? 0, -1, 1)
  const dark = seeds.appearance === 'dark'

  // A monochrome accent is ink, not grey. Below chroma 0.04 the accent is
  // pulled toward the ink pole — near-white on dark, near-black on light — so
  // the one filled action still reads as the action. A mid grey at the
  // chromatic lightness fails AA on paper (0.58 L grey on white is 3.3:1) and
  // reads as disabled everywhere; the correction lives here so no one has to
  // remember it.
  const mono = 1 - clamp(chroma / 0.04, 0, 1)

  // Neutrals inherit a whisper of hue: warm pulls toward paper (85°), cool
  // toward slate (250°), neutral rests at 200°. The anchors are Visionary's
  // own engine's; an earlier 260° here was measured off its muted ink.
  const neutralHue = warmth >= 0 ? lerp(200, 85, warmth) : lerp(200, 250, -warmth)
  const neutralChroma = 0.006 + Math.abs(warmth) * 0.014

  const t: Record<string, string> = {}

  if (dark) {
    // Lightness places the ground between OLED black and charcoal; every surface is a fixed step off it.
    const pageL = 0.17 + (lightness < 0 ? lightness * 0.1 : lightness * 0.1)
    t['--surface-page'] = oklch(pageL, neutralChroma, neutralHue)
    t['--surface-sunken'] = oklch(Math.max(0.04, pageL - 0.03), neutralChroma * 0.9, neutralHue)
    t['--surface-raised'] = oklch(pageL + 0.04, neutralChroma * 1.1, neutralHue)
    t['--surface-overlay'] = oklch(pageL + 0.07, neutralChroma * 1.2, neutralHue)
    t['--surface-veil'] = oklch(Math.max(0.03, pageL - 0.07), neutralChroma, neutralHue, 0.62)
    t['--ink'] = oklch(0.94, 0.008, neutralHue)
    t['--ink-muted'] = oklch(0.72, 0.012, neutralHue)
    t['--ink-faint'] = oklch(0.54, 0.012, neutralHue)
    t['--ink-inverse'] = oklch(0.16, 0.01, neutralHue)

    // A lifted ground lifts the accent a little with it, so the one filled action keeps its distance from the page.
    const accentL = lerp(lerp(0.84, 0.78, chroma / 0.25), 0.93, mono) + 0.04 * Math.max(0, lightness)
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
    // Lightness places the ground between bone and paper-white; raised and overlay stay above it, never past white.
    const pageL = 0.97 + (lightness < 0 ? lightness * 0.09 : lightness * 0.015)
    t['--surface-page'] = oklch(pageL, neutralChroma, neutralHue)
    t['--surface-sunken'] = oklch(pageL - 0.03, neutralChroma * 1.1, neutralHue)
    t['--surface-raised'] = oklch(Math.min(0.995, pageL + 0.025), neutralChroma * 0.5, neutralHue)
    t['--surface-overlay'] = oklch(Math.min(1, pageL + 0.03), 0, 0)
    t['--surface-veil'] = oklch(0.3, 0.01, neutralHue, 0.4)
    t['--ink'] = oklch(0.24, 0.015, neutralHue)
    t['--ink-muted'] = oklch(0.45, 0.015, neutralHue)
    t['--ink-faint'] = oklch(0.6, 0.012, neutralHue)
    t['--ink-inverse'] = oklch(0.97, 0.005, neutralHue)

    // Light appearances need darker, denser accents to hold AA contrast, and a darkened ground needs them darker still.
    const accentL = lerp(lerp(0.58, 0.52, chroma / 0.25), 0.3, mono) - 0.06 * Math.max(0, -lightness)
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

  // Energy → motion personality. Calm themes glide; kinetic themes snap.
  const speed = lerp(1.5, 0.65, energy)
  t['--motion-instant'] = `${Math.round(80 * speed)}ms`
  t['--motion-fast'] = `${Math.round(160 * speed)}ms`
  t['--motion-base'] = `${Math.round(260 * speed)}ms`
  t['--motion-slow'] = `${Math.round(480 * speed)}ms`
  t['--motion-ease'] = energy > 0.6 ? 'var(--strata-ease-spring)' : 'var(--strata-ease-out)'
  t['--motion-ease-emphasis'] =
    energy > 0.3 ? 'var(--strata-ease-spring)' : 'var(--strata-ease-in-out)'

  // Density → rhythm.
  t['--density'] = density.toFixed(3)

  // Shape follows energy: kinetic themes round off, calm themes stay architectural.
  const radius = lerp(0.375, 0.75, energy)
  t['--radius-interactive'] = `${radius.toFixed(3)}rem`
  t['--radius-surface'] = `${(radius * 1.5).toFixed(3)}rem`
  t['--radius-overlay'] = `${(radius * 2.4).toFixed(3)}rem`

  // Rhythm: one multiplier, two renderings.
  for (const { role, primitive, rem } of RHYTHM)
    t[role] = opts.form === 'computed' ? `${(rem * density).toFixed(4)}rem` : `calc(${primitive} * var(--density))`

  // Roles held against a primitive. Same in both forms: a font stack and a
  // shadow recipe are references, and there is no number to resolve.
  for (const [role, value] of PRIMITIVE_ROLES) t[role] = value

  return t
}

export interface ApplyOptions {
  /**
   * What a cut token renders as, by name. The engine does not read the
   * ledger — deciding whether a role stands is a judgement — so whoever holds
   * the decisions passes them in.
   */
  cuts?: Record<string, string>
  /** Motion durations collapse to 0ms. The caller decides; this file has no window. */
  reducedMotion?: boolean
}

const isDuration = (prop: string) => prop.startsWith('--motion-') && prop !== '--motion-ease' && prop !== '--motion-ease-emphasis'

/** Apply a seed set to a root element, with whatever cuts the caller holds. */
export function applyTheme(seeds: ThemeSeeds, root: HTMLElement, opts: ApplyOptions = {}) {
  root.dataset.theme = seeds.appearance
  for (const [prop, value] of Object.entries(generateTheme(seeds))) {
    const decided = opts.cuts?.[prop] ?? value
    root.style.setProperty(prop, opts.reducedMotion && isDuration(prop) ? '0ms' : decided)
  }
}
