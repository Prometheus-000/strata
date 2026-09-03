/**
 * THE FOLDS — everything that reads the record without touching a
 * filesystem, so the same functions run in a CLI that read the log and in a
 * page that fetched it.
 */
import { targetKey, type Decision, type Kind } from './decision.ts'

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

/** Brought onto the record from an old file, not decided since. */
export const isImported = (d: Decision) => d.via.startsWith('import:')

/** What a handoff is made of: everything decided since the last ready, refusals and the back-fill aside. */
export const pending = (all: readonly Decision[]): Decision[] => since(all, 'ready').filter((d) => !d.consequence.refused && !isImported(d))

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
