/**
 * EVIDENCE — what the system found out about a decision, when asked.
 *
 * The write path records; this computes. Contrast, consumers, duplicate
 * roles, convergence: each is an evaluator a projection registers for the
 * kinds it can speak about, and `evaluate()` runs them for one decision when
 * `explain`, `check` or the handoff wants the EVIDENCE block. A repo-wide
 * evaluator returns findings for `check`, each under the rule it speaks for
 * and with that rule's authority — so the report says whether it is stating
 * an invariant, a policy, a preference, what was learned, or what the record
 * shows.
 */
import type { Decision, Kind } from './decision.ts'
import type { Fact } from './format.ts'
import { loadRules, type Authority, type Rule } from './grammar.ts'
import { current, readAll } from './log.ts'

export interface Finding {
  /** The rule this speaks for; a computed finding names the evaluator. */
  rule: string
  authority: Authority
  message: string
  /** file:line, a token, a target key. */
  where?: string
  /** The decision it is about, when one. */
  decision?: string
  facts?: Fact[]
}

export interface EvalContext {
  root: string
  log: readonly Decision[]
  current: Map<string, Decision>
  rules: readonly Rule[]
}

export interface Evaluator {
  id: string
  /** Decision kinds it can give evidence about. */
  kinds?: Kind[]
  /** Evidence about one decision. */
  evidence?: (d: Decision, ctx: EvalContext) => Fact[]
  /** Repo-wide findings. */
  findings?: (ctx: EvalContext) => Finding[]
}

const evaluators = new Map<string, Evaluator>()
export const registerEvaluator = (e: Evaluator) => evaluators.set(e.id, e)
export const resetEvaluators = () => evaluators.clear()
export const registeredEvaluators = () => [...evaluators.keys()]

export function evalContext(root: string, log: readonly Decision[] = readAll(root)): EvalContext {
  return { root, log, current: current(log), rules: loadRules(root) }
}

/** Every fact every registered evaluator has about this decision. */
export function evaluate(d: Decision, ctx: EvalContext): Fact[] {
  const facts: Fact[] = []
  for (const e of evaluators.values()) {
    if (!e.evidence || (e.kinds && !e.kinds.includes(d.kind))) continue
    for (const f of e.evidence(d, ctx)) facts.push(f.source ? f : { ...f, source: e.id })
  }
  return facts
}

/** Every finding every registered evaluator has about the product. */
export function findings(ctx: EvalContext): Finding[] {
  const out: Finding[] = []
  for (const e of evaluators.values()) if (e.findings) out.push(...e.findings(ctx))
  return out
}

/** The authority a rule id carries, from the grammar; an unknown rule speaks as precedent (computed). */
export const authorityOf = (rules: readonly Rule[], ruleId: string): Authority => rules.find((r) => r.id === ruleId)?.authority ?? 'precedent'
