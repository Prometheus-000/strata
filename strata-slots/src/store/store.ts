/**
 * THE SLOT STORE — pure operations over an array of assignments.
 *
 * The primary key is `(view, state, feature)`, and the id *is* that key, so the
 * uniqueness the design needs ("one slot per feature per state") is enforced by
 * the data rather than by every caller remembering to enforce it.
 *
 * `drop` is the only interesting operation, and it is where the two occupancy
 * behaviours live: dropping on the centre of an occupant swaps, dropping on an
 * edge inserts. Nothing else in the repo knows this — the drag surface reports
 * *where* the pointer landed and this function decides what that means.
 *
 * What it never does is refuse on behavioural grounds. Every move lands. The
 * only refusals left are structural — a slot the grammar does not define, an
 * occupant that is not where the caller says it is — because those are not
 * moves at all. Behavioural cost becomes an open item and blocks the commit.
 */
import { isLegalSlot } from '../grammar/grammar'
import {
  assignmentKey,
  featureOf,
  layout,
  presentIn,
  resolve,
  viewOf,
  costsOf,
  type Sources,
} from '../resolve/resolve'
import type {
  Assignment,
  Author,
  FeatureId,
  Manifest,
  Requirement,
  SlotId,
  StateId,
  Store,
  ViewId,
} from '../schema'
import type { Slot } from '../schema'
import { slotsOf } from '../grammar/grammar'
import { assignmentsFromSource } from '../resolve/resolve'

export const emptyStore = (): Store => ({ version: 1, assignments: [] })

/** The store as source currently states it. Where a session starts. */
export const storeFromSource = (manifest: Manifest): Store => ({
  version: 1,
  assignments: assignmentsFromSource(manifest),
})

export interface Where {
  view: ViewId
  state: StateId
  feature: FeatureId
}

export function put(
  store: Store,
  where: Where,
  slot: SlotId,
  order: number,
  author: Author,
  ts: number,
): Store {
  const id = assignmentKey(where.view, where.state, where.feature)
  const prior = store.assignments.find((a) => a.id === id)
  // Acceptance is bound to a position. Reordering inside a slot keeps it;
  // moving to a different slot is a different decision, so it starts unaccepted
  // and the cost — if there still is one — surfaces again.
  const accepted = prior && prior.slot === slot ? prior.accepted : []
  return {
    ...store,
    assignments: [
      ...store.assignments.filter((a) => a.id !== id),
      // `open` is stamped at write time by `commit`, which is the only place
      // that knows what the finished arrangement costs. Carrying a stale copy
      // through every drag would be a second source of truth.
      { id, ...where, slot, order, author, ts, accepted, open: [] },
    ],
  }
}

/**
 * Take a behavioural cost on the record.
 *
 * One click, no text box: a typed justification is a field nobody reads and a
 * step everybody learns to skip. What makes this reviewable is that it lands in
 * source, on the same line as the slot it applies to, with a name against it.
 *
 * A feature sitting at its source default has no record to accept into, so one
 * is written at the slot it already occupies. That is not a move — the diff
 * shows a placement whose slot is unchanged and whose `accepted` is not.
 */
export function accept(
  manifest: Manifest,
  store: Store,
  where: Where,
  requirement: Requirement,
  author: Author,
  ts: number,
): Store {
  const current = resolve({ manifest, assignments: store.assignments }, where.view, where.state, where.feature)
  if (!current) return store
  const id = assignmentKey(where.view, where.state, where.feature)
  const prior = store.assignments.find((a) => a.id === id)
  const accepted = prior && prior.slot === current.slot ? prior.accepted : []
  if (accepted.includes(requirement)) return store
  return {
    ...store,
    assignments: [
      ...store.assignments.filter((a) => a.id !== id),
      {
        id,
        ...where,
        slot: current.slot,
        order: current.order,
        author,
        ts,
        accepted: [...accepted, requirement].sort(),
        open: [],
      },
    ],
  }
}

/** Withdraw an acceptance. The cost becomes open again. */
export function unaccept(store: Store, where: Where, requirement: Requirement): Store {
  const id = assignmentKey(where.view, where.state, where.feature)
  return {
    ...store,
    assignments: store.assignments.map((a) =>
      a.id === id ? { ...a, accepted: a.accepted.filter((r) => r !== requirement) } : a,
    ),
  }
}

/** Drop the assignment, returning the feature to whatever source says. */
export function clear(store: Store, where: Where): Store {
  const id = assignmentKey(where.view, where.state, where.feature)
  return { ...store, assignments: store.assignments.filter((a) => a.id !== id) }
}

/* ---------------- ordering ---------------- */

/**
 * A number strictly between two orders, or null when the gap has closed.
 *
 * Repeated halving eventually exhausts a double, and a silently collapsing
 * order is a layout that reorders itself for no reason a designer can see. When
 * it returns null the caller renormalises the slot and tries once more.
 */
export function orderBetween(before: number | undefined, after: number | undefined): number | null {
  if (before === undefined && after === undefined) return 0
  if (before === undefined) return (after as number) - 1
  if (after === undefined) return before + 1
  const mid = (before + after) / 2
  return mid > before && mid < after ? mid : null
}

/** Give every occupant of a slot a whole number, in the order they already sit. */
function renormalise(
  src: Sources,
  store: Store,
  view: ViewId,
  state: StateId,
  slot: SlotId,
  author: Author,
  ts: number,
): { store: Store; touched: FeatureId[] } {
  const current = layout({ ...src, assignments: store.assignments }, view, state)
  const occupants = current?.slots.find((s) => s.slot.id === slot)?.features ?? []
  let next = store
  for (const [i, p] of occupants.entries())
    next = put(next, { view, state, feature: p.feature }, slot, i, author, ts)
  return { store: next, touched: occupants.map((p) => p.feature) }
}

/* ---------------- the drop ---------------- */

export type DropTarget =
  /** The empty part of a slot. */
  | { kind: 'append'; slot: SlotId }
  /** The centre of an occupant. */
  | { kind: 'swap'; slot: SlotId; occupant: FeatureId }
  /** An edge of an occupant — above, below, or either side. */
  | { kind: 'before'; slot: SlotId; occupant: FeatureId }
  | { kind: 'after'; slot: SlotId; occupant: FeatureId }

export interface DropEffect {
  feature: FeatureId
  slot: SlotId
  order: number
  kind: 'moved' | 'displaced' | 'renumbered'
}

export interface DropResult {
  store: Store
  effects: DropEffect[]
  /** Set when the drop meant nothing. The surface says why; it never guesses. */
  refused?: string
}

export function drop(
  manifest: Manifest,
  store: Store,
  where: Where,
  target: DropTarget,
  author: Author,
  ts: number,
): DropResult {
  const src: Sources = { manifest, assignments: store.assignments }
  const view = viewOf(manifest, where.view)
  if (!view) return { store, effects: [], refused: `no view "${where.view}"` }
  if (!view.states.includes(where.state))
    return { store, effects: [], refused: `view "${view.id}" has no state "${where.state}"` }
  const feature = featureOf(manifest, where.feature)
  if (!feature || feature.view !== view.id)
    return { store, effects: [], refused: `no feature "${where.feature}" in view "${view.id}"` }
  if (!presentIn(feature, where.state))
    return {
      store,
      effects: [],
      refused: `"${feature.id}" is not part of the "${where.state}" state`,
    }
  if (!isLegalSlot(view, target.slot))
    return { store, effects: [], refused: `slot "${target.slot}" is not in this view's grammar` }

  const me = resolve(src, where.view, where.state, where.feature)
  if (!me) return { store, effects: [], refused: 'this feature does not resolve anywhere' }

  if (target.kind === 'swap') {
    if (target.occupant === where.feature) return { store, effects: [] }
    const them = resolve(src, where.view, where.state, target.occupant)
    if (!them || them.slot !== target.slot)
      return { store, effects: [], refused: `"${target.occupant}" is not in ${target.slot}` }
    let next = put(store, where, them.slot, them.order, author, ts)
    next = put(next, { ...where, feature: target.occupant }, me.slot, me.order, author, ts)
    return {
      store: next,
      effects: [
        { feature: where.feature, slot: them.slot, order: them.order, kind: 'moved' },
        { feature: target.occupant, slot: me.slot, order: me.order, kind: 'displaced' },
      ],
    }
  }

  // Where the new order has to land, given the slot's current occupants. A
  // feature already in this slot is not its own neighbour — it is about to move.
  const bracket = (
    s: Store,
  ): { before?: number; after?: number } | { refused: string } => {
    const contents =
      layout({ manifest, assignments: s.assignments }, where.view, where.state)?.slots.find(
        (x) => x.slot.id === target.slot,
      )?.features ?? []
    const others = contents.filter((p) => p.feature !== where.feature)
    if (target.kind === 'append')
      return { before: others.length ? others[others.length - 1].order : undefined }
    const at = others.findIndex((p) => p.feature === target.occupant)
    if (at === -1) return { refused: `"${target.occupant}" is not in ${target.slot}` }
    return target.kind === 'before'
      ? { before: at > 0 ? others[at - 1].order : undefined, after: others[at].order }
      : { before: others[at].order, after: at + 1 < others.length ? others[at + 1].order : undefined }
  }

  const effects: DropEffect[] = []
  let next = store
  let bracketed = bracket(next)
  if ('refused' in bracketed) return { store, effects: [], refused: bracketed.refused }
  let order = orderBetween(bracketed.before, bracketed.after)

  if (order === null) {
    // The gap between two neighbours has closed. Give the slot whole numbers
    // again — which changes nobody's position, only their arithmetic — and ask
    // once more. Once, not in a loop: after renormalising, integer neighbours
    // always have room between them.
    const norm = renormalise(src, next, where.view, where.state, target.slot, author, ts)
    next = norm.store
    for (const f of norm.touched) {
      if (f === where.feature) continue
      const p = resolve({ manifest, assignments: next.assignments }, where.view, where.state, f)
      if (p) effects.push({ feature: f, slot: p.slot, order: p.order, kind: 'renumbered' })
    }
    bracketed = bracket(next)
    if ('refused' in bracketed) return { store, effects: [], refused: bracketed.refused }
    order = orderBetween(bracketed.before, bracketed.after)
    if (order === null)
      return { store, effects: [], refused: `no room left in ${target.slot}` }
  }

  next = put(next, where, target.slot, order, author, ts)
  effects.push({ feature: where.feature, slot: target.slot, order, kind: 'moved' })
  return { store: next, effects }
}

/** Who would be in `slot` after the move, not counting the feature being moved. */
function occupantsAfter(
  src: Sources,
  where: Where,
  slot: SlotId,
  leaving: FeatureId[],
): FeatureId[] {
  const contents =
    layout(src, where.view, where.state)?.slots.find((s) => s.slot.id === slot)?.features ?? []
  return contents
    .map((p) => p.feature)
    .filter((f) => f !== where.feature && !leaving.includes(f))
}

/**
 * What this drop would cost, in words a designer can read while reaching for the
 * slot. Never a refusal — the caller shows this and lets the move land anyway.
 *
 * Vacating a slot can only relax a requirement, never unmeet one, so only the
 * arrivals are priced: the feature being moved, and in a swap the occupant it
 * displaces.
 */
export interface DropCost {
  feature: FeatureId
  requirement: Requirement
  reason: string
}

export function costOfDrop(
  manifest: Manifest,
  store: Store,
  where: Where,
  target: DropTarget,
): DropCost[] {
  const src: Sources = { manifest, assignments: store.assignments }
  const me = resolve(src, where.view, where.state, where.feature)
  if (!me) return []

  if (target.kind === 'swap') {
    const them = resolve(src, where.view, where.state, target.occupant)
    if (!them) return []
    return [
      ...costsOf(
        manifest,
        where.view,
        where.feature,
        them.slot,
        occupantsAfter(src, where, them.slot, [target.occupant]),
      ),
      ...costsOf(
        manifest,
        where.view,
        target.occupant,
        me.slot,
        occupantsAfter(src, where, me.slot, []).filter((f) => f !== target.occupant),
      ),
    ]
  }

  return costsOf(
    manifest,
    where.view,
    where.feature,
    target.slot,
    occupantsAfter(src, where, target.slot, []),
  )
}

/**
 * Every slot in the view, and what landing here would cost.
 *
 * Every slot is a destination — the map is exhaustive on purpose, because
 * "which slots may I use" is no longer a question the system answers. What it
 * answers is "what does this one cost", for all of them, before the drop.
 */
export function slotCosts(
  manifest: Manifest,
  store: Store,
  where: Where,
): Map<SlotId, DropCost[]> {
  const view = viewOf(manifest, where.view)
  const out = new Map<SlotId, DropCost[]>()
  if (!view) return out
  for (const slot of slotsOf(view))
    out.set(slot.id, costOfDrop(manifest, store, where, { kind: 'append', slot: slot.id }))
  return out
}

/** Assignments a state no longer has any use for. Reported, never auto-removed. */
export function orphansOf(manifest: Manifest, store: Store) {
  const out: Array<{ assignment: Assignment; reason: string }> = []
  for (const view of manifest.views)
    for (const state of view.states) {
      const l = layout({ manifest, assignments: store.assignments }, view.id, state)
      for (const o of l?.orphans ?? []) out.push({ assignment: o.assignment, reason: o.reason })
    }
  return out
}
