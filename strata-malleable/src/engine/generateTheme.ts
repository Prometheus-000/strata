/**
 * THE ENGINE, as the malleable layer reaches it.
 *
 * This file used to be a vendored copy — 134 diff lines away from the
 * original, with its own comments explaining why the drift was fine. It is an
 * import now. The malleable layer is a *client* of the compiler, never a
 * peer: nothing here is edited to make an override work, and if a value
 * cannot be reached by moving a seed, that is a fact about the system and
 * gets reported as one.
 *
 * The resolver needs numbers where the stylesheet wants `calc()`, and that is
 * what the engine's `form` option is for — same table, same multipliers, one
 * authority.
 */
export {
  OBSIDIAN,
  PRESETS,
  ROLES_AGAINST_PRIMITIVES,
  SEED_RANGE,
  clamp,
  generateTheme,
  lerp,
  type ApplyOptions,
  type ThemeForm,
  type ThemeSeeds,
} from '@strata/engine/generateTheme'

import { applyTheme as apply, generateTheme, type ThemeSeeds } from '@strata/engine/generateTheme'

/** Seeds in, resolved numbers out — what the resolver compares a dragged value against. */
export const resolvedTheme = (seeds: ThemeSeeds) => generateTheme(seeds, { form: 'computed' })

/**
 * The cuts this product's record holds, as the harness needs them.
 *
 * The harness renders the same page the site does, so it collapses the same
 * three roles. This table is a *copy of a decision*, which is the honest name
 * for it: a library that ships without the host's record has to be told, and
 * `strata rebuild` regenerates it from `.strata/decisions.jsonl` so it cannot
 * quietly disagree. The resolver's token table is untouched — a drag can
 * still name `--radius-overlay`, and on this page it renders as the surface
 * radius, exactly as it does on the site.
 */
export const LEDGER_CUTS: Record<string, string> = {
  '--shadow-color': 'transparent', // lines, not shadows
  '--motion-ease-emphasis': 'var(--motion-ease)', // nothing bounces
  '--radius-overlay': 'var(--radius-surface)', // two radii, not three
}

/** Apply a seed set to a root element, with this product's cuts. */
export function applyTheme(seeds: ThemeSeeds, root: HTMLElement) {
  apply(seeds, root, { cuts: LEDGER_CUTS })
}
