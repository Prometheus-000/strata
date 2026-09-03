/**
 * PROPERTY CONTROLS — a component says what may be changed about it.
 *
 * Declared beside the component, in its own file, the way Framer's
 * `addPropertyControls` sits beside a component: the person who wrote
 * `<Badge>` is the one who knows that `tone` has three values and that its
 * radius should never leave the pill, so that is where the knowledge lives.
 * The declaration is data, read by the codemod, never executed at build time.
 *
 *   export const controls = defineControls(Card, {
 *     tone: { options: ['neutral', 'accent', 'positive'] },   // a prop with options — picked on the object
 *     interactive: { toggle: true },                           // a boolean prop — one chip, on or off
 *     lines: { range: [1, 6] },                                // a numeric prop — scrubbed sideways
 *     radius: { range: [0, 24], snap: ['--radius-pill'] },     // a CSS length on the root node — its own handle limits
 *     padding: false,                                          // no handle for this one
 *   })
 *
 * Two kinds, one declaration. A prop pick rewrites the JSX where the component
 * is used — a diff, receipted like a move. A CSS control shapes the handle the
 * overlay already offers; the drag still goes through the store.
 */
import type { CssControl } from '../schema'

/** How a prop control is written. The reader turns each into a kinded `PropControl`. */
export type PropControlSpec =
  /** A fixed set of strings, picked on the object. */
  | { options: string[] }
  /** On or off. `default` is what the component does when the attribute is absent; false when omitted. */
  | { toggle: true; default?: boolean }
  /** A number within a range, scrubbed on the object. `step` defaults to 1. */
  | { range: [number, number]; step?: number }

export type ControlSpec = CssControl | PropControlSpec | false

/** Identity at runtime; the codemod reads the literal. */
export function defineControls<P>(
  _component: (props: P) => unknown,
  spec: { [K in keyof P & string]?: PropControlSpec } & Record<string, ControlSpec>,
) {
  return spec
}
