/**
 * `npm run ledger` — keep or cut one generated token, on the record.
 *
 *   npm run ledger -- list
 *   npm run ledger -- cut --accent-strong --why "one filled action per surface"
 *   npm run ledger -- keep --accent-strong
 *
 * Editing `src/theme/ledger.json` by hand does the same thing; this exists so
 * the decision is one gesture with a name on it. The name comes from the shell:
 * `--by human|agent`, then `STRATA_AUTHOR`, then `CLAUDECODE` (which Claude
 * Code sets for every command it runs), then `human` — and the sentence that
 * decided is printed, so a wrong default is visible where it happened.
 *
 * After writing, the projections are regenerated, because a decision that is
 * not in `semantic.css` and `tokens.json` has not been made yet.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { generateTheme, OBSIDIAN } from '../src/theme/generateTheme'
import { emptyLedger, FALLBACKS, summarise, type Author, type Ledger } from '../src/theme/ledger'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const LEDGER_PATH = join(root, 'src/theme/ledger.json')

const argv = process.argv.slice(2)
const [cmd, token] = argv.filter((a, i) => !(a === '--by' || a === '--why') && !(i > 0 && (argv[i - 1] === '--by' || argv[i - 1] === '--why')))
const flag = (n: string) => {
  const i = argv.indexOf(`--${n}`)
  return i === -1 ? undefined : argv[i + 1]
}

/** Who is deciding. Explicit first, and never silent. */
function authorFrom(): { author: Author; because: string } {
  const by = flag('by')
  if (by !== undefined) {
    if (by !== 'human' && by !== 'agent') {
      console.error(`\n  --by must be human or agent, not "${by}"\n`)
      process.exit(1)
    }
    return { author: by, because: `by ${by} — --by ${by} on the command line` }
  }
  const env = process.env.STRATA_AUTHOR
  if (env !== undefined) {
    if (env !== 'human' && env !== 'agent') {
      console.error(`\n  STRATA_AUTHOR must be human or agent, not "${env}"\n`)
      process.exit(1)
    }
    return { author: env, because: `by ${env} — STRATA_AUTHOR in the environment` }
  }
  if (process.env.CLAUDECODE !== undefined)
    return { author: 'agent', because: 'by agent — CLAUDECODE in the environment (pass --by human to override)' }
  return { author: 'human', because: 'by human — no --by, no STRATA_AUTHOR, no CLAUDECODE; defaulted' }
}

const ledger: Ledger = existsSync(LEDGER_PATH)
  ? (JSON.parse(readFileSync(LEDGER_PATH, 'utf8')) as Ledger)
  : emptyLedger()
const engine = generateTheme(OBSIDIAN)

const reemit = () => execFileSync('npx', ['tsx', 'scripts/emit-tokens.ts'], { cwd: root, stdio: 'inherit' })

switch (cmd) {
  case 'list': {
    const n = summarise(ledger)
    console.log(`\n${n.kept} kept · ${n.cut} cut · ${n.proposed} proposed\n`)
    for (const name of Object.keys(engine)) {
      const d = ledger.tokens[name] ?? { status: 'proposed' }
      const mark = d.status === 'cut' ? '✂' : d.status === 'kept' ? '✓' : '·'
      const tail =
        d.status === 'cut'
          ? `→ ${FALLBACKS[name]?.to}${d.by ? ` · ${d.by}` : ''}${d.reason ? ` · ${d.reason}` : ''}`
          : d.status === 'kept'
            ? `${d.by ? `· ${d.by}` : ''}${d.reason ? ` · ${d.reason}` : ''}`
            : 'unreviewed'
      console.log(`  ${mark} ${name.padEnd(24)} ${d.status.padEnd(9)} ${tail}`)
    }
    console.log('\n  a cut token collapses to its fallback in every projection; a proposed one ships as generated until someone decides.\n')
    break
  }

  case 'cut':
  case 'keep': {
    if (!token || !token.startsWith('--')) {
      console.error(`\n  usage: npm run ledger -- ${cmd} --<token> [--why "…"] [--by human|agent]\n`)
      process.exit(1)
    }
    if (!(token in engine)) {
      console.error(`\n  the engine does not emit ${token}. It emits:\n    ${Object.keys(engine).join('\n    ')}\n`)
      process.exit(1)
    }
    const who = authorFrom()
    const why = flag('why')
    const prior = ledger.tokens[token]
    ledger.tokens[token] = {
      status: cmd === 'cut' ? 'cut' : 'kept',
      by: who.author,
      ...(why ? { reason: why } : {}),
    }
    writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + '\n')
    console.log(`\n  ${token}: ${prior?.status ?? 'proposed'} → ${ledger.tokens[token].status}`)
    if (cmd === 'cut') {
      const fb = FALLBACKS[token]
      console.log(`  collapses to ${fb.to} — ${fb.why}`)
    }
    console.log(`  ${who.because}\n`)
    reemit()
    break
  }

  default:
    console.log(`ledger — every generated token is a proposal; decide each one:
  list                      every token and its status
  cut  --<token> [--why …]  collapse it to its fallback in every projection
  keep --<token> [--why …]  mark it reviewed and wanted
  (--by human|agent on any write; otherwise STRATA_AUTHOR, then CLAUDECODE, then human)`)
}
