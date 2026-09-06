/**
 * A MARK, SIGNED — how a mark made on the published site reaches the record.
 *
 * The site is static: no endpoint, no token, nothing that can write, and a
 * page that held a token would be handing it to everyone who opened it. The
 * one write GitHub gives a page is an issue, and an issue is signed by the
 * account that opened it — which is more than a pointer ever was. So a click
 * on the published field composes an issue: the same request the page would
 * have posted to the dev server, in a fenced block, with a sentence around
 * it, and the visitor is handed the link. Opening the issue is the signature.
 * `.github/workflows/mark.yml` reads it, and `scripts/mark.ts` calls
 * `decide()` through the identity's handler with the account as the deciding
 * hand and the workflow as the writing one.
 *
 * This module is the shape both ends agree on, and nothing else: what the
 * page composes is what the writer reads back, and one test holds the two
 * together. It has no dependencies, so the page and the script share it.
 */

/** Where the record lives. The issue is opened against this repository. */
export const RECORD_REPO = 'Prometheus-000/strata'

/** The title's first word. The workflow runs on issues that start with it and on no others. */
export const MARK_TITLE = 'mark'

/** What the page posts to the dev server, and what it puts in an issue: one shape for both roads. */
export interface PostedMark {
  request: { kind: 'deviation'; file: 'identity.html'; line: number; value: string }
  decided: 'human'
  written: 'human'
  via: 'identity'
}

const FILE = 'identity.html'

export const postedMark = (line: number, value: string): PostedMark => ({
  request: { kind: 'deviation', file: FILE, line, value },
  decided: 'human',
  written: 'human',
  via: 'identity',
})

const PLACE = /^\d(?:\.\d+)?,\d(?:\.\d+)?$/

/** The issue a mark becomes: a title the workflow can gate on, and a body with the request in a fenced block. */
export function markIssue(posted: PostedMark): { title: string; body: string } {
  const { value } = posted.request
  return {
    title: `${MARK_TITLE} ${value}`,
    body: [
      `A mark on the field at ${value}, made on the published site.`,
      '',
      'Opening this issue signs it: the workflow puts the mark on the record with this account as the hand that chose, and answers here with the decision’s id. Nothing else in this issue is read.',
      '',
      '```json',
      JSON.stringify(posted),
      '```',
    ].join('\n'),
  }
}

/** The link the page hands a visitor: GitHub's new-issue form, prefilled. */
export function signUrl(posted: PostedMark, repo = RECORD_REPO): string {
  const { title, body } = markIssue(posted)
  const q = new URLSearchParams({ title, body })
  return `https://github.com/${repo}/issues/new?${q.toString()}`
}

/**
 * The mark an issue carries, or undefined when it carries none. Strict on
 * purpose: the block must be the posted shape, a deviation on the identity's
 * own surface, with a place for a value. The writer mounts only the
 * identity's handler, and this is the other half of the same narrowness — an
 * issue can put a mark on the field and can do nothing else to the record.
 */
export function parseMarkIssue(body: string): PostedMark | undefined {
  const m = /```json\s*\n([\s\S]*?)\n\s*```/.exec(body)
  if (!m) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(m[1])
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const p = parsed as Partial<PostedMark> & { request?: Partial<PostedMark['request']> }
  const r = p.request
  if (!r || r.kind !== 'deviation' || r.file !== FILE) return undefined
  if (typeof r.line !== 'number' || !Number.isInteger(r.line) || r.line < 1) return undefined
  if (typeof r.value !== 'string' || !PLACE.test(r.value)) return undefined
  if (p.decided !== 'human' || p.written !== 'human' || p.via !== 'identity') return undefined
  return postedMark(r.line, r.value)
}
