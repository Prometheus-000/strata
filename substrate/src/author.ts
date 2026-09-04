/**
 * WHO CHOSE, AND WHOSE HAND WROTE IT.
 *
 * These are two questions and the record used to ask one. A single `by`
 * recorded which channel wrote the line, so a decision a person made and an
 * agent typed came back reading as the agent's. That is not a naming
 * nuisance: it is the difference between a record of judgements and a log of
 * keystrokes.
 *
 * So every write carries two hands.
 *
 *   decided   who could have chosen otherwise
 *   written   whose hand ran the command
 *
 * Either may be an agent. Neither outranks the other, and `actor` — a handle,
 * an email, a harness id — is opaque to the substrate.
 *
 * The signals, most explicit first:
 *
 *   decided   `--decided-by human|agent` (`--by` is the same flag), then
 *             `STRATA_DECIDED_BY`, then `STRATA_AUTHOR`.
 *   written   `--written-by human|agent`, then `STRATA_WRITTEN_BY`, then
 *             `STRATA_AUTHOR`, then `CLAUDECODE` in the environment, which
 *             Claude Code sets for every command it runs.
 *   actor     `--actor` for the deciding hand, `--written-actor` for the
 *             writing one, then `STRATA_ACTOR`; `CLAUDECODE` names the
 *             writing hand `claude-code` and never the deciding one.
 *
 * `CLAUDECODE` infers the hand that *wrote* and never the hand that *decided*.
 * An agent's shell with nothing else said is refused rather than guessed at,
 * because the guess is exactly the one that put an agent's name on thirty-four
 * of this record's decisions. A pointer is a hand: the overlay writes
 * `decided: human` without asking.
 *
 * The sentence returned alongside the answer is printed by every write and
 * kept on the decision as `because`, so a wrong default — or a missing name —
 * is visible where it happened and readable later.
 */
import { isAuthor, type Author, type Hand } from './decision.ts'

export interface Authorship {
  decided: Hand
  written: Hand
  /** Why these two hands, in a sentence. Printed, never swallowed. */
  because: string
}

const CLAUDE_CODE = 'claude-code'

const flag = (argv: readonly string[], name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? undefined : argv[i + 1]
}

const kindFrom = (v: string | undefined, where: string): Author | { error: string } => {
  if (v === undefined) return { error: `${where} is not set` }
  if (!isAuthor(v)) return { error: `${where} must be human or agent, not "${v}"` }
  return v
}

export function authorFrom(
  argv: readonly string[],
  env: Record<string, string | undefined>,
): Authorship | { error: string } {
  const claude = env.CLAUDECODE !== undefined

  /* ---- who decided ---- */
  let decidedKind: Author
  let decidedWhy: string
  const decidedFlag = flag(argv, 'decided-by') ?? flag(argv, 'by')
  const which = argv.includes('--decided-by') ? '--decided-by' : '--by'
  if (decidedFlag !== undefined || argv.includes('--decided-by') || argv.includes('--by')) {
    const k = kindFrom(decidedFlag, which)
    if (typeof k !== 'string') return k
    decidedKind = k
    decidedWhy = `decided by ${k} — ${which} ${k} on the command line`
  } else if (env.STRATA_DECIDED_BY !== undefined) {
    const k = kindFrom(env.STRATA_DECIDED_BY, 'STRATA_DECIDED_BY')
    if (typeof k !== 'string') return k
    decidedKind = k
    decidedWhy = `decided by ${k} — STRATA_DECIDED_BY in the environment`
  } else if (env.STRATA_AUTHOR !== undefined || env.MALLEABLE_AUTHOR !== undefined) {
    const name = env.STRATA_AUTHOR !== undefined ? 'STRATA_AUTHOR' : 'MALLEABLE_AUTHOR'
    const k = kindFrom(env.STRATA_AUTHOR ?? env.MALLEABLE_AUTHOR, name)
    if (typeof k !== 'string') return k
    decidedKind = k
    decidedWhy = `decided by ${k} — ${name} in the environment`
  } else if (claude) {
    return {
      error:
        'CLAUDECODE says an agent\'s shell is writing this, but not who decided it, and that is not a guess this makes.\n' +
        '  Ask: who could have chosen otherwise? If the target and the value were both named to you, --decided-by human.\n' +
        '  If you chose either of them, --decided-by agent. Add --actor <handle> to say which hand.',
    }
  } else {
    decidedKind = 'human'
    decidedWhy = 'decided by human — no --decided-by, no STRATA_DECIDED_BY, no STRATA_AUTHOR; a person at a terminal is the base case'
  }

  /* ---- whose hand wrote ---- */
  let writtenKind: Author
  let writtenWhy: string
  let writtenActor = flag(argv, 'written-actor')
  const writtenFlag = flag(argv, 'written-by')
  if (argv.includes('--written-by')) {
    const k = kindFrom(writtenFlag, '--written-by')
    if (typeof k !== 'string') return k
    writtenKind = k
    writtenWhy = `written by ${k} — --written-by ${k} on the command line`
  } else if (env.STRATA_WRITTEN_BY !== undefined) {
    const k = kindFrom(env.STRATA_WRITTEN_BY, 'STRATA_WRITTEN_BY')
    if (typeof k !== 'string') return k
    writtenKind = k
    writtenWhy = `written by ${k} — STRATA_WRITTEN_BY in the environment`
  } else if (claude) {
    writtenKind = 'agent'
    writtenActor = writtenActor ?? CLAUDE_CODE
    writtenWhy = `written by agent ${CLAUDE_CODE} — CLAUDECODE in the environment`
  } else if (env.STRATA_AUTHOR !== undefined || env.MALLEABLE_AUTHOR !== undefined) {
    writtenKind = decidedKind
    writtenWhy = `written by ${writtenKind} — the same environment that said who decided`
  } else {
    writtenKind = decidedKind
    writtenWhy = `written by ${writtenKind} — the hand that decided ran the command`
  }

  /* ---- which hands ---- */
  const decidedActor = flag(argv, 'actor') ?? env.STRATA_ACTOR
  const decided: Hand = { kind: decidedKind, ...(decidedActor ? { actor: decidedActor } : {}) }
  const written: Hand = { kind: writtenKind, ...(writtenActor ? { actor: writtenActor } : {}) }

  const missing = !decidedActor ? '; no actor named for the deciding hand — precedent will count it as an unnamed one' : ''
  return { decided, written, because: `${decidedWhy}; ${writtenWhy}${missing}` }
}
