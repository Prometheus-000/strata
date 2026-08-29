/**
 * PROMPT → SEEDS COMPILER
 * "The user's prose is the record; everything derived from it is a receipt."
 * A phrase compiles to a seed set deterministically, and every effect is
 * itemized so the derivation is inspectable — no word acts silently.
 * Fragments are the expected input: out of order, incomplete, self-correcting.
 */
import type { ThemeSeeds } from './generateTheme'

export interface Receipt {
  word: string
  effect: string
}

type Effect = Partial<{
  hue: number
  chroma: number
  warmth: number
  energy: number
  density: number
  appearance: 'dark' | 'light'
}>

const HUES: Record<string, number> = {
  crimson: 25, blood: 25, rust: 32, ember: 40, copper: 50, amber: 70, honey: 78,
  gold: 85, brass: 82, sun: 88, chartreuse: 108, lime: 115, moss: 125, meadow: 135,
  forest: 142, jade: 155, emerald: 160, mint: 165, teal: 178, lagoon: 185, cyan: 198,
  ice: 212, glacier: 220, ocean: 232, blue: 248, cobalt: 260, indigo: 275, violet: 295,
  ultraviolet: 302, orchid: 315, magenta: 330, fuchsia: 335, rose: 350, blush: 355,
}

const WORDS: Record<string, Effect> = {
  // chroma
  neon: { chroma: 0.22, energy: 0.85 }, electric: { chroma: 0.2, energy: 0.85 },
  vivid: { chroma: 0.19 }, saturated: { chroma: 0.18 }, pastel: { chroma: 0.08 },
  muted: { chroma: 0.09 }, dusty: { chroma: 0.07 }, faded: { chroma: 0.06 },
  monochrome: { chroma: 0.02 },
  // warmth
  warm: { warmth: 0.5 }, cream: { warmth: 0.7 }, paper: { warmth: 0.8, appearance: 'light' },
  candle: { warmth: 0.65, appearance: 'dark' }, sepia: { warmth: 0.7 }, autumn: { warmth: 0.55 },
  diner: { warmth: 0.4 }, desert: { warmth: 0.6 },
  cool: { warmth: -0.5 }, slate: { warmth: -0.6 }, steel: { warmth: -0.7 },
  rain: { warmth: -0.5 }, storm: { warmth: -0.45, energy: 0.6 }, arctic: { warmth: -0.9 },
  clinical: { warmth: -0.6, chroma: 0.06 },
  // energy
  kinetic: { energy: 0.9 }, arcade: { energy: 0.95, chroma: 0.2 }, playful: { energy: 0.8 },
  snappy: { energy: 0.85 }, fast: { energy: 0.8 }, pop: { energy: 0.75 },
  calm: { energy: 0.15 }, still: { energy: 0.1 }, quiet: { energy: 0.2 },
  slow: { energy: 0.15 }, serene: { energy: 0.15 }, museum: { energy: 0.2, density: 1.12 },
  library: { energy: 0.2, warmth: 0.4 },
  // density
  airy: { density: 1.1 }, spacious: { density: 1.12 }, roomy: { density: 1.08 },
  dense: { density: 0.9 }, compact: { density: 0.88 }, console: { density: 0.9 },
  cockpit: { density: 0.87, appearance: 'dark' },
  // appearance
  night: { appearance: 'dark' }, midnight: { appearance: 'dark', hue: 250, chroma: 0.01, warmth: -0.6 },
  polar: { appearance: 'light', hue: 250, chroma: 0.01, warmth: -0.6 }, noir: { appearance: 'dark', chroma: 0.05 },
  dusk: { appearance: 'dark' }, '3am': { appearance: 'dark' }, nocturne: { appearance: 'dark' },
  obsidian: { appearance: 'dark' }, cave: { appearance: 'dark' },
  day: { appearance: 'light' }, daylight: { appearance: 'light' }, morning: { appearance: 'light' },
  noon: { appearance: 'light' }, gallery: { appearance: 'light', density: 1.08 },
  overcast: { appearance: 'light', warmth: -0.3, chroma: 0.07 },
}

const fnvHue = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 360)
}

const describe = (e: Effect): string =>
  Object.entries(e)
    .map(([k, v]) => (k === 'hue' ? `hue ${v}°` : k === 'appearance' ? `${v}` : `${k} ${typeof v === 'number' && v > 0 && (k === 'warmth') ? '+' : ''}${v}`))
    .join(', ')

export function compilePrompt(
  phrase: string,
  base: ThemeSeeds,
): { seeds: ThemeSeeds; receipts: Receipt[]; unmatched: string[] } {
  const words = phrase.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  const seeds: ThemeSeeds = { ...base }
  const receipts: Receipt[] = []
  const unmatched: string[] = []
  let hueSet = false

  const STOP = new Set(['a', 'an', 'the', 'of', 'on', 'in', 'at', 'and', 'or', 'with', 'to', 'for'])
  for (const w of words) {
    const singular = w.endsWith('s') && !HUES[w] && !WORDS[w] ? w.slice(0, -1) : w
    if (HUES[singular] !== undefined) {
      seeds.hue = HUES[singular]
      hueSet = true
      receipts.push({ word: singular, effect: `hue ${HUES[singular]}°` })
    } else if (WORDS[singular]) {
      Object.assign(seeds, WORDS[singular])
      receipts.push({ word: singular, effect: describe(WORDS[singular]) })
    } else if (!STOP.has(w)) {
      unmatched.push(w)
    }
  }

  // No color word: the phrase still deserves a hue. Hash it — deterministic,
  // so the same sentence always compiles to the same theme.
  if (!hueSet && words.length) {
    seeds.hue = fnvHue(words.join(' '))
    receipts.push({ word: '(whole phrase)', effect: `hue ${seeds.hue}° — hashed, no color word found` })
  }

  return { seeds, receipts, unmatched }
}
