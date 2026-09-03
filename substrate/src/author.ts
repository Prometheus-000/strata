/**
 * Who is writing.
 *
 * The record carries an author on every line, so every surface has to know
 * who it is writing for — and must never guess silently. Three signals, most
 * explicit first, and the sentence returned alongside the answer is printed by
 * every write and kept on the decision as `because`, so a wrong guess is
 * visible where it happened and readable later:
 *
 *   1. `--by human|agent` on the command line
 *   2. `STRATA_AUTHOR` in the environment (`MALLEABLE_AUTHOR` still honoured)
 *   3. `CLAUDECODE` present in the environment — Claude Code sets it for every
 *      command it runs, which is the honest default for an agent's shell. A
 *      person typing into that shell passes `--by human`.
 *
 * Other agents have no standard signal; the skill tells them to pass `--by`.
 * A pointer is a hand: the overlay writes `human` without asking.
 */
import { isAuthor, type Author } from './decision.ts'

export interface AuthorDecision {
  author: Author
  /** Why this author, in a sentence. Printed, never swallowed. */
  because: string
}

export function authorFrom(
  argv: readonly string[],
  env: Record<string, string | undefined>,
): AuthorDecision | { error: string } {
  const i = argv.indexOf('--by')
  if (i !== -1) {
    const v = argv[i + 1]
    if (!isAuthor(v)) return { error: `--by must be human or agent, not "${v ?? ''}"` }
    return { author: v, because: `by ${v} — --by ${v} on the command line` }
  }
  for (const name of ['STRATA_AUTHOR', 'MALLEABLE_AUTHOR'] as const) {
    const v = env[name]
    if (v === undefined) continue
    if (!isAuthor(v)) return { error: `${name} must be human or agent, not "${v}"` }
    return { author: v, because: `by ${v} — ${name} in the environment` }
  }
  if (env.CLAUDECODE !== undefined)
    return { author: 'agent', because: 'by agent — CLAUDECODE in the environment (pass --by human to override)' }
  return { author: 'human', because: 'by human — no --by, no STRATA_AUTHOR, no CLAUDECODE; defaulted' }
}
