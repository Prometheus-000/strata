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
import { importAll, rebuild, registeredProjections } from './projection'
import { buildIndex, search, PROMOTION_CANDIDATE_AT } from './precedent'
import type { Author, Kind } from './decision'

export const SUBSTRATE_COMMANDS = ['log', 'history', 'show', 'ready', 'import', 'rebuild', 'precedent'] as const

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

    case 'import': {
      const { imported, skipped } = importAll(home.root, { dryRun: has('dry') })
      for (const d of imported) io.out(`  + ${d.id}  ${d.at.slice(0, 10)}  ${describe(d)}`)
      for (const s of skipped) io.out(`  · ${s} is already on the record`)
      io.out(`\n  ${imported.length} decision(s) imported from ${registeredProjections().join(', ') || 'no projection'}${has('dry') ? ' (dry run — nothing written)' : ''}`)
      if (imported.length && !has('dry')) io.out('  next: strata rebuild — so every projected line points at its decision\n')
      return 0
    }

    case 'rebuild': {
      const check = has('check') || has('dry')
      const r = rebuild(home.root, { dryRun: check })
      if (!r.files.length) return fail('no projection is registered here')
      for (const f of r.files) io.out(`  ${r.changed.includes(f) ? (check ? '≠' : '~') : '='} ${f}`)
      if (check && r.changed.length) {
        io.err(`\n  ${r.changed.length} projection(s) do not match the record — run strata rebuild\n`)
        return 1
      }
      io.out(check ? '\n  every projection matches the record\n' : `\n  ${r.written.length} file(s) rewritten from the record\n`)
      return 0
    }

    case 'precedent': {
      const q = {
        kind: flag('kind') as Kind | undefined,
        property: flag('property'),
        value: flag('value'),
        component: flag('component'),
        token: flag('token'),
        author: flag('author') as Author | undefined,
        since: flag('since'),
        unpromoted: has('unpromoted'),
        text: positional.join(' ') || undefined,
      }
      const r = search(buildIndex(readAll(home.root)), q, { candidateAt: flag('at') ? Number(flag('at')) : PROMOTION_CANDIDATE_AT })
      io.out('')
      if (!r.decisions.length) io.out('  no precedent on the record for that')
      for (const line of r.lines) io.out(`  ${line}`)
      if (r.lines.length) io.out('')
      const limit = Number(flag('limit') ?? 40)
      for (const d of r.decisions.slice(-limit)) io.out(`  ${d.id}  ${d.at.slice(0, 10)}  ${describe(d)}`)
      if (r.decisions.length > limit) io.out(`  … ${r.decisions.length - limit} earlier`)
      io.out(r.decisions.length ? `\n  ${r.decisions.length} decision(s)\n` : '')
      return 0
    }

    default:
      return cmd ? 1 : 0
  }
}
