/**
 * WHERE THE PRODUCT IS.
 *
 * Two roots, and for a year they were one. The *package* is where Strata's
 * code, templates, skills and canonical grammar live; the *product* is whose
 * record this is. `bin/strata.mjs` rooted both at the script's own directory,
 * so run from any other repository it silently reported on Strata's own
 * record — which is worse than failing, because nothing said so.
 *
 * The product is found the way git finds `.git`: walk up from the working
 * directory to the first directory holding `.strata/`. `STRATA_ROOT` names
 * it outright. Nothing is found, nothing is guessed: a verb that needs a
 * product says there is none here and how to start one.
 */
import fs from 'node:fs'
import path from 'node:path'

/** The directory that makes a directory a product: it holds the record. */
export const PRODUCT_DIR = '.strata'

/** The nearest ancestor of `from` — itself included — that holds `.strata/`, or undefined. */
export function findProductRoot(from: string): string | undefined {
  let dir = path.resolve(from)
  for (;;) {
    if (fs.existsSync(path.join(dir, PRODUCT_DIR))) return dir
    const up = path.dirname(dir)
    if (up === dir) return undefined
    dir = up
  }
}

/** What a verb prints when it needs a product and finds none. */
export const NOT_A_PRODUCT = 'not a Strata product here — `npx strata init` starts one, or STRATA_ROOT names the product'

/** The product root: `STRATA_ROOT` when set, else the nearest `.strata/` above the working directory. */
export function productRoot(env: Record<string, string | undefined> = process.env, cwd: string = process.cwd()): string | undefined {
  if (env.STRATA_ROOT) return path.resolve(env.STRATA_ROOT)
  return findProductRoot(cwd)
}
