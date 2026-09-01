/**
 * THE CONTRACT CHECK — does this slot support what this feature needs?
 *
 * Pure, and deliberately dull. It answers one requirement at a time against one
 * slot, and the interesting judgements (which moves are legal, which slots to
 * offer) are built out of it in the resolver rather than smuggled in here.
 *
 * `sole-focus` is the one requirement that cannot be answered by looking at the
 * slot alone — it depends on who else is in it — so it takes the occupants.
 * That is why validation is a property of a *layout* and not of a placement.
 */
import type { Behavior, FeatureId, Requirement, ViewDecl } from '../schema'
import { parseSlotId } from './grammar'

/** What a slot supports, from the band it belongs to. */
export function behaviorOf(view: ViewDecl, slot: string): Behavior {
  const parsed = parseSlotId(slot)
  const band = parsed && view.bands.find((b) => b.id === parsed.band)
  return band?.behavior ?? {}
}

export interface CheckContext {
  /** Everything else that would be in the slot. Excludes the feature itself. */
  otherOccupants: FeatureId[]
}

/** null when the requirement is met; the reason, in words, when it is not. */
export function unmet(
  view: ViewDecl,
  slot: string,
  requirement: Requirement,
  ctx: CheckContext,
): string | null {
  const behavior = behaviorOf(view, slot)
  const phase = behavior.focusPhase
  switch (requirement) {
    case 'before-main':
      return phase === 'before-main'
        ? null
        : `${slot} is ${phase ?? 'unphased'} in focus order — this must be reachable before the main content`
    case 'main':
      return phase === 'main' ? null : `${slot} is ${phase ?? 'unphased'}, not main content`
    case 'after-main':
      return phase === 'after-main'
        ? null
        : `${slot} is ${phase ?? 'unphased'} in focus order — this must come after the main content`
    case 'dismissible':
      return behavior.dismissible
        ? null
        : `${slot} has no dismissible context, so Escape and click-outside would do nothing`
    case 'sole-focus':
      return ctx.otherOccupants.length === 0
        ? null
        : `${slot} already holds ${ctx.otherOccupants.join(', ')}, and this feature owns its own arrow keys`
  }
}
