/**
 * `npm run identity` — the favicon and the mark, projected from the record.
 *
 * Two files, both regenerable, neither edited by hand: `public/favicon.svg`,
 * the whole system at 32px — one contour and a point for the present — and
 * `src/identity/mark.svg`, the same state at four levels. They are what the
 * record projects at the moment this ran; `npm run build` runs it again, so
 * the deployed icon is the deployed record. Same engine as the page, same
 * derivation, same lines: `@strata/identity`, the package beside the engine.
 *
 *   node --import tsx/esm scripts/emit-identity.ts [root]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readAll } from '@strata/substrate/log'
import { OBSIDIAN, PRESETS } from '../src/theme/generateTheme'
import { readLedger } from '../src/theme/emit'
import { frameAt, levelCount } from '@strata/identity/field'
import { stateFrom } from '@strata/identity/record'
import { svgFrom } from '@strata/identity/render'
import { paletteFrom } from '../src/identity/palette'

export const FAVICON_PATH = 'public/favicon.svg'
export const MARK_PATH = 'src/identity/mark.svg'

export function emitIdentity(root: string): Record<string, string> {
  const ledger = readLedger(root)
  const record = readAll(root)
  const state = stateFrom(record)
  const house = paletteFrom(OBSIDIAN, ledger)
  const inks = { dark: paletteFrom(PRESETS.Obsidian, ledger).ink, light: paletteFrom(PRESETS.Gallery, ledger).ink, house: OBSIDIAN.appearance }
  const base = { energy: OBSIDIAN.energy, density: OBSIDIAN.density }
  const favicon = svgFrom(frameAt(state, Infinity, { ...base, n: 24, levels: levelCount('favicon', OBSIDIAN.density) }), 32, house, { dot: true, inks })
  const mark = svgFrom(frameAt(state, Infinity, { ...base, n: 64, levels: levelCount('mark', OBSIDIAN.density) }), 160, house, { dot: false, inks })
  const files = { [FAVICON_PATH]: favicon, [MARK_PATH]: mark }
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), text)
  }
  return files
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invoked) {
  const root = process.argv[2] ? resolve(process.argv[2]) : join(dirname(fileURLToPath(import.meta.url)), '..')
  const files = emitIdentity(root)
  const n = readAll(root).length
  console.log(`emitted ${Object.keys(files).join(' and ')} from ${n} decision(s) on the record`)
}
