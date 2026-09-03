#!/usr/bin/env node
/**
 * `strata` — the one interface to the substrate.
 *
 * Every write here is a decision on `.strata/decisions.jsonl`, and every
 * hand goes through the same call: a person at this terminal, an agent in
 * its shell (`--by agent`, or `CLAUDECODE` in the environment), the overlay
 * in the browser through the dev server. The verbs are grouped by which
 * projection applies them; the record does not care.
 */
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { runSubstrate, SUBSTRATE_COMMANDS } from '../substrate/src/cli.ts'
import { runTheme, THEME_COMMANDS } from '../src/theme/cli.ts'
import { registerTheme } from '../src/theme/handlers.ts'
import { runMalleable, MALLEABLE_COMMANDS } from '../strata-malleable/src/cli.ts'
import { registerMalleable } from '../strata-malleable/src/decide/index.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const [cmd] = argv
const flag = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? undefined : argv[i + 1]
}

const MALLEABLE_HOME = {
  logRoot: ROOT,
  root: flag('malleable') ?? process.env.STRATA_MALLEABLE ?? join(ROOT, 'strata-malleable'),
  source: flag('root') ?? process.env.MALLEABLE_ROOT ?? 'fixtures/app',
}

// Every projection this product has, registered before any command runs, so
// `import`, `rebuild` and the checks see all of them.
registerTheme({ root: ROOT })
registerMalleable({ root: MALLEABLE_HOME.root, source: MALLEABLE_HOME.source })

const help = () => {
  console.log(`strata — the record of what this product decided, and the one way to change it

  the record
    check [--enforce] [--json]  here is what happened: invariants, then policy, preference, knowledge, precedent, handoff
    explain <id | targetKey>    one decision as a glass box: DECISION · CONTEXT · EVIDENCE · CONSEQUENCE
    log [--kind k]              every decision, one line each
    history <targetKey>         every decision on one target, as glass boxes
    show <id>                   one decision
    ready [--why …]             hand off what changed since the last ready
    import                      bring the old ledger and store onto the record, once
    rebuild [--check]           write every projection from the record; --check only says which differ
    skill [name] [--<input> v]  list the skills, or assemble one's packet: rules, precedent, state, procedure
    precedent [words] [--property p] [--value v] [--component C] [--token --x] [--author a] [--kind k] [--since iso] [--unpromoted] [--at n]
                                what has been decided before, with convergence counted

  tokens (Layer 0)
    list · cut · keep · propose --<token> [--why …]
    deviate <file>:<line> --why …

  the malleable layer (--malleable <dir> picks the library root; --root <dir> the app tree)
    ${MALLEABLE_COMMANDS.join(' · ')}

  every write takes --by human|agent (otherwise STRATA_AUTHOR, then CLAUDECODE, then human) and --dry`)
}

if (!cmd || cmd === 'help' || cmd === '--help') {
  help()
  process.exit(0)
}
if (SUBSTRATE_COMMANDS.includes(cmd)) process.exit(runSubstrate(argv, { root: ROOT }))
if (THEME_COMMANDS.includes(cmd)) process.exit(runTheme(argv, { root: ROOT }))
if (MALLEABLE_COMMANDS.includes(cmd)) process.exit(runMalleable(argv, MALLEABLE_HOME))
console.error(`\n  unknown command "${cmd}"\n`)
help()
process.exit(1)
