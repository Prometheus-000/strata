/**
 * THE RESOLVER — a pure function from (seeds, overrides, node, property) to a
 * final value, and to the reason it is that value.
 *
 * Reads no UI state, no DOM, no clock, no module-level mutable anything. The
 * overlay, the runtime stylesheet, the drift report and ship are all clients of
 * this function and none of them re-implements a step of it. That is the single
 * constraint that keeps the four of them from disagreeing.
 *
 * Precedence, narrowest wins:  instance ▸ view ▸ component ▸ base
 * System sits upstream of all four: it moves a seed, the seed moves the token,
 * the token moves every value derived from it — including the base.
 */
import { generateTheme, type ThemeSeeds } from '../engine/generateTheme'
import { PRIMITIVES, toPx } from '../engine/scales'
import type {
  NodeAddress,
  Override,
  Resolution,
  ResolveStep,
  Scope,
  Value,
} from '../schema'
import { matches } from './selector'

/** Narrowest first. The resolver walks this order and stops at the first match. */
const PRECEDENCE: Scope[] = ['instance', 'view', 'component']

export interface ResolveInput {
  seeds: ThemeSeeds
  overrides: Override[]
  address: NodeAddress
  property: string
  /** What the source says before anyone touched it. From the manifest. */
  base: Value
}

/** Every token name the resolver can evaluate, primitives included. */
export function tokenTable(seeds: ThemeSeeds): Record<string, string> {
  return { ...PRIMITIVES, ...generateTheme(seeds) }
}

/**
 * Fold system-scope overrides into the seeds. Later `ts` wins per seed, so a
 * store is replayable in any order and lands in the same place.
 */
export function effectiveSeeds(seeds: ThemeSeeds, overrides: Override[]): ThemeSeeds {
  const system = overrides
    .filter((o) => o.target.scope === 'system')
    .slice()
    .sort((a, b) => a.ts - b.ts)
  let out = seeds
  for (const o of system) {
    const seed = o.target.selector
    if (!(seed in out)) continue
    const raw = 'literal' in o.value ? o.value.literal : undefined
    if (raw === undefined) continue
    const n = Number(raw)
    if (!Number.isFinite(n)) continue
    out = { ...out, [seed]: n }
  }
  return out
}

/** A Value rendered as the CSS it should emit, and as px when it is a length. */
export function evaluate(
  value: Value,
  table: Record<string, string>,
): { css: string; px: number | null } {
  if ('token' in value) {
    const raw = table[value.token]
    // A token stays a `var()` reference on purpose: snapped overrides keep
    // following the theme. Only a literal is frozen.
    return { css: `var(${value.token})`, px: raw === undefined ? null : toPx(raw) }
  }
  return { css: value.literal, px: toPx(value.literal) }
}

/** Latest write wins inside a scope; array order breaks an exact tie. */
function winnerAt(
  scope: Scope,
  overrides: Override[],
  address: NodeAddress,
  property: string,
): Override | undefined {
  let best: Override | undefined
  for (const o of overrides) {
    if (o.target.scope !== scope) continue
    if (o.property !== property) continue
    if (!matches(scope, o.target.selector, address)) continue
    if (!best || o.ts >= best.ts) best = o
  }
  return best
}

export function resolve(input: ResolveInput): Resolution {
  const { overrides, address, property, base } = input
  const seeds = effectiveSeeds(input.seeds, overrides)
  const table = tokenTable(seeds)
  const chain: ResolveStep[] = []

  for (const o of overrides) {
    if (o.target.scope !== 'system' || o.property !== property) continue
    chain.push({
      scope: 'system',
      selector: o.target.selector,
      value: o.value,
      outcome: 'applied',
      note: `seed ${o.target.selector} = ${'literal' in o.value ? o.value.literal : ''} — moves the token, not the node`,
    })
  }

  let winner: { scope: Scope | 'base'; value: Value } | null = null

  for (const scope of PRECEDENCE) {
    const o = winnerAt(scope, overrides, address, property)
    if (!o) {
      chain.push({
        scope,
        selector: '',
        value: base,
        outcome: 'no-match',
        note: 'nothing written at this scope',
      })
      continue
    }
    if (!winner) {
      winner = { scope, value: o.value }
      chain.push({ scope, selector: o.target.selector, value: o.value, outcome: 'applied' })
    } else {
      chain.push({
        scope,
        selector: o.target.selector,
        value: o.value,
        outcome: 'shadowed',
        note: `${winner.scope} is narrower`,
      })
    }
  }

  if (!winner) {
    winner = { scope: 'base', value: base }
    chain.push({ scope: 'base', selector: address.nodeId, value: base, outcome: 'applied' })
  } else {
    chain.push({
      scope: 'base',
      selector: address.nodeId,
      value: base,
      outcome: 'shadowed',
      note: `${winner.scope} override wins`,
    })
  }

  const { css, px } = evaluate(winner.value, table)
  return {
    nodeId: address.nodeId,
    property,
    css,
    px,
    value: winner.value,
    source: winner.scope,
    chain,
  }
}

/**
 * True when an override resolves to exactly what the base already says — which
 * happens after a seed change catches up to a hand edit. Ship drops these; the
 * designer already got what they wanted, from the system, for free.
 */
export function isRedundant(input: ResolveInput): boolean {
  const r = resolve(input)
  if (r.source === 'base') return false
  const table = tokenTable(effectiveSeeds(input.seeds, input.overrides))
  const b = evaluate(input.base, table)
  return b.css === r.css || (b.px !== null && r.px !== null && Math.abs(b.px - r.px) < 0.01)
}

/** Resolve every malleable property of one node in one pass. */
export function resolveNode(
  seeds: ThemeSeeds,
  overrides: Override[],
  address: NodeAddress,
  base: Record<string, Value>,
): Record<string, Resolution> {
  const out: Record<string, Resolution> = {}
  for (const [property, value] of Object.entries(base)) {
    out[property] = resolve({ seeds, overrides, address, property, base: value })
  }
  return out
}
