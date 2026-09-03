/**
 * PROJECTIONS — the files derived from the record.
 *
 * `ledger.json`, `semantic.css`, `tokens.json`, `overrides.json` stay on disk
 * because a runtime imports them and a resolver reads them. None of them is
 * a source: each is what the record says, written out. A projection registers
 * two things — how its old file becomes decisions (once, when a product
 * adopts the record) and how the record becomes its files (every time) — and
 * `rebuild --check` is the invariant that the two agree: an artifact that
 * cannot be faithfully produced from the record is not a projection of it.
 */
import fs from 'node:fs'
import path from 'node:path'
import { newId, targetKey, type Author, type Consequence, type Decision, type DecisionBody } from './decision.ts'
import { append, current, readAll } from './log.ts'

/** A decision as an importer reconstructs it from an old file: body, hand, time, reason. */
export type Imported = DecisionBody & { by: Author; at: string; reason?: string; consequence?: Consequence }

export interface Projection {
  name: string
  /** The old file as decisions, oldest first. Skipped when the record already carries them. */
  import?: (root: string, log: readonly Decision[]) => Imported[]
  /** The files this projection derives from the record, as text, keyed by path relative to root. */
  project: (root: string, log: readonly Decision[]) => Record<string, string>
}

const projections = new Map<string, Projection>()

export const registerProjection = (p: Projection) => projections.set(p.name, p)
export const resetProjections = () => projections.clear()
export const registeredProjections = () => [...projections.keys()]

export const importVia = (name: string) => `import:${name}`

/** Bring every projection's old file onto the record, once, in time order, with the chain intact. */
export function importAll(root: string, opts: { dryRun?: boolean } = {}): { imported: Decision[]; skipped: string[] } {
  const log = readAll(root)
  const skipped: string[] = []
  const pending: Array<Imported & { via: string }> = []
  for (const p of projections.values()) {
    if (!p.import) continue
    const via = importVia(p.name)
    if (log.some((d) => d.via === via)) {
      skipped.push(p.name)
      continue
    }
    for (const d of p.import(root, log)) pending.push({ ...d, via })
  }
  pending.sort((a, b) => a.at.localeCompare(b.at))
  const imported: Decision[] = []
  const seen = current(log)
  for (const d of pending) {
    const { by, at, reason, consequence, via, ...body } = d
    const prev = seen.get(targetKey(body as DecisionBody))
    const decision: Decision = {
      ...(body as DecisionBody),
      id: newId(Date.parse(at)),
      at,
      by,
      via,
      ...(reason ? { reason } : {}),
      ...(prev ? { supersedes: prev.id } : {}),
      consequence: consequence ?? {},
    }
    if (!opts.dryRun) append(root, decision)
    seen.set(targetKey(decision), decision)
    imported.push(decision)
  }
  return { imported, skipped }
}

export function projectAll(root: string, log: readonly Decision[] = readAll(root)): Record<string, string> {
  const files: Record<string, string> = {}
  for (const p of projections.values()) Object.assign(files, p.project(root, log))
  return files
}

export interface RebuildResult {
  /** Every projected file. */
  files: string[]
  /** Files whose text on disk differed from the record (and were written, unless dry). */
  changed: string[]
  written: string[]
}

/** Write every projection from the record; with `dryRun`, only say which files disagree. */
export function rebuild(root: string, opts: { dryRun?: boolean } = {}): RebuildResult {
  const files = projectAll(root)
  const changed: string[] = []
  const written: string[] = []
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(root, rel)
    const onDisk = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null
    if (onDisk === text) continue
    changed.push(rel)
    if (!opts.dryRun) {
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      fs.writeFileSync(abs, text)
      written.push(rel)
    }
  }
  return { files: Object.keys(files), changed, written }
}
