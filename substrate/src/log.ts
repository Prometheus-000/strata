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
 * Everything below `readAll` is pure and takes the decisions it needs, so the
 * same folds run in a browser that fetched the log and in a CLI that read it.
 */
import fs from 'node:fs'
import path from 'node:path'
import { problemsWith, targetKey, type Decision, type Kind } from './decision'

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

/** Every decision on one target, oldest first. */
export const history = (all: readonly Decision[], key: string): Decision[] =>
  all.filter((d) => targetKey(d) === key)

/** The latest non-refused decision per target — the fold every projection reads. */
export function current(all: readonly Decision[]): Map<string, Decision> {
  const m = new Map<string, Decision>()
  for (const d of all) if (!d.consequence.refused) m.set(targetKey(d), d)
  return m
}

/** Decisions after the most recent decision of `kind` — what has happened since the last handoff or ship. */
export function since(all: readonly Decision[], kind: Kind): Decision[] {
  let i = all.length - 1
  while (i >= 0 && all[i].kind !== kind) i--
  return all.slice(i + 1)
}

export const byId = (all: readonly Decision[], id: string): Decision | undefined => all.find((d) => d.id === id)

/**
 * What a reviewer needs to see, from what happened. A move that exactly
 * reverses the one before it on the same region is a change of mind, and
 * both drop. Picks on one attribute collapse to the last one, keeping the
 * first pick's `from`; picking the start value back drops the row. Refused
 * decisions are not in the handoff. Everything else passes through in order.
 * The log is untouched; this is a view.
 */
export function collapseReversals(ds: readonly Decision[]): Decision[] {
  const out: Decision[] = []
  for (const d of ds) {
    if (d.consequence.refused) continue
    if (d.kind === 'move') {
      const i = findLast(out, (o) => o.kind === 'move' && o.region === d.region)
      const last = i === -1 ? undefined : (out[i] as Extract<Decision, { kind: 'move' }>)
      const reverses =
        last &&
        last.from.container === d.to.container &&
        last.to.container === d.from.container &&
        last.from.line === d.to.line
      if (reverses) out.splice(i, 1)
      else out.push(d)
      continue
    }
    if (d.kind === 'prop') {
      const i = findLast(out, (o) => o.kind === 'prop' && targetKey(o) === targetKey(d))
      if (i === -1) {
        out.push(d)
        continue
      }
      const first = out[i] as Extract<Decision, { kind: 'prop' }>
      out.splice(i, 1)
      if (first.from !== d.to) out.push({ ...d, from: first.from })
      continue
    }
    out.push(d)
  }
  return out
}

function findLast<T>(xs: readonly T[], f: (x: T) => boolean): number {
  for (let i = xs.length - 1; i >= 0; i--) if (f(xs[i])) return i
  return -1
}
