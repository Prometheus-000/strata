/**
 * The whole vocabulary of the slot layer, in one file.
 *
 * Nothing here imports anything. No React, no DOM, no filesystem, no clock —
 * these types are shared by the codemod, the store, the resolver, the CLI and
 * the drag surface, and a type that drags a dependency along would drag it into
 * all five.
 */

export type ViewId = string
export type StateId = string
export type FeatureId = string
/** `band/column`, one-based: `lede/1`, `body/2`. */
export type SlotId = string

export type Author = 'human' | 'agent'

/* ---------------- The spacing grammar ---------------- */

/**
 * One horizontal band of a view — the unit of vertical rhythm. A band is
 * divided into a fixed number of columns, and each (band, column) pair is a
 * slot. This is the whole grammar: everything a designer can do structurally is
 * a consequence of these two numbers, which is why the slot set is finite and
 * knowable before a drag starts.
 */
export interface Band {
  id: string
  columns: number
  label?: string
  /** Vertical breathing room around the band. Presentation only. */
  rhythm?: 'tight' | 'normal' | 'loose'
  /** What the slots in this band can promise a feature. See `Behavior`. */
  behavior?: Behavior
}

/**
 * THE BEHAVIOR CONTRACT — what a slot supports.
 *
 * Layout stays legal by construction, because the slot set is enumerated and a
 * drop cannot invent a destination. Behaviour does not: focus order, keyboard
 * traversal and dismissal all depend on *where* a feature sits, and a designer
 * moving a region has no way to know they have just put the filters after the
 * results they filter.
 *
 * So a slot declares what it supports and a feature declares what it requires —
 * and where the two do not meet, the system says so. It does not say no.
 *
 * The move always lands. Refusing it would put the tool in the position of
 * knowing better than the person using it, about a product it cannot see; and
 * a designer who is told "no" without recourse learns to route around the tool.
 * What the mismatch produces instead is an **open item**: a named, unresolved
 * behavioural cost that follows the design until someone deals with it, and
 * that stops the commit rather than the drag.
 */
export interface Behavior {
  /**
   * Where this band falls in focus order. Slots are enumerated in reading
   * order, which *is* DOM order, which is tab order — so this is not a label
   * on the arrangement, it is the arrangement.
   */
  focusPhase?: 'before-main' | 'main' | 'after-main'
  /** Escape and click-outside mean something here, so a dismissible region works. */
  dismissible?: boolean
  /** The ARIA landmark these slots sit inside, for the report. */
  landmark?: string
}

/**
 * What a feature needs from wherever it sits. Three requirements, covering the
 * three cases position can break.
 *
 * - `before-main` / `main` / `after-main` — focus order. A banner or a filter
 *   must be reachable before the content it introduces; a contentinfo must not.
 * - `sole-focus` — keyboard traversal. A feature that handles its own arrow
 *   keys cannot share a slot with another focusable region, because then the
 *   arrow keys are ambiguous and neither feature owns them.
 * - `dismissible` — dismissal. Escape and click-outside need a region where
 *   "outside" is defined; in the middle of the main body it is not.
 */
export const REQUIREMENTS = [
  'before-main',
  'main',
  'after-main',
  'sole-focus',
  'dismissible',
] as const
export type Requirement = (typeof REQUIREMENTS)[number]

export interface Slot {
  id: SlotId
  band: string
  /** One-based, left to right. */
  column: number
  /** Position in the view's flattened slot list, top-left to bottom-right. */
  index: number
}

/* ---------------- Declarations (authored) ---------------- */

/**
 * A view, declared by the designer. Not derived from a route, a directory, or
 * the component tree — a view is a unit of design work, and design work does
 * not respect any of those boundaries.
 */
export interface ViewDecl {
  id: ViewId
  label?: string
  /** Every state this view has. A state is a node set, not another view. */
  states: StateId[]
  defaultState: StateId
  bands: Band[]
  /**
   * Written through from a drop. Per state, per feature: where it sits when
   * that differs from the source default declared on the view surface.
   *
   * This lives in the declaration rather than on the `<Feature>` element
   * because placement varies by state and a JSX attribute does not. One file
   * per view, one key per state, one line per feature — so `git diff` is
   * already the per-view, per-state report, with no formatter in between.
   */
  placement?: Placements
}

/** `state → feature → where it sits`. Absent keys mean "the source default". */
export type Placements = Record<StateId, Record<FeatureId, PlacementRecord>>

export interface PlacementRecord {
  slot: SlotId
  order: number
  /**
   * What this slot could not satisfy for this feature, recorded at write time.
   *
   * Computed by the resolver and then *written down*, which is the whole point:
   * a value that only exists while the tool is running is not visible in a diff
   * and not countable across a codebase. Recording it makes an unsatisfied
   * contract a line someone reviews and a number an organisation can total,
   * rather than a warning that scrolls past.
   *
   * The obvious cost of recording derived data is drift. That is not prevented
   * here, it is *detected*: `npm run lint` recomputes and reports any record
   * that no longer matches. Silence would be the failure; a stale line that
   * says so is not.
   */
  open?: Requirement[]
  /**
   * Costs deliberately taken on at this slot — a subset of `open`.
   *
   * Both sit inside the placement record rather than in lists of their own so
   * that a cost and its acknowledgement are bound to a *position* by
   * construction. Move the feature and `slot` changes on the same line, which
   * is exactly where a reviewer is already looking — there is no way to carry
   * an old acknowledgement quietly into a new place.
   */
  accepted?: Requirement[]
  /**
   * Who put it there. Written to source; `ts` deliberately is not — git knows
   * when a line changed, and a timestamp in source churns every diff while
   * telling a reviewer nothing the log does not.
   */
  by: Author
}

/**
 * A feature, as the codemod found it in source. The unit that moves: a composed
 * region, never a leaf element.
 */
export interface FeatureDecl {
  id: FeatureId
  view: ViewId
  /** The component this feature is made of, for the report and the drag label. */
  component: string
  file: string
  /** Where source puts it when nothing has been assigned. */
  sourceSlot: SlotId
  /** Declaration order within the view — the base value of `order`. */
  sourceIndex: number
  /** States this feature appears in. `null` means every state. */
  states: StateId[] | null
  /** What this feature needs from its slot. Empty means it can sit anywhere. */
  requires: Requirement[]
}

export interface Manifest {
  version: 1
  generatedFrom: string[]
  views: ViewDecl[]
  features: FeatureDecl[]
  /**
   * Which file declares each view. Kept beside `views` rather than inside
   * `ViewDecl` because a view declaration is authored and this is discovered —
   * mixing the two invites someone to write a path into a declaration.
   */
  viewFiles: Record<ViewId, string>
  /**
   * Which component renders each view, and where it lives. A preview has to
   * import the real surface — a preview of a mock is a mock.
   */
  viewSurfaces: Record<ViewId, { file: string; component: string }>
}

/* ---------------- The store ---------------- */

/**
 * One assignment. The primary key is (view, state, feature): a feature occupies
 * exactly one slot per state, so nothing here needs a precedence rule.
 *
 * `order` places the feature among the slot's other occupants. It shares a
 * number line with `FeatureDecl.sourceIndex` on purpose — an assigned feature
 * and an un-assigned one have to be sortable against each other, and two number
 * spaces cannot be.
 */
export interface Assignment {
  /** `view:state:feature` — the primary key, used as the id. */
  id: string
  view: ViewId
  state: StateId
  feature: FeatureId
  slot: SlotId
  order: number
  author: Author
  ts: number
  /** Behavioural costs accepted at this slot. Cleared when the slot changes. */
  accepted: Requirement[]
  /**
   * What source records as unsatisfied here. Written by `commit`, read back by
   * the lint pass so recorded and computed can be compared.
   */
  open: Requirement[]
}

export interface Store {
  version: 1
  assignments: Assignment[]
}

/* ---------------- Resolution ---------------- */

export interface Placement {
  feature: FeatureId
  component: string
  slot: SlotId
  order: number
  /** Where the value came from. The report axis, and the drag surface's hint. */
  from: 'assigned' | 'source'
  /** Set when the feature resolved somewhere other than where source puts it. */
  movedFrom?: SlotId
  author?: Author
}

export interface SlotContents {
  slot: Slot
  features: Placement[]
}

/**
 * A behavioural cost the current arrangement incurs and nobody has dealt with.
 *
 * Emitted, never enforced, and not a warning — a warning is a line in a log
 * that nobody totals. This is written into source next to the assignment that
 * put the feature where it sits, so it survives the session, shows up in the
 * diff, and can be counted across a codebase without running anything.
 *
 * It carries enough structure to answer both questions asked of it: *what is
 * unsatisfied in what I am building* (view, state, feature, slot) and *which
 * contracts are being violated across everything built on this system*
 * (requirement, band, and what that band did provide).
 */
export interface OpenItem {
  /** `view:state:feature:slot:requirement` — stable, so acceptance can name it. */
  id: string
  view: ViewId
  state: StateId
  feature: FeatureId
  component: string
  slot: SlotId
  /** The band the slot belongs to — the unit that carries the contract. */
  band: string
  requirement: Requirement
  /** What the band did offer. Lets a count say *why*, not just *how many*. */
  provides: Behavior
  /** Said plainly, because this text is what a designer is shown mid-drag. */
  reason: string
  /** True when this feature's record accepts this cost at this slot. */
  accepted: boolean
  acceptedBy?: Author
}

export interface Layout {
  view: ViewId
  state: StateId
  /** Every slot the grammar defines, in reading order, occupied or not. */
  slots: SlotContents[]
  /** Features this state does not include. Not an error — that is what a state is. */
  absent: FeatureId[]
  /**
   * Assignments that no longer describe anything: a feature this state does not
   * have, or a slot this grammar does not define. Reported, never silently
   * applied and never silently dropped.
   */
  orphans: Array<{
    assignment: Assignment
    reason: 'unknown-feature' | 'absent-in-state' | 'unknown-slot'
  }>
  /**
   * What this arrangement costs. Not a reason to render something else — the
   * layout below is exactly what was asked for. These travel with it.
   */
  openItems: OpenItem[]
}
