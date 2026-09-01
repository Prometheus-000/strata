/**
 * The two elements a view surface is written with, and their props.
 *
 * This file exists at step 1 rather than step 5 because the codemod writes into
 * these props: `fid` is the identity it assigns, and a codemod that writes an
 * attribute the type system does not know about is a codemod whose output does
 * not compile. The rendering behaviour arrives in `View.tsx`; what is fixed here
 * is the shape of the declaration.
 */
import type { ReactNode } from 'react'
import type { SlotId, StateId, ViewId } from '../schema'

export interface ViewProps {
  /** Matches the `id` of a declared view. Views are flat — never nest these. */
  id: ViewId
  /** Which state to render. Defaults to the view declaration's default state. */
  state?: StateId
  children?: ReactNode
}

export interface FeatureProps {
  /**
   * Stable identity, assigned once by `npm run id` and never recomputed.
   * Absent in freshly written source; present in source the codemod has seen.
   */
  fid?: string
  /** Where source puts this feature when nothing has been assigned. */
  slot: SlotId
  /**
   * States this feature appears in, space-separated. Omitted means every state.
   * A state is a node set, so this is the only place absence is expressed.
   */
  states?: string
  /**
   * What this feature needs from wherever it sits, space-separated: any of
   * `before-main`, `main`, `after-main`, `sole-focus`, `dismissible`.
   *
   * These are not hints. The resolver refuses any placement that does not meet
   * them, and the drag surface does not offer the slots that cannot — so a
   * designer never reads this word, they just find that some places will not
   * take the thing they are holding.
   */
  requires?: string
  children?: ReactNode
}
