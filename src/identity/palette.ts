import { generateTheme, type ThemeSeeds } from '../theme/generateTheme'
import { themeTokens, type Ledger } from '../theme/ledger'
import type { Palette } from '@strata/identity/render'

/**
 * Resolved token values for a canvas, which cannot read a custom property.
 * The same call the appearance dot makes, so the field and the dot agree on
 * what ink is. This is the product's half of the identity: the engine takes
 * a palette and never asks where it came from.
 */
export function paletteFrom(seeds: ThemeSeeds, ledger: Ledger): Palette {
  const t = themeTokens(generateTheme(seeds), ledger, 'value')
  return {
    ink: t['--ink'],
    faint: t['--ink-faint'],
    line: t['--line'],
    ground: t['--surface-page'],
    accent: seeds.chroma > 0 ? t['--accent'] : undefined,
  }
}
