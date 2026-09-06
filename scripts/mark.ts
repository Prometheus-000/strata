/**
 * `scripts/mark.ts` — the GitHub-backed writer for a mark made on the
 * published site.
 *
 * The page cannot write; a visitor can, by opening the issue the page
 * composes (`src/identity/sign.ts`). `.github/workflows/mark.yml` runs this
 * with the issue's body and the account that opened it, and this calls
 * `decide()` the way the dev server would — the same request, through the
 * identity's handler — with two differences it states on the record: the
 * deciding hand carries the account's name, because that is the one name a
 * public page can give a hand, and the writing hand is the workflow, because
 * that is whose hand ran the command. The mark's line is counted from the
 * record here rather than taken from the page, whose count was a session's.
 *
 * It mounts the identity's handler and nothing else, so the only thing an
 * issue can do to the record is put a mark on the field. A refusal is an
 * answer, not a failure: the process exits 0 either way and prints one JSON
 * line, and writes `ok`, `id` and `message` to GITHUB_OUTPUT when it is set.
 *
 *   MARK_BODY=<issue body> MARK_ACTOR=<login> node --import tsx/esm scripts/mark.ts [root]
 */
import { appendFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decide, resetHandlers } from '@strata/substrate/decide'
import { readAll } from '@strata/substrate/log'
import { IDENTITY_FILE } from '@strata/identity/record'
import { registerIdentity } from '../src/identity/handler'
import { parseMarkIssue } from '../src/identity/sign'

/** The writing hand's name on the record. */
export const WRITER = 'github-actions'

export type Written = { ok: true; id: string; line: number; value: string } | { ok: false; error: string }

export function writeMark(root: string, body: string, actor: string | undefined, at?: string): Written {
  if (!actor) return { ok: false, error: 'a mark from the published site carries the account that signed it; without one there is no hand to name' }
  const posted = parseMarkIssue(body)
  if (!posted) return { ok: false, error: 'the issue carries no mark — a mark is the fenced block the identity page composes, and nothing else is read' }
  // The count of marks on the record, plus one: the page counted a session, and only the record can count the record.
  const line = readAll(root).filter((d) => d.kind === 'deviation' && d.file === IDENTITY_FILE).length + 1
  resetHandlers()
  registerIdentity()
  const result = decide(
    { ...posted.request, line },
    {
      root,
      decided: { kind: 'human', actor },
      written: { kind: 'agent', actor: WRITER },
      via: posted.via,
      because: `decided by human ${actor} — the issue that carried the mark was opened by that GitHub account, the one name a public page can give a hand; written by agent ${WRITER} — the workflow ran decide()`,
      ...(at ? { at } : {}),
    },
  )
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, id: result.decision.id, line, value: posted.request.value }
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invoked) {
  const root = process.argv[2] ? resolve(process.argv[2]) : join(dirname(fileURLToPath(import.meta.url)), '..')
  const out = writeMark(root, process.env.MARK_BODY ?? '', process.env.MARK_ACTOR)
  const message = out.ok
    ? `On the record as ${out.id}: a mark on the field at ${out.value}, decided by human ${process.env.MARK_ACTOR}, written by agent ${WRITER}. The site redeploys with it.`
    : `Not on the record: ${out.error}`
  console.log(JSON.stringify({ ...out, message }))
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `ok=${out.ok}\nid=${out.ok ? out.id : ''}\nmessage=${message.replace(/\r?\n/g, ' ')}\n`)
}
