/**
 * THE GRAMMAR AS DATA — rules with reasons, each carrying the authority it
 * has. GRAMMAR.md stays the prose people read; `grammar/rules.json` is the
 * index a check runs from and a skill cites.
 *
 *   invariant    a mechanical truth about the artifact. The only class a
 *                build fails on. Never a design judgement.
 *   policy       a rule of the system. Evaluated and reported, never enforced.
 *   preference   a leaning, with its number. "We generally prefer…"
 *   knowledge    what was learned, with its source. "Historically…"
 *   precedent    what the record shows. Computed, never declared here.
 *
 * These do not carry the same authority, and a report says which it is
 * speaking with.
 */
import fs from 'node:fs'
import path from 'node:path'

export type Authority = 'invariant' | 'policy' | 'preference' | 'knowledge' | 'precedent'
export const AUTHORITIES: readonly Authority[] = ['invariant', 'policy', 'preference', 'knowledge', 'precedent']

/**
 * Whose rule it is. `system` rules are Strata's own — the layers, the record,
 * the way evaluation works — and an adopter inherits them. `product` rules are
 * one product's taste, shipped here as a worked example and expected to be
 * replaced. The distinction is not decoration: a reader who cannot tell them
 * apart reads this product's preference for two radii as the system's law.
 */
export type Scope = 'system' | 'product'

export interface Rule {
  id: string
  authority: Exclude<Authority, 'precedent'>
  /** Defaults to `system` — a rule says so when it is only this product's. */
  scope?: Scope
  statement: string
  reason: string
  incident?: string
  /** Where the prose lives. */
  source: string
  /**
   * The evaluator that speaks for it. `none` says, out loud, that no
   * evaluator can: the rule is cited into skills and read by a hand, and
   * `check` reports it as cited rather than passing over it in silence.
   */
  check?: string
  /** A preference's number. */
  value?: unknown
}

/** A rule nothing can evaluate — stated, so silence is never mistaken for a pass. */
export const isCitedOnly = (r: Rule) => r.check === undefined || r.check === 'none'

export const scopeOf = (r: Rule): Scope => r.scope ?? 'system'

export const RULES_PATH = 'grammar/rules.json'

export function loadRules(root: string): Rule[] {
  const p = path.join(root, RULES_PATH)
  if (!fs.existsSync(p)) return []
  const parsed = JSON.parse(fs.readFileSync(p, 'utf8')) as { rules?: unknown }
  const rules = Array.isArray(parsed.rules) ? (parsed.rules as Rule[]) : []
  const problems = rules.flatMap(problemsWithRule)
  if (problems.length) throw new Error(`${RULES_PATH}: ${problems.join('; ')}`)
  return rules
}

export function problemsWithRule(r: unknown): string[] {
  if (typeof r !== 'object' || r === null) return ['a rule is not an object']
  const x = r as Record<string, unknown>
  const p: string[] = []
  if (typeof x.id !== 'string' || !x.id) p.push('a rule has no id')
  const id = String(x.id)
  if (!['invariant', 'policy', 'preference', 'knowledge'].includes(String(x.authority))) p.push(`${id}: authority must be invariant, policy, preference or knowledge`)
  for (const k of ['statement', 'reason', 'source']) if (typeof x[k] !== 'string' || !x[k]) p.push(`${id}: ${k} is missing`)
  if (x.authority === 'preference' && x.value === undefined) p.push(`${id}: a preference carries its value`)
  if (x.scope !== undefined && x.scope !== 'system' && x.scope !== 'product') p.push(`${id}: scope is system or product`)
  if (x.authority !== 'invariant' && x.check === undefined)
    p.push(`${id}: say which evaluator speaks for this rule, or "check": "none" — a rule nothing evaluates is cited, and check says so`)
  return p
}

export const rulesFor = (rules: readonly Rule[], ids: readonly string[]): Rule[] =>
  ids.map((id) => rules.find((r) => r.id === id)).filter((r): r is Rule => !!r)

export const byAuthority = (rules: readonly Rule[], authority: Authority): Rule[] => rules.filter((r) => r.authority === authority)

export const byScope = (rules: readonly Rule[], scope: Scope): Rule[] => rules.filter((r) => scopeOf(r) === scope)

/** A preference's number, or the default when the grammar does not say. */
export function preference<T>(rules: readonly Rule[], id: string, fallback: T): T {
  const r = rules.find((x) => x.id === id && x.authority === 'preference')
  return r && r.value !== undefined ? (r.value as T) : fallback
}
