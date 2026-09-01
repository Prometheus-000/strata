/**
 * The write itself — the one function every batching trigger calls.
 *
 * When this runs is not its business. Batching and triggers belong to the host;
 * this function only knows how to land a store into source.
 *
 * It writes when it is asked to and never decides that it should not. Open
 * items are exposed, not enforced — whether an unresolved cost should stop a
 * commit is a policy, policies differ between teams, and a library that picks
 * one has picked it for everybody. `carries` reports what the written design
 * costs so a host can act on it; nothing here acts on it.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Manifest, OpenItem, Store } from '../schema'
import { unresolvedOpenItems } from '../resolve/resolve'
import { placementsFor, writePlacements } from './source'

export interface CommitResult {
  written: string[]
  unchanged: string[]
  /**
   * What the design that was just written costs. Reported for the host to act
   * on — or not. Writing happened either way.
   */
  carries: OpenItem[]
}

export function commit(manifest: Manifest, store: Store, root = process.cwd()): CommitResult {
  const carries = unresolvedOpenItems({ manifest, assignments: store.assignments })
  const written: string[] = []
  const unchanged: string[] = []
  for (const view of manifest.views) {
    const file = manifest.viewFiles[view.id]
    if (!file) continue
    const abs = path.join(root, file)
    const before = fs.readFileSync(abs, 'utf8')
    const after = writePlacements(before, placementsFor(manifest, store, view.id))
    if (after === before) unchanged.push(file)
    else {
      fs.writeFileSync(abs, after)
      written.push(file)
    }
  }
  return { written, unchanged, carries }
}
