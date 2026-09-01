/**
 * The spacing grammar, and the slot set it generates.
 *
 * "Enumerated in advance" is the load-bearing phrase. The slot set is a pure
 * function of the band declaration, so it is finite, identical on every machine,
 * and knowable before a drag begins. A drop cannot invent a destination,
 * because there is nowhere to invent one to.
 */
import type { Band, Requirement, Slot, SlotId, ViewDecl } from '../schema'

export const slotId = (band: string, column: number): SlotId => `${band}/${column}`

export function parseSlotId(id: SlotId): { band: string; column: number } | null {
  const m = /^([A-Za-z0-9_-]+)\/(\d+)$/.exec(id)
  if (!m) return null
  const column = Number(m[2])
  return column >= 1 ? { band: m[1], column } : null
}

/** Every slot the grammar defines, in reading order: top to bottom, left to right. */
export function enumerateSlots(bands: Band[]): Slot[] {
  const out: Slot[] = []
  for (const band of bands)
    for (let column = 1; column <= band.columns; column++)
      out.push({ id: slotId(band.id, column), band: band.id, column, index: out.length })
  return out
}

export const slotsOf = (view: ViewDecl): Slot[] => enumerateSlots(view.bands)

export const isLegalSlot = (view: ViewDecl, id: SlotId): boolean =>
  slotsOf(view).some((s) => s.id === id)

export const findSlot = (view: ViewDecl, id: SlotId): Slot | undefined =>
  slotsOf(view).find((s) => s.id === id)

/**
 * Reject a grammar that cannot generate a usable slot set. Called by the codemod
 * so a malformed declaration fails at build time rather than as an empty region
 * in a browser.
 */
export function validateView(view: ViewDecl): string[] {
  const problems: string[] = []
  if (!view.id) problems.push('view has no id')
  if (!view.bands.length) problems.push(`view "${view.id}" declares no bands`)
  if (!view.states.length) problems.push(`view "${view.id}" declares no states`)
  if (view.states.length && !view.states.includes(view.defaultState))
    problems.push(`view "${view.id}" default state "${view.defaultState}" is not one of its states`)

  const seenBands = new Set<string>()
  for (const band of view.bands) {
    if (seenBands.has(band.id)) problems.push(`view "${view.id}" declares band "${band.id}" twice`)
    seenBands.add(band.id)
    if (!Number.isInteger(band.columns) || band.columns < 1)
      problems.push(`view "${view.id}" band "${band.id}" needs at least one column`)
    if (!/^[A-Za-z0-9_-]+$/.test(band.id))
      problems.push(`view "${view.id}" band "${band.id}" has a name that cannot be a slot id`)
  }

  const seenStates = new Set<string>()
  for (const state of view.states) {
    if (seenStates.has(state)) problems.push(`view "${view.id}" declares state "${state}" twice`)
    seenStates.add(state)
  }
  return problems
}

export { behaviorOf, unmet } from './behavior'

/**
 * Which bands provide a requirement.
 *
 * Returns `null` for `sole-focus`, which is not a grammar question at all — it
 * depends on who else is in the slot, and any empty slot satisfies it. Callers
 * must skip it rather than read an empty array as "nothing provides this",
 * which would report every grammar as broken.
 */
export function providersOf(view: ViewDecl, requirement: Requirement): string[] | null {
  if (requirement === 'sole-focus') return null
  return view.bands
    .filter((b) =>
      requirement === 'dismissible'
        ? b.behavior?.dismissible === true
        : b.behavior?.focusPhase === requirement,
    )
    .map((b) => b.id)
}

/** Type-only helper so a `.view.ts` file reads as a declaration, not a literal. */
export const defineView = (view: ViewDecl): ViewDecl => view
