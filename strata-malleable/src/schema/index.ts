/**
 * The whole vocabulary of the malleable layer, in one file, because every
 * other module is a client of the resolver and the resolver is a client of
 * these types. Nothing here imports anything that touches a DOM or a clock.
 */

import type { Author, PropValue, Scope, ThemeSeeds, Value } from '@strata/substrate/decision'
import { SCOPES } from '@strata/substrate/decision'

/** The types every projection shares are declared once, in the substrate, and re-exported here. */
export type { Author, PropValue, Scope, ThemeSeeds, Value }
export { SCOPES }

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

/*
 * `Scope`, `SCOPES` and `Value` come from the substrate: narrowest to widest,
 * the order is load-bearing; snapped to a token or drifted to a literal, the
 * distinction is the point.
 */

export interface Override {
  id: string
  target: { scope: Scope; selector: string }
  property: string
  value: Value
  /**
   * Who wrote it. The overlay writes 'human'; `malleable set` in a terminal
   * writes whoever the shell says it is — `--by`, `MALLEABLE_AUTHOR`, or
   * `CLAUDECODE` for an agent — and prints which. The drift report groups by
   * this, so "how much of this drift did the agent make" is a line, not a
   * question.
   */
  author: Author
  ts: number
}

export interface Store {
  version: 1
  seeds: ThemeSeeds
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
  /** Set when this node is a landmark — a container regions can be moved into. */
  landmark?: Landmark
  /** On a component's root node: what the component declared may be changed. */
  controls?: Controls
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

/* ---------------- Controls ---------------- */

/**
 * What a component says may be changed about it, declared beside it with
 * `defineControls`. Two kinds, one declaration:
 *
 *   - a CSS length on the component's root node (`radius`, `padding`, `gap`)
 *     with the range and snap tokens the component chooses, or `false` to take
 *     the handle away;
 *   - a prop with a fixed set of options (`tone`, `variant`) — picked on the
 *     object, written to the call site as a JSX attribute. A diff, not an override.
 */
export interface CssControl {
  range?: [number, number]
  snap?: string[]
}

export type PropControl =
  /** A fixed set of strings, picked. */
  | { kind: 'options'; options: string[] }
  /** On or off. `default` is what the component does when the attribute is absent. */
  | { kind: 'toggle'; default: boolean }
  /** A number within a range, scrubbed. */
  | { kind: 'number'; range: [number, number]; step: number }
export interface Controls {
  css: Record<string, CssControl | false>
  props: Record<string, PropControl>
}

/** One `<Badge …>` in source: where it is and what it passes. */
export interface CallSite {
  component: string
  /** The component whose JSX contains it. */
  parent: string
  /** Among this component's call sites inside `parent`, in source order. */
  ordinal: number
  line: number
  range: [number, number]
  /** Offset just past the tag name, where a new attribute is spliced in. */
  insertAt: number
  /** Attribute values as literals — string, number, boolean — or null when an expression. */
  attrs: Record<string, PropValue>
  /** Rendered from a `.map` — one call site, many instances. */
  list: boolean
}

export interface PropRequest {
  file: string
  component: string
  parent: string
  ordinal: number
  prop: string
  /** null removes the attribute — back to the component's default. */
  value: PropValue
  by?: Author
}

export interface PropRecord {
  kind: 'prop'
  what: string
  prop: string
  from: PropValue
  to: PropValue
  file: string
  line: number
  by: Author
  at: string
}

export type PropResult =
  | { ok: true; unchanged?: true; edit: string; record: PropRecord }
  | { ok: false; error: string }

/* ---------------- Structure ---------------- */

/**
 * The page's regions, read from its landmarks. Nothing here is declared: a
 * container is a `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`, a
 * `role`, or the root component's own root element; a region is a component
 * call site under one. A move rewrites the JSX; this is only how the overlay
 * and the CLI name what they are moving.
 */
export type Landmark =
  | 'banner'
  | 'navigation'
  | 'search'
  | 'main'
  | 'complementary'
  | 'contentinfo'
  | 'dialog'

export interface RegionChild {
  /** A component call site, or a `.map` that renders one — which is not moved; the data is its order. */
  kind: 'component' | 'list'
  component: string
  /** Among same-name children of this container, in source order. */
  ordinal: number
  line: number
  /** The outermost node: the `{cond && <X />}` expression when conditional, else the element. */
  range: [number, number]
  condition?: string
  /** The `data-region` value the DOM will carry; null when the component's root is not a host element. */
  host: string | null
  /** The module specifier this file imports the component from, when it does. */
  importedFrom?: string
}

export interface Container {
  /** The landmark element's `data-sid`. */
  sid: string
  landmark: Landmark | 'root'
  tag: string
  /** The component whose JSX holds it. */
  component: string
  /** The regions looked through to reach it, root first — so a thing cannot be dropped into itself. */
  via: string[]
  file: string
  line: number
  /** The element's text range. */
  range: [number, number]
  /** The opening tag's range. */
  open: [number, number]
  /** Offset of `</tag>`, or null when self-closing. */
  close: number | null
  children: RegionChild[]
}

export interface Structure {
  version: 1
  generatedFrom: string[]
  roots: Array<{ component: string; file: string; sid: string | null }>
  containers: Container[]
  /** Components that render but cannot be addressed in the DOM — a fragment root, a component root. */
  unaddressable: Array<{ component: string; file: string; why: string }>
}

/* ---------------- Moves ---------------- */

export type Anchor = { region: string; ordinal: number }

export interface MoveRequest {
  what: { container: string; region: string; ordinal: number }
  to:
    | { container: string; before: Anchor }
    | { container: string; after: Anchor }
    | { container: string; end: true }
  by?: Author
}

export interface MoveRecord {
  what: string
  from: { file: string; line: number; container: string }
  to: { file: string; line: number; container: string; index: number }
  by: Author
  at: string
  /** Identifiers the moved element still needs from where it came. Wired at review. */
  adapt?: string[]
}

export type MoveResult =
  | {
      ok: true
      unchanged?: true
      edits: Array<{ file: string; what: string }>
      adapt: string[]
      record: MoveRecord
    }
  | { ok: false; error: string }

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
