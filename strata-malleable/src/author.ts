/**
 * Who is writing.
 *
 * The record carries an author on every line, so the CLI has to know who it is
 * writing for — and it must never guess silently. Three signals, most explicit
 * first, and the sentence returned alongside the answer is printed by every
 * write command so a wrong guess is visible in the terminal that made it:
 *
 *   1. `--by human|agent` on the command line
 *   2. `MALLEABLE_AUTHOR` in the environment
 *   3. `CLAUDECODE` present in the environment — Claude Code sets it for every
 *      command it runs, which is the honest default for an agent's shell. A
 *      person typing into that shell passes `--by human`.
 *
 * Other agents have no standard signal; the skill tells them to pass `--by`.
 */
type Author = 'human' | 'agent'

export interface AuthorDecision {
  author: Author
  /** Why this author, in a sentence. Printed, never swallowed. */
  because: string
}

const isAuthor = (v: unknown): v is Author => v === 'human' || v === 'agent'

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
  if (env.MALLEABLE_AUTHOR !== undefined) {
    if (!isAuthor(env.MALLEABLE_AUTHOR))
      return { error: `MALLEABLE_AUTHOR must be human or agent, not "${env.MALLEABLE_AUTHOR}"` }
    return { author: env.MALLEABLE_AUTHOR, because: `by ${env.MALLEABLE_AUTHOR} — MALLEABLE_AUTHOR in the environment` }
  }
  if (env.CLAUDECODE !== undefined)
    return {
      author: 'agent',
      because: 'by agent — CLAUDECODE in the environment (pass --by human to override)',
    }
  return { author: 'human', because: 'by human — no --by, no MALLEABLE_AUTHOR, no CLAUDECODE; defaulted' }
}
