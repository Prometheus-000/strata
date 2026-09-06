/**
 * THE THEME'S HALF OF `strata init`: the primitives the semantic tier stands
 * on, then every token projection written from the record.
 *
 * The primitives are copied, once, and never rewritten: Tier 1 is raw,
 * context-free scales the product owns the way it owns a stylesheet, and this
 * repository's own file is the starter. Everything after that is a
 * projection — `strata rebuild` writes it again.
 */
import fs from 'node:fs'
import path from 'node:path'
import { rebuild } from '@strata/substrate/projection'
import { themePaths } from './emit'

export const PRIMITIVES_SOURCE = 'src/tokens/primitives.css'

export function initTheme(root: string, pkg: string, opts: { dry?: boolean } = {}): { wrote: string[]; skipped: string[] } {
  const paths = themePaths(root)
  const wrote: string[] = []
  const skipped: string[] = []
  const primitives = path.join(root, paths.primitives)
  if (fs.existsSync(primitives)) skipped.push(paths.primitives)
  else {
    if (!opts.dry) {
      fs.mkdirSync(path.dirname(primitives), { recursive: true })
      fs.copyFileSync(path.join(pkg, PRIMITIVES_SOURCE), primitives)
    }
    wrote.push(paths.primitives)
  }
  const r = rebuild(root, { dryRun: opts.dry })
  for (const f of r.files) (r.changed.includes(f) ? wrote : skipped).push(f)
  return { wrote, skipped }
}
