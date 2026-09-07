/**
 * The CLI, behind the launcher.
 *
 * Two roots. PACKAGE is where Strata's code, templates, skills and canonical
 * grammar live — beside this file. ROOT is the product whose record this is:
 * STRATA_ROOT, else the nearest `.strata/` above the working directory, the
 * way git finds `.git`. For a year they were one directory, so the CLI run
 * from any other repository silently reported on Strata's own record, which
 * is worse than failing. Where no product is found, only `init` and `help`
 * run; everything else says so and stops.
 *
 * Every write here is a decision on `.strata/decisions.jsonl`, and every
 * hand goes through the same call: a person at this terminal, an agent in
 * its shell (`--by agent`, or `CLAUDECODE` in the environment), the overlay
 * in the browser through the dev server. The verbs are grouped by which
 * projection applies them; the record does not care.
 */
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { runSubstrate, SUBSTRATE_COMMANDS } from '@strata/substrate/cli'
import { productRoot, NOT_A_PRODUCT } from '@strata/substrate/root'
import { loadConfig } from '@strata/substrate/config'
import { registerProse } from '@strata/substrate/prose'
import { runTheme, THEME_COMMANDS } from '../src/theme/cli.ts'
import { registerTheme } from '../src/theme/handlers.ts'
import { registerIdentity } from '../src/identity/handler.ts'
import { runMalleable, MALLEABLE_COMMANDS } from '../strata-malleable/src/cli.ts'
import { registerMalleable } from '../strata-malleable/src/decide/index.ts'
import { runInit, INIT_COMMANDS } from '../src/init.ts'
import { runVoice, VOICE_COMMANDS } from '../src/voices.ts'
import { PROSE } from '../scripts/prose.ts'

const PACKAGE = join(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const [cmd] = argv
const flag = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? undefined : argv[i + 1]
}
const fail = (msg) => {
  console.error(`\n  ${msg}\n`)
  process.exit(1)
}
const ALL_COMMANDS = [...INIT_COMMANDS, ...VOICE_COMMANDS, ...SUBSTRATE_COMMANDS, ...THEME_COMMANDS, ...MALLEABLE_COMMANDS, 'help']

const help = () => {
  console.log(`strata — the record of what this product decided, and the one way to change it

  starting
    init [--yes] [--source d] [--tokens d | --no-theme] [--no-skills] [--mcp] [--dry]
                                begin here: the record, your grammar, the skills, the tokens — in an empty repo or a full one

  the record
    check [--enforce] [--json]  here is what happened: invariants, then policy, preference, knowledge, precedent, handoff
    explain <id | targetKey>    one decision as a glass box: DECISION · CONTEXT · EVIDENCE · CONSEQUENCE
    log [--kind k]              every decision, one line each
    history <targetKey>         every decision on one target, as glass boxes
    show <id>                   one decision
    ready [--why …]             hand off what changed since the last ready
    handoff                     what changed since the last ready, from the record
    import                      bring an old ledger and store onto the record, once
    rebuild [--check]           write every projection from the record; --check only says which differ
    skill [name] [--<input> v]  list the skills, or assemble one's packet: rules, precedent, state, procedure
    precedent [words] [--property p] [--value v] [--component C] [--token --x] [--author a] [--kind k] [--since iso] [--unpromoted] [--at n]
                                what has been decided before, with convergence counted

  the theme (Layer 0)
    retheme [--hue n] [--chroma n] [--warmth n] [--energy n] [--density n] [--lightness n] [--appearance dark|light] [--link <theme lab url>]
                                move the seven seeds, on the record; every projection follows
    list · cut · keep · propose --<token> [--why …]
    mint --<token> --value <v> --why …
    deviate <file>:<line> --why …
    survey                      what the stylesheets already decided: fonts, radii, shadows, raw colours

  the malleable layer (--malleable <dir> picks the library root; --root <dir> the app tree)
    ${MALLEABLE_COMMANDS.join(' · ')}

  every write names two hands and --dry:
    --decided-by human|agent   who could have chosen otherwise (--by is the same flag)
    --actor <handle>           which hand that was; a missing name is noted on the record
    --written-by human|agent   whose hand ran the command
  CLAUDECODE in the environment says who *wrote* and never who decided, so an
  agent's shell that states neither is refused rather than guessed at.`)
}

if (!cmd || cmd === 'help' || cmd === '--help') {
  help()
  process.exit(0)
}

// `voice list` reads the store, which is nowhere near a product; `voice save`
// reads the product it is typed in. Neither needs a record above the cwd.
if (VOICE_COMMANDS.includes(cmd)) {
  try {
    process.exit(runVoice(argv, productRoot() ?? process.cwd()))
  } catch (err) {
    console.error(`\n  ${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  }
}

const found = productRoot()
if (!found && !INIT_COMMANDS.includes(cmd)) fail(NOT_A_PRODUCT)

if (INIT_COMMANDS.includes(cmd)) {
  // `init` starts a product *here*, in the directory it was typed in, even
  // when one exists above: a package in a monorepo may keep its own record,
  // and a second `init` in a product that already has one writes nothing and
  // says so. Every other verb reads the nearest record above the cwd.
  const here = process.cwd()
  if (found && resolve(found) !== resolve(here)) console.log(`\n  note: ${found} is already a Strata product; this starts one here, in ${here}\n`)
  const code = await runInit(argv, { root: here, package: PACKAGE }).catch((err) => {
    console.error(`\n  ${err instanceof Error ? err.message : String(err)}\n`)
    return 1
  })
  process.exit(code)
}

const ROOT = found
let config
try {
  config = loadConfig(ROOT)
} catch (err) {
  fail(err instanceof Error ? err.message : String(err))
}

// Every projection this product mounts, registered before any command runs,
// so `import`, `rebuild` and the checks see all of them. The theme first: the
// malleable layer chains onto its seed handler.
registerTheme({ root: ROOT })
registerIdentity()
const MALLEABLE = config.malleable
  ? {
      logRoot: ROOT,
      root: flag('malleable') ?? process.env.STRATA_MALLEABLE ?? join(ROOT, config.malleable.root ?? '.'),
      source: flag('root') ?? process.env.MALLEABLE_ROOT ?? config.malleable.source,
    }
  : null
if (MALLEABLE) registerMalleable({ root: MALLEABLE.root, source: MALLEABLE.source, logRoot: ROOT })
// Prose last: the verbs it checks against are the ones registered above.
// This repository's own settings — its retired words, its remembered verbs —
// are its own; an adopter gets the substrate's defaults plus what their
// frame file adds.
registerProse(
  ROOT,
  resolve(ROOT) === resolve(PACKAGE)
    ? PROSE
    : {
        commands: ALL_COMMANDS,
        skip: ['node_modules', 'dist', 'build', 'coverage', ...(config.prose?.skip ?? [])],
        packages: ['.', ...(config.prose?.packages ?? [])],
      },
)

function run() {
  if (SUBSTRATE_COMMANDS.includes(cmd)) return runSubstrate(argv, { root: ROOT })
  if (THEME_COMMANDS.includes(cmd)) return runTheme(argv, { root: ROOT })
  if (MALLEABLE_COMMANDS.includes(cmd)) {
    if (!MALLEABLE) fail(`the malleable layer is not mounted here, and \`${cmd}\` is one of its verbs — see ADOPTING.md`)
    return runMalleable(argv, MALLEABLE)
  }
  console.error(`\n  unknown command "${cmd}"\n`)
  help()
  return 1
}

try {
  process.exit(run())
} catch (err) {
  // A record that does not parse, a grammar with a typo: the message, not a stack.
  fail(err instanceof Error ? err.message : String(err))
}
