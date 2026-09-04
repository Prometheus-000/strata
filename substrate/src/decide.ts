/**
 * DECIDE — the one way anything changes.
 *
 *   human ─┐
 *          ├──► decide(request, { decided, written, via }) ──► handler applies ──► log appends
 *   agent ─┘
 *
 * A pointer in the overlay, a command in a terminal, an agent's shell: each
 * builds a request and says both who chose and whose hand wrote, and nothing
 * else about them differs. The substrate knows how to record; it does not know how to
 * cut a token or rewrite JSX. Those are projections, and each projection
 * registers a handler for the kinds it owns. The handler applies the change
 * (or refuses it, by name), returns the canonical body of what happened and
 * the facts it already had, and this module writes the line.
 *
 * Order: read the log → apply → append.
 *
 * The record holds the change and who made it. That is the whole of its job,
 * and the boundary is worth stating because it is easy to talk past: a
 * refusal changed nothing, so it is not a ruling, and putting attempts on the
 * record would turn a thing a person can read end to end into a log nobody
 * reads — the same argument `record.use-is-not-decision` makes about ordinary
 * token use. What was *tried* is the harness's business: the refusal is
 * returned, printed, and sits in the session that provoked it.
 *
 * The exception is narrow and deliberate. When a projection refuses something
 * it can still *name* — a request against a known target, declined on grounds
 * a hand might revisit — it returns a body, and the attempt is appended with
 * `consequence.refused` and no state change. Most refusals return a bare
 * string and are not recorded at all, which is correct: a malformed request
 * has no target to record it against.
 *
 * Nothing here evaluates anything: that is `explain`, `check` and `handoff`,
 * and they run when asked.
 */
import { newId, targetKey, type Consequence, type Decision, type DecisionBody, type Hand, type Kind } from './decision.ts'
import { append, current, pending, readAll } from './log.ts'

export interface DecideContext {
  /** Where the log lives. */
  root: string
  /** Who could have chosen otherwise. */
  decided: Hand
  /** Whose hand ran the command. */
  written: Hand
  /** The surface writing: 'cli' | 'overlay' | 'server' | a harness name. */
  via: string
  /** How `decided` and `written` were determined. Kept on the record. */
  because?: string
  at?: string
  /** For projections that also need a tree to edit — the app root, relative to `root`. */
  source?: string
  /** Apply nothing, append nothing; the handler still says what it would do. */
  dryRun?: boolean
}

/** What a handler sees: the context, with the id and time the decision will carry. */
export interface ResolvedContext extends DecideContext {
  id: string
  at: string
}

/** A projection's input vocabulary is its own; the substrate asks only for a kind and a reason. */
export interface Request {
  kind: Kind
  reason?: string
  [k: string]: unknown
}

export interface Applied {
  /** The canonical body of what happened — a move's input names a container; its record names file:line. */
  body: DecisionBody
  consequence?: Consequence
  written?: string[]
  /** Nothing changed because it was already so. Recorded, so the attempt is visible, but not as a refusal. */
  unchanged?: boolean
}

export interface Refused {
  refused: string
  /** When the target is known, the refusal is logged against it. Omit and it is only returned. */
  body?: DecisionBody
}

export type Handler<R extends Request = Request> = (req: R, ctx: ResolvedContext, log: readonly Decision[]) => Applied | Refused

export type DecideResult =
  | { ok: true; decision: Decision; written: string[]; unchanged?: boolean }
  | { ok: false; error: string; decision?: Decision }

const handlers = new Map<Kind, Handler>()

export function registerHandler<R extends Request>(kind: R['kind'], h: Handler<R>): void {
  handlers.set(kind, h as Handler)
}

export const handlerFor = (kind: Kind) => handlers.get(kind)
export const registeredKinds = () => [...handlers.keys()]

/** For tests and for a host that mounts a different set of projections. */
export function resetHandlers(): void {
  handlers.clear()
  registerBuiltins()
}

export function decide(req: Request, ctx: DecideContext): DecideResult {
  const handler = handlers.get(req.kind)
  if (!handler) return { ok: false, error: `no projection handles "${req.kind}" here — registered: ${registeredKinds().join(', ') || 'none'}` }
  const at = ctx.at ?? new Date().toISOString()
  const resolved: ResolvedContext = { ...ctx, at, id: newId(Date.parse(at)) }
  const log = readAll(ctx.root)

  let outcome: Applied | Refused
  try {
    outcome = handler(req, resolved, log)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  const finish = (body: DecisionBody, consequence: Consequence, unchanged?: boolean): Decision => ({
    ...body,
    id: resolved.id,
    at,
    decided: ctx.decided,
    written: ctx.written,
    via: ctx.via,
    ...(ctx.because ? { because: ctx.because } : {}),
    ...(req.reason ? { reason: req.reason } : {}),
    ...(supersedesOf(log, body) ?? {}),
    consequence: unchanged ? { ...consequence, note: consequence.note ?? 'already so — nothing written' } : consequence,
  })

  if ('refused' in outcome) {
    if (!outcome.body) return { ok: false, error: outcome.refused }
    const decision = finish(outcome.body, { refused: outcome.refused })
    if (!ctx.dryRun) append(ctx.root, decision)
    return { ok: false, error: outcome.refused, decision }
  }

  // A dry run applied nothing, so it wrote nothing, whatever the handler would have.
  const written = ctx.dryRun ? [] : (outcome.written ?? [])
  const decision = finish(outcome.body, { ...(outcome.consequence ?? {}), ...(written.length ? { written } : {}) }, outcome.unchanged)
  if (!ctx.dryRun) append(ctx.root, decision)
  return { ok: true, decision, written, ...(outcome.unchanged ? { unchanged: true } : {}) }
}

const supersedesOf = (log: readonly Decision[], body: DecisionBody): { supersedes: string } | undefined => {
  const prev = current(log).get(targetKey(body))
  return prev ? { supersedes: prev.id } : undefined
}

/* ---- built in: the handoff records only ---- */

function registerBuiltins() {
  registerHandler<Request & { kind: 'ready' }>('ready', (_req, _ctx, log) => ({
    body: { kind: 'ready' },
    consequence: { affected: pending(log).length },
  }))
}
registerBuiltins()
