/**
 * Drag arithmetic and snapping.
 *
 * Snap to token, drift to literal. A drag that lands near a token's value takes
 * the token and keeps following the theme forever after; a drag that lands
 * between tokens takes the number and stops following. Both are legitimate —
 * the difference is that one of them is a decision about the system and the
 * other is a decision about this corner, and the store records which.
 */
import { fromPx, toPx } from '../engine/scales'
import type { PropertySpec } from '../resolve/properties'
import type { Value } from '../schema'

/** How close a drag has to land, in px, before the token takes it. */
export const SNAP_PX = 3

export interface Tick {
  token: string
  px: number
}

/** Every token this property could snap to, with its current value. */
export function ticksFor(spec: PropertySpec, table: Record<string, string>): Tick[] {
  return spec.snapTo
    .map((token) => ({ token, px: toPx(table[token] ?? '') ?? NaN }))
    .filter((t) => Number.isFinite(t.px) && t.px <= spec.range[1] * 1.5)
    .sort((a, b) => a.px - b.px)
}

export interface Snapped {
  value: Value
  px: number
  /** The token it landed on, when it landed on one. */
  token?: string
}

export function snap(px: number, spec: PropertySpec, table: Record<string, string>): Snapped {
  const clamped = Math.min(spec.range[1], Math.max(spec.range[0], px))
  let best: Tick | null = null
  for (const t of ticksFor(spec, table)) {
    const d = Math.abs(t.px - clamped)
    if (d <= SNAP_PX && (!best || d < Math.abs(best.px - clamped))) best = t
  }
  if (best) return { value: { token: best.token }, px: best.px, token: best.token }
  const rounded = Math.round(clamped)
  return { value: { literal: fromPx(rounded) }, px: rounded }
}

/** Pointer delta → value delta, per handle kind. */
export function deltaFor(handle: PropertySpec['handle'], dx: number, dy: number): number {
  switch (handle) {
    case 'corner':
      // The diagonal, so a corner handle behaves like a corner.
      return (dx + dy) / 2
    case 'inset':
      return dx
    case 'gap':
      return dy
  }
}
