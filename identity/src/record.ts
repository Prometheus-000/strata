/**
 * THE RECORD ADAPTER — from decisions to events.
 *
 * `field.ts` knows events and nothing else. This file is the one derivation
 * from Strata's record to those events, and the only module in the package
 * that depends on the substrate. An adopter whose product keeps a Strata
 * record gets its own field from its own decisions through this file; a
 * host with a different source writes a sibling adapter and keeps the engine.
 *
 * The derivation, as rules:
 *   - a token kept is a bump of weight one at the target's place;
 *   - a token cut is the same bump, travelling to the place of what it
 *     collapses to, and a hollow left where it was;
 *   - a deviation lands on the outer ring, away from what it left — except a
 *     mark made on the identity itself, which lands exactly where the hand
 *     put it, because the value on the record is the place;
 *   - a ship is a stratum: weight zero, and the isolines frozen at that moment;
 *   - anything refused is a line with nothing on it, because the attempt is
 *     on the record;
 *   - everything else is a smaller bump.
 */
import { handText, problemsWith, targetKey, type Decision } from '@strata/substrate/decision'
import {
  DEVIATION_W,
  GENERIC_W,
  append,
  clamp01,
  deviationPosition,
  emptyState,
  frameAt,
  levelCount,
  positionFor,
  type Frame,
  type IdentityEvent,
  type IdentityState,
  type Receipt,
  type Station,
  type Vec,
} from './field.ts'
import { svgFrom, type Palette } from './render.ts'

/**
 * The file a mark on the identity is declared against. A visitor's click is a
 * deviation — a raw value where the record's targets belong — and this is the
 * surface it sits on. No comment is written into it; the identity's own
 * handler answers for this file.
 */
export const IDENTITY_FILE = 'identity.html'

/** A place in the unit square, as the record stores it: four decimals each, comma between. */
export const markValue = (p: Vec) => `${clamp01(p[0]).toFixed(4)},${clamp01(p[1]).toFixed(4)}`

/** The place a mark's value names, or undefined when the value is not one. */
export function parseMark(value: string): Vec | undefined {
  const m = /^(\d(?:\.\d+)?),(\d(?:\.\d+)?)$/.exec(value)
  if (!m) return undefined
  const x = Number(m[1])
  const y = Number(m[2])
  if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return undefined
  return [x, y]
}

/** The filesystem-free twin of the substrate's `parseLog`, which lives in a module that imports `node:fs`. */
export function parseRecord(text: string): Decision[] {
  const out: Decision[] = []
  text.split('\n').forEach((line, i) => {
    if (!line.trim()) return
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      throw new Error(`record line ${i + 1} is not JSON`)
    }
    const problems = problemsWith(parsed)
    if (problems.length) throw new Error(`record line ${i + 1} is not a decision — ${problems.join('; ')}`)
    out.push(parsed as Decision)
  })
  return out
}

const fallbackKey = (to: string | undefined) => (to === undefined ? 'literal:none' : to.startsWith('--') ? `token:${to}` : `literal:${to}`)

/** One derivation, for the page and the script alike. */
export function deriveEvents(decisions: readonly Decision[]): IdentityEvent[] {
  return decisions.map((d, i) => {
    const key = targetKey(d)
    const receipt: Receipt = { id: d.id, kind: d.kind, target: key, hand: handText(d.decided), date: d.at.slice(0, 10) }
    const base = { i, id: d.id, key, hand: d.decided.kind, receipt }
    if (d.consequence.refused) return { ...base, kind: 'refused', p: positionFor(key), w: 0 }
    switch (d.kind) {
      case 'token':
        if (d.action === 'cut') return { ...base, kind: 'cut', p: positionFor(key), w: 1, to: positionFor(fallbackKey(d.consequence.collapsesTo)) }
        return { ...base, kind: 'keep', p: positionFor(key), w: 1 }
      case 'deviation': {
        const mark = d.file === IDENTITY_FILE ? parseMark(d.value) : undefined
        return { ...base, kind: 'deviation', p: mark ?? deviationPosition(key), w: DEVIATION_W, receipt: mark ? { ...receipt, target: 'a mark on the field' } : receipt }
      }
      case 'ship':
        return { ...base, kind: 'ship', p: positionFor(key), w: 0 }
      default:
        return { ...base, kind: 'generic', p: positionFor(key), w: GENERIC_W }
    }
  })
}

/** The record as a state: every decision derived, appended in order. */
export const stateFrom = (decisions: readonly Decision[]): IdentityState => deriveEvents(decisions).reduce<IdentityState>((st, e) => append(st, e), emptyState())

/**
 * A visitor's click, before or without the record. On a dev server the same
 * click is also written through as a deviation on `IDENTITY_FILE`, and the
 * receipt then carries the decision's id; on a static host it lives in
 * session memory and the receipt says so.
 */
export function visitorDeviation(p: Vec, i: number, date: string, id?: string): IdentityEvent {
  const key = `deviation:${IDENTITY_FILE}:${i}`
  return {
    i,
    id: id ?? `session-${i}`,
    key,
    kind: 'deviation',
    hand: 'human',
    p: [clamp01(p[0]), clamp01(p[1])],
    w: DEVIATION_W,
    receipt: { id: id ?? 'not on the record', kind: 'deviation', target: 'a mark on the field', hand: 'human visitor', date },
  }
}

/* ---------- an adopter's field ---------- */

/** What a host brings: its colours, resolved, and the two seeds that shape the field. */
export interface Adoption {
  /** Five strings the host reads from its own theme. The engine writes no colour of its own. */
  palette: Palette
  /** Settle length and kernel sharpness. Defaults to what this repository's own field is drawn with. */
  energy?: number
  /** Level count. Same default. */
  density?: number
}

/** The two files a host ships from its record, as this repository does: the seed at tab size, the mark at four levels. */
export type Shipped = 'favicon' | 'mark'

export interface AdoptedField {
  state: IdentityState
  palette: Palette
  /**
   * One frame of the field, settled by default — `t` is Infinity, every
   * decision arrived — at `n` cells per world unit and the station's level
   * count. Hand it to `draw` for a canvas or `svgFrom` for a file.
   */
  frame(station: Station, opts?: { t?: number; n?: number; aspect?: number }): Frame
  /** The favicon or the mark as SVG, at the sizes this repository emits them, with the ink as a custom property. */
  svg(station: Shipped, size?: number, inks?: { dark: string; light: string; house?: 'dark' | 'light' }): string
}

/** The seeds this repository draws its own field with; an adopter passes their own. */
export const ADOPTION_DEFAULTS = { energy: 0.35, density: 1 } as const

/**
 * A field of a host's own, from a host's own record. The record arrives as
 * its text — the file, read or fetched — or as decisions already parsed;
 * the palette is the host's, resolved; and what comes back is the same
 * derivation, the same frames and the same files this repository's identity
 * is made of. Nothing here reads a filesystem, so a page can call it with
 * what it fetched and a script with what it read. `scripts/identity.test.ts`
 * is the worked example: a record in a temp directory, three decisions on
 * it, the mark rendered as SVG.
 */
export function fieldFrom(record: string | readonly Decision[], adoption: Adoption): AdoptedField {
  const { palette } = adoption
  const energy = adoption.energy ?? ADOPTION_DEFAULTS.energy
  const density = adoption.density ?? ADOPTION_DEFAULTS.density
  const state = stateFrom(typeof record === 'string' ? parseRecord(record) : record)
  const frame: AdoptedField['frame'] = (station, opts = {}) =>
    frameAt(state, opts.t ?? Infinity, { energy, density, n: opts.n ?? (station === 'favicon' ? 24 : 64), levels: levelCount(station, density), aspect: opts.aspect })
  const svg: AdoptedField['svg'] = (station, size = station === 'favicon' ? 32 : 160, inks) => svgFrom(frame(station), size, palette, { dot: station === 'favicon', inks })
  return { state, palette, frame, svg }
}

/* ---------- a synthetic record, for what the real one has not done yet ---------- */

/** mulberry32: a small, good, seedable generator. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const VOCABULARY = [
  '--accent', '--accent-soft', '--accent-strong', '--accent-line', '--surface-page', '--surface-sunken', '--surface-raised', '--surface-overlay',
  '--surface-veil', '--radius-interactive', '--radius-surface', '--radius-overlay', '--motion-ease', '--motion-ease-emphasis', '--motion-fast',
  '--ink', '--ink-muted', '--ink-faint', '--line', '--line-strong', '--shadow-color', '--font-display', '--font-mono', '--control-h-md',
]
/** The target three hands reach independently in the synthetic stream — the precedent it exists to show. */
const CONVERGENT = '--radius-overlay'

/**
 * A stream that behaves like a record: keeps spread across a vocabulary with
 * one target reached three times on purpose (precedent), two cuts that
 * collapse, one declared deviation, one ship near the end, an override, a
 * prop pick, a refusal. Every line passes `problemsWith`; the only way it
 * differs from a record is that nobody wrote it.
 */
export function syntheticStream(seed: number, count = 48): Decision[] {
  const rnd = mulberry32(seed)
  const base = Date.parse('2026-01-01T00:00:00.000Z')
  const four = () => Math.floor(rnd() * 36 ** 4).toString(36).padStart(4, '0')
  const out: Decision[] = []
  const hand = () => (rnd() < 0.7 ? { kind: 'human' as const, actor: 'prometheus-000' } : { kind: 'agent' as const, actor: 'claude-code' })
  const shipAt = Math.max(3, Math.round(count * 0.62))
  const cutsAt = new Set([Math.round(count * 0.3), Math.round(count * 0.8)])
  const deviationAt = Math.round(count * 0.45)
  const refusedAt = Math.round(count * 0.55)
  const overrideAt = Math.round(count * 0.2)
  const propAt = Math.round(count * 0.7)
  for (let i = 0; i < count; i++) {
    const at = new Date(base + i * 60_000).toISOString()
    const decided = hand()
    const prov = { id: `d${(base + i * 60_000).toString(36).padStart(9, '0')}-${four()}`, at, decided, written: decided, via: 'synthetic' }
    let d: Decision
    if (i === shipAt) d = { kind: 'ship', promoted: { system: 1, component: 2 }, frozen: 3, ...prov, consequence: {} }
    else if (i === deviationAt) d = { kind: 'deviation', file: 'src/site/site.css', line: 858, value: '0.72', ...prov, reason: 'the slider paints its own wheel', consequence: {} }
    else if (i === overrideAt)
      d = { kind: 'override', action: 'set', scope: 'component', selector: '.card', property: 'padding', value: { token: '--strata-space-5' }, ...prov, consequence: {} }
    else if (i === propAt) d = { kind: 'prop', component: 'Button', prop: 'variant', file: 'src/site/App.tsx', line: 100, from: 'primary', to: 'ghost', ...prov, consequence: {} }
    else if (cutsAt.has(i)) {
      const token = VOCABULARY[Math.floor(rnd() * VOCABULARY.length)]
      const to = token === '--accent' ? '--ink' : '--accent'
      d = { kind: 'token', token, action: 'cut', ...prov, reason: 'one filled action per surface', consequence: { collapsesTo: to } }
    } else {
      // Most keeps spread across the vocabulary; one target is reached three times on purpose.
      const token = i % 13 === 5 ? CONVERGENT : VOCABULARY[Math.floor(rnd() * VOCABULARY.length)]
      d = { kind: 'token', token, action: 'keep', ...prov, consequence: i === refusedAt ? { refused: 'the engine does not emit it' } : {} }
    }
    out.push(d)
  }
  return out
}
