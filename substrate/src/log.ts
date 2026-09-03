/**
 * THE LOG — `.strata/decisions.jsonl`, one decision per line, appended and
 * never rewritten.
 *
 * The ledger used to be last-write-wins; the receipt deleted a move that
 * reversed the one before it. Both lost the path to the current state, and
 * the path is where precedent lives. So nothing here removes a line. A
 * reversal is two decisions; "what does the reviewer need to see" is a query
 * (`collapseReversals`), not a deletion. A refusal is a line too — the state
 * did not change, and the attempt is worth knowing about.
 *
 * The folds — history, current, pending, collapseReversals — live in `fold.ts`
 * and touch no filesystem, so a page that fetched the log runs the same ones.
 */
import fs from 'node:fs'
import path from 'node:path'
import { problemsWith, type Decision } from './decision.ts'
export * from './fold.ts'

export const LOG_PATH = '.strata/decisions.jsonl'

export const logPath = (root: string) => path.join(root, LOG_PATH)

export function append(root: string, d: Decision): void {
  const problems = problemsWith(d)
  if (problems.length) throw new Error(`refusing to append a malformed decision: ${problems.join('; ')}`)
  const p = logPath(root)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.appendFileSync(p, JSON.stringify(d) + '\n')
}

/** Every decision, oldest first. A malformed line is an error that names its line; it is an invariant, not a warning. */
export function readAll(root: string): Decision[] {
  return parseLog(fs.existsSync(logPath(root)) ? fs.readFileSync(logPath(root), 'utf8') : '')
}

export function parseLog(text: string): Decision[] {
  const out: Decision[] = []
  text.split('\n').forEach((line, i) => {
    if (!line.trim()) return
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      throw new Error(`${LOG_PATH}:${i + 1} is not JSON`)
    }
    const problems = problemsWith(parsed)
    if (problems.length) throw new Error(`${LOG_PATH}:${i + 1} is not a decision — ${problems.join('; ')}`)
    out.push(parsed as Decision)
  })
  return out
}
