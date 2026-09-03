/**
 * The substrate's own commands — the ones that read the record and need no
 * projection: the log, a target's history. `explain`, `check`, `precedent`
 * and `skill` join here as the evaluators and the index arrive.
 */
import { decide, type DecideContext } from './decide'
import { targetKey } from './decision'
import { authorFrom } from './author'
import { describe, formatDecision } from './format'
import { byId, history, readAll } from './log'

export const SUBSTRATE_COMMANDS = ['log', 'history', 'show', 'ready'] as const

export interface CliIo {
  out: (s: string) => void
  err: (s: string) => void
}

export function runSubstrate(argv: string[], home: { root: string }, env: Record<string, string | undefined> = process.env, io: CliIo = { out: console.log, err: console.error }): number {
  const [cmd, ...rest] = argv
  const flag = (n: string) => {
    const i = rest.indexOf(`--${n}`)
    return i === -1 ? undefined : rest[i + 1]
  }
  const has = (n: string) => rest.includes(`--${n}`)
  const positional = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--')))
  const fail = (msg: string) => {
    io.err(`\n  ${msg}\n`)
    return 1
  }

  switch (cmd) {
    case 'log': {
      const all = readAll(home.root)
      const kind = flag('kind')
      const shown = all.filter((d) => !kind || d.kind === kind)
      if (!shown.length) io.out('\n  nothing on the record yet\n')
      for (const d of shown) io.out(`  ${d.id}  ${d.at.slice(0, 16)}  ${d.kind.padEnd(9)} ${describe(d)}${d.consequence.refused ? '  (refused)' : ''}`)
      if (shown.length) io.out(`\n  ${shown.length} decision(s)${kind ? ` of kind ${kind}` : ''}\n`)
      return 0
    }

    case 'history': {
      const [key] = positional
      if (!key) return fail('usage: history <targetKey>   e.g. token:--accent-strong, move:Filters')
      const all = readAll(home.root)
      const ds = history(all, key)
      if (!ds.length) return fail(`nothing on the record about ${key}`)
      for (const d of ds) io.out(formatDecision(d))
      return 0
    }

    case 'show': {
      const [id] = positional
      const all = readAll(home.root)
      const d = id ? byId(all, id) : undefined
      if (!d) return fail(id ? `no decision ${id}` : 'usage: show <decision id>')
      io.out(formatDecision(d))
      const prior = d.supersedes ? byId(all, d.supersedes) : undefined
      if (prior) io.out(`supersedes ${prior.id}: ${describe(prior)}\n`)
      io.out(`target: ${targetKey(d)}\n`)
      return 0
    }

    case 'ready': {
      const who = authorFrom(rest, env)
      if ('error' in who) return fail(who.error)
      const ctx: DecideContext = { root: home.root, by: who.author, via: 'cli', because: who.because, dryRun: has('dry') }
      const result = decide({ kind: 'ready', reason: flag('why') }, ctx)
      if (!result.ok) return fail(result.error)
      io.out(`\n  ${describe(result.decision)} · ${result.decision.consequence.affected ?? 0} change(s) handed off\n  ${who.because}\n`)
      return 0
    }

    default:
      return cmd ? 1 : 0
  }
}
