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
export type RuleScope = 'system' | 'product'

export interface Rule {
  id: string
  authority: Exclude<Authority, 'precedent'>
  /** Defaults to `system` — a rule says so when it is only this product's. */
  scope?: RuleScope
  /**
   * The layer it governs, when it governs one. Defaults to the prefix its id
   * carries, which is how most rules say it: `layer0.semantic-names-only`
   * needs no field. A rule whose id was named before the layers existed, or
   * whose subject is the record rather than the artifact, says so here or
   * says nothing and sits outside the stack.
   */
  layer?: string
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

export const scopeOf = (r: Rule): RuleScope => r.scope ?? 'system'

/**
 * A LAYER — what governance a tier carries, as data.
 *
 * This is here because the hub used to hand-write the layer table in JSX and it
 * drifted precisely as `knowledge.drift-by-transcription` predicts: the copy
 * went on claiming the old validator enforced Layer 0, and that undeclared drift
 * failed CI, long after both had stopped being true. A layer's character is a
 * claim about governance, so it lives with the rules and is projected into
 * anything that displays it.
 */
export interface Layer {
  /** The prefix its rules carry: `layer0` matches `layer0.semantic-names-only`. */
  id: string
  name: string
  /** What the layer is, in a sentence. */
  what: string
  /** How it is governed, as the line the table prints. */
  governance: string
}

export const RULES_PATH = 'grammar/rules.json'

export function loadRules(root: string): Rule[] {
  const p = path.join(root, RULES_PATH)
  if (!fs.existsSync(p)) return []
  const parsed = JSON.parse(fs.readFileSync(p, 'utf8')) as { rules?: unknown; layers?: unknown }
  const rules = Array.isArray(parsed.rules) ? (parsed.rules as Rule[]) : []
  const layers = Array.isArray(parsed.layers) ? (parsed.layers as Layer[]) : []
  const known = new Set(layers.map((l) => l.id))
  const problems = rules.flatMap(problemsWithRule)
  // A declared layer is a citation like any other: it resolves or it is a ghost.
  for (const r of rules) if (r.layer !== undefined && !known.has(r.layer)) problems.push(`${r.id}: layer "${r.layer}" is not one of the layers`)
  if (problems.length) throw new Error(`${RULES_PATH}: ${problems.join('; ')}`)
  return rules
}

export function loadLayers(root: string): Layer[] {
  const p = path.join(root, RULES_PATH)
  if (!fs.existsSync(p)) return []
  const parsed = JSON.parse(fs.readFileSync(p, 'utf8')) as { layers?: unknown }
  const layers = Array.isArray(parsed.layers) ? (parsed.layers as Layer[]) : []
  const problems = layers.flatMap(problemsWithLayer)
  if (problems.length) throw new Error(`${RULES_PATH}: ${problems.join('; ')}`)
  return layers
}

export function problemsWithLayer(l: unknown): string[] {
  if (typeof l !== 'object' || l === null) return ['a layer is not an object']
  const x = l as Record<string, unknown>
  const p: string[] = []
  if (typeof x.id !== 'string' || !x.id) p.push('a layer has no id')
  for (const k of ['name', 'what', 'governance']) if (typeof x[k] !== 'string' || !x[k]) p.push(`${String(x.id)}: ${k} is missing`)
  return p
}

/** The layer a rule governs: what it declares, else the prefix its id carries. */
export const layerOf = (r: Rule, layers: readonly Layer[]): string | undefined => r.layer ?? layers.find((l) => r.id.startsWith(`${l.id}.`))?.id

export const rulesInLayer = (rules: readonly Rule[], layer: Layer, layers: readonly Layer[] = [layer]): Rule[] => rules.filter((r) => layerOf(r, layers) === layer.id)

/**
 * The rules that govern no layer. Not a leftover: the record's own rules, the
 * ones about how evaluation works, and what this product decided about its
 * voice are all real rules with no tier of the artifact to sit in. They are
 * returned rather than dropped, because a table that silently omits two rules
 * in three is worse than no table — the hub showed a layer stack of thirteen
 * rules while the grammar held thirty-four, and the four the Machine row
 * exists to describe were among the missing.
 */
export const rulesOutsideLayers = (rules: readonly Rule[], layers: readonly Layer[]): Rule[] => rules.filter((r) => layerOf(r, layers) === undefined)

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

export const byScope = (rules: readonly Rule[], scope: RuleScope): Rule[] => rules.filter((r) => scopeOf(r) === scope)

/** A preference's number, or the default when the grammar does not say. */
export function preference<T>(rules: readonly Rule[], id: string, fallback: T): T {
  const r = rules.find((x) => x.id === id && x.authority === 'preference')
  return r && r.value !== undefined ? (r.value as T) : fallback
}
