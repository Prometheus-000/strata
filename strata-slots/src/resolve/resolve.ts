/**
 * THE RESOLVER — a pure deterministic function from (view, state, feature) to
 * the slot it occupies, and from (view, state) to the whole layout.
 *
 * Reads no UI state, no DOM, no clock, no module-level mutable anything. The
 * runtime, the drag surface, the CLI and the diff are all clients of this and
 * none of them re-implements a step of it. That is the single constraint that
 * stops the rendered layout and the reported layout from disagreeing.
 *
 * The resolver also evaluates the behaviour contract, and **never blocks a
 * move**. Where a slot cannot give a feature what it requires, it emits an open
 * item naming what is unsatisfied and places the feature exactly where it was
 * asked to go. Enforcement lives at the commit, not at the drag.
 *
 * There is no precedence question — `(view, state, feature)` is unique, so a
 * feature has exactly one assignment or none. What the resolver does have to
 * decide is *order within a slot*, and it does that on one number line:
 * an assigned feature's `order` and an un-assigned feature's `sourceIndex` are
 * the same kind of number, so the two sort against each other without a
 * tie-breaking rule that only one of them understands.
 */
import { slotsOf } from '../grammar/grammar'
import { behaviorOf, unmet } from '../grammar/behavior'
import type {
  Assignment,
  FeatureDecl,
  FeatureId,
  Layout,
  Manifest,
  Placement,
  SlotContents,
  SlotId,
  StateId,
  ViewDecl,
  ViewId,
  OpenItem,
  Requirement,
} from '../schema'

/** Everything the resolver reads. Data only — assemble it, then ask. */
export interface Sources {
  manifest: Manifest
  assignments: Assignment[]
}

export const assignmentKey = (view: ViewId, state: StateId, feature: FeatureId) =>
  `${view}:${state}:${feature}`

/** Assignments as source currently states them. The on-disk answer. */
export function assignmentsFromSource(manifest: Manifest): Assignment[] {
  const out: Assignment[] = []
  for (const view of manifest.views)
    for (const [state, byFeature] of Object.entries(view.placement ?? {}))
      for (const [feature, record] of Object.entries(byFeature))
        out.push({
          id: assignmentKey(view.id, state, feature),
          view: view.id,
          state,
          feature,
          slot: record.slot,
          order: record.order,
          author: record.by,
          accepted: record.accepted ?? [],
          open: record.open ?? [],
          // Source carries no timestamp on purpose — git holds the when. Zero
          // here means "as far back as this repo remembers", and nothing in
          // resolution reads it, because the key is already unique.
          ts: 0,
        })
  return out
}

export const viewOf = (m: Manifest, id: ViewId): ViewDecl | undefined =>
  m.views.find((v) => v.id === id)

export const featureOf = (m: Manifest, id: FeatureId): FeatureDecl | undefined =>
  m.features.find((f) => f.id === id)

/** Features of a view, in source declaration order. */
export const featuresOf = (m: Manifest, view: ViewId): FeatureDecl[] =>
  m.features.filter((f) => f.view === view).sort((a, b) => a.sourceIndex - b.sourceIndex)

/** A state is a node set: `null` states means every state includes this feature. */
export const presentIn = (f: FeatureDecl, state: StateId): boolean =>
  f.states === null || f.states.includes(state)

const findAssignment = (
  assignments: Assignment[],
  view: ViewId,
  state: StateId,
  feature: FeatureId,
): Assignment | undefined =>
  assignments.find((a) => a.view === view && a.state === state && a.feature === feature)

/**
 * Where one feature sits. `null` when the view, the state or the feature is not
 * a thing — never a guess.
 */
export function resolve(
  src: Sources,
  view: ViewId,
  state: StateId,
  feature: FeatureId,
): Placement | null {
  const decl = viewOf(src.manifest, view)
  if (!decl || !decl.states.includes(state)) return null
  const f = featureOf(src.manifest, feature)
  if (!f || f.view !== view || !presentIn(f, state)) return null

  const legal = new Set(slotsOf(decl).map((s) => s.id))
  const assignment = findAssignment(src.assignments, view, state, feature)
  if (assignment && legal.has(assignment.slot))
    return {
      feature,
      component: f.component,
      slot: assignment.slot,
      order: assignment.order,
      from: 'assigned',
      movedFrom: assignment.slot === f.sourceSlot ? undefined : f.sourceSlot,
      author: assignment.author,
    }

  // A slot the grammar does not define is not a position at all, so there is
  // nothing to place the feature at; it falls back to source and `layout()`
  // reports the assignment as an orphan. This is the one structural fallback —
  // it is not a behaviour judgement, and nothing else here overrides a move.
  if (!legal.has(f.sourceSlot)) return null
  return {
    feature,
    component: f.component,
    slot: f.sourceSlot,
    order: f.sourceIndex,
    from: 'source',
  }
}

/**
 * The whole view in one state: every slot the grammar defines, occupied or not,
 * in reading order; what this state leaves out; and every assignment that no
 * longer describes anything.
 */
export function layout(src: Sources, view: ViewId, state: StateId): Layout | null {
  const decl = viewOf(src.manifest, view)
  if (!decl || !decl.states.includes(state)) return null

  const slots = slotsOf(decl)
  const legal = new Set(slots.map((s) => s.id))
  const all = featuresOf(src.manifest, view)
  const present = all.filter((f) => presentIn(f, state))

  const assigned = new Map<FeatureId, Placement>(
    present
      .map((f) => [f.id, placementFor(src, decl, legal, f, state)] as const)
      .filter((e): e is [FeatureId, Placement] => e[1] !== null),
  )

  const placed = [...assigned.values()]
  const contents: SlotContents[] = slots.map((slot) => ({
    slot,
    features: placed
      .filter((p) => p.slot === slot.id)
      // `order` first, then source order, then the id — total and stable, so two
      // machines given the same store produce the same layout byte for byte.
      .sort(
        (a, b) =>
          a.order - b.order ||
          (featureOf(src.manifest, a.feature)?.sourceIndex ?? 0) -
            (featureOf(src.manifest, b.feature)?.sourceIndex ?? 0) ||
          a.feature.localeCompare(b.feature),
      ),
  }))

  const orphans: Layout['orphans'] = []
  for (const a of src.assignments) {
    if (a.view !== view || a.state !== state) continue
    const f = featureOf(src.manifest, a.feature)
    if (!f || f.view !== view) orphans.push({ assignment: a, reason: 'unknown-feature' })
    else if (!presentIn(f, state)) orphans.push({ assignment: a, reason: 'absent-in-state' })
    else if (!legal.has(a.slot)) orphans.push({ assignment: a, reason: 'unknown-slot' })
  }

  return {
    view,
    state,
    slots: contents,
    absent: all.filter((f) => !presentIn(f, state)).map((f) => f.id),
    orphans,
    openItems: openItemsFor(src, decl, present, assigned, state),
  }
}

/** One feature's placement: the assignment if there is one, else source. */
function placementFor(
  src: Sources,
  decl: ViewDecl,
  legal: Set<SlotId>,
  f: FeatureDecl,
  state: StateId,
): Placement | null {
  const p = resolve(src, decl.id, state, f.id)
  if (p) return p
  if (!legal.has(f.sourceSlot)) return null
  return {
    feature: f.id,
    component: f.component,
    slot: f.sourceSlot,
    order: f.sourceIndex,
    from: 'source',
  }
}

/**
 * What this arrangement costs: every requirement it does not meet, named.
 *
 * A cost is *accepted* when the feature's own record says so at this exact
 * slot. Acceptance lives in the placement record, so moving the feature moves
 * the acceptance question with it rather than leaving a stale yes behind.
 */
function openItemsFor(
  src: Sources,
  decl: ViewDecl,
  present: FeatureDecl[],
  assigned: Map<FeatureId, Placement>,
  state: StateId,
): OpenItem[] {
  const out: OpenItem[] = []
  const acceptedFor = (feature: FeatureId, slot: SlotId): Requirement[] => {
    const a = src.assignments.find(
      (x) => x.view === decl.id && x.state === state && x.feature === feature,
    )
    // `?? []` on purpose: a placement literal may legitimately omit `accepted`,
    // and a store restored from an older session may predate the field.
    return a && a.slot === slot ? (a.accepted ?? []) : []
  }

  for (const f of present) {
    const p = assigned.get(f.id)
    if (!p) continue
    const otherOccupants = [...assigned.values()]
      .filter((o) => o.feature !== f.id && o.slot === p.slot)
      .map((o) => o.feature)
    const accepted = acceptedFor(f.id, p.slot)
    for (const requirement of f.requires) {
      const reason = unmet(decl, p.slot, requirement, { otherOccupants })
      if (!reason) continue
      out.push({
        id: openItemId(decl.id, state, f.id, p.slot, requirement),
        view: decl.id,
        state,
        feature: f.id,
        component: f.component,
        slot: p.slot,
        band: p.slot.split('/')[0],
        requirement,
        provides: behaviorOf(decl, p.slot),
        reason,
        accepted: accepted.includes(requirement),
        acceptedBy: accepted.includes(requirement)
          ? src.assignments.find(
              (x) => x.view === decl.id && x.state === state && x.feature === f.id,
            )?.author
          : undefined,
      })
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
}

export const openItemId = (
  view: ViewId,
  state: StateId,
  feature: FeatureId,
  slot: SlotId,
  requirement: Requirement,
) => `${view}:${state}:${feature}:${slot}:${requirement}`

/** Every open item across every view and state. The commit gate reads this. */
export function allOpenItems(src: Sources): OpenItem[] {
  return src.manifest.views.flatMap((v) =>
    v.states.flatMap((state) => layout(src, v.id, state)?.openItems ?? []),
  )
}

/** Open items nobody has acknowledged. Reported, never enforced. */
export const unresolvedOpenItems = (src: Sources): OpenItem[] =>
  allOpenItems(src).filter((i) => !i.accepted)

/**
 * What *source records* as unsatisfied, as opposed to what the resolver
 * computes now. The two should agree; the lint pass exists because nothing
 * guarantees it when the grammar moves underneath a recorded assignment.
 */
export function recordedOpenItems(
  manifest: Manifest,
): Array<{ view: ViewId; state: StateId; feature: FeatureId; slot: SlotId; requirement: Requirement }> {
  const out: Array<{
    view: ViewId
    state: StateId
    feature: FeatureId
    slot: SlotId
    requirement: Requirement
  }> = []
  for (const view of manifest.views)
    for (const [state, byFeature] of Object.entries(view.placement ?? {}))
      for (const [feature, record] of Object.entries(byFeature))
        for (const requirement of record.open ?? [])
          out.push({ view: view.id, state, feature, slot: record.slot, requirement })
  return out
}

/**
 * What landing `feature` in `slot` alongside `alongside` would cost.
 *
 * Asked by the drag surface *while the designer is reaching for the slot*, so
 * the cost is visible at the moment of the decision rather than discovered
 * afterwards. It is never a veto — the caller shows this and lets go anyway.
 */
export function costsOf(
  manifest: Manifest,
  view: ViewId,
  feature: FeatureId,
  slot: SlotId,
  alongside: FeatureId[],
): Array<{ feature: FeatureId; requirement: Requirement; reason: string }> {
  const decl = viewOf(manifest, view)
  const f = featureOf(manifest, feature)
  if (!decl || !f) return []
  const others = alongside.filter((o) => o !== feature)
  const out: Array<{ feature: FeatureId; requirement: Requirement; reason: string }> = []
  for (const requirement of f.requires) {
    const reason = unmet(decl, slot, requirement, { otherOccupants: others })
    if (reason) out.push({ feature, requirement, reason })
  }
  // A neighbour's `sole-focus` is unmet by arrival just as surely as by moving,
  // and the cost belongs to whoever pays it — not to whoever moved.
  for (const id of others) {
    const other = featureOf(manifest, id)
    if (!other?.requires.includes('sole-focus')) continue
    out.push({
      feature: id,
      requirement: 'sole-focus',
      reason: `${slot} holds ${other.component}, which owns its own arrow keys and cannot share a slot`,
    })
  }
  return out
}

/** Every (view, state) pair the manifest declares. The axis every report uses. */
export function allStates(manifest: Manifest): Array<{ view: ViewId; state: StateId }> {
  return manifest.views.flatMap((v) => v.states.map((state) => ({ view: v.id, state })))
}
