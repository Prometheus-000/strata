/**
 * CHECK — "here is what happened", and EXPLAIN — one decision, as a glass box.
 *
 *   EVALUATION    here is what happened            exit 0, always
 *   ENFORCEMENT   this cannot ship                  exit 1, only with --enforce,
 *                                                   only for an invariant
 *
 * An invariant is a mechanical truth about the artifact: the record parses,
 * the projections match it, every fallback chain ends, every var() resolves.
 * A build fails on those and on nothing else — never because a design is
 * different. Everything else is reported under the authority it carries:
 * policy, preference, knowledge, precedent. Nothing here runs while someone
 * is designing; it runs when asked.
 */
import { targetKey, type Decision } from './decision.ts'
import { authorityOf, evalContext, evaluate, findings as allFindings, registeredEvaluators, type EvalContext, type Finding } from './evidence.ts'
import { describe, formatDecision, formatHandoff, type Fact } from './format.ts'
import { AUTHORITIES, byAuthority, type Authority } from './grammar.ts'
import { byId, collapseReversals, current, history, parseLog, pending, readAll, since, LOG_PATH } from './log.ts'
import { buildIndex, search, valueText, PROMOTION_CANDIDATE_AT } from './precedent.ts'
import { preference } from './grammar.ts'
import { rebuild, registeredProjections } from './projection.ts'
import fs from 'node:fs'
import path from 'node:path'

export interface InvariantResult {
  rule: string
  ok: boolean
  findings: Finding[]
}

export interface CheckReport {
  decisions: number
  invariants: InvariantResult[]
  /** Everything that is not an invariant, in the order found. */
  findings: Finding[]
  pending: Decision[]
  ready: Decision | null
}

const BUILT_IN = new Set(['record.parses', 'projections.match-record'])

export function runCheck(root: string): CheckReport {
  // The one invariant that gates the others: a record that does not parse cannot be checked.
  let log: Decision[]
  try {
    const p = path.join(root, LOG_PATH)
    log = fs.existsSync(p) ? parseLog(fs.readFileSync(p, 'utf8')) : []
  } catch (err) {
    const f: Finding = { rule: 'record.parses', authority: 'invariant', message: err instanceof Error ? err.message : String(err) }
    return { decisions: 0, invariants: [{ rule: 'record.parses', ok: false, findings: [f] }], findings: [], pending: [], ready: null }
  }
  const ctx = evalContext(root, log)
  const found = allFindings(ctx)

  // Projections must be what the record says.
  const projections = registeredProjections().length ? rebuild(root, { dryRun: true }) : { changed: [] as string[] }
  for (const file of projections.changed)
    found.push({ rule: 'projections.match-record', authority: 'invariant', where: file, message: `${file} differs from what the record projects — strata rebuild` })

  const invariants: InvariantResult[] = byAuthority(ctx.rules, 'invariant').map((r) => {
    const mine = found.filter((f) => f.rule === r.id)
    const spoken = BUILT_IN.has(r.check ?? r.id) || registeredEvaluators().includes(r.check ?? r.id)
    if (!spoken) mine.push({ rule: r.id, authority: 'invariant', message: `no evaluator here can speak for ${r.id} (${r.check ?? 'no check named'})` })
    return { rule: r.id, ok: mine.length === 0, findings: mine }
  })
  if (!invariants.some((i) => i.rule === 'record.parses')) invariants.unshift({ rule: 'record.parses', ok: true, findings: [] })
  const known = new Set(invariants.map((i) => i.rule))
  const rest = found.filter((f) => !(f.authority === 'invariant' && known.has(f.rule)))

  const open = pending(log)
  return {
    decisions: log.length,
    invariants,
    findings: rest.map((f) => ({ ...f, authority: f.authority ?? authorityOf(ctx.rules, f.rule) })),
    pending: collapseReversals(open),
    ready: since(log, 'ready').length === 0 ? (current(log).get('ready') ?? null) : null,
  }
}

export const enforced = (r: CheckReport) => r.invariants.every((i) => i.ok)

const RULE = '──────────────'

export function formatCheck(r: CheckReport): string {
  const out: string[] = ['', 'INVARIANTS', RULE]
  for (const i of r.invariants) {
    out.push(`${i.ok ? '✓' : '✗'} ${i.rule}${i.rule === 'record.parses' && i.ok ? ` — ${r.decisions} decision(s)` : ''}`)
    for (const f of i.findings) out.push(`    ${f.where ? `${f.where}  ` : ''}${f.message}`)
  }
  out.push('')
  for (const a of AUTHORITIES.filter((x): x is Exclude<Authority, 'invariant'> => x !== 'invariant')) {
    const fs = r.findings.filter((f) => f.authority === a)
    if (!fs.length) continue
    out.push(a.toUpperCase(), RULE)
    for (const f of fs) {
      out.push(`${f.rule}${f.where ? `  ${f.where}` : ''}`)
      out.push(`    ${f.message}`)
      for (const fact of f.facts ?? []) out.push(`      ${fact.name}: ${String(fact.value)}`)
    }
    out.push('')
  }
  out.push('HANDOFF', RULE, formatHandoff(r.pending, r.ready).trimEnd(), '')
  out.push(enforced(r) ? 'every invariant holds; the rest is evaluation, and none of it blocks anything' : 'an invariant does not hold — the artifact cannot be produced faithfully from the record', '')
  return out.join('\n')
}

/* ---------------- explain ---------------- */

export interface Explanation {
  decision: Decision
  history: Decision[]
  context: Fact[]
  evidence: Fact[]
}

/** The CONTEXT block: what the record itself knows about the target, before any projection speaks. */
export function contextFor(d: Decision, ctx: EvalContext): Fact[] {
  const key = targetKey(d)
  const past = history(ctx.log, key)
  const facts: Fact[] = [{ name: 'target', value: key, source: 'record' }]
  const before = past.filter((x) => x.at < d.at)
  facts.push({ name: 'decisions on this target before it', value: before.length, source: 'record' })
  const prev = d.supersedes ? byId(ctx.log, d.supersedes) : undefined
  if (prev) facts.push({ name: 'superseded', value: describe(prev), source: 'record' })
  const later = past.filter((x) => x.at > d.at)
  if (later.length) facts.push({ name: 'since superseded by', value: describe(later[later.length - 1]), source: 'record' })
  const index = buildIndex(ctx.log)
  const candidateAt = preference(ctx.rules, 'promotion.candidate-at', PROMOTION_CANDIDATE_AT)
  const q =
    d.kind === 'override' ? { property: d.property, value: valueText(d) } : d.kind === 'prop' ? { property: d.prop, value: valueText(d) } : d.kind === 'token' ? { token: d.token } : d.kind === 'move' ? { component: d.region } : null
  if (q) {
    const r = search(index, q, { candidateAt })
    const others = r.decisions.filter((x) => x.id !== d.id)
    if (others.length) facts.push({ name: 'precedent', value: `${others.length} other decision(s) about the same thing`, source: 'precedent' })
    for (const line of r.lines.slice(0, 3)) facts.push({ name: 'convergence', value: line, source: 'precedent' })
  }
  return facts
}

export function explain(root: string, idOrKey: string): Explanation | null {
  const log = readAll(root)
  const d = byId(log, idOrKey) ?? current(log).get(idOrKey) ?? history(log, idOrKey).at(-1)
  if (!d) return null
  const ctx = evalContext(root, log)
  return { decision: d, history: history(log, targetKey(d)), context: contextFor(d, ctx), evidence: evaluate(d, ctx) }
}

export function formatExplanation(e: Explanation): string {
  const out = [formatDecision(e.decision, { context: e.context, evidence: e.evidence })]
  if (e.history.length > 1) {
    out.push('HISTORY', RULE)
    for (const h of e.history) out.push(`${h.id === e.decision.id ? '●' : '·'} ${h.at.slice(0, 16)}  ${describe(h)}${h.consequence.refused ? '  (refused)' : ''}`)
    out.push('')
  }
  return out.join('\n')
}
