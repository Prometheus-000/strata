/**
 * The whole vocabulary of the malleable layer, in one file, because every
 * other module is a client of the resolver and the resolver is a client of
 * these types. Nothing here imports anything that touches a DOM or a clock.
 */

/* ---------------- Identity ---------------- */

/**
 * A stable id for one styled node in source, assigned once by the codemod and
 * never recomputed. Format is `Component.tag.primary-class` with a `#n`
 * disambiguator on collision — legible on purpose: this string appears in the
 * drift report, and a report full of hashes does not get read.
 */
export type NodeId = string

/** Which rendered copy of a source node. '' when the node renders once. */
export type InstancePath = string

export type ViewId = string

/** Everything needed to address one rendered node. Data only. */
export interface NodeAddress {
  nodeId: NodeId
  viewId: ViewId
  instancePath: InstancePath
}

/* ---------------- Store ---------------- */

/**
 * Narrowest to widest. The order is load-bearing: SCOPES.indexOf is the
 * precedence comparison, and promotion walks this array.
 */
export const SCOPES = ['instance', 'view', 'component', 'system'] as const
export type Scope = (typeof SCOPES)[number]

/**
 * Snapped to a token, or drifted to a literal. The distinction is the point:
 * a token override still follows a retheme, a literal one is frozen at the
 * value it was dragged to. The UI shows which, and ship reports which.
 */
export type Value = { token: string } | { literal: string }

export interface Override {
  id: string
  target: { scope: Scope; selector: string }
  property: string
  value: Value
  /**
   * Present from day one. Nothing writes 'agent' yet — agent authorship is
   * out of scope — but the field is written, read, and grouped by, so it is
   * a real column rather than a reserved word.
   */
  author: 'human' | 'agent'
  ts: number
}

export interface Store {
  version: 1
  seeds: import('../engine/generateTheme').ThemeSeeds
  overrides: Override[]
}

/* ---------------- Manifest (codemod output) ---------------- */

/** One styled node as the codemod found it. */
export interface ManifestNode {
  nodeId: NodeId
  file: string
  component: string
  /** 'recipe' = Layer 2, forkable. 'local' = Layer 3, free. */
  layer: 'recipe' | 'local'
  tag: string
  classes: string[]
  /** Set when this node is a view root — the codemod stamped data-view here. */
  viewId?: ViewId
  /** Declared base value per malleable property, read out of the stylesheet. */
  base: Record<string, Value>
  /** Which CSS rule each base came from, so ship knows where to write back. */
  baseFrom: Record<string, { selector: string; file: string }>
}

export interface Manifest {
  version: 1
  generatedFrom: string[]
  nodes: ManifestNode[]
}

/* ---------------- Resolution ---------------- */

export type ResolveOutcome = 'applied' | 'shadowed' | 'no-match'

export interface ResolveStep {
  scope: Scope | 'base'
  selector: string
  value: Value
  outcome: ResolveOutcome
  /** Why it lost, in words, for the readout. */
  note?: string
}

export interface Resolution {
  nodeId: NodeId
  property: string
  /** What to emit as CSS: `var(--token)` when snapped, the literal when drifted. */
  css: string
  /** The same value in px, when it is a length. null when it is not comparable. */
  px: number | null
  value: Value
  source: Scope | 'base'
  /** Every candidate considered, in precedence order, with its outcome. */
  chain: ResolveStep[]
}
