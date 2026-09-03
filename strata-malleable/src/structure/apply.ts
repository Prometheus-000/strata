/**
 * The move, on disk. Reads the structure fresh, plans against the text it is
 * about to edit, and writes only the files whose text changed. The plan is
 * pure; this is the one place it meets the filesystem. Who moved it, and why,
 * is the decision that wraps this call — see `decide/`.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { MoveRequest, MoveResult } from '../schema'
import { buildStructure } from '../identity/manifest'
import { writeStructure } from '../store/persist'
import { planMove } from './move'

export function applyMove(
  source: string,
  req: MoveRequest,
  by: 'human' | 'agent',
  at: string,
  opts: { root?: string; dryRun?: boolean } = {},
): MoveResult & { written: string[] } {
  const root = opts.root ?? process.cwd()
  const structure = buildStructure(source)
  const abs = (rel: string) => path.resolve(root, rel)
  const plan = planMove(
    structure,
    (rel) => (fs.existsSync(abs(rel)) ? fs.readFileSync(abs(rel), 'utf8') : null),
    req,
    by,
    at,
    abs,
  )
  const written: string[] = []
  if (!plan.result.ok || plan.result.unchanged || opts.dryRun) return { ...plan.result, written }
  for (const [rel, text] of plan.texts) {
    fs.writeFileSync(abs(rel), text)
    written.push(rel)
  }
  // The committed structure follows the source it describes.
  writeStructure(buildStructure(source), root)
  return { ...plan.result, written }
}
