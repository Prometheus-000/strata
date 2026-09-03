/**
 * THE ENGINE, as this product reaches it.
 *
 * The compiler itself lives in `@strata/engine` and is imported, never
 * copied — one module, one authority over the semantic tier. What belongs
 * here is the one thing the engine deliberately does not know: the ledger.
 * Deciding whether a role stands is a judgement, and the engine only derives,
 * so the cuts are applied at this edge instead.
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
import { applyLedger, type Ledger } from './ledger'

/**
 * Apply a seed set to the document root. Respects prefers-reduced-motion, and
 * the ledger when given one — a cut token collapses here exactly as it does
 * in the stylesheet, so the Theme Lab never shows a role the record decided
 * against.
 */
export function applyTheme(seeds: ThemeSeeds, root: HTMLElement = document.documentElement, ledger?: Ledger) {
  const cuts = ledger ? applyLedger(generateTheme(seeds), ledger).tokens : undefined
  apply(seeds, root, {
    cuts,
    reducedMotion: typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  })
}
