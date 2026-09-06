/**
 * THE IDENTITY AS A PROJECTION WITH A HANDLER.
 *
 * A click on the field is a decision: a deviation, declared against the
 * identity's own surface (`identity.html`), whose value is the place the hand
 * chose. It goes through the same door as everything else — `decide()`, from
 * the page over the dev server's one write endpoint, or from a shell — and it
 * lands on the record with two hands and a time.
 *
 * The theme's deviation handler writes a `deviation:` comment beside a
 * literal in a source file. A mark on the field has no literal to sit
 * beside, so this handler answers for `IDENTITY_FILE` itself: it validates
 * the place, writes nothing, and hands every other file back to whatever
 * handled deviations before it was registered. Where nothing did, a
 * deviation on a real file is refused with that sentence rather than
 * quietly accepted without its comment.
 *
 * Provenance, as this handler sees it. A pointer is a hand, and the dev
 * server says so; but a pointer on a public page is a hand nobody named, and
 * the record does not take one. A mark from the published site arrives
 * through `scripts/mark.ts` instead, with the GitHub account that signed the
 * issue as the deciding hand and the workflow as the writing one — the
 * account's name and nothing else about the person. This handler cannot see
 * which road a request took, so it notes the one thing it can: whether the
 * hand that chose was named.
 */
import { handlerFor, registerHandler, type Applied, type Handler, type Refused, type Request } from '@strata/substrate/decide'
import { IDENTITY_FILE, parseMark } from '@strata/identity/record'

export type MarkRequest = Request & { kind: 'deviation'; file: string; line: number; value?: string }

export function registerIdentity(): void {
  const prior = handlerFor('deviation') as Handler<MarkRequest> | undefined
  registerHandler<MarkRequest>('deviation', (req, ctx, log): Applied | Refused => {
    if (req.file !== IDENTITY_FILE) {
      if (prior) return prior(req, ctx, log)
      return { refused: `no projection handles a deviation on ${String(req.file)} here — the identity answers only for ${IDENTITY_FILE}` }
    }
    if (!Number.isInteger(req.line) || req.line < 1) return { refused: 'a mark on the field names its line: the count of marks before it, plus one' }
    const place = typeof req.value === 'string' ? parseMark(req.value) : undefined
    if (!place) return { refused: 'a mark on the field is a place in the unit square — "x,y", each 0 to 1' }
    const named = ctx.decided.actor ? '' : '; the hand that chose is not named'
    return {
      body: { kind: 'deviation', file: IDENTITY_FILE, line: req.line, value: req.value as string },
      consequence: { note: `a mark on the field at ${req.value}; the identity draws it, and no file was written${named}` },
      written: [],
    }
  })
}
