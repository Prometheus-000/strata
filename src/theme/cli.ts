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
import { handText } from '@strata/substrate/decision'
import { generateTheme, OBSIDIAN } from './generateTheme'
import { FALLBACKS, summarise } from './ledger'
import { mintedRoles, readLedger } from './emit'
import { readAll } from '@strata/substrate/log'
import { registerTheme } from './handlers'

export const THEME_COMMANDS = ['list', 'cut', 'keep', 'propose', 'mint', 'deviate'] as const

export interface CliIo {
  out: (s: string) => void
  err: (s: string) => void
}

const FLAGS = new Set(['by', 'decided-by', 'written-by', 'actor', 'written-actor', 'why', 'value', 'from', 'dry'])

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
    return { root: home.root, decided: who.decided, written: who.written, via: 'cli', because: who.because, dryRun: has('dry') }
  }

  switch (cmd) {
    case 'list': {
      const ledger = readLedger(home.root)
      const minted = mintedRoles(readAll(home.root))
      const n = summarise(ledger)
      io.out(`\n${n.kept} kept · ${n.cut} cut · ${n.proposed} proposed\n`)
      for (const name of Object.keys({ ...engine, ...minted })) {
        const d = ledger.tokens[name] ?? { status: 'proposed' as const }
        const mark = d.status === 'cut' ? '✂' : d.status === 'kept' ? '✓' : '·'
        const hand = d.decided ? handText(d.decided) : ''
        const tail =
          d.status === 'cut'
            ? `→ ${FALLBACKS[name]?.to}${hand ? ` · ${hand}` : ''}${d.reason ? ` · ${d.reason}` : ''}`
            : d.status === 'kept'
              ? `${hand ? `· ${hand}` : ''}${d.reason ? ` · ${d.reason}` : ''}`
              : 'unreviewed'
        io.out(`  ${mark} ${name.padEnd(24)} ${(name in minted ? 'minted' : d.status).padEnd(9)} ${name in minted ? `= ${minted[name]} · ` : ''}${tail}${d.id ? `  [${d.id}]` : ''}`)
      }
      io.out('\n  a cut token collapses to its fallback in every projection; a proposed one ships as generated until someone decides;\n  a minted one is a name a hand coined for a value usage kept reaching, and the record is its source.\n')
      return 0
    }

    case 'cut':
    case 'keep':
    case 'propose': {
      const [token] = positional
      if (!token || !token.startsWith('--')) return fail(`usage: ${cmd} --<token> [--why "…"] [--decided-by human|agent] [--actor h] [--dry]`)
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

    case 'mint': {
      const [token] = positional
      if (!token || !token.startsWith('--')) return fail('usage: mint --<token> --value <literal | --token> --why "…" [--from <id,id>] [--decided-by human|agent] [--actor …] [--dry]')
      const raw = flag('value')
      if (!raw) return fail('a mint says what the name is worth: --value 12px, or --value --radius-surface to alias an existing role')
      const value = raw.startsWith('--') ? { token: raw } : { literal: raw }
      const ctx = context()
      if ('error' in ctx) return fail(ctx.error)
      const from = (flag('from') ?? '').split(',').map((x) => x.trim()).filter(Boolean)
      const result = decide({ kind: 'token', token, action: 'mint', value, from, reason: flag('why') }, ctx)
      if (!result.ok) return fail(result.error)
      io.out(`\n  minted ${token} = ${raw}`)
      io.out(`  ${result.decision.consequence.note ?? ''}`)
      io.out(`  ${ctx.because}`)
      io.out(ctx.dryRun ? '  (dry run — nothing written)\n' : `  ~ ${[...result.written, '.strata/decisions.jsonl'].join(', ')}\n`)
      return 0
    }

    case 'deviate': {
      const [where] = positional
      const m = where?.match(/^(.+):(\d+)$/)
      if (!m) return fail('usage: deviate <file>:<line> --why "…" [--decided-by human|agent] [--actor h] [--dry]')
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
  mint --<token> --value v --why …
                                coin a name for a value usage kept reaching — the one
                                path that adds to the language rather than choosing
                                within it. --from <ids> cites the convergence that earned it.
  deviate <file>:<line> --why … legalise a raw literal where it sits
  (--decided-by human|agent says who chose; --actor names the hand. CLAUDECODE says who wrote, never who chose.)`)
      return cmd ? 1 : 0
  }
}
