/**
 * Where the pointer landed, in the vocabulary of the drop.
 *
 * This is the whole spatial judgement, and it is deliberately arithmetic rather
 * than interface: the drag surface reports a point, this turns it into a
 * DropTarget, and the store decides what that means. Nothing here knows what a
 * swap is.
 *
 * Centre swaps, edges insert. A generous centre — the middle half in both axes
 * — because swapping is the coarser gesture and should be the easier one to hit;
 * insertion is a refinement and can ask for aim.
 */
import type { DropTarget } from '../store/store'
import type { SlotId } from '../schema'

export type Zone = 'centre' | 'before' | 'after'

export function zoneOf(rect: DOMRect, x: number, y: number): Zone {
  const fx = rect.width ? (x - rect.left) / rect.width : 0.5
  const fy = rect.height ? (y - rect.top) / rect.height : 0.5
  if (fx > 0.25 && fx < 0.75 && fy > 0.25 && fy < 0.75) return 'centre'
  // The nearest edge decides which side of the occupant this is. Above and to
  // the left read as "before" because that is how reading order runs.
  const edges: Array<[Zone, number]> = [
    ['before', fy],
    ['after', 1 - fy],
    ['before', fx],
    ['after', 1 - fx],
  ]
  return edges.reduce((best, e) => (e[1] < best[1] ? e : best))[0]
}

/** The pointer is over a slot, and possibly over one of its occupants. */
export function targetFor(
  slot: SlotId,
  occupant: { feature: string; rect: DOMRect } | null,
  x: number,
  y: number,
): DropTarget {
  if (!occupant) return { kind: 'append', slot }
  const zone = zoneOf(occupant.rect, x, y)
  return zone === 'centre'
    ? { kind: 'swap', slot, occupant: occupant.feature }
    : { kind: zone, slot, occupant: occupant.feature }
}
