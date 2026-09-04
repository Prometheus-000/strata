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
import { newId, targetKey, type Consequence, type Decision, type DecisionBody, type Hand } from './decision.ts'
import { append, current, readAll } from './log.ts'

/**
 * A decision as an importer reconstructs it from an old file: body, time,
 * reason, and — only where the old file genuinely recorded them — the hands.
 * Most old files recorded a channel rather than a judgement, so an importer
 * that cannot tell who chose leaves `decided` unset and takes the hands the
 * import was run with. Saying "the file did not know" in `because` is the
 * honest reconstruction; inventing a decider is not.
 */
export type Imported = DecisionBody & {
  decided?: Hand
  written?: Hand
  at: string
  reason?: string
  because?: string
  consequence?: Consequence
}

export interface ImportOptions {
  dryRun?: boolean
  /** The hands every imported row takes unless its own source knew better. */
  decided?: Hand
  written?: Hand
  /** Why those hands, kept on every row that used them. */
  because?: string
}

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
export function importAll(root: string, opts: ImportOptions = {}): { imported: Decision[]; skipped: string[] } {
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
  const fallbackDecided: Hand = opts.decided ?? { kind: 'human' }
  const fallbackWritten: Hand = opts.written ?? fallbackDecided
  for (const d of pending) {
    const { decided, written, at, reason, because, consequence, via, ...body } = d
    const prev = seen.get(targetKey(body as DecisionBody))
    const why = because ?? opts.because
    const decision: Decision = {
      ...(body as DecisionBody),
      id: newId(Date.parse(at)),
      at,
      decided: decided ?? fallbackDecided,
      written: written ?? fallbackWritten,
      via,
      ...(why ? { because: why } : {}),
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
