/**
 * The malleable property registry.
 *
 * A property is malleable when it has a direct handle on the object — a corner
 * you can drag, an edge you can push. Colour is deliberately absent: it has no
 * honest direct manipulation at this size, and a colour picker is a panel.
 */
import { PRIMITIVES } from '../engine/scales'

export interface PropertySpec {
  key: string
  label: string
  /** The CSS declarations this property writes. */
  css: string[]
  /** How it is grabbed. The overlay renders one handle kind per property. */
  handle: 'corner' | 'inset' | 'gap'
  range: [number, number]
  /** Drag distance in px that equals one px of value. 1 = direct. */
  gain: number
  /** Tokens this property may snap to, widest-meaning first. */
  snapTo: string[]
}

const RADIUS_TOKENS = [
  '--radius-interactive',
  '--radius-surface',
  '--radius-overlay',
  '--strata-radius-0',
  '--strata-radius-1',
  '--strata-radius-2',
  '--strata-radius-3',
  '--strata-radius-4',
]

const SPACE_TOKENS = [
  '--surface-pad',
  '--control-pad-x',
  '--stack-gap',
  '--strata-space-1',
  '--strata-space-2',
  '--strata-space-3',
  '--strata-space-4',
  '--strata-space-5',
  '--strata-space-6',
]

export const PROPERTIES: Record<string, PropertySpec> = {
  radius: {
    key: 'radius',
    label: 'radius',
    css: ['border-radius'],
    handle: 'corner',
    range: [0, 64],
    gain: 1,
    snapTo: RADIUS_TOKENS,
  },
  padding: {
    key: 'padding',
    label: 'padding',
    css: ['padding'],
    handle: 'inset',
    range: [0, 96],
    gain: 1,
    snapTo: SPACE_TOKENS,
  },
  gap: {
    key: 'gap',
    label: 'gap',
    css: ['gap'],
    handle: 'gap',
    range: [0, 96],
    gain: 1,
    snapTo: SPACE_TOKENS,
  },
}

/** CSS declaration → malleable property key. Used by the manifest reader. */
export const CSS_TO_PROPERTY: Record<string, string> = {
  'border-radius': 'radius',
  padding: 'padding',
  gap: 'gap',
}

export const isPrimitive = (token: string) => token in PRIMITIVES
