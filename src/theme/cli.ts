/**
 * The token commands: what `npm run ledger` did, through `decide()`.
 *
 *   list                        every generated token and what was decided about it
 *   cut  --<token> --why "…"    collapse it to its fallback in every projection
 *   keep --<token> --why "…"    mark it reviewed and wanted
 *   propose --<token>           return it to unreviewed
 *   deviate <file:line> --why   legalise a raw literal, on the record and beside the literal
 */
import { authorFrom } from '@strata/substrate/author'
import { decide, type DecideContext } from '@strata/substrate/decide'
import { describe } from '@strata/substrate/format'
import { generateTheme, OBSIDIAN } from './generateTheme'
import { FALLBACKS, summarise } from './ledger'
import { readLedger } from './emit'
import { registerTheme } from './handlers'

export const THEME_COMMANDS = ['list', 'cut', 'keep', 'propose', 'deviate'] as const

export interface CliIo {
  out: (s: string) => void
  err: (s: string) => void
}

const FLAGS = new Set(['by', 'why', 'dry'])

export function runTheme(argv: string[], home: { root: string }, env: Record<string, string | undefined> = process.env, io: CliIo = { out: console.log, err: console.error }): number {
  const [cmd, ...rest] = argv
  const flag = (n: string) => {
    const i = rest.indexOf(`--${n}`)
    return i === -1 ? undefined : rest[i + 1]
  }
  const has = (n: string) => rest.includes(`--${n}`)
  // A token looks like a flag; it is the one `--word` that is not a flag we know.
  const positional = rest.filter((a, i) => !FLAGS.has(a.replace(/^--/, '')) && !(i > 0 && FLAGS.has(rest[i - 1].replace(/^--/, ''))))
  const fail = (msg: string) => {
    io.err(`\n  ${msg}\n`)
    return 1
  }
  registerTheme(home)
  const engine = generateTheme(OBSIDIAN)

  const context = (): DecideContext | { error: string } => {
    const who = authorFrom(rest, env)
    if ('error' in who) return who
    return { root: home.root, by: who.author, via: 'cli', because: who.because, dryRun: has('dry') }
  }

  switch (cmd) {
    case 'list': {
      const ledger = readLedger(home.root)
      const n = summarise(ledger)
      io.out(`\n${n.kept} kept · ${n.cut} cut · ${n.proposed} proposed\n`)
      for (const name of Object.keys(engine)) {
        const d = ledger.tokens[name] ?? { status: 'proposed' as const }
        const mark = d.status === 'cut' ? '✂' : d.status === 'kept' ? '✓' : '·'
        const tail =
          d.status === 'cut'
            ? `→ ${FALLBACKS[name]?.to}${d.by ? ` · ${d.by}` : ''}${d.reason ? ` · ${d.reason}` : ''}`
            : d.status === 'kept'
              ? `${d.by ? `· ${d.by}` : ''}${d.reason ? ` · ${d.reason}` : ''}`
              : 'unreviewed'
        io.out(`  ${mark} ${name.padEnd(24)} ${d.status.padEnd(9)} ${tail}${d.id ? `  [${d.id}]` : ''}`)
      }
      io.out('\n  a cut token collapses to its fallback in every projection; a proposed one ships as generated until someone decides.\n')
      return 0
    }

    case 'cut':
    case 'keep':
    case 'propose': {
      const [token] = positional
      if (!token || !token.startsWith('--')) return fail(`usage: ${cmd} --<token> [--why "…"] [--by human|agent] [--dry]`)
      const ctx = context()
      if ('error' in ctx) return fail(ctx.error)
      const prior = readLedger(home.root).tokens[token]?.status ?? 'proposed'
      const result = decide({ kind: 'token', token, action: cmd, reason: flag('why') }, ctx)
      if (!result.ok) return fail(result.error)
      const d = result.decision
      io.out(`\n  ${token}: ${prior} → ${cmd === 'cut' ? 'cut' : cmd === 'keep' ? 'kept' : 'proposed'}${result.unchanged ? ' (already so)' : ''}`)
      if (cmd === 'cut') io.out(`  collapses to ${d.consequence.collapsesTo} — ${FALLBACKS[token]?.why}`)
      io.out(`  ${ctx.because}`)
      io.out(ctx.dryRun ? '  (dry run — nothing written)\n' : `  ~ ${[...result.written, '.strata/decisions.jsonl'].join(', ')}\n`)
      return 0
    }

    case 'deviate': {
      const [where] = positional
      const m = where?.match(/^(.+):(\d+)$/)
      if (!m) return fail('usage: deviate <file>:<line> --why "…" [--by human|agent] [--dry]')
      const ctx = context()
      if ('error' in ctx) return fail(ctx.error)
      const result = decide({ kind: 'deviation', file: m[1], line: Number(m[2]), reason: flag('why') }, ctx)
      if (!result.ok) return fail(result.error)
      io.out(`\n  ${describe(result.decision)}${result.unchanged ? ' (already declared in source)' : ''}`)
      io.out(`  ${ctx.because}`)
      io.out(ctx.dryRun ? '  (dry run — nothing written)\n' : `  ~ ${[...result.written, '.strata/decisions.jsonl'].join(', ')}\n`)
      return 0
    }

    default:
      io.out(`tokens — every generated token is a proposal; decide each one:
  list                          every token and its status
  cut  --<token> [--why …]      collapse it to its fallback in every projection
  keep --<token> [--why …]      mark it reviewed and wanted
  propose --<token>             return it to unreviewed
  deviate <file>:<line> --why … legalise a raw literal where it sits
  (--by human|agent on any write; otherwise STRATA_AUTHOR, then CLAUDECODE, then human)`)
      return cmd ? 1 : 0
  }
}
