/**
 * THE OVERRIDE STORE — pure operations over an array of records.
 *
 * One rule holds the model together: an override's id is
 * `scope:selector:property`, so the uniqueness constraint the design needs
 * ("one value per property per target") is the primary key rather than
 * something a caller has to remember to enforce.
 *
 * `setScope` is the only write the promotion control makes. Promote and demote
 * are the same operation read in two directions, so there is one code path and
 * one set of edge cases instead of two that drift.
 */
import type { ThemeSeeds } from '../engine/generateTheme'
import { solveSeed, type SeedProposal } from '../engine/invert'
import type { Manifest, NodeAddress, Override, Scope, Store, Value } from '../schema'
import { SCOPES } from '../schema'
import { evaluate, effectiveSeeds, isRedundant, resolve, tokenTable } from '../resolve/resolve'
import { matches, selectorFor } from '../resolve/selector'

export const emptyStore = (seeds: ThemeSeeds): Store => ({ version: 1, seeds, overrides: [] })

const idOf = (scope: Scope, selector: string, property: string) =>
  `${scope}:${selector}:${property}`

const sameValue = (a: Value, b: Value) =>
  'token' in a && 'token' in b
    ? a.token === b.token
    : 'literal' in a && 'literal' in b
      ? a.literal === b.literal
      : false

const upsert = (overrides: Override[], next: Override): Override[] => {
  const out = overrides.filter((o) => o.id !== next.id)
  out.push(next)
  return out
}

export interface WriteInput {
  address: NodeAddress
  property: string
  value: Value
  author: 'human' | 'agent'
  ts: number
  scope?: Scope
}

/**
 * The manipulator's write. Instance scope by default — a drag is a statement
 * about the thing under the cursor and nothing else, until someone says so.
 */
export function put(store: Store, w: WriteInput): Store {
  const scope = w.scope ?? 'instance'
  const selector = selectorFor(scope, w.address)
  return {
    ...store,
    overrides: upsert(store.overrides, {
      id: idOf(scope, selector, w.property),
      target: { scope, selector },
      property: w.property,
      value: w.value,
      author: w.author,
      ts: w.ts,
    }),
  }
}

export function remove(store: Store, id: string): Store {
  return { ...store, overrides: store.overrides.filter((o) => o.id !== id) }
}

/** Every override for `property` that this address can currently see. */
export function reachable(store: Store, address: NodeAddress, property: string): Override[] {
  return store.overrides.filter(
    (o) =>
      o.property === property &&
      o.target.scope !== 'system' &&
      matches(o.target.scope, o.target.selector, address),
  )
}

export interface ScopeChange {
  store: Store
  /** Overrides flattened into the new one. Shown as a count, never silently. */
  absorbed: Override[]
  /** Present only for system scope. The seed move, and what it costs. */
  proposal?: SeedProposal
  /** Set when the requested scope could not be written, with the reason. */
  refused?: string
}

/**
 * Re-scope the value currently winning at `address` to `target`.
 *
 * Widening is a promise — "all here" must mean all here — so widening absorbs
 * every narrower override of the same node inside the new scope, including ones
 * that disagreed. Narrowing removes only the overrides carrying the value being
 * narrowed, so an unrelated wider decision stays standing and becomes what the
 * siblings fall back to.
 */
export function setScope(
  store: Store,
  manifest: Manifest,
  address: NodeAddress,
  property: string,
  target: Scope,
  author: 'human' | 'agent',
  ts: number,
): ScopeChange {
  const node = manifest.nodes.find((n) => n.nodeId === address.nodeId)
  const base = node?.base[property]
  if (!base) return { store, absorbed: [], refused: `no base value for ${address.nodeId}.${property}` }

  const current = resolve({ seeds: store.seeds, overrides: store.overrides, address, property, base })
  if (current.source === 'base')
    return { store, absorbed: [], refused: 'nothing to scope — this node is still at its base value' }

  const value = current.value
  const targetRank = SCOPES.indexOf(target)

  if (target === 'system') {
    if (!('token' in base))
      return {
        store,
        absorbed: [],
        refused:
          'this node’s base is a literal, so no token carries it and no seed can move it — promote to the component instead',
      }
    const px = current.px
    if (px === null)
      return { store, absorbed: [], refused: 'this value is not a length the engine can solve for' }

    const seeds = effectiveSeeds(store.seeds, store.overrides)
    const proposal = solveSeed(seeds, base.token, px)
    if (!proposal)
      return { store, absorbed: [], refused: `no seed moves ${base.token}` }

    // Absorb the narrower overrides that led here; leave everything else, and
    // let reconcile() report what the seed change made redundant.
    const absorbed = reachable(store, address, property).filter((o) => sameValue(o.value, value))
    const kept = store.overrides.filter((o) => !absorbed.includes(o))
    const selector = proposal.seed
    return {
      store: {
        ...store,
        overrides: upsert(kept, {
          id: idOf('system', selector, property),
          target: { scope: 'system', selector },
          property,
          value: { literal: String(proposal.to) },
          author,
          ts,
        }),
      },
      absorbed,
      proposal,
    }
  }

  const inScope = store.overrides.filter((o) => {
    if (o.property !== property) return false
    const rank = SCOPES.indexOf(o.target.scope)
    if (o.target.scope === 'system') return false
    if (rank > targetRank) {
      // Wider than the target: only removed when it is the value being narrowed.
      return matches(o.target.scope, o.target.selector, address) && sameValue(o.value, value)
    }
    if (rank === targetRank) return matches(o.target.scope, o.target.selector, address)
    // Narrower than the target and inside it: absorbed regardless of value,
    // because widening is a promise about every node the new scope covers.
    return subsumes(target, address, o)
  })

  const selector = selectorFor(target, address)
  const kept = store.overrides.filter((o) => !inScope.includes(o))
  return {
    store: {
      ...store,
      overrides: upsert(kept, {
        id: idOf(target, selector, property),
        target: { scope: target, selector },
        property,
        value,
        author,
        ts,
      }),
    },
    absorbed: inScope.filter((o) => o.id !== idOf(target, selector, property)),
  }
}

/** Does a `target`-scope write at `address` cover this narrower override? */
function subsumes(target: Scope, address: NodeAddress, o: Override): boolean {
  const { nodeId, viewId } = address
  if (target === 'component') {
    if (o.target.scope === 'view') return o.target.selector.endsWith(`::${nodeId}`)
    if (o.target.scope === 'instance') return o.target.selector.endsWith(`::${nodeId}`)
    return false
  }
  if (target === 'view') {
    return (
      o.target.scope === 'instance' &&
      o.target.selector.startsWith(`${viewId}/`) &&
      o.target.selector.endsWith(`::${nodeId}`)
    )
  }
  return false
}

/**
 * Overrides that now say exactly what the base says. A seed change is the usual
 * cause: the system caught up with a hand edit, and the hand edit is dead weight.
 */
export function reconcile(store: Store, manifest: Manifest): Override[] {
  const out: Override[] = []
  for (const o of store.overrides) {
    if (o.target.scope === 'system') continue
    const nodeId = o.target.selector.split('::').pop() ?? o.target.selector
    const node = manifest.nodes.find((n) => n.nodeId === nodeId)
    const base = node?.base[o.property]
    if (!base) continue
    const address = addressOf(o, nodeId)
    if (isRedundant({ seeds: store.seeds, overrides: store.overrides, address, property: o.property, base }))
      out.push(o)
  }
  return out
}

/** Recover the address an override was written against, from its selector. */
export function addressOf(o: Override, nodeId: string): NodeAddress {
  if (o.target.scope === 'instance') {
    const [left] = o.target.selector.split('::')
    const slash = left.indexOf('/')
    return { nodeId, viewId: left.slice(0, slash), instancePath: left.slice(slash + 1) }
  }
  if (o.target.scope === 'view')
    return { nodeId, viewId: o.target.selector.split('::')[0], instancePath: '' }
  return { nodeId, viewId: '', instancePath: '' }
}

/** A human-readable rendering of one override, for the report and the readout. */
export function describe(store: Store, o: Override): string {
  const table = tokenTable(effectiveSeeds(store.seeds, store.overrides))
  const { css } = evaluate(o.value, table)
  const kind = 'token' in o.value ? 'snapped' : 'drifted'
  return `${o.property} = ${css} (${kind}) · ${o.target.scope} · ${o.target.selector} · ${o.author}`
}
