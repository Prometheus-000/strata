/**
 * Where a pointer is, relative to a neighbour: before it or after it, along
 * the axis its container stacks in. Nothing here knows what a move is.
 */
export type Axis = 'vertical' | 'horizontal'

export function edgeOf(rect: DOMRect, x: number, y: number, axis: Axis): 'before' | 'after' {
  if (axis === 'vertical') return y < rect.top + rect.height / 2 ? 'before' : 'after'
  return x < rect.left + rect.width / 2 ? 'before' : 'after'
}

/** Vertical when the second child starts below the first; horizontal otherwise. */
export function axisOf(a: DOMRect | null, b: DOMRect | null): Axis {
  if (!a || !b) return 'vertical'
  return b.top >= a.bottom - 1 ? 'vertical' : 'horizontal'
}
