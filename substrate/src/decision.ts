/**
 * THE DECISION — the one primitive.
 *
 * A token cut, a property override, a region move, a prop pick, a seed change,
 * a declared deviation, a ship, a handoff: each used to be its own record with
 * its own shape, its own file and its own idea of who wrote it. They are all
 * the same thing — a change to the design state with provenance, intent and
 * consequences — so they are one type, discriminated on `kind`, and one
 * append-only log holds every one of them.
 *
 * Three fields do the work. `by` says which hand; `reason` says why, in the
 * author's words; `consequence` says what the operation already knew when it
 * ran — files written, the fallback a cut landed on, the overrides a promotion
 * absorbed. Nothing in `consequence` is computed: evidence (contrast, usage,
 * convergence) is derived later, on request, because a design in progress
 * fails any check by definition and the write path must stay silent.
 *
 * This module has no dependencies and touches no filesystem, clock or DOM.
 */

export type Author = 'human' | 'agent'
export const AUTHORS: readonly Author[] = ['human', 'agent']
export const isAuthor = (v: unknown): v is Author => v === 'human' || v === 'agent'

/* ---- the small structural types every projection shares ---- */

/** Narrowest to widest. The order is load-bearing: precedence and promotion both walk it. */
export const SCOPES = ['instance', 'view', 'component', 'system'] as const
export type Scope = (typeof SCOPES)[number]

/** Snapped to a token, or drifted to a literal. A token still follows a retheme; a literal is frozen. */
export type Value = { token: string } | { literal: string }

/** A prop value as source can state it, or null when the attribute is absent or an expression. */
export type PropValue = string | number | boolean | null

/** A theme is six numbers. */
export interface ThemeSeeds {
  hue: number
  chroma: number
  warmth: number
  energy: number
  density: number
  appearance: 'dark' | 'light'
}

/* ---- provenance ---- */

/**
 * A hand, as the record names one: what kind of hand it was, and — when the
 * surface knew — which one. `actor` is opaque: a handle, an email, a harness
 * id. The substrate stores it and never interprets it. No rank, no weight, no
 * default; two actors are the same hand only when the strings match.
 */
export interface Hand {
  kind: Author
  actor?: string
}

export const isHand = (v: unknown): v is Hand =>
  typeof v === 'object' && v !== null && isAuthor((v as { kind?: unknown }).kind) &&
  ((v as { actor?: unknown }).actor === undefined || typeof (v as { actor?: unknown }).actor === 'string')

export const sameHand = (a: Hand, b: Hand) => a.kind === b.kind && a.actor === b.actor

/** `human`, or `human prometheus-000` when a name was given. */
export const handText = (h: Hand) => (h.actor ? `${h.kind} ${h.actor}` : h.kind)

export interface Provenance {
  /**
   * Who chose. The test is one question: who could have chosen otherwise? If
   * every input was named to the hand that ran the command — the target and
   * the value both — the choosing happened elsewhere and this says so.
   */
  decided: Hand
  /** Whose hand ran the command. An agent writing a person's decision is the ordinary case, not a special one. */
  written: Hand
  /** ISO 8601. */
  at: string
  /** The surface that wrote it: 'cli' | 'overlay' | 'server' | 'import:<file>' | 'reconcile' | a harness name. */
  via: string
  /** How `decided` and `written` were determined, verbatim from authorFrom(). Printed at the write, kept on the record. */
  because?: string
}

/* ---- consequence: recorded facts, never computed ones ---- */

export interface Consequence {
  /** Files the operation touched, relative to the root. */
  written?: string[]
  /** token: what the cut lands on after the fallback chain. */
  collapsesTo?: string
  /** override rescope: ids of the narrower overrides this one replaced. */
  absorbed?: string[]
  /** move: identifiers the moved element still needs from where it came. Wired at review. */
  adapt?: string[]
  /** A count the operation already had: consumers, group size, frozen overrides. */
  affected?: number
  /** The request was refused, in a sentence. State is unchanged; the attempt is on the record. */
  refused?: string
  note?: string
}

/* ---- the body, one variant per kind ---- */

export type DecisionBody =
  | { kind: 'token'; token: string; action: 'propose' | 'keep' | 'cut' }
  | {
      kind: 'override'
      action: 'set' | 'remove' | 'rescope'
      scope: Scope
      selector: string
      property: string
      value?: Value
      fromScope?: Scope
      /** The node and view the selector addresses, as plain facts, so precedent need not parse selectors. */
      node?: string
      view?: string
    }
  | {
      kind: 'move'
      region: string
      from: { container: string; file: string; line: number }
      to: { container: string; file: string; line: number; index: number }
    }
  | { kind: 'prop'; component: string; prop: string; file: string; line: number; from: PropValue; to: PropValue }
  | { kind: 'seed'; seeds: ThemeSeeds; from?: ThemeSeeds }
  | { kind: 'deviation'; file: string; line: number; value: string }
  | { kind: 'ship'; promoted: { system: number; component: number }; frozen: number; seeds?: ThemeSeeds }
  | { kind: 'ready' }

export type Kind = DecisionBody['kind']
export const KINDS: readonly Kind[] = ['token', 'override', 'move', 'prop', 'seed', 'deviation', 'ship', 'ready']

export type Decision = DecisionBody &
  Provenance & {
    /** 'd' + base36 milliseconds + '-' + four random base36 characters. Sorts by time as a string. */
    id: string
    /** Intent, in the author's words. */
    reason?: string
    /** The previous decision on the same target, so history is a chain and not a search. */
    supersedes?: string
    consequence: Consequence
  }

/* ---- identity ---- */

const rand4 = () => Math.floor(Math.random() * 36 ** 4).toString(36).padStart(4, '0')

/** Time-sortable, collision-resistant enough for a log a person reads, and dependency-free. */
export const newId = (at: number = Date.now()): string => `d${at.toString(36).padStart(9, '0')}-${rand4()}`

export const ID_PATTERN = /^d[0-9a-z]{9}-[0-9a-z]{4}$/

/**
 * What a decision is about, as one string. Two decisions with the same key are
 * a history; the latest non-refused one is the current state of that target.
 */
export function targetKey(d: DecisionBody): string {
  switch (d.kind) {
    case 'token':
      return `token:${d.token}`
    case 'override':
      return `override:${d.scope}:${d.selector}:${d.property}`
    case 'move':
      return `move:${d.region}`
    case 'prop':
      return `prop:${d.file}:${d.line}:${d.component}.${d.prop}`
    case 'seed':
      return 'seed'
    case 'deviation':
      return `deviation:${d.file}:${d.line}`
    case 'ship':
      return 'ship'
    case 'ready':
      return 'ready'
  }
}

/* ---- shape validation: the one invariant the log itself carries ---- */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isPlace = (v: unknown, withIndex: boolean) =>
  isObj(v) && isStr(v.container) && isStr(v.file) && isNum(v.line) && (!withIndex || isNum(v.index))
const isValue = (v: unknown) => isObj(v) && (isStr(v.token) || isStr(v.literal))
const isSeeds = (v: unknown) =>
  isObj(v) &&
  ['hue', 'chroma', 'warmth', 'energy', 'density'].every((k) => isNum(v[k])) &&
  (v.appearance === 'dark' || v.appearance === 'light')
const isPropValue = (v: unknown) => v === null || isStr(v) || isNum(v) || typeof v === 'boolean'

/** Every way a line can fail to be a decision, named. Empty means it is one. */
export function problemsWith(x: unknown): string[] {
  const p: string[] = []
  if (!isObj(x)) return ['not an object']
  if (!isStr(x.id) || !ID_PATTERN.test(x.id)) p.push('id is not a decision id')
  if (!isHand(x.decided))
    p.push(
      x.by !== undefined
        ? `decided is missing and by is "${String(x.by)}" — this line predates the decided/written split; re-import it`
        : 'decided must be { kind: human | agent, actor?: string }',
    )
  if (!isHand(x.written)) p.push('written must be { kind: human | agent, actor?: string }')
  if (!isStr(x.at) || Number.isNaN(Date.parse(x.at))) p.push('at is not an ISO date')
  if (!isStr(x.via) || !x.via) p.push('via is missing')
  if (x.reason !== undefined && !isStr(x.reason)) p.push('reason is not a string')
  if (x.supersedes !== undefined && !isStr(x.supersedes)) p.push('supersedes is not an id')
  if (!isObj(x.consequence)) p.push('consequence is missing')
  const kind = x.kind
  switch (kind) {
    case 'token':
      if (!isStr(x.token) || !x.token.startsWith('--')) p.push('token must be a custom property name')
      if (!['propose', 'keep', 'cut'].includes(String(x.action))) p.push('token action must be propose, keep or cut')
      break
    case 'override':
      if (!['set', 'remove', 'rescope'].includes(String(x.action))) p.push('override action must be set, remove or rescope')
      if (!SCOPES.includes(x.scope as Scope)) p.push('override scope is not a scope')
      if (!isStr(x.selector) || !isStr(x.property)) p.push('override needs selector and property')
      if (x.value !== undefined && !isValue(x.value)) p.push('override value is neither token nor literal')
      break
    case 'move':
      if (!isStr(x.region)) p.push('move needs a region')
      if (!isPlace(x.from, false) || !isPlace(x.to, true)) p.push('move needs from and to places')
      break
    case 'prop':
      if (!isStr(x.component) || !isStr(x.prop) || !isStr(x.file) || !isNum(x.line)) p.push('prop needs component, prop, file, line')
      if (!isPropValue(x.from) || !isPropValue(x.to)) p.push('prop from/to must be literals or null')
      break
    case 'seed':
      if (!isSeeds(x.seeds)) p.push('seed needs six seeds')
      break
    case 'deviation':
      if (!isStr(x.file) || !isNum(x.line) || !isStr(x.value)) p.push('deviation needs file, line, value')
      break
    case 'ship':
      if (!isObj(x.promoted) || !isNum(x.frozen)) p.push('ship needs promoted counts and frozen')
      break
    case 'ready':
      break
    default:
      p.push(`unknown kind "${String(kind)}"`)
  }
  return p
}

export const isDecision = (x: unknown): x is Decision => problemsWith(x).length === 0
